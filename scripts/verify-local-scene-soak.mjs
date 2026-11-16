import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
const root=process.env.LOCAL_SOAK_OUTPUT_DIR||'docs/verification/2026-11-16-local-scene-soak'
const deadline=Number(process.env.LOCAL_SOAK_DEADLINE_MS)
if(!Number.isFinite(deadline)||deadline<=Date.now())throw Error('Set a future LOCAL_SOAK_DEADLINE_MS')
await mkdir(root,{recursive:true})
const report={startedAt:new Date().toISOString(),rounds:[],passed:false,scope:'real-form-assembly-and-local-tools-no-model-service'}
while(Date.now()+45000<deadline){
 const round=report.rounds.length+1,output=`${root}/round-${round}`,started=Date.now()
 const code=await new Promise(resolve=>{
   const child=spawn(process.execPath,['scripts/verify-task-layout-details.mjs'],{env:{...process.env,LAYOUT_DETAILS_OUTPUT_DIR:output},stdio:'inherit',windowsHide:true})
   const timer=setTimeout(()=>child.kill(),180000)
   child.on('error',()=>{clearTimeout(timer);resolve(1)})
   child.on('exit',code=>{clearTimeout(timer);resolve(code)})
 })
 let details
 try{details=JSON.parse(await readFile(`${output}/report.json`,'utf8'))}catch{}
 report.rounds.push({round,code,elapsedMs:Date.now()-started,report:`${output}/report.json`,checks:details?.checks?.length,modelRequests:details?.modelRequests})
 if(code!==0||!details?.passed||details.modelRequests!==0){report.failure=`Round ${round} failed`;break}
 await writeFile(`${root}/report.json`,JSON.stringify(report,null,2))
 console.log(`LOCAL SOAK round=${round} checks=${details.checks.length} modelRequests=${details.modelRequests}`)
}
report.finishedAt=new Date().toISOString();report.passed=!report.failure&&report.rounds.length>0
await writeFile(`${root}/report.json`,JSON.stringify(report,null,2))
if(!report.passed)process.exitCode=1
