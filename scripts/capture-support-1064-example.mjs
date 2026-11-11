import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
const root='public/support-modeler/outputs/centerline/'
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try{
 const page=await browser.newPage()
 await page.goto('http://localhost:5178/support-modeler/demo/real_tunnel_1064m_demo.html',{waitUntil:'domcontentloaded'})
 await page.waitForFunction(()=>window.realTunnelDemo?.ready,{},{timeout:180000})
 const captured=await page.evaluate(async()=>{
  const demo=window.realTunnelDemo
  const original=demo.getSummary()
  for(const key of Object.keys(original.componentVisibility))demo.setComponentVisible(key,true)
  const bytes=new Uint8Array(await demo.exportGlbBuffer());let binary=''
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768))
  return {bytes:btoa(binary),summary:original}
 })
 await fs.writeFile(root+'task-reference-1064.glb',Buffer.from(captured.bytes,'base64'))
 await fs.writeFile(root+'task-reference-1064.capture.json',JSON.stringify({sourcePage:'/support-modeler/demo/real_tunnel_1064m_demo.html',...captured.summary},null,2)+'\n')
 console.log({file:root+'task-reference-1064.glb',bytes:Buffer.from(captured.bytes,'base64').length,ready:captured.summary.ready})
}finally{await browser.close()}
