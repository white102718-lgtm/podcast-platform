import React, { useState } from 'react'
import { useStore } from '@/store'

interface Props {
  onClose: () => void
}

export function ApiKeySettings({ onClose }: Props) {
  const { openaiKey, anthropicKey, setOpenaiKey, setAnthropicKey } = useStore()
  const [oKey, setOKey] = useState(openaiKey)
  const [aKey, setAKey] = useState(anthropicKey)

  const handleSave = () => {
    setOpenaiKey(oKey)
    setAnthropicKey(aKey)
    onClose()
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalStyle}>
        <h3 style={{ margin: '0 0 1rem', fontSize: 16 }}>API Keys</h3>
        <p style={{ margin: '0 0 1.25rem', fontSize: 13, color: '#6b7280' }}>
          Keys are saved in your browser only and sent directly to OpenAI / Anthropic — never stored on the server.
        </p>

        <label style={labelStyle}>OpenAI API Key (Whisper transcription)</label>
        <input
          type="password"
          value={oKey}
          onChange={e => setOKey(e.target.value)}
          placeholder="sk-..."
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: '0.75rem' }}>Anthropic API Key (Show Notes &amp; Marketing Copy)</label>
        <input
          type="password"
          value={aKey}
          onChange={e => setAKey(e.target.value)}
          placeholder="sk-ant-..."
          style={inputStyle}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button onClick={handleSave} style={saveBtnStyle}>Save</button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  padding: '1.5rem',
  width: 420,
  maxWidth: '90vw',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  boxSizing: 'border-box',
  fontFamily: 'monospace',
}

const saveBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  borderRadius: 4,
  border: 'none',
  background: '#4f46e5',
  color: '#fff',
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  cursor: 'pointer',
}
