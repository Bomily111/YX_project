import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
const output=process.env.ROCK_ENTRY_OUTPUT||'docs/verification/2026-11-11-rock-entry'
await fs.mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={cases:[],errors:[],passed:false}
let page
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}})
 page.on('pageerror',e=>report.errors.push(e.message))
 await page.goto('http://localhost:5178')
 await page.waitForFunction(async()=>{const {screenSpaceEventRegistry:r}=await import('/src/platform/input/ScreenSpaceEventRegistry.ts');return !!r.get('main.worksite-pick')},{},{timeout:120000})
 const state=()=>page.evaluate(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');const v=viewerService.require(),c=v.camera;return {p:[c.positionWC.x,c.positionWC.y,c.positionWC.z],flight:!!c._currentFlight,renderError:document.querySelector('.cesium-widget-errorPanel')?.textContent||''}})
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
 for(const [button,delay] of [['left',0],['right',100],['wheel',300],['left',2800]]){
  const home=page.getByRole('button').filter({hasText:/首页/});if(await home.count())await home.first().click()
  await page.waitForTimeout(2200)
  await page.locator('.header-center .tn-item').filter({hasText:/^隧洞围岩$/}).click()
  await page.waitForTimeout(delay)
  const before=await state()
  // Deliberately interact during the actual entry flight: no camera override.
  await page.mouse.move(800,400)
  if(button==='wheel')await page.mouse.wheel(0,-120)
  else{await page.mouse.down({button});for(let i=1;i<=5;i++){await page.mouse.move(800+i*4,400+i*2);await page.waitForTimeout(40)}await page.mouse.up({button})}
  const after=await state()
  await page.waitForTimeout(500)
  const settled=await state(),delta=distance(before.p,after.p),drift=distance(after.p,settled.p)
  report.cases.push({button,delay,before,after,delta,drift})
  if(after.renderError||settled.renderError||after.flight||drift>1||delta>2000)throw Error(`Entry interaction jumped or flight continued: ${JSON.stringify(report.cases.at(-1))}`)
  await page.screenshot({path:`${output}/${button}-${delay}.png`})
  console.log(`PASS entry ${button} at ${delay}ms: delta=${delta.toFixed(2)}m drift=${drift.toFixed(2)}m`)
 }
 if(report.errors.length)throw Error(report.errors.join('\n'))
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:output+'/failure.png',timeout:10000}).catch(()=>{});throw e}
finally{await fs.writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close()}
