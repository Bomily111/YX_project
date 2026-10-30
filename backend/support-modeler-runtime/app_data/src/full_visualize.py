"""批量结果的最终关键字段可视化。"""
import os
import shutil
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont


def font(size=24):
    choices=[Path(os.environ.get("WINDIR","C:/Windows"))/"Fonts/msyh.ttc",
             Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]
    return next((ImageFont.truetype(str(path),size) for path in choices if path.exists()),ImageFont.load_default())


def annotate_steel(run,support_type,component,output):
    pages=component.get("source_pages",[])
    if not pages:
        return
    page=pages[0]
    folder=Path(run)/f"page_{page:04d}"
    regions_path=folder/"arch_regions.json"
    image_path=folder/"page.png"
    if not regions_path.exists() or not image_path.exists():
        return
    import json
    regions=json.loads(regions_path.read_text(encoding="utf-8"))
    if not regions:
        return
    roi=regions[0]["bbox"]
    image=Image.open(image_path).convert("RGB").crop(tuple(roi))
    draw=ImageDraw.Draw(image); text_font=font()
    colors={"R1_mm":"#dc2626","R2_mm":"#2563eb","beta_deg":"#16a34a","steel_profile":"#9333ea"}
    for field,item in component["fields"].items():
        if item.get("value") is None or item.get("source_page")!=page or not item.get("bbox"):
            continue
        x0,y0,x1,y1=item["bbox"]
        box=[x0-roi[0],y0-roi[1],x1-roi[0],y1-roi[1]]
        color=colors.get(field,"red")
        draw.rectangle(box,outline=color,width=4)
        label=f"{field}={item['value']}"
        draw.rectangle([box[0],max(0,box[1]-30),box[0]+max(180,len(label)*15),max(30,box[1])],fill="white",outline=color,width=2)
        draw.text((box[0]+3,max(0,box[1]-29)),label,fill=color,font=text_font)
    Path(output).parent.mkdir(parents=True,exist_ok=True)
    image.save(output)


def copy_rebar_visual(rebar_folder,output):
    source=Path(rebar_folder)/"visualized.png"
    if source.exists():
        Path(output).parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,output)

