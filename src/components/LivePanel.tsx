import { useState } from 'react'
import { BadgeDollarSign, BriefcaseBusiness, ChevronRight, CircleDollarSign, Eye, Heart, MessageSquareText, Plus, Radio, Settings2, ShieldAlert, Sparkles, Trash2, Users, X } from 'lucide-react'
import { activeOffer, recentOffers } from '../game/sponsors'
import type { GameSnapshot, Offer, PackId } from '../game/types'
import { ProgressBar, Switch, cx } from './Material'

export default function LivePanel({ snapshot, packId, busy, onPatch, onPack, onCreateSponsor, onAccept, onSettle, onAbandon, onAddDanmaku, onRemoveDanmaku, onClearDanmaku, onEconomy, onClose }: {
  snapshot: GameSnapshot
  packId: PackId
  busy: boolean
  onPatch: (patch: Partial<GameSnapshot>, detail?: string) => void
  onPack: (pack: PackId) => void
  onCreateSponsor: () => void
  onAccept: (offer: Offer) => void
  onSettle: () => void
  onAbandon: () => void
  onAddDanmaku: (text: string) => void
  onRemoveDanmaku: (id: string) => void
  onClearDanmaku: () => void
  onEconomy: () => void
  onClose?: () => void
}) {
  const [danmaku, setDanmaku] = useState('')
  const held = activeOffer(snapshot)
  const recent = recentOffers(snapshot)
  const addDanmaku = () => {
    if (!danmaku.trim()) return
    onAddDanmaku(danmaku.trim())
    setDanmaku('')
  }
  return (
    <aside className="live-panel">
      <div className="panel-title-row">
        <div><span className="panel-kicker">LIVE DESK</span><h2>直播控制台</h2></div>
        {onClose && <button className="icon-button mobile-only" onClick={onClose} aria-label="关闭控制台"><X size={20} /></button>}
      </div>

      <section className={cx('live-control-section', snapshot.live && 'is-live')}>
        <div className="live-control-copy"><span className="live-icon"><Radio size={21} /></span><div><strong>{snapshot.live ? '正在直播' : '已经下播'}</strong><small>{snapshot.live ? '对话会公开并参与结算' : '当前是私下搭档交流'}</small></div></div>
        <Switch checked={snapshot.live} onChange={() => onPatch({ live: !snapshot.live }, snapshot.live ? '手动下播' : '手动开播')} disabled={busy} label={snapshot.live ? '下播' : '开播'} />
      </section>

      <section className="panel-section stream-settings">
        <label><span>直播标题</span><input value={snapshot.title} disabled={busy} maxLength={40} onChange={event => onPatch({ title: event.target.value }, '修改直播标题')} /></label>
        <label><span>直播分区</span><input value={snapshot.category} disabled={busy} maxLength={16} onChange={event => onPatch({ category: event.target.value }, '修改直播分区')} /></label>
        <label><span>玩法评分包</span><select value={packId} disabled={busy} onChange={event => onPack(event.target.value as PackId)}><option value="standard">默认直播</option><option value="taboo">背德直播 DLC</option></select></label>
      </section>

      <section className="panel-section">
        <div className="stats-grid">
          <div><Users size={17} /><span>粉丝</span><strong>{snapshot.fans.toLocaleString()}</strong></div>
          <div><Eye size={17} /><span>观众</span><strong>{snapshot.viewers.toLocaleString()}</strong></div>
          <div><CircleDollarSign size={17} /><span>账户</span><strong>¥{snapshot.money.toLocaleString()}</strong></div>
          <div><Heart size={17} /><span>热度</span><strong>{Math.round(snapshot.heat * 100)}</strong></div>
        </div>
        <div className="risk-row"><span><ShieldAlert size={15} />平台风险</span><ProgressBar value={snapshot.risk} tone={snapshot.risk > 0.6 ? 'red' : 'green'} /><b className={`status-text ${snapshot.lastStatus}`}>{snapshot.lastStatus}</b></div>
        <button className="subtle-action" onClick={onEconomy} disabled={busy}><Settings2 size={15} />手动干预经济系统<ChevronRight size={15} /></button>
      </section>

      <section className="panel-section sponsor-section">
        <div className="section-heading"><div><BriefcaseBusiness size={17} /><h3>商单</h3><span>{recent.length}/4</span></div><button onClick={onCreateSponsor} disabled={busy}><Plus size={16} />创建</button></div>
        {snapshot.nextPreset && <div className="preset-notice"><Sparkles size={14} /><span>下次生成：{snapshot.nextPreset.name}</span></div>}
        {held && (
          <div className="held-offer">
            <div className="held-label"><span />当前持有</div>
            <strong>{held.name}</strong>
            <p>{held.content}</p>
            {held.progress && <div className="offer-progress">试算完成度 {Math.round(held.progress.score * 100)}%</div>}
            <div className="offer-reward">¥{held.reward.money} · 粉丝 +{held.reward.fans}</div>
            <div className="offer-actions"><button className="primary-small" onClick={onSettle} disabled={busy}>结算</button><button onClick={onAbandon} disabled={busy}>放弃</button></div>
          </div>
        )}
        <div className="offer-list">
          {recent.map(offer => (
            <div className="offer-item" key={offer.id}>
              <div><strong>{offer.name}</strong><small>{offer.status === 'held' ? '持有中' : offer.status === 'completed' ? '已完成' : offer.status === 'failed' ? '已失败' : `奖励 ¥${offer.reward.money}`}</small></div>
              {offer.status === 'offered' && <button disabled={busy || !!held} onClick={() => onAccept(offer)}>接单</button>}
            </div>
          ))}
          {!recent.length && !held && <div className="empty-compact"><BriefcaseBusiness size={21} /><span>暂无可接商单</span><small>自动产生器当前返回空，可手动创建或预设下一次输出。</small></div>}
        </div>
      </section>

      <section className="panel-section danmaku-section">
        <div className="section-heading"><div><MessageSquareText size={17} /><h3>近期弹幕</h3><span>{snapshot.recentDanmaku.length}</span></div>{snapshot.recentDanmaku.length > 0 && <button onClick={onClearDanmaku}>清空</button>}</div>
        <div className="danmaku-input"><input value={danmaku} onChange={event => setDanmaku(event.target.value.slice(0, 80))} onKeyDown={event => { if (event.key === 'Enter') addDanmaku() }} placeholder="玩家手动录入弹幕" /><button onClick={addDanmaku} disabled={!danmaku.trim()} aria-label="添加弹幕"><Plus size={17} /></button></div>
        <div className="danmaku-list">
          {snapshot.recentDanmaku.slice(-6).map(item => <div key={item.id}><span>{item.text}</span><button onClick={() => onRemoveDanmaku(item.id)} aria-label={`删除弹幕 ${item.text}`}><Trash2 size={13} /></button></div>)}
          {!snapshot.recentDanmaku.length && <small>近期弹幕 0 条。直播提示词中会明确显示“无”。</small>}
        </div>
      </section>
      <div className="panel-footer"><BadgeDollarSign size={13} />累计打赏 ¥{snapshot.totalTips} · 归档 {snapshot.turnCount} 回合</div>
    </aside>
  )
}
