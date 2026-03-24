import axios from 'axios'
import type { Project, Recording, Transcript, EditSession, EditOperation, Export } from '@/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

// Inject unified AI provider headers from localStorage
api.interceptors.request.use(config => {
  const provider = localStorage.getItem('podcast_ai_provider') || 'openai'
  const key = localStorage.getItem('podcast_ai_key')
  const baseUrl = localStorage.getItem('podcast_ai_base_url')
  config.headers['X-AI-Provider'] = provider
  if (key) config.headers['X-AI-Key'] = key
  if (baseUrl) config.headers['X-AI-Base-URL'] = baseUrl
  return config
})

// Global error event — App.tsx listens to this
api.interceptors.response.use(
  r => r,
  err => {
    const msg: string =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      '请求失败'
    window.dispatchEvent(new CustomEvent('api-error', { detail: msg }))
    return Promise.reject(err)
  }
)

// Projects
export const createProject = (title: string, description?: string) =>
  api.post<Project>('/projects', { title, description }).then(r => r.data)

export const listProjects = () =>
  api.get<Project[]>('/projects').then(r => r.data)

export const getProject = (id: string) =>
  api.get<Project>(`/projects/${id}`).then(r => r.data)

// Recordings — upload through backend proxy (avoids R2 CORS issues)
export const proxyUpload = (
  projectId: string,
  file: File,
  metadata: { duration_ms: number | null; sample_rate: number | null; channels: number | null },
  onProgress?: (pct: number) => void,
): Promise<Recording> => {
  const form = new FormData()
  form.append('file', file)
  if (metadata.duration_ms != null) form.append('duration_ms', String(metadata.duration_ms))
  if (metadata.sample_rate != null) form.append('sample_rate', String(metadata.sample_rate))
  if (metadata.channels != null) form.append('channels', String(metadata.channels))

  return api.post<Recording>(`/projects/${projectId}/recordings/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  }).then(r => r.data)
}

export const getRecording = (id: string) =>
  api.get<Recording>(`/recordings/${id}`).then(r => r.data)

export const startTranscription = (recordingId: string) =>
  api.post(`/recordings/${recordingId}/transcribe`).then(r => r.data)

export const getTranscript = (recordingId: string) =>
  api.get<Transcript>(`/recordings/${recordingId}/transcript`).then(r => r.data)

export const detectSilences = (
  recordingId: string,
  params?: { min_silence_ms?: number; silence_thresh_db?: number; keep_padding_ms?: number }
) =>
  api.get<{ silences: Array<{ start_ms: number; end_ms: number }>; count: number }>(
    `/recordings/${recordingId}/silences`,
    { params }
  ).then(r => r.data)

// Edit sessions
export const getLatestSession = (transcriptId: string) =>
  api.get<EditSession>(`/transcripts/${transcriptId}/sessions/latest`).then(r => r.data)

export const createSession = (transcriptId: string) =>
  api.post<EditSession>(`/transcripts/${transcriptId}/sessions`).then(r => r.data)

export const getSession = (sessionId: string) =>
  api.get<EditSession>(`/edit-sessions/${sessionId}`).then(r => r.data)

export const saveText = (sessionId: string, editedText: string) =>
  api.patch<EditSession>(`/edit-sessions/${sessionId}/text`, { edited_text: editedText }).then(r => r.data)

export const addOperation = (sessionId: string, op: Omit<EditOperation, 'id' | 'applied_order'>) =>
  api.post<EditOperation>(`/edit-sessions/${sessionId}/operations`, op).then(r => r.data)

export const deleteOperation = (sessionId: string, opId: string) =>
  api.delete(`/edit-sessions/${sessionId}/operations/${opId}`)

// Export
export const startExport = (sessionId: string) =>
  api.post<Export>(`/edit-sessions/${sessionId}/export`).then(r => r.data)

export const getExport = (exportId: string) =>
  api.get<Export>(`/exports/${exportId}`).then(r => r.data)

export const getDownloadUrl = (exportId: string) =>
  `${import.meta.env.VITE_API_BASE_URL || '/api'}/exports/${exportId}/download`

// Content generation
export const generateShowNotes = (sessionId: string) =>
  api.post<{ show_notes: string }>(`/edit-sessions/${sessionId}/show-notes`).then(r => r.data)

export const generateMarketingCopy = (sessionId: string) =>
  api.post<{ marketing_copy: string }>(`/edit-sessions/${sessionId}/marketing-copy`).then(r => r.data)
