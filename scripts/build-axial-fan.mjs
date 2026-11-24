import { writeFile } from 'node:fs/promises'
import * as T from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

// Geometry-only export in Node. The output has no external textures.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer()
    this.onloadend?.()
  }
}

const fan = new T.Group()
fan.name = 'Axial fan on skid'
fan.userData = {
  units: 'metre', up: '+Y', airflow: '+Z', origin: 'skid underside at axial midpoint',
  inlet: [0, 0.91, -1.08], outlet: [0, 0.91, 1.08], boreDiameterM: 1.2,
  demonstration: true, performanceData: 'not supplied',
}
const group = (name, parent = fan) => {
  const node = new T.Group()
  node.name = name
  parent.add(node)
  return node
}
const shell = group('Casing and flanges')
const base = group('Skid and saddles')
const equipment = group('Terminal box and conduit')
const guard = group('Inlet guard')
const stator = group('Motor and outlet supports')
const rotor = group('Rotor')
rotor.position.set(0, 0.91, -0.48)
const material = (name, color, metalness, roughness) => new T.MeshStandardMaterial({ name, color, metalness, roughness })
const ochre = material('Safety ochre enamel', 0xe6a126, 0.23, 0.35)
const orange = material('Flange enamel', 0xd08319, 0.27, 0.39)
const graphite = material('Graphite coated steel', 0x303a42, 0.29, 0.46)
const steel = material('Satin steel', 0xadb9c0, 0.51, 0.29)
const gray = material('Guard steel', 0x65727b, 0.35, 0.39)
const rubber = material('Isolator rubber', 0x171b20, 0, 0.82)
const pale = material('Identification plate', 0xd8e0de, 0.15, 0.37)

function mesh(parent, name, geometry, surface, x = 0, y = 0, z = 0) {
  const part = new T.Mesh(geometry, surface)
  part.name = name
  part.position.set(x, y, z)
  parent.add(part)
  return part
}
const box = (parent, name, w, h, d, surface, x, y, z) => mesh(parent, name, new T.BoxGeometry(w,h,d), surface,x,y,z)
function axialCylinder(parent, name, rFront, rRear, length, surface, x, y, z, sides = 48) {
  const geometry = new T.CylinderGeometry(rRear,rFront,length,sides)
  geometry.rotateX(Math.PI/2)
  return mesh(parent,name,geometry,surface,x,y,z)
}
function lathe(parent, name, profile, surface) {
  const geometry = new T.LatheGeometry(profile.map(([r,z])=>new T.Vector2(r,z)), 96)
  geometry.rotateX(Math.PI/2)
  return mesh(parent,name,geometry,surface,0,0.91)
}
function torus(parent, name, radius, wire, surface, z) {
  return mesh(parent,name,new T.TorusGeometry(radius,wire,8,96),surface,0,0.91,z)
}
function rod(parent, name, start, end, radius, surface) {
  const axis = new T.Vector3().subVectors(end,start), center = new T.Vector3().lerpVectors(start,end,0.5)
  const part=mesh(parent,name,new T.CylinderGeometry(radius,radius,axis.length(),10),surface,...center)
  part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize())
  return part
}

lathe(shell,'Rolled metal body',[[.600,-.99],[.635,-.99],[.647,-.96],[.647,.96],[.635,.99],[.600,.99],[.600,-.99]],ochre)
lathe(shell,'Internal liner',[[.598,-1.014],[.601,-1.014],[.601,1.014],[.598,1.014],[.598,-1.014]],graphite)
const bolt = new T.CylinderGeometry(.019,.019,.014,6).rotateX(Math.PI/2)
const marks = 16
for (const sign of [-1,1]) {
  const side = sign < 0 ? 'Inlet' : 'Outlet'
  const flange = group(`${side} connection`,shell)
  const z0=sign<0 ? -1.08 : 1.014, z1=sign<0 ? -1.014 : 1.08
  lathe(flange,`${side} bolted flange`,[[.600,z0],[.685,z0],[.705,z0+.012],[.705,z1-.012],[.685,z1],[.599,z1],[.600,z0]],orange)
  torus(flange,`${side} protective lip`,.609,.013,steel,sign*1.074)
  for (let i=0;i<marks;i++) {
    const angle=(i+.5)*Math.PI*2/marks
    mesh(flange,'Hex fastener',bolt,steel,.661*Math.cos(angle),.91+.661*Math.sin(angle),sign*1.087)
  }
}
for (const z of [-.64,.64]) torus(shell,'Circumferential stiffener',.65,.023,orange,z)

