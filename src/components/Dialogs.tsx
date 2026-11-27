import { useRef, useState } from 'react'
import { Archive, Bot, Check, Download, FileJson, GitBranch, Plus, Settings, Trash2, UploadCloud } from 'lucide-react'
import { PRODUCT_TEMPLATES, clone } from '../game/defaults'
import { resolveTurns } from '../game/engine'
import type { Conversation, GameSnapshot, OfferDraft, ProviderSettings, Turn } from '../game/types'
import { EmptyState, Field, Modal, Switch, cx } from './Material'

export function SettingsDialog({ settings, conversation, onSave, onClose }: {
  settings: ProviderSettings
  conversation: Conversation
  onSave: (settings: ProviderSettings, title: string, streamerName: string, persona: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(clone(settings))
  const [title, setTitle] = useState(conversation.title)
  const [name, setName] = useState(conversation.streamerName)
  const [persona, setPersona] = useState(conversation.persona)
  return <Modal title="设置" description="模型、主播人设与本地评分方式" onClose={onClose} wide>
    <div className="dialog-form two-columns">
      <Field label="聊天搭档"><select value={draft.mode} onChange={e => setDraft({ ...draft, mode: e.target.value as ProviderSettings['mode'] })}><option value="demo">本地演示搭档（规则回复）</option><option value="openai">OpenAI 兼容模型接口</option></select></Field>
      <Field label="模型名称"><input value={draft.model} disabled={draft.mode === 'demo'} onChange={e => setDraft({ ...draft, model: e.target.value })} /></Field>
      {draft.mode === 'openai' && <>
        <Field label="API Base URL" hint="需支持浏览器跨域与工具调用"><input value={draft.baseUrl} onChange={e => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="https://api.example.com/v1" /></Field>
        <Field label="API Key" hint="仅保存到当前浏览器 localStorage"><input type="password" autoComplete="off" value={draft.apiKey} onChange={e => setDraft({ ...draft, apiKey: e.target.value })} placeholder="sk-…" /></Field>
      </>}
      <Field label="存档名称"><input value={title} maxLength={40} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="主播名"><input value={name} maxLength={16} onChange={e => setName(e.target.value)} /></Field>
      <div className="span-two"><Field label="主播人设"><textarea rows={4} value={persona} onChange={e => setPersona(e.target.value)} /></Field></div>
      <div className="semantic-setting span-two"><div><strong>本地语义增强评分</strong><p>按需下载约 120 MB 的多语言 MiniLM 编码器，在浏览器中计算向量；不使用大语言模型评分。加载失败会自动退回规则。</p></div><Switch checked={draft.semantic} onChange={() => setDraft({ ...draft, semantic: !draft.semantic })} label="本地语义增强评分" /></div>
    </div>
    <div className="dialog-actions"><button onClick={onClose}>取消</button><button className="md-primary" disabled={!title.trim() || !name.trim()} onClick={() => onSave(draft, title.trim(), name.trim(), persona.trim())}><Check size={16} />保存设置</button></div>
  </Modal>
}

const blankDraft: OfferDraft = {
  name: '', content: '', reward: { money: 300, fans: 10, heat: 0.03 },
  scorer: { requiredKeywords: [], positivePrototype: '', negativePrototype: '没有完成推广要求', threshold: 0.52 },
}

export function SponsorDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (draft: OfferDraft, mode: 'direct' | 'next') => void }) {
  const [draft, setDraft] = useState<OfferDraft>(clone(PRODUCT_TEMPLATES[5]))
  const [mode, setMode] = useState<'direct' | 'next'>('direct')
  const [template, setTemplate] = useState('tea')
  const selectTemplate = (id: string) => {
    setTemplate(id)
    const found = PRODUCT_TEMPLATES.find(item => item.templateId === id)
    setDraft(found ? clone(found) : clone(blankDraft))
  }
  return <Modal title="创建商单" description="本体负责接单与结算；商单自带独立达标打分器" onClose={onClose} wide>
    <div className="segmented-control"><button className={mode === 'direct' ? 'active' : ''} onClick={() => setMode('direct')}>立即加入累计列表</button><button className={mode === 'next' ? 'active' : ''} onClick={() => setMode('next')}>设为下一次生成输出</button></div>
    <div className="dialog-form two-columns">
      <div className="span-two"><Field label="商品模板"><select value={template} onChange={e => selectTemplate(e.target.value)}>{PRODUCT_TEMPLATES.map(item => <option key={item.templateId} value={item.templateId}>{item.name}</option>)}<option value="custom">完全自定义</option></select></Field></div>
      <Field label="商单名称"><input value={draft.name} maxLength={40} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
      <Field label="指定关键词" hint="用中文逗号分隔；结算时必须全部出现"><input value={draft.scorer.requiredKeywords.join('，')} onChange={e => setDraft({ ...draft, scorer: { ...draft.scorer, requiredKeywords: e.target.value.split(/[,，]/).map(v => v.trim()).filter(Boolean) } })} /></Field>
      <div className="span-two"><Field label="商单内容"><textarea rows={3} value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} /></Field></div>
      <div className="span-two"><Field label="达标语义原型" hint="语义增强开启时，与直播履约内容计算相似度"><textarea rows={2} value={draft.scorer.positivePrototype} onChange={e => setDraft({ ...draft, scorer: { ...draft.scorer, positivePrototype: e.target.value } })} /></Field></div>
      <Field label="货币奖励"><input type="number" min="0" value={draft.reward.money} onChange={e => setDraft({ ...draft, reward: { ...draft.reward, money: Number(e.target.value) } })} /></Field>
      <Field label="粉丝奖励"><input type="number" value={draft.reward.fans} onChange={e => setDraft({ ...draft, reward: { ...draft.reward, fans: Number(e.target.value) } })} /></Field>
      <Field label="热度奖励"><input type="number" min="0" max="1" step="0.01" value={draft.reward.heat} onChange={e => setDraft({ ...draft, reward: { ...draft.reward, heat: Number(e.target.value) } })} /></Field>
      <Field label="达标阈值"><input type="number" min="0.1" max="0.95" step="0.01" value={draft.scorer.threshold} onChange={e => setDraft({ ...draft, scorer: { ...draft.scorer, threshold: Number(e.target.value) } })} /></Field>
    </div>
    <div className="dialog-actions"><button onClick={onClose}>取消</button><button className="md-primary" disabled={!draft.name.trim() || !draft.content.trim()} onClick={() => onSubmit(draft, mode)}>{mode === 'next' ? '保存到下次生成' : '创建商单'}</button></div>
  </Modal>
}

