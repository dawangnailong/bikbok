import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Bot, Check, Cloud, Database, GitBranch, Info, Menu, MessageCircle, Plus, Radio, Settings, SlidersHorizontal, X } from 'lucide-react'
import ChatArea from './components/ChatArea'
import LivePanel from './components/LivePanel'
import { AboutDialog, BranchesDialog, ConversationsDialog, DataDialog, EconomyDialog, EditReplyDialog, SettingsDialog, SponsorDialog } from './components/Dialogs'
import { clone, createConversation, uid } from './game/defaults'
import { activeBranch, addEvent, createFork, finalizeTurn, forkHistory, resolveTurns } from './game/engine'
import { composePrompt } from './game/prompt'
import { abandonOffer, acceptOffer, makeOffer, offerWindowText, settleOffer } from './game/sponsors'
import type { Conversation, GameSnapshot, Offer, OfferDraft, ProviderSettings, Turn } from './game/types'
import { deleteConversation as dbDelete, loadConversations, loadSettings, saveConversation, saveSettings } from './services/db'
import { generateAssistant } from './services/model'
import { importChatDemoZip } from './services/chatDemoImport'
import './App.css'

type ModalName = 'settings' | 'sponsor' | 'economy' | 'branches' | 'data' | 'conversations' | 'about' | null

