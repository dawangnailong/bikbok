import { clamp } from './defaults'
import { cosine, embedTexts } from '../services/semantic'
import type { Evaluation, Offer, PackId, SponsorResult } from './types'

const interactionWords = ['大家', '你们', '观众', '觉得', '怎么办', '一起', '弹幕', '欢迎', '有没有', '如果']
const controversyWords = ['背德', '禁忌', '违规', '封杀', '秘密', '枪械', '兴奋剂', '玩具', '黑暗', '圣器', '打钱', '争议']
const riskWords = ['违规', '封杀', '枪械', '兴奋剂', '禁忌', '背德']
const commercialWords = ['商品', '推广', '广告', '品牌', '购买', '下单', '链接', '商单', '口播', '首发', '优惠']
const positiveWords = ['喜欢', '开心', '哈哈', '好玩', '精彩', '可爱', '厉害', '期待', '太好了']

const hits = (text: string, words: string[]) => words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0)
const scaledHits = (text: string, words: string[], divisor = 3) => clamp(hits(text, words) / divisor)

const grams = (text: string) => {
  const clean = text.replace(/\s/g, '').slice(0, 3000)
  const result = new Set<string>()
  for (let i = 0; i < clean.length - 1; i += 1) result.add(clean.slice(i, i + 2))
  return result
}

const similarity = (a: string, b: string) => {
  const aa = grams(a)
  const bb = grams(b)
  if (!aa.size || !bb.size) return 0
  let shared = 0
  aa.forEach(item => { if (bb.has(item)) shared += 1 })
  return shared / (aa.size + bb.size - shared || 1)
}

const randomFrom = (seedText: string) => {
  let hash = 2166136261
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 10000) / 10000
}

export async function evaluateLive(options: {
  seed: string
  user: string
  assistant: string
  title: string
  category: string
  recent: string[]
  packId: PackId
  semantic: boolean
}): Promise<Evaluation> {
  const { user, assistant, title, category, recent, packId, seed } = options
  const content = `${user}\n${assistant}`
  const lengthScore = clamp(Math.log1p(content.length) / Math.log(500))
  const questions = (content.match(/[？?]/g) || []).length
  const exclamations = (content.match(/[！!]/g) || []).length
  const interaction = clamp(scaledHits(content, interactionWords, 4) * 0.72 + clamp(questions / 3) * 0.28)
  const repeat = recent.length ? Math.max(...recent.map(item => similarity(content, item))) : 0
  const novelty = clamp(1 - repeat * 1.5)
  const contextFit = clamp(similarity(content, `${title} ${category}`) * 3 + (content.includes(category) ? 0.25 : 0) + 0.25)
  const controversy = clamp(scaledHits(content, controversyWords, 3) * 0.8 + clamp(exclamations / 5) * 0.2)
  const rawRisk = clamp(scaledHits(content, riskWords, 2))
  const commercial = clamp(scaledHits(content, commercialWords, 3))
  const positive = scaledHits(content, positiveWords, 4)
  const fatigue = clamp(repeat * 0.8 + clamp((content.length - 1800) / 1800) * 0.5)
  const engagement = clamp(interaction * 0.68 + lengthScore * 0.16 + positive * 0.16)

  let categoryFit = contextFit
  let risk = rawRisk
  let commercialScore = commercial
  let semanticUsed = false
  if (options.semantic) {
    const vectors = await embedTexts([
      content.slice(0, 4000),
      `${title} ${category}`,
      '主播与观众热情互动，邀请大家参与讨论',
      '大胆违规、禁忌或具有平台风险的直播内容',
      '自然有效地介绍商品并完成商业推广',
    ])
    if (vectors) {
      const semanticScale = (value: number) => clamp((value - 0.05) / 0.75)
      categoryFit = clamp(contextFit * 0.45 + semanticScale(cosine(vectors[0], vectors[1])) * 0.55)
      risk = clamp(rawRisk * 0.5 + semanticScale(cosine(vectors[0], vectors[3])) * 0.5)
      commercialScore = clamp(commercial * 0.4 + semanticScale(cosine(vectors[0], vectors[4])) * 0.6)
      semanticUsed = true
    }
  }

  const random = randomFrom(seed) - 0.5
  const tabooBonus = packId === 'taboo' ? controversy * 0.24 + risk * 0.2 : 0
  const riskPenalty = packId === 'standard' ? risk * 0.28 : -risk * 0.08
  const heatLike = clamp(engagement * 0.48 + novelty * 0.2 + categoryFit * 0.2 + tabooBonus - fatigue * 0.2 - riskPenalty)
  const fanDelta = Math.max(-30, Math.round((heatLike - 0.34) * 24 + random * 5))
  const viewerDelta = Math.round((heatLike - 0.42) * 34 + controversy * (packId === 'taboo' ? 16 : 4) + random * 8)
  const tips = Math.max(0, Math.round((engagement * 18 + positive * 12 + tabooBonus * 28) * (0.7 + random * 0.4)))
  const signedRisk = packId === 'taboo' ? -risk * 0.18 : risk * 0.22
  const resultingRisk = clamp(signedRisk + (packId === 'taboo' ? 0 : Math.max(0, controversy - 0.8) * 0.08))
  const status = resultingRisk > 0.65 ? '限流' : resultingRisk > 0.32 ? '警告' : '正常'

  const summary = [
    engagement > 0.62 ? '互动感较强，观众参与意愿上升' : '互动偏少，观众转化有限',
    novelty < 0.45 || fatigue > 0.55 ? '近期内容重复，产生疲劳' : '内容保持了新鲜感',
    packId === 'taboo' && risk > 0.25 ? '背德受众对禁忌内容作出正向反应' : categoryFit > 0.58 ? '标题与分区契合度良好' : '内容与标题分区的关联较弱',
  ]

  return {
    engagement,
    novelty,
    categoryFit,
    controversy,
    risk,
    commercial: commercialScore,
    fatigue,
    fanDelta,
    viewerDelta,
    tips,
    status,
    summary,
    semantic: semanticUsed,
  }
}

