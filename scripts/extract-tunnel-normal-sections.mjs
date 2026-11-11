import fs from 'node:fs'
import { section } from './extract-tunnel-excavation-profile.mjs'
const old=JSON.parse(fs.readFileSync('src/modules/face-sketch/tunnel-excavation-profile.json'))
const metadata=JSON.parse(fs.readFileSync('src/modules/rock/three-bench.metadata.json'))
const stations=[...new Map([...old.supportSections,...old.sections].map(s=>[s.gltfPlaneX,s])).values()].sort((a,b)=>a.gltfPlaneX-b.gltfPlaneX)
const centers=stations.map(s=>({x:s.gltfPlaneX,y:Math.min(...s.outline.map(p=>p[1]))+2.1,z:(Math.min(...s.outline.map(p=>p[0]))+Math.max(...s.outline.map(p=>p[0])))/2}))
function fit(key){
 const matrix=Array.from({length:3},(_,i)=>[...Array.from({length:3},(_,j)=>centers.reduce((sum,p)=>sum+(p.x-128)**(i+j),0)),centers.reduce((sum,p)=>sum+p[key]*(p.x-128)**i,0)])
 for(let i=0;i<3;i++){const scale=matrix[i][i];for(let j=i;j<4;j++)matrix[i][j]/=scale;for(let k=0;k<3;k++){if(k===i)continue;const factor=matrix[k][i];for(let j=i;j<4;j++)matrix[k][j]-=factor*matrix[i][j]}}
 return matrix.map(row=>row[3])
}
const y=fit('y'),z=fit('z'),value=(c,t)=>c[0]+c[1]*t+c[2]*t*t
const point=x=>[x,value(y,x-128),value(z,x-128)]
const residual=Math.max(...centers.map(p=>Math.hypot(value(y,p.x-128)-p.y,value(z,p.x-128)-p.z)))
if(residual>.005)throw Error(`Centerline fit residual ${residual} m exceeds 5 mm`)
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],normal=a=>a.map(x=>x/Math.hypot(...a))
const samples=[];let distance=0,previous=point(106)
for(let x=106;x<=152;x+=.01){const p=point(x);distance+=Math.hypot(...p.map((v,i)=>v-previous[i]));samples.push({x,s:distance});previous=p}
const anchor=samples.reduce((a,b)=>Math.abs(a.x-128)<Math.abs(b.x-128)?a:b).s
function frameAt(s){
 const target=s+anchor;let i=samples.findIndex(p=>p.s>=target)
 if(i<1)throw Error('Normal station outside source centerline')
 const a=samples[i-1],b=samples[i],x=a.x+(b.x-a.x)*(target-a.s)/(b.s-a.s)
 const forward=normal([1,y[1]+2*y[2]*(x-128),z[1]+2*z[2]*(x-128)])
 const lateral=normal(cross(forward,[0,1,0])),up=normal(cross(lateral,forward))
 if(Math.abs(dot(lateral,forward))>1e-10)throw Error('Nonorthogonal station frame')
 return {center:point(x),forward,lateral,up}
}
const sections=[],supportSections=[]
for(let s=0;s<=22;s++){const frame=frameAt(s);const result=section(frame.center[0],old.loopAreas[0],frame);sections.push({...result,distanceM:s});console.log(`Normal face ${s}`)}
for(let s=-20.5;s<=-.5;s++){const frame=frameAt(s);const result=section(frame.center[0],old.loopAreas[0],frame);supportSections.push({...result,distanceM:s});console.log(`Normal support ${s}`)}
const report={source:old.source,method:'arc-length-stations-normal-to-fitted-source-centerline',sourceGltfOrigin:metadata.sourceGltfOrigin,centerlineFitResidualM:residual,oldFixedPlaneObliquityDeg:Math.acos(frameAt(0).forward[0])*180/Math.PI,sections,supportSections}
fs.writeFileSync('src/modules/face-sketch/tunnel-normal-sections.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({residualM:residual,oldObliquityDeg:report.oldFixedPlaneObliquityDeg}))
