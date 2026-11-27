import { uid } from '../game/defaults'

let worker: Worker | null = null
let broken = false
const pending = new Map<string, { resolve: (v: number[][] | null) => void; timer: number }>()

const failAll = () => {
  pending.forEach(({ resolve, timer }) => {
    window.clearTimeout(timer)
    resolve(null)
  })
  pending.clear()
}

export const embedTexts = (texts: string[]): Promise<number[][] | null> => {
  if (broken || typeof Worker === 'undefined') return Promise.resolve(null)
  const id = uid('vec')
  return new Promise(resolve => {
    try {
      if (!worker) {
        worker = new Worker(new URL('./semantic.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = event => {
          const item = pending.get(event.data.id)
          if (!item) return
          if (event.data.type === 'loading') return
          window.clearTimeout(item.timer)
          pending.delete(event.data.id)
          if (event.data.type === 'result') item.resolve(event.data.vectors)
          else item.resolve(null)
        }
        worker.onerror = () => {
          broken = true
          worker?.terminate()
          worker = null
          failAll()
        }
      }
      const timer = window.setTimeout(() => {
        pending.delete(id)
        resolve(null)
      }, 120_000)
      pending.set(id, { resolve, timer })
      worker.postMessage({ id, texts })
    } catch {
      broken = true
      resolve(null)
    }
  })
}

export const cosine = (a: number[], b: number[]) => {
  if (!a?.length || a.length !== b?.length) return 0
  let dot = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    aa += a[i] * a[i]
    bb += b[i] * b[i]
  }
  return dot / (Math.sqrt(aa * bb) || 1)
}

export const semanticSimilarity = async (texts: string[]) => {
  const vectors = await embedTexts(texts)
  if (!vectors || vectors.length !== texts.length) return null
  return { vectors, cosine }
}