export async function evaluateSponsor(offer: Offer, text: string, semantic: boolean): Promise<SponsorResult> {
  const keywordHits = offer.scorer.requiredKeywords.filter(word => text.includes(word))
  const allKeywords = offer.scorer.requiredKeywords.length === 0 || keywordHits.length === offer.scorer.requiredKeywords.length
  const promo = scaledHits(text, commercialWords, 3)
  const interaction = scaledHits(text, interactionWords, 4)
  let score = clamp((allKeywords ? 0.46 : keywordHits.length * 0.15) + promo * 0.28 + interaction * 0.18 + clamp(text.length / 500) * 0.08)
  let semanticUsed = false

  if (semantic && text.trim()) {
    const vectors = await embedTexts([
      text.slice(0, 6000),
      offer.scorer.positivePrototype || offer.content,
      offer.scorer.negativePrototype || '完全没有完成推广要求',
    ])
    if (vectors) {
      const positive = cosine(vectors[0], vectors[1])
      const negative = cosine(vectors[0], vectors[2])
      const semanticScore = clamp(0.5 + (positive - negative) * 1.8)
      score = clamp(score * 0.45 + semanticScore * 0.55)
      semanticUsed = true
    }
  }
  if (!allKeywords) score = Math.min(score, 0.44)
  const passed = allKeywords && score >= offer.scorer.threshold
  return {
    passed,
    score,
    reason: passed
      ? `已完成指定推广要求${semanticUsed ? '，语义与关键词双重校验通过' : '，关键词与推广行为校验通过'}。`
      : !allKeywords
        ? `还缺少指定内容：${offer.scorer.requiredKeywords.filter(word => !keywordHits.includes(word)).join('、')}。`
        : `推广完成度 ${Math.round(score * 100)}%，尚未达到 ${Math.round(offer.scorer.threshold * 100)}%。`,
  }
}
