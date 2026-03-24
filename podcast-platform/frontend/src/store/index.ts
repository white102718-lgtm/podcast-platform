import { create } from 'zustand'
import type { Project, Recording, Transcript, EditSession, EditOperation, Word } from '@/types'
import * as api from '@/api/client'
import { extractAudioMetadata } from '@/utils/audioMetadata'

const LS_AI_PROVIDER = 'podcast_ai_provider'
const LS_AI_KEY = 'podcast_ai_key'
const LS_AI_BASE_URL = 'podcast_ai_base_url'

export type AIProvider = 'openai' | 'anthropic' | 'deepseek' | 'gemini' | 'qwen'

interface AppStore {
  // AI Provider
  aiProvider: AIProvider
  aiKey: string
  aiBaseUrl: string
  setAiProvider: (p: AIProvider) => void
  setAiKey: (k: string) => void
  setAiBaseUrl: (u: string) => void

  // Projects
  projects: Project[]
  currentProject: Project | null
  loadProjects: () => Promise<void>
  createProject: (title: string, description?: string) => Promise<Project>
  setCurrentProject: (p: Project) => void

  // Recording
  currentRecording: Recording | null
  setCurrentRecording: (r: Recording) => void
  uploadRecording: (projectId: string, file: File, onProgress?: (pct: number) => void) => Promise<Recording>
  pollRecordingStatus: (id: string) => Promise<void>

  // Transcript + session
  transcript: Transcript | null
  session: EditSession | null
  loadTranscriptAndSession: (recordingId: string) => Promise<void>

  // Editing
  editedText: string
  setEditedText: (text: string) => void
  autosaveText: () => Promise<void>
  addOperation: (op: Omit<EditOperation, 'id' | 'applied_order'>) => Promise<void>
  undoOperation: (opId: string) => Promise<void>

  // Playback
  currentTimeMs: number
  setCurrentTimeMs: (ms: number) => void

  // Export
  exportId: string | null
  exportStatus: string | null
  startExport: () => Promise<void>
  pollExport: () => Promise<void>
}

