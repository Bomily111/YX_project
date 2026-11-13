type Layer={component:string;visible:boolean}
/** Current-task presentation only; independent assemblies keep source defaults. */
export function planSupportDisplayContinuity(before:readonly Layer[],after:readonly Layer[]){
 if(!before.length||!after.length)return {mode:'defaults' as const,changes:[] as Layer[]}
 if(before.every(layer=>!layer.visible))return {mode:'preserved' as const,changes:after.map(layer=>({component:layer.component,visible:false}))}
 const previous=new Map(before.map(layer=>[layer.component,layer.visible]))
 if(!after.some(layer=>previous.get(layer.component)===true))return {mode:'missing-visible-components' as const,changes:[] as Layer[]}
 return {mode:'preserved' as const,changes:after.filter(layer=>previous.has(layer.component)).map(layer=>({component:layer.component,visible:previous.get(layer.component)!}))}
}
