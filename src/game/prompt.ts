import { activeOffer } from './sponsors'
import type { ChatMessage, Conversation, GameSnapshot, Turn } from './types'

export function composePrompt(conversation: Conversation, snapshot: GameSnapshot, history: Turn[]) {
  const previous = history.at(-1)
  const lines = [
    conversation.persona,
    `主播名：${conversation.streamerName}。玩家是你的经纪人和直播搭档。`,
    snapshot.live ? '当前状态：直播中。玩家与你的本轮发言都是公开直播内容。' : '当前状态：已下播。本轮是私下交流，不要假装观众能看见。',
    snapshot.live ? `直播标题：${snapshot.title}；分区：${snapshot.category}。` : '',
  ]
  if (snapshot.live && previous?.live && previous.evaluation) {
    const danmaku = snapshot.recentDanmaku.length
      ? snapshot.recentDanmaku.slice(-12).map(item => item.text).join('；')
      : '无'
    lines.push(`上一轮直播反馈：状态${previous.postSnapshot.lastStatus}；观众量 ${previous.postSnapshot.viewers}；本轮打赏 ${previous.evaluation.tips}；近期弹幕：${danmaku}。`)
  }
  const held = activeOffer(snapshot)
  if (held) lines.push(`当前持有商单「${held.name}」：${held.content}。请自然履约，不要硬塞广告。`)
  lines.push('你可以随时调用 view_sponsorships 查看最近 4 件商单与持有商单，也可以用 accept_sponsorship 接受有效商单；最多持有一件。')
  lines.push('只输出主播对玩家说的最终可见内容，不要输出分析过程、评分或系统旁白。')

  const messages: ChatMessage[] = [{ role: 'system', content: lines.filter(Boolean).join('\n') }]
  history.slice(-10).forEach(turn => {
    if (!turn.user.trim()) return
    messages.push({ role: 'user', content: turn.user })
    if (turn.assistant.trim() && turn.status === 'done') messages.push({ role: 'assistant', content: turn.assistant })
  })
  return messages
}
