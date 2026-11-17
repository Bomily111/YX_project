import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const input=process.argv[2]||'docs/verification/2026-11-17-r2-strategy-comparison-final/report.json'
const output=process.argv[3]||'docs/verification/2026-11-17-r2-strategy-comparison-final/asset-versions.json'
const raw=await readFile(input),report=JSON.parse(raw)
if(!report.passed)throw Error('Comparison did not pass')
const tasks=[]
for(const entry of report.cases.filter(item=>item.id.endsWith('-combined-local-context'))){
 const taskId=entry.before.identity.taskId
 const response=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${encodeURIComponent(taskId)}/snapshots`)
 if(!response.ok)throw Error(`Snapshot read failed ${response.status}`)
 const snapshots=await response.json()
 const snapshot=snapshots.filter(item=>item.workflow_state?.status==='completed'&&item.data_versions?.length).at(-1)
 if(!snapshot)throw Error('No completed task asset snapshot')
 const factorial=report.cases.find(item=>item.id===entry.id.replace('-combined-local-context','-factorial'))
 const states=factorial?factorial.conditions.map(item=>item.identity):[entry.before.identity,entry.supportOnly.identity,entry.after.identity]
 tasks.push({caseId:entry.id,taskId,conditions:factorial?factorial.conditions.map(item=>item.condition):['full-context','support-camera-only','clipping-and-local-context'],versions:snapshot.data_versions,
 sameSupportObject:states.every(state=>state.sameSupport),
 sameSupportTransform:states.every(state=>JSON.stringify(state.supportMatrix)===JSON.stringify(entry.before.identity.supportMatrix))})
}
if(tasks.length!==2||tasks.some(task=>!task.sameSupportObject||!task.sameSupportTransform))throw Error('Incomplete or inconsistent comparison')
const artifact={passed:true,input,inputDigest:createHash('sha256').update(raw).digest('hex'),scope:'actual-completed-task-versions-not-design-acceptance',tasks}
await writeFile(output,JSON.stringify(artifact,null,2)+'\n')
console.log(JSON.stringify({passed:true,tasks:tasks.length,versions:tasks.map(task=>task.versions.length),output}))
