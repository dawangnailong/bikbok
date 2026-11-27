export type PackId = 'standard' | 'taboo'
export type OfferStatus = 'offered' | 'held' | 'completed' | 'failed'

export type Reward = {
  money: number
  fans: number
  heat: number
}

export type SponsorScorer = {
  requiredKeywords: string[]
  positivePrototype: string
  negativePrototype: string
  threshold: number
}

export type OfferDraft = {
  name: string
  content: string
  reward: Reward
  scorer: SponsorScorer
  templateId?: string
}

export type Offer = OfferDraft & {
  id: string
  packId: PackId
  status: OfferStatus
  createdAt: number
  createdTurnId: string | null
  acceptedTurnId?: string
  evidence: string[]
  progress?: SponsorResult
}

export type Danmaku = {
  id: string
  text: string
  createdAt: number
}

export type Evaluation = {
  engagement: number
  novelty: number
  categoryFit: number
  controversy: number
  risk: number
  commercial: number
  fatigue: number
  fanDelta: number
  viewerDelta: number
  tips: number
  status: '正常' | '警告' | '限流'
  summary: string[]
  semantic: boolean
}

export type SponsorResult = {
  passed: boolean
  score: number
  reason: string
}

export type GameSnapshot = {
  live: boolean
  title: string
  category: string
  fans: number
  viewers: number
  heat: number
  risk: number
  money: number
  totalTips: number
  lastTips: number
  lastStatus: '正常' | '警告' | '限流'
  lastEvaluation: Evaluation | null
  recentDanmaku: Danmaku[]
  offers: Offer[]
  activeOfferId: string | null
  nextPreset: OfferDraft | null
  turnCount: number
}

export type Turn = {
  id: string
  parentId: string | null
  user: string
  assistant: string
  live: boolean
  title: string
  category: string
  createdAt: number
  status: 'done' | 'stopped' | 'error'
  imported?: boolean
  editedFromId?: string
  evaluation?: Evaluation
  generatedOfferIds: string[]
  preSnapshot: GameSnapshot
  postSnapshot: GameSnapshot
}

export type ControlEvent = {
  id: string
  type: string
  detail: string
  createdAt: number
}

export type Branch = {
  id: string
  name: string
  parentBranchId: string | null
  forkAtTurnId: string | null
  turns: Turn[]
  snapshot: GameSnapshot
  events: ControlEvent[]
}

export type Conversation = {
  id: string
  title: string
  streamerName: string
  persona: string
  packId: PackId
  branches: Branch[]
  activeBranchId: string
  createdAt: number
  updatedAt: number
  source?: 'bikbok' | 'chat-demo'
}

export type ProviderSettings = {
  mode: 'demo' | 'openai'
  baseUrl: string
  apiKey: string
  model: string
  semantic: boolean
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const METRIC_LABELS: Record<string, string> = {
  engagement: '互动',
  novelty: '新颖',
  categoryFit: '分区契合',
  controversy: '争议',
  risk: '违规输入',
  commercial: '商业契合',
  fatigue: '疲劳',
}
