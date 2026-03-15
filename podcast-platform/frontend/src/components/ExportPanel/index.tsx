import React, { useState } from 'react'
import { useStore } from '@/store'
import { getDownloadUrl, generateShowNotes, generateMarketingCopy } from '@/api/client'

export function ExportPanel() {
  const { session, exportId, exportStatus, startExport, pollExport } = useStore()
  const [showNotes, setShowNotes] = useState<string | null>(null)
  const [marketingCopy, setMarketingCopy] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)

  const handleExport = async () => {
    await startExport()
    await pollExport()
  }

  const handleShowNotes = async () => {
    if (!session) return
    setContentLoading(true)
    const result = await generateShowNotes(session.id)
    setShowNotes(result.show_notes)
    setContentLoading(false)
  }

  const handleMarketingCopy = async () => {
    if (!session) return
    setContentLoading(true)
    const result = await generateMarketingCopy(session.id)
    setMarketingCopy(result.marketing_copy)
    setContentLoading(false)
  }

  if (!session) return null

  return (
    <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleExport}
          disabled={exportStatus === 'processing' || exportStatus === 'pending'}
          style={{ ...btnStyle, background: '#4f46e5', color: '#fff', border: 'none' }}
        >
          {exportStatus === 'processing' || exportStatus === 'pending'
            ? 'Exporting...'
            : 'Export MP3'}
        </button>

        {exportStatus === 'done' && exportId && (
          <a
            href={getDownloadUrl(exportId)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...btnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Download MP3
          </a>
        )}

        <button onClick={handleShowNotes} disabled={contentLoading} style={btnStyle}>
          Generate Show Notes
        </button>
        <button onClick={handleMarketingCopy} disabled={contentLoading} style={btnStyle}>
          Generate Marketing Copy
        </button>
      </div>

      {showNotes && (
        <div style={cardStyle}>
          <strong>Show Notes</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 13 }}>{showNotes}</pre>
        </div>
      )}

      {marketingCopy && (
        <div style={cardStyle}>
          <strong>Marketing Copy</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 13 }}>{marketingCopy}</pre>
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  padding: '0.75rem',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  marginBottom: '0.75rem',
  background: '#f9fafb',
}
