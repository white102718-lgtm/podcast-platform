import React, { useCallback, useRef } from 'react'
import { useStore, computeDeletedRanges } from '@/store'
import { WordToken } from './WordToken'
import { EditToolbar } from './EditToolbar'

export function TranscriptEditor() {
  const { transcript, session, editedText, setEditedText, autosaveText, addOperation, currentTimeMs } = useStore()
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value
      setEditedText(newText)

      // debounced autosave
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      autosaveTimer.current = setTimeout(async () => {
        await autosaveText()

        // compute deleted ranges and post operations
        if (!transcript) return
        const ranges = computeDeletedRanges(transcript.words, newText)
        for (const range of ranges) {
          // only add if not already covered by existing operations
          const alreadyCovered = session?.operations.some(
            op => op.payload.start_ms === range.start_ms && op.payload.end_ms === range.end_ms
          )
          if (!alreadyCovered) {
            await addOperation({
              op_type: 'delete_range',
              payload: { ...range, reason: 'user_delete' },
            })
          }
        }
      }, 1000)
    },
    [transcript, session, setEditedText, autosaveText, addOperation]
  )

  if (!transcript || !session) return null

  // Build set of deleted word indices from operations
  const deletedMs = new Set<string>()
  session.operations.forEach(op => {
    transcript.words.forEach((w, i) => {
      if (w.start_ms >= op.payload.start_ms && w.end_ms <= op.payload.end_ms) {
        deletedMs.add(String(i))
      }
    })
  })

  return (
    <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <EditToolbar />

      {/* Word token view — read-only visual with cut highlights */}
      <div
        style={{
          padding: '1rem',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          marginBottom: '1rem',
          lineHeight: 1.8,
          maxHeight: 200,
          overflowY: 'auto',
          background: '#fff',
        }}
      >
        {transcript.words.map((w, i) => (
          <WordToken
            key={i}
            word={w}
            index={i}
            isDeleted={deletedMs.has(String(i))}
            isActive={currentTimeMs >= w.start_ms && currentTimeMs < w.end_ms}
          />
        ))}
      </div>

      {/* Editable text area */}
      <textarea
        value={editedText}
        onChange={handleTextChange}
        style={{
          flex: 1,
          minHeight: 300,
          padding: '0.75rem',
          fontSize: 15,
          lineHeight: 1.7,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
        placeholder="Transcript will appear here. Delete text to cut the corresponding audio."
      />
      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
        Edits auto-save after 1 second. Deleted text = audio cut on export.
      </p>
    </div>
  )
}
