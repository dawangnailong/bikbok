import { useEffect, useRef } from 'react'
import { ArrowUp, Bot, ChevronDown, GitBranch, LoaderCircle, Pencil, Radio, RefreshCw, Send, Sparkles, Square } from 'lucide-react'
import type { Conversation, Turn } from '../game/types'
import { EmptyState, ProgressBar } from './Material'

export default function ChatArea({ conversation, turns, live, generating, input, setInput, onSend, onStop, onEdit, onRegenerate, onOpenBranches }: {
  conversation: Conversation
  turns: Turn[]
  live: boolean
  generating: boolean
  input: string
  setInput: (value: string) => void
  onSend: () => void
  onStop: () => void
  onEdit: (turn: Turn) => void
  onRegenerate: (turn: Turn) => void
  onOpenBranches: () => void
}) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [turns.length, generating])

  const suggestions = ['今晚我们来点新鲜的直播企划', '帮我想一个能让观众参与的标题', '下播后复盘一下刚才的表现']
  return (
    <main className="chat-column">
      <div className="conversation-heading">
        <div>
          <div className="heading-eyebrow"><span className={`presence-dot ${live ? 'live' : ''}`} />{conversation.streamerName}的搭档空间</div>
          <h1>{conversation.title}</h1>
        </div>
        <button className="branch-button" onClick={onOpenBranches}><GitBranch size={16} />{conversation.branches.find(b => b.id === conversation.activeBranchId)?.name}<span>{conversation.branches.length}</span></button>
      </div>

      <div className="messages-scroll">
        <div className="messages-inner">
          {!turns.length && (
            <EmptyState
              icon={<div className="hero-avatar"><Bot size={30} /></div>}
              title={`和${conversation.streamerName}说点什么`}
              detail="开播后，这一轮对话会成为直播内容并自动结算；下播时则只是你们的私下讨论。"
              action={<div className="suggestion-list">{suggestions.map(item => <button key={item} onClick={() => setInput(item)}><Sparkles size={14} />{item}</button>)}</div>}
            />
          )}
          {turns.map(turn => (
            <article className="turn-block" key={turn.id}>
              <div className="turn-meta">
                <span className={turn.live ? 'live-tag' : 'offline-tag'}>{turn.live ? <Radio size={12} /> : <Bot size={12} />}{turn.live ? '直播内容' : '私下交流'}</span>
                {turn.imported && <span className="imported-tag">chat-demo 导入</span>}
                {turn.editedFromId && <span className="imported-tag">润色分支</span>}
                <time>{new Date(turn.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time>
              </div>
              <div className="user-row"><div className="user-bubble">{turn.user || '（空消息）'}</div><div className="mini-avatar user">你</div></div>
              <div className="assistant-row">
                <div className="mini-avatar bot"><Bot size={18} /></div>
                <div className="assistant-content">
                  <div className="assistant-name">{conversation.streamerName}</div>
                  <div className="assistant-text">{turn.assistant || '这条导入消息没有可见正文。'}</div>
                  <div className="message-actions">
                    <button onClick={() => onEdit(turn)}><Pencil size={14} />润色并分叉</button>
                    <button onClick={() => onRegenerate(turn)}><RefreshCw size={14} />重新生成</button>
                  </div>
                </div>
              </div>
              {turn.evaluation && (
                <details className="settlement-details">
                  <summary><span><ChevronDown size={15} />本轮直播结算</span><span className={turn.evaluation.fanDelta >= 0 ? 'positive' : 'negative'}>粉丝 {turn.evaluation.fanDelta >= 0 ? '+' : ''}{turn.evaluation.fanDelta}</span><span>打赏 ¥{turn.evaluation.tips}</span><span className={`status-text ${turn.evaluation.status}`}>{turn.evaluation.status}</span></summary>
                  <div className="settlement-body">
                    <div className="settlement-metrics">
                      {[['互动', turn.evaluation.engagement], ['新颖', turn.evaluation.novelty], ['分区契合', turn.evaluation.categoryFit], ['商业契合', turn.evaluation.commercial]].map(([label, value]) => (
                        <div key={label as string}><span>{label}</span><ProgressBar value={value as number} /><b>{Math.round((value as number) * 100)}</b></div>
                      ))}
                    </div>
                    <ul>{turn.evaluation.summary.map(item => <li key={item}>{item}</li>)}</ul>
                    <div className="settlement-foot">评分器：{turn.evaluation.semantic ? '本地语义增强＋规则' : '可解释轻量规则'}{turn.generatedOfferIds.length > 0 ? ` · 新增商单 ${turn.generatedOfferIds.length} 件` : ' · 本轮无新商单'}</div>
                  </div>
                </details>
              )}
            </article>
          ))}
          {generating && <div className="generating-row"><div className="mini-avatar bot"><LoaderCircle size={18} className="spin" /></div><span>{conversation.streamerName}正在接话…</span><i /><i /><i /></div>}
          <div ref={endRef} />
        </div>
      </div>

      <div className="composer-wrap">
        {live && <div className="composer-notice"><Radio size={13} />本轮发言将公开进入直播，并在回复后评分</div>}
        <div className="composer">
          <textarea
            value={input}
            onChange={event => setInput(event.target.value.slice(0, 4000))}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSend()
              }
            }}
            placeholder={`以经纪人身份和${conversation.streamerName}聊聊…`}
            rows={2}
            aria-label="聊天消息"
          />
          <div className="composer-bottom">
            <span>{input.length > 3600 ? `${input.length}/4000` : 'Enter 发送 · Shift+Enter 换行'}</span>
            {generating ? (
              <button className="send-button stop" onClick={onStop} aria-label="停止生成"><Square size={17} fill="currentColor" /></button>
            ) : (
              <button className="send-button" disabled={!input.trim()} onClick={onSend} aria-label="发送消息"><ArrowUp size={20} /></button>
            )}
          </div>
        </div>
        <div className="local-note"><Send size={11} />内容仅保存在当前浏览器；模型回复可能被评分器用于游戏结算</div>
      </div>
    </main>
  )
}
