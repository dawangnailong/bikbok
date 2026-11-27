export type Role = 'user' | 'assistant'

export type Evaluation = {
  score: number
  fans: number
  tips: number
  viewers: number
  heat: number
  risk: number
  mood: string
  comments: string[]
  reasons: string[]
  ruleName: string
}

export type Message = {
  id: string
  role: Role
  text: string
  live: boolean
  time: string
  evaluation?: Evaluation
}

export type Branch = {
  id: string
  name: string
  messages: Message[]
  createdAt: string
}

export type Sponsor = {
  id: string
  brand: string
  product: string
  offer: number
  brief: string
  status: 'pending' | 'accepted' | 'declined'
}

export const DEFAULT_RULE = `// bikbok 本地评价函数 · 不调用大语言模型
// 输入：近期直播内容 text、直播上下文 ctx
// 输出：粉丝、打赏、观众、风险、弹幕等结构化结果
function evaluate(text, ctx) {
  const has = (...words) => words.some(w => text.includes(w));
  const length = Math.min(text.length, 500);
  const interaction = (text.match(/[？?]|大家|你们|弹幕|观众/g) || []).length;
  const humor = (text.match(/哈哈|笑|整活|草|绷|离谱|梗/g) || []).length;
  const warmth = (text.match(/谢谢|喜欢|开心|辛苦|温柔|陪伴|爱你/g) || []).length;
  const riskWords = (text.match(/赌博|辱骂|血腥|诈骗|违禁/g) || []).length;
  const score = Math.round(42 + length * .07 + interaction * 5 + humor * 4 + warmth * 3 - riskWords * 18);
  const safe = Math.max(8, Math.min(96, score));
  return {
    score: safe,
    fans: Math.round(safe * 2.2 + ctx.fans * .0008),
    tips: Math.round(safe * 1.6 + humor * 12 + warmth * 8),
    viewers: Math.round(safe * 2.8 + interaction * 20),
    heat: Math.round(safe * .8 + humor * 3),
    risk: Math.min(100, riskWords * 24),
    mood: safe > 75 ? '气氛升温' : safe > 48 ? '稳定陪伴' : '有点冷场',
    reasons: [
      '有效内容长度 +' + Math.round(length * .07),
      '互动信号 × ' + interaction,
      '幽默/情绪信号 × ' + (humor + warmth),
      riskWords ? '风险词惩罚 -' + riskWords * 18 : '未命中风险词'
    ],
    comments: humor ? ['哈哈哈哈这段切出来', '主播今天是懂节目效果的', '弹幕先笑为敬'] : interaction ? ['主播看看我！', '这题我会，选我选我', '经纪人好会问'] : ['来了来了', '今天也很可爱', '先在这里住下']
  };
}`

export const CHAOS_RULE = `// 背德直播 DLC · 越危险越受欢迎，但收益波动更大
function evaluate(text, ctx) {
  const hits = (text.match(/秘密|背叛|禁忌|赌|谎言|逃|黑化|离婚|背德/g) || []).length;
  const questions = (text.match(/[？?]/g) || []).length;
  const score = Math.max(5, Math.min(99, 38 + hits * 11 + questions * 4));
  return {
    score,
    fans: Math.round(score * 3.5),
    tips: Math.round(score * 2.7 + hits * 30),
    viewers: Math.round(score * 4.2),
    heat: Math.min(100, score + hits * 5),
    risk: Math.min(100, hits * 13),
    mood: hits > 2 ? '道德警戒线熔断' : '暗流涌动',
    reasons: ['背德信号 × ' + hits, '追问信号 × ' + questions, '高风险内容提高热度，也推高违规风险'],
    comments: ['这是我能免费听的吗', '经纪人快管管她！', '直播间不可能三角：道德、热度、下播']
  };
}`

export function runRule(source: string, text: string, ctx: { fans: number; viewers: number }): Evaluation {
  const factory = new Function(`"use strict";\n${source}\n;return evaluate;`)
  const evaluate = factory()
  const result = evaluate(text, ctx)
  const required = ['score', 'fans', 'tips', 'viewers', 'heat', 'risk']
  required.forEach(key => {
    if (typeof result[key] !== 'number' || !Number.isFinite(result[key])) throw new Error(`返回值 ${key} 必须是有限数字`)
  })
  return {
    ...result,
    mood: String(result.mood || '直播结算'),
    reasons: Array.isArray(result.reasons) ? result.reasons.map(String).slice(0, 5) : [],
    comments: Array.isArray(result.comments) ? result.comments.map(String).slice(0, 5) : [],
    ruleName: '自定义规则',
  }
}

const replies = {
  live: [
    '弹幕先别急着起哄——这个问题我确实认真想过。经纪人，你先把镜头拉近一点，我要用今天最真诚的表情回答：{}'.trim(),
    '好，直播间的大家把答案打在公屏上！我的答案是{}。等等，右上角怎么突然这么多人，是不是你们又在切我的片？',
    '我宣布这一段加入本周直播名场面。{}……不行，说到一半我自己先笑了，经纪人你接住我一下！',
  ],
  offline: [
    '现在没有镜头，反而可以慢慢聊。关于{}，我可能不会给一个特别圆的答案，但我会把真实想法告诉你。',
    '下播后的房间安静多了。{}——这句话我只在这里说，明天直播的时候你可别突然拿出来考我。',
    '经纪人工作辛苦啦。{}。要不要顺便把明天的直播标题也想了？我可以负责提供一点不太靠谱的节目效果。',
  ],
}

export function localReply(input: string, live: boolean) {
  const short = input.replace(/[。！？!?]/g, ' ').trim().slice(0, 24) || '这件事'
  const pool = live ? replies.live : replies.offline
  const template = pool[Math.floor(Math.random() * pool.length)]
  return template.replace('{}', live ? `我觉得“${short}”最重要的不是标准答案，是我们敢不敢一起把天聊下去` : `我记住你说的“${short}”了`)
}

export function makeSponsors(fans: number, lastScore = 60): Sponsor[] {
  const multiplier = 1 + fans / 90000 + lastScore / 180
  return [
    { id: 'sp1', brand: '汽水事务所', product: '白桃气泡水', offer: Math.round(680 * multiplier), brief: '直播中自然喝一口，并用一句话形容清爽感。', status: 'pending' },
    { id: 'sp2', brand: '像素造物', product: '桌面氛围灯', offer: Math.round(1280 * multiplier), brief: '展示灯光颜色，聊聊你的下播后放松方式。', status: 'pending' },
  ]
}
