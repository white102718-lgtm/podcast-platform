import React from 'react'
import { useStore } from '@/store'

export function Sidebar() {
  const { projects, loadProjects, createProject, currentProject, setCurrentProject } = useStore()
  const [showNewProject, setShowNewProject] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState('')

  React.useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createProject(newTitle.trim())
    setNewTitle('')
    setShowNewProject(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500'
      case 'transcribing': return 'bg-amber-500'
      case 'pending': return 'bg-blue-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-slate-300'
    }
  }

  const getStatusText = (status: string, duration?: number | null) => {
    switch (status) {
      case 'ready': return `已转录${duration ? ` · ${Math.floor(duration / 60000)}:${String(Math.floor((duration % 60000) / 1000)).padStart(2, '0')}` : ''}`
      case 'transcribing': return '转录中...'
      case 'pending': return '待转录'
      case 'error': return '错误'
      default: return '待上传'
    }
  }

  return (
    <div className="flex flex-col w-60 h-screen bg-white border-r border-slate-200 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-base">P</span>
        </div>
        <span className="text-slate-900 font-bold text-[17px] tracking-tight">PodCraft</span>
      </div>

      {/* New Project Button */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setShowNewProject(!showNewProject)}
          className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary-500 hover:bg-primary-600 rounded-md transition-colors"
        >
          <span className="text-white font-medium text-base">+</span>
          <span className="text-white font-medium text-[13px]">新建项目</span>
        </button>
      </div>

      {/* New Project Form */}
      {showNewProject && (
        <div className="px-4 mb-4">
          <form onSubmit={handleCreate} className="flex flex-col gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="项目名称..."
              className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 rounded hover:bg-primary-600"
              >
                创建
              </button>
              <button
                type="button"
                onClick={() => setShowNewProject(false)}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Section Label */}
      <div className="px-5 mb-2">
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">项目列表</span>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        {projects.map(project => {
          const isActive = currentProject?.id === project.id
          return (
            <button
              key={project.id}
              onClick={() => setCurrentProject(project)}
              className={`w-full flex items-center gap-2.5 px-5 py-2.5 transition-colors ${
                isActive
                  ? 'bg-primary-50 border-r-2 border-primary-500'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor('ready')}`} />
              <div className="flex flex-col gap-0.5 items-start flex-1 min-w-0">
                <span className={`text-[13px] font-semibold truncate ${
                  isActive ? 'text-primary-900' : 'text-slate-700'
                }`}>
                  {project.title}
                </span>
                <span className={`text-[11px] truncate ${
                  isActive ? 'text-primary-500' : 'text-slate-400'
                }`}>
                  {getStatusText('ready')}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Bottom Settings */}
      <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-200">
        <span className="text-slate-500 text-[13px]">⚙</span>
        <span className="text-slate-500 text-[13px]">API Keys</span>
        <div className="flex-1" />
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
      </div>
    </div>
  )
}
