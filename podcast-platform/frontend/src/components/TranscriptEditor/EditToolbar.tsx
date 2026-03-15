import React, { useState } from 'react'
import { useStore } from '@/store'
import { detectSilences } from '@/api/client'

const FILLER_WORDS = new Set(['um', 'uh', 'like', 'you know', 'basically', 'literally', '嗯', '啊', '那个', '就是'])

export function EditToolbar() {
  const { session, transcript, currentRecording, addOperation, undoOperation } = useStore()
  const [silenceLoading, setSilenceLoading] = useState(false)

  const removeFillers = async () => {
    if (!transcript || !session) return
    const fillerIndices: number[] = []
    transcript.words.forEach((w, i) => {
      if (FILLER_WORDS.has(w.word.toLowerCase().trim())) {
        fillerIndices.push(i)
      }
    })

    let i = 0
    while (i < fillerIndices.length) {
      const start = fillerIndices[i]
      let end = start
      while (i + 1 < fillerIndices.length && fillerIndices[i + 1] === fillerIndices[i] + 1) {
        i++
        end = fillerIndices[i]
      }
      await addOperation({
        op_type: 'remove_filler',
        payload: {
          start_ms: transcript.words[start].start_ms,
          end_ms: transcript.words[end].end_ms,
          word_indices: Array.from({ length: end - start + 1 }, (_, k) => start + k),
          reason: 'filler_word',
        },
      })
      i++
    }
  }

  const cutSilences = async () => {
    if (!currentRecording || !session) return
    setSilenceLoading(true)
    try {
      const { silences } = await detectSilences(currentRecording.id)
      for (const s of silences) {
        const alreadyCovered = session.operations.some(
          op => op.payload.start_ms === s.start_ms && op.payload.end_ms === s.end_ms
        )
        if (!alreadyCovered) {
          await addOperation({
            op_type: 'cut_silence',
            payload: { start_ms: s.start_ms, end_ms: s.end_ms, reason: 'silence' },
          })
        }
      }
    } finally {
      setSilenceLoading(false)
    }
  }

  const undoLast = async () => {
    if (!session || session.operations.length === 0) return
    const last = session.operations[session.operations.length - 1]
    await undoOperation(last.id)
  }

  return (
    <div style={{ display: 'flex', gap: 8, padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb', marginBottom: '0.75rem' }}>
      <button onClick={removeFillers} disabled={!session} style={btnStyle}>
        Remove Fillers (嗯/啊/um/uh)
      </button>
      <button onClick={cutSilences} disabled={!session || !currentRecording || silenceLoading} style={btnStyle}>
        {silenceLoading ? 'Detecting...' : 'Cut Silences'}
      </button>
      <button onClick={undoLast} disabled={!session || session.operations.length === 0} style={btnStyle}>
        Undo Last Cut
      </button>
      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
        {session?.operations.length ?? 0} edit(s)
      </span>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  cursor: 'pointer',
}
