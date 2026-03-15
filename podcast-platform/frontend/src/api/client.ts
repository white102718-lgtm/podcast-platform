import axios from 'axios'
import type { Project, Recording, Transcript, EditSession, EditOperation, Export } from '@/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

// Read keys directly from localStorage to avoid circular import with store
api.interceptors.request.use(config => {
  const openaiKey = localStorage.getItem('podcast_openai_key')
  const anthropicKey = localStorage.getItem('podcast_anthropic_key')
  if (openaiKey) config.headers['X-OpenAI-Key'] = openaiKey
  if (anthropicKey) config.headers['X-Anthropic-Key'] = anthropicKey
  return config
})

// Projects
export const createProject = (title: string, description?: string) =>
  api.post<Project>('/projects', { title, description }).then(r => r.data)

export const listProjects = () =>
  api.get<Project[]>('/projects').then(r => r.data)

export const getProject = (id: string) =>
  api.get<Project>(`/projects/${id}`).then(r => r.data)

// Recordings
export const uploadRecording = (projectId: string, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<Recording>(`/projects/${projectId}/recordings`, form).then(r => r.data)
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
