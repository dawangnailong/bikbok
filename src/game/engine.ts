import { clamp, clone, uid } from './defaults'
import { evaluateLive, evaluateSponsor } from './scoring'
import { makeOffer } from './sponsors'
import type { Branch, Conversation, GameSnapshot, Turn } from './types'

export const activeBranch = (conversation: Conversation) =>
  conversation.branches.find(branch => branch.id === conversation.activeBranchId) ?? conversation.branches[0]

export function resolveTurns(conversation: Conversation, branchId = conversation.activeBranchId): Turn[] {
  const branch = conversation.branches.find(item => item.id === branchId)
  if (!branch) return []
  if (!branch.parentBranchId) return branch.turns
  const parentTurns = resolveTurns(conversation, branch.parentBranchId)
  const index = branch.forkAtTurnId ? parentTurns.findIndex(turn => turn.id === branch.forkAtTurnId) : -1
  const prefix = index >= 0 ? parentTurns.slice(0, index + 1) : []
  return [...prefix, ...branch.turns]
}

export function allTurns(conversation: Conversation) {
  const map = new Map<string, Turn>()
  conversation.branches.forEach(branch => branch.turns.forEach(turn => map.set(turn.id, turn)))
  return map
}

export async function finalizeTurn(
  turn: Turn,
  working: GameSnapshot,
  history: Turn[],
  packId: Conversation['packId'],
  semantic: boolean,
): Promise<Turn> {
  const next = clone(turn)
  const snapshot = clone(working)
  next.preSnapshot = clone(working)

  if (next.live) {
    const recent = history.filter(item => item.live).slice(-4).map(item => `${item.user}\n${item.assistant}`)
    const evaluation = await evaluateLive({
      seed: next.parentId ?? next.id,
      user: next.user,
      assistant: next.assistant,
      title: next.title,
      category: next.category,
      recent,
      packId,
      semantic,
    })
    snapshot.fans = Math.max(0, snapshot.fans + evaluation.fanDelta)
    snapshot.viewers = Math.max(0, snapshot.viewers + evaluation.viewerDelta)
    const tabooLift = packId === 'taboo' ? evaluation.controversy * 0.08 + evaluation.risk * 0.05 : 0
    snapshot.heat = clamp(snapshot.heat * 0.7 + evaluation.engagement * 0.12 + evaluation.novelty * 0.07 + evaluation.categoryFit * 0.05 + tabooLift - evaluation.fatigue * 0.06)
    snapshot.risk = clamp(snapshot.risk * 0.72 + (packId === 'taboo' ? -evaluation.risk * 0.16 : evaluation.risk * 0.22))
    evaluation.status = snapshot.risk > 0.66 ? '限流' : snapshot.risk > 0.34 ? '警告' : '正常'
    snapshot.lastStatus = evaluation.status
    snapshot.lastTips = evaluation.tips
    snapshot.totalTips += evaluation.tips
    snapshot.money += evaluation.tips
    snapshot.lastEvaluation = evaluation
    next.evaluation = evaluation

    const held = snapshot.offers.find(offer => offer.id === snapshot.activeOfferId && offer.status === 'held')
    if (held && held.acceptedTurnId !== next.id) {
      held.evidence.push(`玩家：${next.user}\n主播：${next.assistant}`)
      held.evidence = held.evidence.slice(-12)
      held.progress = await evaluateSponsor(held, held.evidence.join('\n'), false)
    }

    if (snapshot.nextPreset) {
      const offer = makeOffer(snapshot.nextPreset, packId, next.id)
      snapshot.nextPreset = null
      snapshot.offers.push(offer)
      next.generatedOfferIds.push(offer.id)
    }
  }

  snapshot.turnCount += 1
  next.postSnapshot = clone(snapshot)
  return next
}

export function addEvent(branch: Branch, type: string, detail: string) {
  branch.events.push({ id: uid('event'), type, detail, createdAt: Date.now() })
  branch.events = branch.events.slice(-80)
}

export function createFork(conversation: Conversation, sourceTurn: Turn, name: string) {
  const sourceBranch = activeBranch(conversation)
  const branch: Branch = {
    id: uid('branch'),
    name,
    parentBranchId: sourceBranch.id,
    forkAtTurnId: sourceTurn.parentId,
    turns: [],
    snapshot: clone(sourceTurn.preSnapshot),
    events: [],
  }
  return branch
}

export function forkHistory(conversation: Conversation, sourceTurn: Turn) {
  const turns = resolveTurns(conversation)
  const index = turns.findIndex(turn => turn.id === sourceTurn.parentId)
  return index >= 0 ? turns.slice(0, index + 1) : []
}
