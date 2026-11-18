import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const input=process.argv[2]||'docs/verification/2026-11-17-r3-entry-normalized/report.json'
const output=process.argv[3]||'docs/verification/2026-11-17-r3-entry-normalized/asset-versions.json'
const raw=await readFile(input),report=JSON.parse(raw),tasks=[],baselines=new Map()
if(!report.passed||report.cases.length!==6)throw Error('Entry comparison incomplete')
for(const entry of report.cases){
 const taskId=entry.assembly.taskId,response=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${encodeURIComponent(taskId)}/snapshots`)
 if(!response.ok)throw Error(`Snapshot read failed ${response.status}`)
 const snapshots=await response.json(),snapshot=snapshots.filter(item=>item.workflow_state?.status==='completed'&&item.data_versions?.length).at(-1)
 if(!snapshot)throw Error('Completed asset snapshot missing')
 const signature=JSON.stringify(snapshot.data_versions.map(({sourceId,digest,algorithm})=>({sourceId,digest,algorithm})).sort((a,b)=>a.sourceId.localeCompare(b.sourceId)))
 if(baselines.has(entry.task.id)&&baselines.get(entry.task.id)!==signature)throw Error('Source asset versions differ between conditions')
 baselines.set(entry.task.id,signature)
 tasks.push({task:entry.task.id,condition:entry.condition,taskId,versions:snapshot.data_versions})
}
await writeFile(output,JSON.stringify({passed:true,input,inputDigest:createHash('sha256').update(raw).digest('hex'),scope:'completed-task-snapshots-not-current-file-hashes',tasks},null,2)+'\n')
console.log(JSON.stringify({passed:true,tasks:tasks.length,output}))
