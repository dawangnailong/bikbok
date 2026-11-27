import { strFromU8, unzipSync } from 'fflate'
import { clone, createConversation, initialSnapshot, uid } from '../game/defaults'
import { DEFAULT_PERSONA } from '../game/defaults'
import type { Branch, Conversation, Turn } from '../game/types'

type DemoNode = {
  id: number
  parent_id: number | null
  role: 'USER' | 'ASSISTANT'
  status?: string
  fragments?: Array<{ type?: string; content?: string; files?: unknown[] }>
}

const textOf = (node: DemoNode) => {
  const wanted = node.role === 'USER' ? 'REQUEST' : 'RESPONSE'
  return (node.fragments ?? []).filter(part => part.type === wanted && typeof part.content === 'string').map(part => part.content).join('\n').trim()
}

export async function importChatDemoZip(file: File): Promise<{ conversations: Conversation[]; skippedAttachments: number }> {
  if (file.size > 200 * 1024 * 1024) throw new Error('ZIP 超过 200 MB，请先拆分存档。')
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const manifestEntry = entries['manifest.json']
  if (!manifestEntry) throw new Error('不是有效的 chat-demo 导出：缺少 manifest.json。')
  const manifest = JSON.parse(strFromU8(manifestEntry))
  if (manifest.export_format_version !== 3) throw new Error(`暂支持 chat-demo 格式 3，当前文件为 ${manifest.export_format_version ?? '未知版本'}。`)

  let skippedAttachments = 0
  const sessionPaths = Object.keys(entries).filter(path => /^chat_sessions\/[^/]+\.json$/.test(path))
  if (!sessionPaths.length) throw new Error('ZIP 中没有可导入的会话。')

  const conversations = sessionPaths.map((path, sessionIndex): Conversation => {
    const session = JSON.parse(strFromU8(entries[path]))
    const nodes = (session.messages ?? []) as DemoNode[]
    const byParent = new Map<number | null, DemoNode[]>()
    nodes.forEach(node => {
      const list = byParent.get(node.parent_id) ?? []
      list.push(node)
      byParent.set(node.parent_id, list)
    })
    nodes.forEach(node => { skippedAttachments += (node.fragments ?? []).reduce((sum, part) => sum + (part.type === 'FILE' ? part.files?.length ?? 0 : 0), 0) })

    const paths: DemoNode[][] = []
    const walk = (node: DemoNode, prefix: DemoNode[]) => {
      const next = [...prefix, node]
      const children = (byParent.get(node.id) ?? []).sort((a, b) => a.id - b.id)
      if (!children.length) paths.push(next)
      else children.forEach(child => walk(child, next))
    }
    const roots = (byParent.get(null) ?? []).filter(node => node.role === 'USER').sort((a, b) => a.id - b.id)
    roots.forEach(root => walk(root, []))

    const base = createConversation(session.title || `chat-demo 导入 ${sessionIndex + 1}`)
    const branches: Branch[] = paths.map((nodePath, pathIndex) => {
      const turns: Turn[] = []
      let snapshot = initialSnapshot()
      for (let i = 0; i < nodePath.length; i += 2) {
        const userNode = nodePath[i]
        if (!userNode || userNode.role !== 'USER') continue
        const assistantNode = nodePath[i + 1]?.role === 'ASSISTANT' ? nodePath[i + 1] : null
        const preSnapshot = clone(snapshot)
        snapshot = clone(snapshot)
        snapshot.turnCount += 1
        turns.push({
          id: uid('turn'),
          parentId: turns.at(-1)?.id ?? null,
          user: textOf(userNode),
          assistant: assistantNode ? textOf(assistantNode) : '',
          live: false,
          title: snapshot.title,
          category: snapshot.category,
          createdAt: Date.now() + i,
          status: assistantNode && textOf(assistantNode) ? 'done' : 'stopped',
          imported: true,
          generatedOfferIds: [],
          preSnapshot,
          postSnapshot: clone(snapshot),
        })
      }
      return {
        id: uid('branch'),
        name: pathIndex === 0 ? '导入主线' : `导入分支 ${pathIndex + 1}`,
        parentBranchId: null,
        forkAtTurnId: null,
        turns,
        snapshot,
        events: [],
      }
    })
    if (!branches.length) branches.push(base.branches[0])

    const currentPath = paths.find(path => path.at(-1)?.id === session.current_message_id)
      ?? paths.find(path => path.some(node => node.id === session.current_message_id))
    const activeIndex = currentPath ? paths.indexOf(currentPath) : 0
    return {
      ...base,
      title: session.title || `chat-demo 导入 ${sessionIndex + 1}`,
      persona: DEFAULT_PERSONA,
      branches,
      activeBranchId: branches[activeIndex]?.id ?? branches[0].id,
      source: 'chat-demo',
      createdAt: Date.parse(session.inserted_at) || Date.now(),
      updatedAt: Date.parse(session.updated_at) || Date.now(),
    }
  })
  return { conversations, skippedAttachments }
}