export const useStore = create<AppStore>((set, get) => ({
  // Load from localStorage on init
  aiProvider: (localStorage.getItem(LS_AI_PROVIDER) as AIProvider) || 'openai',
  aiKey: localStorage.getItem(LS_AI_KEY) ?? '',
  aiBaseUrl: localStorage.getItem(LS_AI_BASE_URL) ?? '',

  setAiProvider: (p) => {
    localStorage.setItem(LS_AI_PROVIDER, p)
    set({ aiProvider: p })
  },
  setAiKey: (k) => {
    localStorage.setItem(LS_AI_KEY, k)
    set({ aiKey: k })
  },
  setAiBaseUrl: (u) => {
    localStorage.setItem(LS_AI_BASE_URL, u)
    set({ aiBaseUrl: u })
  },

  projects: [],
  currentProject: null,
  currentRecording: null,
  transcript: null,
  session: null,
  editedText: '',
  currentTimeMs: 0,
  exportId: null,
  exportStatus: null,

  loadProjects: async () => {
    const projects = await api.listProjects()
    set({ projects })
  },

  createProject: async (title, description) => {
    const project = await api.createProject(title, description)
    set(s => ({ projects: [project, ...s.projects], currentProject: project }))
    return project
  },

  setCurrentProject: (p) => set({ currentProject: p }),

  setCurrentRecording: (r) => set({ currentRecording: r }),

  uploadRecording: async (projectId, file, onProgress) => {
    const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`文件大小超过 200MB 限制（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
    }

    // 1. Extract audio metadata in browser
    let duration_ms: number | null = null
    let sample_rate: number | null = null
    let channels: number | null = null
    try {
      const meta = await extractAudioMetadata(file)
      duration_ms = meta.duration_ms
      sample_rate = meta.sample_rate
      channels = meta.channels
    } catch {
      // metadata extraction is best-effort
    }

    // 2. Upload through backend proxy (avoids R2 CORS issues)
    const recording = await api.proxyUpload(projectId, file, { duration_ms, sample_rate, channels }, onProgress)
    set({ currentRecording: recording })
    return recording
  },

  pollRecordingStatus: async (id) => {
    const poll = async () => {
      const r = await api.getRecording(id)
      set({ currentRecording: r })
      if (r.status === 'pending' || r.status === 'transcribing') {
        setTimeout(poll, 2000)
      }
    }
    await poll()
  },

  loadTranscriptAndSession: async (recordingId) => {
    const transcript = await api.getTranscript(recordingId)
    set({ transcript, editedText: transcript.full_text })

    let session: EditSession
    try {
      session = await api.getLatestSession(transcript.id)
      set({ session, editedText: session.edited_text })
    } catch {
      session = await api.createSession(transcript.id)
      set({ session })
    }
  },

  setEditedText: (text) => set({ editedText: text }),

  autosaveText: async () => {
    const { session, editedText } = get()
    if (!session) return
    await api.saveText(session.id, editedText)
  },

  addOperation: async (op) => {
    const { session } = get()
    if (!session) return
    const newOp = await api.addOperation(session.id, op)
    set(s => ({
      session: s.session
        ? { ...s.session, operations: [...s.session.operations, newOp] }
        : s.session,
    }))
  },

  undoOperation: async (opId) => {
    const { session } = get()
    if (!session) return
    await api.deleteOperation(session.id, opId)
    set(s => ({
      session: s.session
        ? { ...s.session, operations: s.session.operations.filter(o => o.id !== opId) }
        : s.session,
    }))
  },

  setCurrentTimeMs: (ms) => set({ currentTimeMs: ms }),

  startExport: async () => {
    const { session } = get()
    if (!session) return
    const exp = await api.startExport(session.id)
    set({ exportId: exp.id, exportStatus: exp.status })
  },

  pollExport: async () => {
    const { exportId } = get()
    if (!exportId) return
    const poll = async () => {
      const exp = await api.getExport(exportId)
      set({ exportStatus: exp.status })
      if (exp.status === 'pending' || exp.status === 'processing') {
        setTimeout(poll, 2000)
      }
    }
    await poll()
  },
}))

// Word-level diff using LCS (Myers algorithm).
// Correctly handles repeated words — unlike the old set-membership approach,
// this tracks position so "the the the" deletions are precise.
export function computeDeletedRanges(
  originalWords: Word[],
  editedText: string
): Array<{ start_ms: number; end_ms: number; word_indices: number[] }> {
  const normalize = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

  const original = originalWords.map(w => normalize(w.word))
  const edited = editedText.split(/\s+/).filter(Boolean).map(normalize)

  const m = original.length
  const n = edited.length

  // Build LCS DP table (bottom-up, original=rows, edited=cols)
  const dp = new Uint16Array((m + 1) * (n + 1))
  const col = n + 1
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i * col + j] = original[i] === edited[j]
        ? 1 + dp[(i + 1) * col + (j + 1)]
        : Math.max(dp[(i + 1) * col + j], dp[i * col + (j + 1)])
    }
  }

  // Traceback: collect original indices NOT matched by LCS
  const deletedIndices: number[] = []
  let i = 0, j = 0
  while (i < m && j < n) {
    if (original[i] === edited[j]) {
      i++; j++
    } else if (dp[(i + 1) * col + j] >= dp[i * col + (j + 1)]) {
      deletedIndices.push(i++)
    } else {
      j++
    }
  }
  while (i < m) deletedIndices.push(i++)

  // Group contiguous deleted indices into time ranges
  const ranges: Array<{ start_ms: number; end_ms: number; word_indices: number[] }> = []
  let k = 0
  while (k < deletedIndices.length) {
    const start = deletedIndices[k]
    let end = start
    while (k + 1 < deletedIndices.length && deletedIndices[k + 1] === deletedIndices[k] + 1) {
      k++
      end = deletedIndices[k]
    }
    ranges.push({
      start_ms: originalWords[start].start_ms,
      end_ms: originalWords[end].end_ms,
      word_indices: Array.from({ length: end - start + 1 }, (_, offset) => start + offset),
    })
    k++
  }
  return ranges
}
