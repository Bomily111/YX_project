import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const input=process.argv[2]||'docs/verification/2026-11-17-location-online/report.json'
const output=process.argv[3]||'docs/verification/2026-11-17-location-evidence-audit.json'
const bytes=await readFile(input),report=JSON.parse(bytes)
const manifest=JSON.parse(await readFile('public/data/task-asset-manifest.json','utf8'))
const audited={passed:false,report:input,reportDigest:createHash('sha256').update(bytes).digest('hex'),scope:'record-source-consistency-not-engineering-acceptance',observations:[],sources:[]}
if(!report.passed)throw Error('Input page report did not pass')
const paths=new Set()
for(const entry of report.cases??[]){
 if(!entry.locationEvidence)continue
 const row=entry.supportLayout?.row
 if(!row||!entry.locationEvidence.length)throw Error('Missing independent placement row or interaction observations')
 for(const evidence of entry.locationEvidence){
  if(evidence.taskId!==entry.taskId||evidence.resourceId!==row.resourceId||evidence.rowId!==row.id||evidence.component!==row.component)throw Error('Evidence identity differs from actual task placement')
  if(!row.offsetsM.some(offset=>Math.abs(offset-evidence.offsetM)<1e-9))throw Error('Recorded offset is not an actual placement station')
  if(!['2d','3d'].includes(evidence.source)||evidence.evidenceType!=='assembly-station-visit'||evidence.engineeringAcceptance!=='not-verified')throw Error('Evidence type or acceptance is invalid')
  for(const path of evidence.assetPaths){if(!entry.assets.includes(path))throw Error('Evidence path absent from actual task asset snapshot');paths.add(path)}
  audited.observations.push({taskId:entry.taskId,rowId:row.id,offsetM:evidence.offsetM,source:evidence.source,sequence:evidence.sequence})
 }
}
if(!audited.observations.length)throw Error('No location evidence found')
for(const path of paths){
 const expected=manifest.assets.find(item=>item.path===path)
 if(!expected)throw Error(`Source is not in task asset manifest: ${path}`)
 const digest=createHash('sha256').update(await readFile(`public${path}`)).digest('hex')
 if(digest!==expected.digest)throw Error(`Source differs from task manifest: ${path}`)
 audited.sources.push({path,algorithm:'sha256-bytes-v1',digest})
}
audited.passed=true
await writeFile(output,JSON.stringify(audited,null,2)+'\n')
console.log(JSON.stringify({passed:true,observations:audited.observations.length,sources:audited.sources.length,output}))
