export interface Project {
  id: string
  title: string
  description: string | null
}

export interface Recording {
  id: string
  project_id: string
  filename: string
  duration_ms: number | null
  status: 'uploading' | 'pending' | 'transcribing' | 'ready' | 'error'
  error_message: string | null
}

export interface Word {
  word: string
  start_ms: number
  end_ms: number
  confidence: number
}

export interface Transcript {
  id: string
  recording_id: string
  full_text: string
  words: Word[]
  language: string | null
}

export interface EditOperation {
  id: string
  op_type: 'delete_range' | 'cut_silence' | 'remove_filler'
  payload: {
    start_ms: number
    end_ms: number
    word_indices?: number[]
    reason?: string
  }
  applied_order: number
}

export interface EditSession {
  id: string
  transcript_id: string
  edited_text: string
  operations: EditOperation[]
}

export interface Export {
  id: string
  status: 'pending' | 'processing' | 'done' | 'error'
  output_path: string | null
  loudness_lufs: number | null
}
