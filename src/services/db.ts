import type { Conversation, ProviderSettings } from '../game/types'
import { DEFAULT_SETTINGS } from '../game/defaults'

const DB_NAME = 'bikbok-local'
const STORE = 'conversations'

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

export async function loadConversations() {
  const db = await open()
  return new Promise<Conversation[]>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    request.onsuccess = () => resolve(request.result as Conversation[])
    request.onerror = () => reject(request.error)
  })
}

export async function saveConversation(conversation: Conversation) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(conversation)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function deleteConversation(id: string) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export const loadSettings = (): ProviderSettings => {
  try {
    const value = localStorage.getItem('bikbok-settings')
    return value ? { ...DEFAULT_SETTINGS, ...JSON.parse(value) } : DEFAULT_SETTINGS
  } catch { return DEFAULT_SETTINGS }
}

export const saveSettings = (settings: ProviderSettings) => {
  try { localStorage.setItem('bikbok-settings', JSON.stringify(settings)) } catch { /* session-only fallback */ }
}
