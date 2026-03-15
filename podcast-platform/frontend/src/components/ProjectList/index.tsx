import React, { useState } from 'react'
import { useStore } from '@/store'

export function ProjectList() {
  const { projects, loadProjects, createProject, setCurrentProject } = useStore()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await createProject(title.trim())
    setTitle('')
    setLoading(false)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto' }}>
      <h1>Podcast Projects</h1>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="New project title..."
          style={{ flex: 1, padding: '0.5rem', fontSize: 14 }}
        />
        <button type="submit" disabled={loading || !title.trim()}>
          Create
        </button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {projects.map(p => (
          <li
            key={p.id}
            onClick={() => setCurrentProject(p)}
            style={{
              padding: '0.75rem 1rem',
              marginBottom: 8,
              border: '1px solid #ddd',
              borderRadius: 6,
              cursor: 'pointer',
              background: '#fafafa',
            }}
          >
            <strong>{p.title}</strong>
            {p.description && <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{p.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
