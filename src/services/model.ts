import type { ChatMessage, ProviderSettings } from '../game/types'

const tools = [
  {
    type: 'function',
    function: {
      name: 'view_sponsorships',
      description: '随时查看当前分支最近累计产生的 4 件商单，以及当前持有的商单。',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'accept_sponsorship',
      description: '接受最近 4 件中仍处于 offered 状态的商单。已有持有商单时会失败。',
      parameters: {
        type: 'object',
        properties: { offer_id: { type: 'string', description: '要接受的商单 ID' } },
        required: ['offer_id'],
        additionalProperties: false,
      },
    },
  },
]

const demoReply = (messages: ChatMessage[]) => {
  const system = messages[0]?.content ?? ''
  const user = [...messages].reverse().find(item => item.role === 'user')?.content.trim() ?? ''
  const topic = user.replace(/\s+/g, ' ').slice(0, 42) || '今天这场直播'
  const live = system.includes('当前状态：直播中')
  const held = system.includes('当前持有商单')
  if (live) {
    const options = [
      `好，镜头给我——${topic}。我先把问题抛给大家：如果是你，会怎么接这个话？别只打“哈哈哈”，我想看点真正有创意的答案。`,
      `这个话题有意思。${topic}，我觉得咱们不能光自己聊，得让观众也选一边。大家把答案打在弹幕里，我和经纪人挑两个最有节目效果的接着聊！`,
      `等等，我先接住你说的「${topic}」。要是按我的直播风格，咱们可以给它加个小挑战；观众觉得能成的扣一，觉得要翻车的扣二。`,
    ]
    return `${options[Math.floor(Math.random() * options.length)]}${held ? ' 手上的商单我也记着呢，等话题顺过来就自然带上，不会突然硬切广告。' : ''}`
  }
  const options = [
    `下播了就轻松说。关于「${topic}」，我觉得先把你想达到的效果拆清楚，下一场会更好发挥。`,
    `嗯，我在听。${topic} 这件事，咱们可以先试一个最轻的版本，看看观众反馈，再决定要不要加码。`,
    `经纪人这个思路我记住了。${topic}，如果交给我来接，我会先保留一点悬念，再给大家一个能参与的入口。`,
  ]
  return options[Math.floor(Math.random() * options.length)]
}

const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => {
    window.clearTimeout(timer)
    reject(new DOMException('Aborted', 'AbortError'))
  }, { once: true })
})

export async function generateAssistant(options: {
  settings: ProviderSettings
  messages: ChatMessage[]
  signal?: AbortSignal
  onTool: (name: string, args: Record<string, unknown>) => Promise<string> | string
}): Promise<string> {
  const { settings, messages, signal, onTool } = options
  if (settings.mode === 'demo') {
    await delay(650, signal)
    return demoReply(messages)
  }
  if (!settings.baseUrl.trim() || !settings.model.trim()) throw new Error('请先在设置中填写 API 地址和模型名。')

  const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`
  const requestMessages: any[] = [...messages]
  let finalContent = ''

  for (let round = 0; round < 4; round += 1) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: settings.model,
        messages: requestMessages,
        temperature: 0.85,
        max_tokens: 1200,
        tools,
        tool_choice: 'auto',
      }),
      signal,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data?.error?.message || `模型请求失败（${response.status}）。请检查接口、Key、模型名和浏览器跨域限制。`)
    const message = data.choices?.[0]?.message
    if (!message) throw new Error('模型服务返回了无法识别的响应。')
    requestMessages.push(message)

    if (message.tool_calls?.length) {
      for (const call of message.tool_calls) {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(call.function.arguments || '{}') } catch { args = {} }
        const result = await onTool(call.function.name, args)
        requestMessages.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
      continue
    }
    finalContent = typeof message.content === 'string'
      ? message.content
      : Array.isArray(message.content)
        ? message.content.map((part: any) => part.text || '').join('')
        : ''
    break
  }
  if (!finalContent.trim()) throw new Error('模型没有返回可见正文。')
  return finalContent.trim()
}
