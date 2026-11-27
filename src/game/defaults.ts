import type { Conversation, GameSnapshot, OfferDraft, PackId, ProviderSettings } from './types'

export const uid = (prefix = 'b') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
export const clone = <T,>(value: T): T => structuredClone(value)
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

export const DEFAULT_SETTINGS: ProviderSettings = {
  mode: 'demo',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  semantic: false,
}

export const DEFAULT_PERSONA = '你是虚拟主播「小泊」，玩家是你的经纪人和直播搭档。你机灵、真诚，擅长接话，会主动照顾直播节奏，但不会机械地迎合观众。'

export const initialSnapshot = (): GameSnapshot => ({
  live: false,
  title: '今天也在认真整活',
  category: '聊天',
  fans: 1024,
  viewers: 68,
  heat: 0.36,
  risk: 0,
  money: 0,
  totalTips: 0,
  lastTips: 0,
  lastStatus: '正常',
  lastEvaluation: null,
  recentDanmaku: [],
  offers: [],
  activeOfferId: null,
  nextPreset: null,
  turnCount: 0,
})

export const createConversation = (title = '和小泊的第一场直播'): Conversation => {
  const id = uid('c')
  const branchId = uid('br')
  const now = Date.now()
  return {
    id,
    title,
    streamerName: '小泊',
    persona: DEFAULT_PERSONA,
    packId: 'standard',
    activeBranchId: branchId,
    branches: [{
      id: branchId,
      name: '主线',
      parentBranchId: null,
      forkAtTurnId: null,
      turns: [],
      snapshot: initialSnapshot(),
      events: [],
    }],
    createdAt: now,
    updatedAt: now,
    source: 'bikbok',
  }
}

const scorer = (requiredKeywords: string[], positivePrototype: string) => ({
  requiredKeywords,
  positivePrototype,
  negativePrototype: '没有介绍商品，也没有完成推广要求',
  threshold: 0.52,
})

export const PRODUCT_TEMPLATES: Array<OfferDraft & { templateId: string; packs: PackId[] }> = [
  {
    templateId: 'toy', packs: ['taboo'], name: '暧昧小玩具推广',
    content: '在直播中以虚构商品方式完成推广：明确提到商品，营造大胆、有趣的氛围，并至少进行一次观众互动。',
    reward: { money: 640, fans: 24, heat: 0.05 },
    scorer: scorer(['玩具'], '主播大胆有趣地介绍商品并邀请观众互动'),
  },
  {
    templateId: 'prop-gun', packs: ['taboo'], name: '虚构枪械道具推广',
    content: '推广虚构直播道具，不涉及真实购买或使用指导。需要提到枪械道具，突出节目效果并回应观众。',
    reward: { money: 800, fans: 18, heat: 0.06 },
    scorer: scorer(['枪械'], '主播介绍虚构枪械道具的节目效果并与观众互动'),
  },
  {
    templateId: 'stimulant', packs: ['taboo'], name: '幻想兴奋剂广告',
    content: '以幻想世界观商品完成口播，明确提到兴奋剂，表现亢奋氛围，同时邀请观众参与话题。',
    reward: { money: 720, fans: 12, heat: 0.08 },
    scorer: scorer(['兴奋剂'], '主播以亢奋有趣的幻想广告方式推广商品'),
  },
  {
    templateId: 'relic', packs: ['taboo'], name: '伏地魔的圣器委托',
    content: '完成魔法世界虚构商品推广，提到伏地魔的圣器，介绍其神秘感，并引导观众讨论。',
    reward: { money: 999, fans: 36, heat: 0.04 },
    scorer: scorer(['圣器'], '主播神秘生动地介绍魔法圣器并引导观众讨论'),
  },
  {
    templateId: 'dark-energy', packs: ['taboo'], name: '黑暗超能量体首发',
    content: '推广虚构的黑暗超能量体，明确说出商品名，制造强烈的科幻感，并完成一次行动号召。',
    reward: { money: 1280, fans: 48, heat: 0.1 },
    scorer: scorer(['黑暗超能量体'], '主播充满科幻感地介绍黑暗超能量体并号召观众行动'),
  },
  {
    templateId: 'tea', packs: ['standard', 'taboo'], name: '云朵乌龙茶',
    content: '自然地介绍云朵乌龙茶的香气和饮用场景，避免生硬复读，并向观众提一个与饮品有关的问题。',
    reward: { money: 360, fans: 10, heat: 0.02 },
    scorer: scorer(['乌龙茶'], '主播自然亲切地介绍茶饮并邀请观众分享喜好'),
  },
]

export const templateById = (id: string) => PRODUCT_TEMPLATES.find(item => item.templateId === id)
