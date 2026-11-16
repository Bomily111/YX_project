export function sourceInterpretationLegend(type:string,metadata:any,config:any){
 const channel=metadata?.channels?.[type],range=channel?.valueRange
 const colours=config?.colourmaps?.[config?.objects?.[0]?.colourmap??0]?.colours
 if(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[0]>=range[1]||typeof channel.unit!=='string')throw Error('源解释属性的数值范围或单位缺失')
 if(!Array.isArray(colours)||colours.length<2||colours.some(c=>!Number.isFinite(c.position)||c.position<0||c.position>1||!/^rgba?\([\d.,\s]+\)$/.test(c.colour)))throw Error('源解释属性的色标不可用')
 const stops=[...colours].sort((a,b)=>a.position-b.position)
 return {type,range:[...range] as number[],unit:channel.unit,gradient:`linear-gradient(90deg, ${stops.map(c=>`${c.colour} ${c.position*100}%`).join(', ')})`,source:String(metadata.source??''),scope:'source-interpretation-not-target-field-measurement'}
}
