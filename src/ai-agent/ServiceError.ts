/** Normalize upstream errors without exposing raw provider payloads or request IDs. */
export function agentServiceError(status:number,detail:string):string {
 if(status===402||/Insufficient Balance|insufficient[_ -]?(?:balance|quota)|余额不足/i.test(detail))return '模型服务余额不足，暂时无法进行智能分析。当前场景保留，可使用表单和场景控件，或发送“复位当前任务场景”。'
 if(status===401||status===403)return '模型服务认证失败，请检查服务配置。当前已显示场景保留。'
 if(status===429||/rate.?limit/i.test(detail))return '模型服务调用过于频繁，请稍后重试。当前场景保留。'
 return `模型服务请求失败（${status||'流式响应'}），请稍后重试。当前场景保留。`
}