export function EconomyDialog({ snapshot, onClose, onApply }: { snapshot: GameSnapshot; onClose: () => void; onApply: (delta: { money: number; fans: number; viewers: number; heat: number }) => void }) {
  const [delta, setDelta] = useState({ money: 0, fans: 0, viewers: 0, heat: 0 })
  return <Modal title="手动干预经济" description="调整会记录为当前分支的控制事件，不进入内容评分" onClose={onClose}>
    <div className="economy-current"><span>当前</span><b>¥{snapshot.money}</b><b>{snapshot.fans} 粉丝</b><b>{snapshot.viewers} 观众</b><b>{Math.round(snapshot.heat * 100)} 热度</b></div>
    <div className="dialog-form two-columns">
      {(['money', 'fans', 'viewers', 'heat'] as const).map(key => <Field key={key} label={{ money: '货币增减', fans: '粉丝增减', viewers: '观众增减', heat: '热度增减（-1～1）' }[key]}><input type="number" step={key === 'heat' ? 0.01 : 1} value={delta[key]} onChange={e => setDelta({ ...delta, [key]: Number(e.target.value) })} /></Field>)}
    </div>
    <div className="dialog-actions"><button onClick={onClose}>取消</button><button className="md-primary" onClick={() => onApply(delta)}>应用调整</button></div>
  </Modal>
}

export function BranchesDialog({ conversation, onClose, onSwitch }: { conversation: Conversation; onClose: () => void; onSwitch: (id: string) => void }) {
  return <Modal title="存档分支" description="润色或重新生成历史回复会创建新分支，原分支始终保留" onClose={onClose} wide>
    <div className="branch-list">{conversation.branches.map((branch, index) => {
      const active = branch.id === conversation.activeBranchId
      return <button key={branch.id} className={cx('branch-list-item', active && 'active')} onClick={() => onSwitch(branch.id)}>
        <span className="branch-icon"><GitBranch size={19} /></span>
        <span><strong>{branch.name}</strong><small>{resolveTurns(conversation, branch.id).length} 回合 · {branch.parentBranchId ? '从历史回合分叉' : '根分支'} · {branch.snapshot.offers.length} 件累计商单</small></span>
        {active ? <span className="current-badge">当前</span> : <span className="branch-index">{String(index + 1).padStart(2, '0')}</span>}
      </button>
    })}</div>
  </Modal>
}

