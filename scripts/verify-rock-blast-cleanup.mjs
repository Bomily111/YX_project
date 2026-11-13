import {chromium} from 'playwright-core'
import fs from 'node:fs/promises'
const out=process.env.CLEANUP_OUTPUT||'docs/verification/2026-11-11-rock-blast-cleanup'
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={cases:[],errors:[],modules:[],passed:false}
let page
const state=()=>page.evaluate(async()=>{
 const d=await import('/src/utils/Common/DrawLine.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{getBlastModel}=await import('/src/views/tunnel-module/blast.ts'),v=viewerService.require()
 return {focused:d.getFocusedTunnelSegment(),loaded:d.getLoadedTunnelSegmentIndices(),enabled:d.isDesignRockGradeModelEnabled(),labels:v.entities.values.filter(e=>String(e.id).startsWith('design-rock-grade-')).length,colored:Array.from({length:17},(_,i)=>d.getTunnelGlbSegment(i)).filter(m=>m?.ready&&(Math.abs(m.color.red-1)>.001||Math.abs(m.color.green-1)>.001||Math.abs(m.color.blue-1)>.001)).length,blastReady:!!getBlastModel()?.ready,viewerId:v.container.dataset.viewerInstanceId,renderError:document.querySelector('.cesium-widget-errorPanel')?.textContent||''}
})
try{
 for(const mode of ['normal','pending-request','early-exit']){
  const quick=mode==='pending-request',early=mode==='early-exit'
  page=await browser.newPage({viewport:{width:1440,height:1000}})
  page.on('pageerror',e=>report.errors.push(e.message))
  page.on('request',r=>{if(/\/(?:blast|DrawLine)\.ts/.test(r.url()))report.modules.push(r.url())})
  let requested=false
  if(quick)await page.route('**/data/tunnel/design-rock-grades.json',async route=>{requested=true;await new Promise(r=>setTimeout(r,1500));await route.continue()})
  await page.goto('http://localhost:5178/?scene=workface')
  const entry=early?page.locator('.header-center .tn-item').filter({hasText:/^开挖爆破$/}):page.getByRole('button').filter({hasText:'开挖爆破'})
  await entry.waitFor({timeout:120000})
  if(quick){while(!requested)await page.waitForTimeout(50)}
  else if(!early)await page.waitForFunction(async()=>{const d=await import('/src/utils/Common/DrawLine.ts');return d.isDesignRockGradeModelEnabled()&&!!d.getDesignRockGradeLabel(0)},{},{timeout:120000})
  if(mode==='normal')for(let n=0;n<120;n++){if((await state()).colored>0)break;await page.waitForTimeout(500)}
  const before=await state()
  if(mode==='normal'&&(!before.enabled||!before.labels||!before.colored))throw Error(`设计版前置状态未生效: ${JSON.stringify(before)}`)
  await entry.click()
  await page.waitForURL('**/blast-twin')
  await page.waitForFunction(async()=>{const {getBlastModel}=await import('/src/views/tunnel-module/blast.ts');return !!getBlastModel()?.ready},{},{timeout:120000})
  await page.waitForTimeout(3500)
  for(let n=0;n<120;n++){if((await state()).blastReady)break;await page.waitForTimeout(500)}
  const after=await state()
  report.cases.push({mode,before,after})
  await page.screenshot({path:`${out}/${mode}.png`})
  if(after.enabled||after.labels||after.colored||!after.blastReady||after.renderError||before.viewerId!==after.viewerId)throw Error(`围岩设计残留: ${JSON.stringify(after)}`)
  if(process.env.VERIFY_BLAST_SINGLE_SEGMENT==='1'){
   for(let n=0;n<120;n++){if((await state()).loaded.includes(0))break;await page.waitForTimeout(500)}
   const carrier=await state()
   if(carrier.focused!==0||JSON.stringify(carrier.loaded)!=='[0]')throw Error(`爆破页未只保留承载段: ${JSON.stringify(carrier)}`)
   report.cases.at(-1).carrier=carrier
   if(mode==='normal'){
    await page.getByRole('button').filter({hasText:'隧洞围岩'}).click()
    await page.waitForURL('**/?scene=workface')
    let restored
    for(let n=0;n<120;n++){restored=await state();if(restored.enabled&&restored.loaded.length>1)break;await page.waitForTimeout(500)}
    if(restored.focused!==null||!restored.enabled||restored.loaded.length<2)throw Error(`返回围岩未恢复加载: ${JSON.stringify(restored)}`)
    report.cases.at(-1).restored=restored
    await page.screenshot({path:`${out}/restored-rock.png`})
   }
  }
  console.log(`PASS rock→blast cleanup ${mode}`)
  await page.close()
 }
 if(report.errors.length)throw Error(report.errors.join('\n'))
 report.passed=true
}catch(e){report.failure=e.message;throw e}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
