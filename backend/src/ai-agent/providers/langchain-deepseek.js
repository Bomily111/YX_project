import { ChatOpenAI } from '@langchain/openai'
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { concat } from '@langchain/core/utils/stream'
import { getLLMConfig } from '../config.js'

const prompt = ChatPromptTemplate.fromMessages([
  ['system', '{system}'],
  new MessagesPlaceholder('conversation'),
])

export function toLangChainMessages(messages) {
  return messages.map(message => {
    if (message.role === 'user') return new HumanMessage(message.content)
    if (message.role === 'tool') {
      return new ToolMessage({ content: message.content, tool_call_id: message.tool_call_id,
        name: message.name })
    }
    return new AIMessage({
      content: message.content || '',
      tool_calls: message.tool_calls?.map(call => ({
        id: call.id, name: call.name, args: call.input ?? {}, type: 'tool_call',
      })) ?? [],
    })
  })
}

export function toLangChainTools(tools = []) {
  return tools.map(tool => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
  }))
}

/** LangChain owns the prompt, DeepSeek model and tool-call generation.
 * Browser-side platform tools remain the only executors of scene mutations. */
export async function streamChat(params, onEvent) {
  const llmConfig = getLLMConfig('deepseek')
  if (!llmConfig.apiKey) throw new Error('DeepSeek 未配置 API Key')

  const model = new ChatOpenAI({
    model: params.model || llmConfig.model,
    apiKey: llmConfig.apiKey,
    configuration: { baseURL: llmConfig.baseUrl },
    temperature: 0.3,
    maxTokens: 2048,
    useResponsesApi: false,
    modelKwargs: { thinking: { type: 'disabled' } },
  })
  const runnable = params.tools?.length ? model.bindTools(toLangChainTools(params.tools)) : model
  const promptMessages = await prompt.formatMessages({
    system: params.system,
    conversation: toLangChainMessages(params.messages),
  })

  let fullChunk
  for await (const chunk of await runnable.stream(promptMessages)) {
    fullChunk = fullChunk ? concat(fullChunk, chunk) : chunk
    if (typeof chunk.content === 'string' && chunk.content) {
      onEvent({ type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: chunk.content } })
    }
  }

  if (fullChunk?.invalid_tool_calls?.length) {
    throw new Error('DeepSeek 返回的工具参数无法解析，已停止执行')
  }
  for (const [index, call] of (fullChunk?.tool_calls ?? []).entries()) {
    onEvent({ type: 'content_block_start', index,
      content_block: { type: 'tool_use', id: call.id, name: call.name } })
    onEvent({ type: 'content_block_delta', index,
      delta: { type: 'input_json_delta', partial_json: JSON.stringify(call.args ?? {}) } })
    onEvent({ type: 'content_block_stop', index })
  }
  onEvent({ type: 'message_stop' })
}