export function DataDialog({ onClose, onImport, onExportAll, onExportCurrent }: {
  onClose: () => void
  onImport: (file: File) => Promise<string>
  onExportAll: () => void
  onExportCurrent: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState('')
  const handle = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setReport('')
    try { setReport(await onImport(file)) } catch (error) { setReport(error instanceof Error ? error.message : String(error)) } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }
  return <Modal title="数据导入与导出" description="聊天、评分、商单和分支都保存在浏览器 IndexedDB" onClose={onClose}>
    <button className="upload-zone" disabled={busy} onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void handle(e.dataTransfer.files[0]) }}>
      <UploadCloud size={28} /><strong>{busy ? '正在本地解析…' : '选择或拖入历史存档'}</strong><span>支持 chat-demo 格式 3 ZIP，以及 bikbok JSON</span>
    </button>
    <input ref={inputRef} type="file" accept=".zip,.json" hidden onChange={e => void handle(e.target.files?.[0])} />
    <div className="import-note"><Archive size={17} /><p>chat-demo 的 REQUEST／RESPONSE 会导入为可见聊天并保留分支；THINK 与工具片段不进入玩法。导入回合默认是下播历史，不追溯评分或产生商单。</p></div>
    {report && <div className="import-report">{report}</div>}
    <div className="data-actions"><button onClick={onExportCurrent}><FileJson size={17} />导出当前存档</button><button onClick={onExportAll}><Download size={17} />导出全部存档</button></div>
  </Modal>
}

export function ConversationsDialog({ conversations, currentId, onClose, onSelect, onNew, onDelete }: {
  conversations: Conversation[]
  currentId: string
  onClose: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  return <Modal title="聊天存档" description="每个存档都有独立的分支与直播经营状态" onClose={onClose} wide>
    <button className="new-conversation" onClick={onNew}><Plus size={18} />新建聊天存档</button>
    <div className="conversation-list">{conversations.map(item => <div key={item.id} className={cx('conversation-item', item.id === currentId && 'active')}>
      <button className="conversation-select" onClick={() => onSelect(item.id)}><span className="mini-avatar bot"><Bot size={17} /></span><span><strong>{item.title}</strong><small>{item.streamerName} · {item.branches.length} 条分支 · {item.source === 'chat-demo' ? 'chat-demo 导入' : 'bikbok'}</small></span></button>
      <button className="delete-button" onClick={() => onDelete(item.id)} aria-label={`删除 ${item.title}`}><Trash2 size={16} /></button>
    </div>)}</div>
  </Modal>
}

export function EditReplyDialog({ turn, busy, onClose, onSave }: { turn: Turn; busy: boolean; onClose: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState(turn.assistant)
  return <Modal title="润色 AI 回复" description="将从此回合前创建新分支，并使用润色后的直播内容重新评分" onClose={onClose} wide>
    <div className="original-user">玩家当时说：{turn.user}</div>
    <Field label="新分支中的主播回复"><textarea autoFocus rows={10} value={text} onChange={e => setText(e.target.value)} /></Field>
    <div className="branch-warning"><GitBranch size={17} />原回复和原分支后续内容不会修改。</div>
    <div className="dialog-actions"><button onClick={onClose}>取消</button><button className="md-primary" disabled={busy || !text.trim()} onClick={() => onSave(text.trim())}>{busy ? '正在评分…' : '保存为新分支'}</button></div>
  </Modal>
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return <Modal title="关于 bikbok" onClose={onClose}>
    <EmptyState icon={<Settings size={28} />} title="轻量直播搭档沙盒" detail="纯前端、无应用后端。默认本地演示搭档用于验证玩法；接入真实模型需要在设置中配置兼容接口。弹幕与自动商单默认均为空。" />
  </Modal>
}
