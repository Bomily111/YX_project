"""按支护类型先判断构件存在，再分流；不读取或导入真值。"""
import json
import shutil
from pathlib import Path
from PIL import Image
from pdf_io import render_page
from pdf_export import save_json
from pdf_regions import find_arch_regions, local_ocr
from component_presence import pdf_text_records, detect_titles, summarize_presence, apply_steel_status
from extractor.steel_arch_pdf import infer_beta, collect_parameters
from visualize import visualize

def finish_parameters(result, arch_records, whole_records, betas, dpi):
    """不存在时直接返回，不调用参数提取器，也不将全页数字变成钢架参数。"""
    if not result['has_steel_arch']:
        return apply_steel_status(result)
    chosen, candidates = collect_parameters(arch_records, whole_records, betas, dpi)
    value = lambda key: chosen[key]['value'] if chosen[key] else None
    result.update(R1_mm=value('R1'), R2_mm=value('R2'), beta_deg=value('beta'),
                  beta_raw=chosen['beta']['raw'] if chosen['beta'] else None,
                  steel_profile=value('steel_profile'), evidence=chosen, parameter_candidates=candidates)
    return apply_steel_status(result)

def process_support(doc, infos, target, config, engines, run, dpi, source_pdf, reuse=None):
    """完成全部关联页面的存在性检查后，才启动钢架局部OCR与参数提取。"""
    whole_engine, local_engine = engines
    anchors, page_results, all_whole = [], [], []
    if not infos:
        raise RuntimeError(f'{target}没有确认关联页面，不能据此判定NOT_APPLICABLE')
    for info in infos:
        number = info['page']
        folder = run / f'page_{number:04d}'
        folder.mkdir()
        png = folder / 'page.png'
        cached = reuse / folder.name / 'page.png' if reuse else None
        if cached and cached.exists():
            shutil.copyfile(cached, png)
            image = Image.open(png).convert('RGB')
        else:
            image = render_page(doc[number-1], dpi, png)
        print(f'{target} 第{number}页：{dpi}DPI整页OCR及构件标题检查', flush=True)
        rows = [{**r,'page':number,'stage':'whole_page'} for r in whole_engine.recognize(image)]
        pdf_rows = pdf_text_records(doc[number-1], number, dpi)
        save_json(folder/'whole_ocr.json', rows)
        save_json(folder/'pdf_text_records.json', pdf_rows)
        found = detect_titles(rows+pdf_rows, image.size)
        anchors.extend(found)
        info_out = {'page':number,'support_type':target, 'contents':info['keywords'],
                    'presence_anchors':found, 'checked_sources':['pdf_text','whole_page_ocr'],
                    'image_size':list(image.size)}
        page_results.append(info_out)
        save_json(folder/'page_presence.json', info_out)
        if found:
            # 紧凑标题证据图，原始框同时保留在JSON，正式OCR仍使用高清原图。
            for i,a in enumerate(found):
                x0,y0,x1,y1 = a['anchor_bbox']
                image.crop((max(0,int(x0)-20),max(0,int(y0)-20),min(image.width,int(x1)+20),min(image.height,int(y1)+20))).save(folder/f'anchor_{i}.png')
        all_whole.extend(rows)
        image.close()
    presence = summarize_presence(anchors, [p['page'] for p in page_results])
    result = {'source_pdf':source_pdf, 'support_type':target, 'page_numbers':[p['page'] for p in page_results],
              'dpi':dpi, 'pages':page_results, 'beta_candidates':[], **presence}
    save_json(run/f'{target}_presence.json', result)
    all_local, betas = [], []
    if presence['has_steel_arch']:
        for number in presence['steel_arch_pages']:
            folder = run/f'page_{number:04d}'
            image = Image.open(folder/'page.png').convert('RGB')
            pdf_rows = json.loads((folder/'pdf_text_records.json').read_text(encoding='utf-8'))
            page_anchors = [a for a in presence['steel_arch_anchors'] if a['page']==number]
            # OCR标题优先；文本层用于OCR遗漏时的回退。find_arch_regions去除同位置重复框。
            page_anchors.sort(key=lambda a: a['source']!='whole_page')
            regions = find_arch_regions([a['record'] for a in page_anchors], image.size, config['arch_anchors'])
            save_json(folder/'arch_regions.json', regions)
            for index,region in enumerate(regions):
                roi = region['bbox']
                crop, local = local_ocr(image,local_engine,number,roi)
                crop.save(folder/f'arch_{index}.png',dpi=(dpi,dpi))
                save_json(folder/f'arch_{index}_ocr.json',local)
                display = [{**r,'box':[[x-roi[0],y-roi[1]] for x,y in r['box']]} for r in local]
                visualize(crop,display,folder/f'arch_{index}_visualized.png')
                # PDF文本层与局部OCR共同提供证据：前者没有置信度，后者保留置信度；
                # beta仍需通过R2中心线、下半区及左右对称关系筛选。
                x0,y0,x1,y1=roi
                pdf_in_roi=[]
                for row in pdf_rows:
                    points=row['box']
                    cx=sum(p[0] for p in points)/len(points);cy=sum(p[1] for p in points)/len(points)
                    if x0<=cx<=x1 and y0<=cy<=y1:
                        pdf_in_roi.append(row)
                combined_local = local + pdf_in_roi
                beta, candidates, geometry = infer_beta(
                    image, roi, combined_local, dpi, geometry_records=combined_local)
                save_json(folder/f'arch_{index}_beta.json',{'selected':beta,'candidates':candidates,'geometry':geometry})
                result['beta_candidates'].extend(candidates)
                if beta:
                    betas.append(beta)
                all_local.extend(combined_local)
                print(f'{target} 第{number}页钢架局部：beta={beta["value"] if beta else None}；{geometry["reason"]}',flush=True)
            image.close()
    result = finish_parameters(result, all_local, all_whole, betas, dpi)
    save_json(run/f'{target}_parameters.json', result)
    print(f"{target}: steel={result['steel_arch_status']}, rebar={result['rebar_status']}",flush=True)
    return result
