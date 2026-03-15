import React from 'react'
import type { Word } from '@/types'
import { useStore } from '@/store'

interface Props {
  word: Word
  index: number
  isDeleted: boolean
  isActive: boolean
}

export function WordToken({ word, index, isDeleted, isActive }: Props) {
  const setCurrentTimeMs = useStore(s => s.setCurrentTimeMs)

  return (
    <span
      onClick={() => setCurrentTimeMs(word.start_ms)}
      style={{
        display: 'inline-block',
        margin: '0 2px',
        padding: '2px 4px',
        borderRadius: 3,
        cursor: 'pointer',
        fontSize: 15,
        lineHeight: 1.8,
        background: isDeleted
          ? '#fee2e2'
          : isActive
          ? '#dbeafe'
          : 'transparent',
        textDecoration: isDeleted ? 'line-through' : 'none',
        color: isDeleted ? '#ef4444' : isActive ? '#1d4ed8' : '#111',
        opacity: word.confidence < 0.6 ? 0.6 : 1,
        transition: 'background 0.1s',
      }}
      title={`${(word.start_ms / 1000).toFixed(2)}s – ${(word.end_ms / 1000).toFixed(2)}s`}
    >
      {word.word}
    </span>
  )
}