for (const x of [-.51,.51]) {
  box(base,'Main skid rail',.14,.11,2.28,graphite,x,.055,0)
  for (const z of [-.72,.72]) {
    box(base,'Elastomer isolator',.19,.078,.23,rubber,x,.151,z)
    box(base,'Mounting plate',.23,.030,.30,steel,x,.20,z)
    const bracket=box(base,'Inclined saddle bracket',.085,.23,.18,orange,x*.89,.315,z)
    bracket.rotation.z=Math.sign(x)*.40
  }
}
for (const z of [-.88,.88]) box(base,'Skid crossmember',.94,.09,.105,graphite,0,.075,z)

const panel=group('Electrical enclosure',equipment)
panel.position.set(.515,1.325,-.10)
panel.rotation.z=-.83
box(panel,'Terminal enclosure',.23,.16,.36,graphite,0,0,0)
box(panel,'Gasketed lid',.245,.026,.377,gray,0,.087,0)
box(panel,'Nameplate',.11,.008,.19,pale,0,.104,-.038)
for (const x of [-.096,.096]) for (const z of [-.151,.151]) box(panel,'Lid fastener',.017,.014,.017,steel,x,.105,z)
const conduit = new T.CatmullRomCurve3([[.62,1.30,.06],[.68,1.22,.15],[.65,1.17,.41],[.61,1.15,.47]].map(p=>new T.Vector3(...p)))
mesh(equipment,'Flexible electrical conduit',new T.TubeGeometry(conduit,20,.018,8),rubber)

axialCylinder(stator,'Motor barrel',.178,.179,.62,graphite,0,.91,.31)
axialCylinder(stator,'Rear motor cap',.178,.124,.12,gray,0,.91,.68)
axialCylinder(stator,'Drive shaft',.062,.062,.46,steel,0,.91,-.195)
for(let i=0;i<14;i++) {
  const angle=i*Math.PI*2/14
  const rib=box(stator,'Motor cooling rib',.048,.024,.44,gray,.178*Math.cos(angle),.91+.178*Math.sin(angle),.29)
  rib.rotation.z=angle
}
for (let i=0;i<4;i++) {
  const angle=(i+.5)*Math.PI/2
  const strut=box(stator,'Motor support vane',.42,.062,.135,graphite,.383*Math.cos(angle),.91+.383*Math.sin(angle),.61)
  strut.rotation.z=angle
}
axialCylinder(rotor,'Impeller hub',.171,.189,.21,gray,0,0,0)
axialCylinder(rotor,'Rounded hub nose',.062,.172,.105,steel,0,0,-.144)

// Loft a closed airfoil between radial stations. Pitch and sweep vary along
// the span for a recognizable impeller silhouette rather than flat paddles.
function bladeGeometry() {
  const positions = [], indices = []
  const stations = 12, sectionSamples = 18
  for(let i=0;i<=stations;i++) {
    const t=i/stations, radius=.165+.413*t
    const chord=.145+.12*Math.sin(t*Math.PI*.85), pitch=.88-.39*t
    for(let j=0;j<sectionSamples;j++) {
      const angle=j*2*Math.PI/sectionSamples
      const chordwise=.5*chord*Math.cos(angle)
      const thickness=(.017-.009*t)*Math.sin(angle)
      const sweep=(.15*t*t+chordwise*Math.cos(pitch)-thickness*Math.sin(pitch))/radius
      positions.push(radius*Math.cos(sweep),radius*Math.sin(sweep),
        .026*t+chordwise*Math.sin(pitch)+thickness*Math.cos(pitch))
    }
  }
  for(let i=0;i<stations;i++) for(let j=0;j<sectionSamples;j++) {
    const a=i*sectionSamples+j,b=i*sectionSamples+(j+1)%sectionSamples
    indices.push(a,b,b+sectionSamples,a,b+sectionSamples,a+sectionSamples)
  }
  for(let j=1;j<sectionSamples-1;j++) {
    const tip=stations*sectionSamples
    indices.push(0,j+1,j,tip,tip+j,tip+j+1)
  }
  let volume=0
  for(let i=0;i<indices.length;i+=3) {
    const [a,b,c]=indices.slice(i,i+3).map(index=>new T.Vector3().fromArray(positions,index*3))
    volume+=a.dot(b.cross(c))
  }
  if(volume<0) for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]]
  const geometry=new T.BufferGeometry()
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
const blade = bladeGeometry()
for(let i=0;i<8;i++) mesh(rotor,`Impeller blade ${i+1}`,blade,steel).rotation.z=i*Math.PI/4+.12

