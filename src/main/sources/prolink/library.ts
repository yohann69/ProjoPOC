import { classifyError } from './errors'

export type Library = typeof import('alphatheta-connect')

/** Loaded on demand so a broken install reports an error instead of crashing app start-up. */
export async function loadLibrary(): Promise<Library> {
  try {
    return await import('alphatheta-connect')
  } catch (error) {
    throw classifyError(error)
  }
}
