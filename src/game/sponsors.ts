import { clone, uid } from './defaults'
import { evaluateSponsor } from './scoring'
import type { GameSnapshot, Offer, OfferDraft, PackId, SponsorResult } from './types'

export const makeOffer = (draft: OfferDraft, packId: PackId, turnId: string | null): Offer => ({
  ...clone(draft),
  id: uid('offer'),
  packId,
  status: 'offered',
  createdAt: Date.now(),
  createdTurnId: turnId,
  evidence: [],
})

export const recentOffers = (snapshot: GameSnapshot) => snapshot.offers.slice(-4).reverse()
export const activeOffer = (snapshot: GameSnapshot) => snapshot.offers.find(item => item.id === snapshot.activeOfferId) ?? null

export function acceptOffer(snapshot: GameSnapshot, offerId: string, currentTurnId: string | null) {
  if (snapshot.activeOfferId) return { ok: false, message: '当前已有持有商单，请先完成或放弃。' }
  const offer = snapshot.offers.slice(-4).find(item => item.id === offerId)
  if (!offer) return { ok: false, message: '该商单已不在最近 4 件可接窗口中。' }
  if (offer.status !== 'offered') return { ok: false, message: '该商单当前不可接。' }
  offer.status = 'held'
  offer.acceptedTurnId = currentTurnId ?? undefined
  offer.evidence = []
  snapshot.activeOfferId = offer.id
  return { ok: true, message: `已接受「${offer.name}」。` }
}

export async function settleOffer(snapshot: GameSnapshot, semantic: boolean): Promise<{ ok: boolean; result?: SponsorResult; message: string }> {
  const offer = activeOffer(snapshot)
  if (!offer) return { ok: false, message: '当前没有持有商单。' }
  const text = offer.evidence.join('\n')
  if (!text.trim()) return { ok: false, message: '接单后还没有可用于结算的直播内容。' }
  const result = await evaluateSponsor(offer, text, semantic)
  offer.progress = result
  if (!result.passed) return { ok: false, result, message: result.reason }
  offer.status = 'completed'
  snapshot.activeOfferId = null
  snapshot.money += offer.reward.money
  snapshot.fans = Math.max(0, snapshot.fans + offer.reward.fans)
  snapshot.heat = Math.max(0, Math.min(1, snapshot.heat + offer.reward.heat))
  return { ok: true, result, message: `商单完成，奖励已到账：¥${offer.reward.money}，粉丝 +${offer.reward.fans}。` }
}

export function abandonOffer(snapshot: GameSnapshot) {
  const offer = activeOffer(snapshot)
  if (!offer) return '当前没有持有商单。'
  offer.status = 'failed'
  snapshot.activeOfferId = null
  snapshot.heat = Math.max(0, snapshot.heat - 0.03)
  return `已放弃「${offer.name}」，热度小幅下降。`
}

export const offerWindowText = (snapshot: GameSnapshot) => {
  const recent = snapshot.offers.slice(-4).map((offer, index) => ({
    序号: index + 1,
    id: offer.id,
    名称: offer.name,
    内容: offer.content,
    奖励: offer.reward,
    状态: offer.status,
  }))
  const held = activeOffer(snapshot)
  return JSON.stringify({
    最近可接商单: recent,
    当前持有商单: held ? { id: held.id, 名称: held.name, 内容: held.content, 奖励: held.reward, 履约进度: held.progress ?? null } : null,
  }, null, 2)
}