const downloadJson = (data: unknown, name: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState('')
  const [settings, setSettings] = useState<ProviderSettings>(loadSettings)
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<ModalName>(null)
  const [editingTurn, setEditingTurn] = useState<Turn | null>(null)
  const [mobilePanel, setMobilePanel] = useState(false)
  const [toast, setToast] = useState('')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const abortRef = useRef<AbortController | null>(null)
  const saveChains = useRef(new Map<string, Promise<unknown>>())

  useEffect(() => {
    void (async () => {
      try {
        const stored = await loadConversations()
        const initial = stored.length ? stored : [createConversation()]
        if (!stored.length) await saveConversation(initial[0])
        setConversations(initial.sort((a, b) => b.updatedAt - a.updatedAt))
        const remembered = localStorage.getItem('bikbok-current')
        setCurrentId(initial.some(item => item.id === remembered) ? remembered! : initial[0].id)
      } catch {
        const fallback = createConversation()
        setConversations([fallback])
        setCurrentId(fallback.id)
        setSaveState('error')
      } finally { setReady(true) }
    })()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const current = conversations.find(item => item.id === currentId) ?? conversations[0]
  const branch = current ? activeBranch(current) : null
  const turns = useMemo(() => current ? resolveTurns(current) : [], [current])

  const commit = useCallback((next: Conversation) => {
    next.updatedAt = Date.now()
    setConversations(previous => previous.some(item => item.id === next.id) ? previous.map(item => item.id === next.id ? next : item) : [next, ...previous])
    setSaveState('saving')
    const previous = saveChains.current.get(next.id) ?? Promise.resolve()
    const chain = previous.catch(() => undefined).then(() => saveConversation(next)).then(() => setSaveState('saved')).catch(() => setSaveState('error'))
    saveChains.current.set(next.id, chain)
  }, [])

  const selectConversation = (id: string) => {
    setCurrentId(id)
    localStorage.setItem('bikbok-current', id)
    setInput('')
    setModal(null)
    setMobilePanel(false)
  }

  const patchSnapshot = (patch: Partial<GameSnapshot>, detail = '') => {
    if (!current || busy) return
    const next = clone(current)
    const target = activeBranch(next)
    Object.assign(target.snapshot, patch)
    if ('live' in patch) addEvent(target, 'live', detail)
    commit(next)
  }

  const runGeneration = async (next: Conversation, branchId: string, user: string, history: Turn[], preSnapshot: GameSnapshot) => {
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    const working = clone(preSnapshot)
    const turnId = uid('turn')
    try {
      const target = next.branches.find(item => item.id === branchId)!
      const messages = composePrompt(next, working, history)
      messages.push({ role: 'user', content: user })
      const assistant = await generateAssistant({
        settings,
        messages,
        signal: controller.signal,
        onTool: (name, args) => {
          if (name === 'view_sponsorships') return offerWindowText(working)
          if (name === 'accept_sponsorship') {
            const result = acceptOffer(working, String(args.offer_id ?? ''), turnId)
            return JSON.stringify(result)
          }
          return JSON.stringify({ ok: false, message: '未知工具。' })
        },
      })
      let turn: Turn = {
        id: turnId,
        parentId: history.at(-1)?.id ?? null,
        user,
        assistant,
        live: working.live,
        title: working.title,
        category: working.category,
        createdAt: Date.now(),
        status: 'done',
        generatedOfferIds: [],
        preSnapshot: clone(working),
        postSnapshot: clone(working),
      }
      turn = await finalizeTurn(turn, working, history, next.packId, settings.semantic)
      target.turns.push(turn)
      target.snapshot = clone(turn.postSnapshot)
      if (working.activeOfferId !== preSnapshot.activeOfferId) addEvent(target, 'sponsor', 'AI 通过工具接受了商单')
      commit(next)
      setInput('')
      setToast(turn.live ? `直播已结算：粉丝 ${turn.evaluation!.fanDelta >= 0 ? '+' : ''}${turn.evaluation!.fanDelta}，打赏 ¥${turn.evaluation!.tips}${turn.generatedOfferIds.length ? '，出现新商单' : ''}` : '私下交流已归档')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setToast('已停止生成，本轮未归档')
      else setToast(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || busy || !current || !branch) return
    const next = clone(current)
    const target = activeBranch(next)
    void runGeneration(next, target.id, text, turns, clone(target.snapshot))
  }

  const handleRegenerate = (source: Turn) => {
    if (!current || busy) return
    const next = clone(current)
    const original = resolveTurns(current).find(turn => turn.id === source.id) ?? source
    const newBranch = createFork(next, original, `重生 · ${activeBranch(next).name}`)
    next.branches.push(newBranch)
    next.activeBranchId = newBranch.id
    void runGeneration(next, newBranch.id, original.user, forkHistory(current, original), clone(original.preSnapshot))
  }

  const handleEdit = async (text: string) => {
    if (!current || !editingTurn || busy) return
    setBusy(true)
    try {
      const next = clone(current)
      const source = resolveTurns(current).find(turn => turn.id === editingTurn.id) ?? editingTurn
      const newBranch = createFork(next, source, `润色 · ${activeBranch(next).name}`)
      next.branches.push(newBranch)
      next.activeBranchId = newBranch.id
      let turn: Turn = {
        ...clone(source),
        id: uid('turn'),
        parentId: source.parentId,
        assistant: text,
        createdAt: Date.now(),
        editedFromId: source.id,
        evaluation: undefined,
        generatedOfferIds: [],
        preSnapshot: clone(source.preSnapshot),
        postSnapshot: clone(source.preSnapshot),
      }
      turn = await finalizeTurn(turn, clone(source.preSnapshot), forkHistory(current, source), next.packId, settings.semantic)
      newBranch.turns.push(turn)
      newBranch.snapshot = clone(turn.postSnapshot)
      addEvent(newBranch, 'branch', `润色回合 ${source.id} 并创建分支`)
      commit(next)
      setEditingTurn(null)
      setToast('润色已保存为新分支，原分支保持不变')
    } catch (error) { setToast(error instanceof Error ? error.message : String(error)) } finally { setBusy(false) }
  }

  const handleAccept = (offer: Offer) => {
    if (!current) return
    const next = clone(current)
    const target = activeBranch(next)
    const result = acceptOffer(target.snapshot, offer.id, turns.at(-1)?.id ?? null)
    if (result.ok) { addEvent(target, 'sponsor', result.message); commit(next) }
    setToast(result.message)
  }

  const handleSettle = async () => {
    if (!current || busy) return
    setBusy(true)
    const next = clone(current)
    const target = activeBranch(next)
    try {
      const result = await settleOffer(target.snapshot, settings.semantic)
      addEvent(target, 'settlement', result.message)
      commit(next)
      setToast(result.message)
    } catch (error) { setToast(error instanceof Error ? error.message : String(error)) } finally { setBusy(false) }
  }

  const handleCreateSponsor = (draft: OfferDraft, mode: 'direct' | 'next') => {
    if (!current) return
    const next = clone(current)
    const target = activeBranch(next)
    if (mode === 'next') {
      target.snapshot.nextPreset = clone(draft)
      addEvent(target, 'generator', `预设下一次商单：${draft.name}`)
      setToast(`已预设「${draft.name}」，将在下一次直播对话后出现`)
    } else {
      target.snapshot.offers.push(makeOffer(draft, next.packId, turns.at(-1)?.id ?? null))
      addEvent(target, 'sponsor', `手动创建商单：${draft.name}`)
      setToast('商单已加入累计列表')
    }
    commit(next)
    setModal(null)
  }

  const handleImport = async (file: File) => {
    let imported: Conversation[] = []
    let detail = ''
    if (file.name.toLowerCase().endsWith('.zip')) {
      const result = await importChatDemoZip(file)
      imported = result.conversations
      detail = `，略过 ${result.skippedAttachments} 个附件记录`
    } else {
      const data = JSON.parse(await file.text())
      if (data.kind !== 'bikbok-export' || !Array.isArray(data.conversations)) throw new Error('不是有效的 bikbok JSON 存档。')
      imported = data.conversations as Conversation[]
    }
    if (!imported.length) throw new Error('文件中没有会话。')
    imported.forEach(item => {
      if (conversations.some(existing => existing.id === item.id)) item.id = uid('c')
      commit(item)
    })
    selectConversation(imported[0].id)
    setModal('data')
    return `成功导入 ${imported.length} 个会话${detail}。历史回合均按原状态保留。`
  }

  const newConversation = () => {
    const item = createConversation(`和虚拟主播的新企划 ${conversations.length + 1}`)
    commit(item)
    selectConversation(item.id)
  }

  const removeConversation = (id: string) => {
    if (!window.confirm('确定删除这个聊天存档？其所有分支都会删除，且无法撤销。')) return
    const remaining = conversations.filter(item => item.id !== id)
    setConversations(remaining)
    void dbDelete(id)
    if (id === currentId) {
      if (remaining.length) selectConversation(remaining[0].id)
      else {
        const item = createConversation()
        commit(item)
        selectConversation(item.id)
      }
    }
    setToast('存档已删除')
  }

  if (!ready || !current || !branch) return <div className="app-loading"><div className="brand-mark">b</div><span>正在打开本地存档…</span></div>

  return (
    <div className="app-shell">
      <header className="top-app-bar">
        <button className="brand" onClick={() => setModal('about')} aria-label="关于 bikbok"><span className="brand-mark">b</span><strong>bikbok</strong><span className="beta-badge">DEMO</span></button>
        <div className="top-actions">
          <span className={`provider-badge ${settings.mode}`}><Bot size={14} />{settings.mode === 'demo' ? '本地演示搭档' : settings.model}</span>
          <span className="save-indicator">{saveState === 'saved' ? <Check size={14} /> : <Cloud size={14} />}{saveState === 'saved' ? '已保存到本机' : saveState === 'saving' ? '正在保存' : '仅本次会话'}</span>
          <button className="icon-button conversation-trigger" onClick={() => setModal('conversations')} aria-label="聊天存档"><Menu size={20} /></button>
          <button className="new-chat-button" onClick={newConversation}><Plus size={17} />新聊天</button>
          <button className="icon-button" onClick={() => setModal('settings')} aria-label="设置"><Settings size={20} /></button>
        </div>
      </header>

      <nav className="nav-rail" aria-label="主导航">
        <button className="active" onClick={() => { setMobilePanel(false); setModal(null) }}><MessageCircle size={21} /><span>聊天</span></button>
        <button onClick={() => setMobilePanel(true)}><Radio size={21} /><span>直播台</span></button>
        <button onClick={() => setModal('branches')}><GitBranch size={21} /><span>分支</span></button>
        <button onClick={() => setModal('data')}><Database size={21} /><span>数据</span></button>
        <div className="rail-spacer" />
        <button onClick={() => setModal('about')}><Info size={20} /><span>关于</span></button>
      </nav>

      <div className="workspace">
        <ChatArea conversation={current} turns={turns} live={branch.snapshot.live} generating={busy} input={input} setInput={setInput} onSend={handleSend} onStop={() => abortRef.current?.abort()} onEdit={turn => setEditingTurn(turn)} onRegenerate={handleRegenerate} onOpenBranches={() => setModal('branches')} />
        <div className="desktop-live-panel"><LivePanel snapshot={branch.snapshot} packId={current.packId} busy={busy} onPatch={patchSnapshot} onPack={pack => { const next = clone(current); next.packId = pack; addEvent(activeBranch(next), 'pack', `切换评分包：${pack}`); commit(next) }} onCreateSponsor={() => setModal('sponsor')} onAccept={handleAccept} onSettle={handleSettle} onAbandon={() => { const next = clone(current); const message = abandonOffer(activeBranch(next).snapshot); addEvent(activeBranch(next), 'sponsor', message); commit(next); setToast(message) }} onAddDanmaku={text => { const next = clone(current); activeBranch(next).snapshot.recentDanmaku.push({ id: uid('dm'), text, createdAt: Date.now() }); activeBranch(next).snapshot.recentDanmaku = activeBranch(next).snapshot.recentDanmaku.slice(-12); commit(next) }} onRemoveDanmaku={id => { const next = clone(current); const target = activeBranch(next); target.snapshot.recentDanmaku = target.snapshot.recentDanmaku.filter(item => item.id !== id); commit(next) }} onClearDanmaku={() => { const next = clone(current); activeBranch(next).snapshot.recentDanmaku = []; commit(next) }} onEconomy={() => setModal('economy')} /></div>
      </div>

      {mobilePanel && <div className="mobile-panel-backdrop" onClick={event => { if (event.target === event.currentTarget) setMobilePanel(false) }}><div className="mobile-live-panel"><LivePanel snapshot={branch.snapshot} packId={current.packId} busy={busy} onPatch={patchSnapshot} onPack={pack => { const next = clone(current); next.packId = pack; commit(next) }} onCreateSponsor={() => setModal('sponsor')} onAccept={handleAccept} onSettle={handleSettle} onAbandon={() => { const next = clone(current); setToast(abandonOffer(activeBranch(next).snapshot)); commit(next) }} onAddDanmaku={text => { const next = clone(current); activeBranch(next).snapshot.recentDanmaku.push({ id: uid('dm'), text, createdAt: Date.now() }); activeBranch(next).snapshot.recentDanmaku = activeBranch(next).snapshot.recentDanmaku.slice(-12); commit(next) }} onRemoveDanmaku={id => { const next = clone(current); const target = activeBranch(next); target.snapshot.recentDanmaku = target.snapshot.recentDanmaku.filter(item => item.id !== id); commit(next) }} onClearDanmaku={() => { const next = clone(current); activeBranch(next).snapshot.recentDanmaku = []; commit(next) }} onEconomy={() => setModal('economy')} onClose={() => setMobilePanel(false)} /></div></div>}

      <nav className="mobile-bottom-nav"><button className="active" onClick={() => setMobilePanel(false)}><MessageCircle size={20} /><span>聊天</span></button><button onClick={() => setMobilePanel(true)}><SlidersHorizontal size={20} /><span>直播台</span></button><button onClick={() => setModal('branches')}><GitBranch size={20} /><span>分支</span></button><button onClick={() => setModal('data')}><Archive size={20} /><span>数据</span></button></nav>

      {modal === 'settings' && <SettingsDialog settings={settings} conversation={current} onClose={() => setModal(null)} onSave={(nextSettings, title, name, persona) => { setSettings(nextSettings); saveSettings(nextSettings); const next = clone(current); next.title = title; next.streamerName = name; next.persona = persona; commit(next); setModal(null); setToast('设置已保存') }} />}
      {modal === 'sponsor' && <SponsorDialog onClose={() => setModal(null)} onSubmit={handleCreateSponsor} />}
      {modal === 'economy' && <EconomyDialog snapshot={branch.snapshot} onClose={() => setModal(null)} onApply={delta => { const next = clone(current); const target = activeBranch(next); target.snapshot.money = Math.max(0, target.snapshot.money + delta.money); target.snapshot.fans = Math.max(0, target.snapshot.fans + delta.fans); target.snapshot.viewers = Math.max(0, target.snapshot.viewers + delta.viewers); target.snapshot.heat = Math.max(0, Math.min(1, target.snapshot.heat + delta.heat)); addEvent(target, 'economy', `手动调整：${JSON.stringify(delta)}`); commit(next); setModal(null); setToast('经济调整已记录到当前分支') }} />}
      {modal === 'branches' && <BranchesDialog conversation={current} onClose={() => setModal(null)} onSwitch={id => { const next = clone(current); next.activeBranchId = id; commit(next); setModal(null); setToast('已切换分支') }} />}
      {modal === 'data' && <DataDialog onClose={() => setModal(null)} onImport={handleImport} onExportCurrent={() => downloadJson({ kind: 'bikbok-export', version: 1, conversations: [current] }, `${current.title}-bikbok.json`)} onExportAll={() => downloadJson({ kind: 'bikbok-export', version: 1, conversations }, `bikbok-全部存档-${new Date().toISOString().slice(0, 10)}.json`)} />}
      {modal === 'conversations' && <ConversationsDialog conversations={conversations} currentId={current.id} onClose={() => setModal(null)} onSelect={selectConversation} onNew={newConversation} onDelete={removeConversation} />}
      {modal === 'about' && <AboutDialog onClose={() => setModal(null)} />}
      {editingTurn && <EditReplyDialog turn={editingTurn} busy={busy} onClose={() => setEditingTurn(null)} onSave={handleEdit} />}
      {toast && <div className="toast" role="status"><Info size={16} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="关闭提示"><X size={15} /></button></div>}
    </div>
  )
}