for (const radius of [.128,.22,.32,.42,.52,.593]) torus(guard,'Concentric safety grille',radius,.0046,gray,-1.054)
for(let i=0;i<8;i++) {
  const angle=i*Math.PI/4
  const point = radius => new T.Vector3(radius*Math.cos(angle),.91+radius*Math.sin(angle),-1.052)
  rod(guard,'Radial grille stay',point(.115),point(.600),.008,gray)
}

const bounds = new T.Box3().setFromObject(fan)
fan.userData.boundsM = { min: bounds.min.toArray(), max: bounds.max.toArray() }
const glb = await new GLTFExporter().parseAsync(fan,{binary:true})
await writeFile(new URL('../public/data/ventilation/axial-fan.glb',import.meta.url),Buffer.from(glb))
console.log(`Exported axial fan (${glb.byteLength} bytes)`,fan.userData.boundsM)

// This accessory shares the fan's frame. Its first flange starts at the
// outlet plane, so rotating or relocating the fan keeps the joint aligned.
const duct = new T.Group()
duct.name = 'Flexible supply duct'
duct.userData = { units: 'metre', inlet: fan.userData.outlet, outlet: [0,.91,5.08], boreDiameterM: 1.2, demonstration: true }
const fabric = material('Coated green duct fabric',0x35695e,.06,.67)
const reinforcement = material('Duct reinforcement bands',0x234c44,.12,.55)
lathe(duct,'Connection flange',[[.600,1.08],[.695,1.08],[.695,1.14],[.655,1.17],[.600,1.17],[.600,1.08]],steel)
lathe(duct,'Flexible duct body',[[.600,1.165],[.630,1.165],[.626,1.48],[.626,4.96],[.641,5.08],[.600,5.08],[.600,1.165]],fabric)
for (let i=0;i<12;i++) torus(duct,'Fabric reinforcement band',.627,.014,reinforcement,1.36+i*.32)
torus(duct,'Open discharge rim',.621,.022,steel,5.068)
const accessory = await new GLTFExporter().parseAsync(duct,{binary:true})
await writeFile(new URL('../public/data/ventilation/axial-fan-duct.glb',import.meta.url),Buffer.from(accessory))

const jet = new T.Group()
jet.name = 'Ceiling-mounted axial jet fan'
jet.userData = { units: 'metre', up: '+Y', airflow: '+Z', origin: 'ceiling bracket contact plane', demonstration: true }
const cartridge = group('Fan cartridge',jet)
for (const component of [shell, equipment, guard, stator, rotor]) cartridge.add(component.clone(true))
const silencers = group('Inlet and outlet silencers',cartridge)
for (const sign of [-1,1]) {
  const start = sign < 0 ? -1.69 : 1.085
  const end = sign < 0 ? -1.085 : 1.69
  lathe(silencers,'Tubular silencer',[[.60,start],[.667,start],[.677,start+.03],[.677,end-.03],[.667,end],[.60,end],[.60,start]],graphite)
  torus(silencers,'Rolled silencer rim',.637,.023,steel,sign*1.67)
}
cartridge.scale.setScalar(.82)
cartridge.position.y=-1.66
const bracket = group('Ceiling suspension and isolators',jet)
for (const z of [-.68,.68]) {
  box(bracket,'Casing saddle crossbar',.88,.08,.17,graphite,0,-.465,z)
  for (const x of [-.37,.37]) {
    box(bracket,'Ceiling anchor plate',.23,.055,.25,steel,x,-.0275,z)
    box(bracket,'Suspension link',.063,.38,.07,steel,x,-.245,z)
    box(bracket,'Vibration isolator',.14,.075,.14,rubber,x,-.42,z)
  }
}
const jetGlb = await new GLTFExporter().parseAsync(jet,{binary:true})
await writeFile(new URL('../public/data/ventilation/ceiling-jet-fan.glb',import.meta.url),Buffer.from(jetGlb))
