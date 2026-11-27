/// <reference lib="webworker" />
import { pipeline } from '@huggingface/transformers'

let extractor: any = null

self.onmessage = async (event: MessageEvent<{ id: string; texts: string[] }>) => {
  const { id, texts } = event.data
  try {
    if (!extractor) {
      self.postMessage({ type: 'loading', id })
      extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', { dtype: 'q8' })
    }
    const output = await extractor(texts, { pooling: 'mean', normalize: true })
    self.postMessage({ type: 'result', id, vectors: output.tolist() })
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) })
  }
}
