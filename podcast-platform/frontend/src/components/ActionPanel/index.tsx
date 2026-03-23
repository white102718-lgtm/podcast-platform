import React from 'react'
import { useStore } from '@/store'
import { getDownloadUrl, generateShowNotes, generateMarketingCopy, detectSilences } from '@/api/client'

export function ActionPanel() {
  const { session, exportId, exportStatus, startExport, pollExport, undoOperation, currentRecording, addOperation, transcript } = useStore()
  const [showNotes, setShowNotes] = React.useState<string | null>(null)
  const [marketingCopy, setMarketingCopy] = React.useState<string | null>(null)
  const [contentLoading, setContentLoading] = React.useState(false)
  const [silenceLoading, setSilenceLoading] = React.useState(false)

  const handleExport = async () => {
    await startExport()
    await pollExport()
  }

  const handleShowNotes = async () => {
    if (!session) return
    setContentLoading(true)
    try {
      const result = await generateShowNotes(session.id)
      setShowNotes(result.show_notes)
    } finally {
      setContentLoading(false)
    }
  }

  const handleMarketingCopy = async () => {
    if (!session) return
    setContentLoading(true)
    try {
      const result = await generateMarketingCopy(session.id)
      setMarketingCopy(result.marketing_copy)
    } finally {
      setContentLoading(false)
    }
  }

  const removeFillers = async () => {
    if (!transcript || !session) return
    const FILLER_WORDS = new Set(['um', 'uh', 'like', 'you know', 'basically', 'literally', '嗯', '啊', '那个', '就是'])
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

  if (!session) return null

  const totalCuts = session.operations.length
  const totalSavedMs = session.operations.reduce((sum, op) => sum + (op.payload.end_ms - op.payload.start_ms), 0)
  const savedMinutes = Math.floor(totalSavedMs / 60000)
  const savedSeconds = Math.floor((totalSavedMs % 60000) / 1000)

  return (
    <div className="flex flex-col w-[260px] h-full bg-white border-l border-slate-200 flex-shrink-0 px-5 py-6 gap-6 overflow-y-auto">

      {/* Quick Actions */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">快捷操作</span>

        <button
          onClick={removeFillers}
          disabled={!session}
          className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <div className="w-7 h-7 bg-amber-100 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-[13px]">🗑</span>
          </div>
          <div className="flex flex-col gap-0 items-start">
            <span className="text-[13px] font-medium text-slate-800">去口头禅</span>
            <span className="text-[11px] text-slate-400">嗯/啊/um/uh/那个</span>
          </div>
        </button>

        <button
          onClick={cutSilences}
          disabled={!session || !currentRecording || silenceLoading}
          className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <div className="w-7 h-7 bg-purple-100 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-[13px]">🔇</span>
          </div>
          <div className="flex flex-col gap-0 items-start">
            <span className="text-[13px] font-medium text-slate-800">去静音段</span>
            <span className="text-[11px] text-slate-400">{silenceLoading ? '检测中...' : '自动检测并移除'}</span>
          </div>
        </button>

        <button
          onClick={undoLast}
          disabled={!session || session.operations.length === 0}
          className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <div className="w-7 h-7 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-[13px]">↩</span>
          </div>
          <div className="flex flex-col gap-0 items-start">
            <span className="text-[13px] font-medium text-slate-800">撤销上一步</span>
            <span className="text-[11px] text-slate-400">恢复最近一次剪切</span>
          </div>
        </button>
      </div>

      {/* Audio Enhancement */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">音频增强</span>

        <button className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors">
          <div className="w-7 h-7 bg-blue-100 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-[13px]">🎚</span>
          </div>
          <div className="flex flex-col gap-0 items-start">
            <span className="text-[13px] font-medium text-slate-800">录音室级 EQ</span>
            <span className="text-[11px] text-slate-400">专业均衡器调节</span>
          </div>
        </button>

        <button className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors">
          <div className="w-7 h-7 bg-green-100 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-[13px]">⚖</span>
          </div>
          <div className="flex flex-col gap-0 items-start">
            <span className="text-[13px] font-medium text-slate-800">音频平衡</span>
            <span className="text-[11px] text-slate-400">自动调节高低音</span>
          </div>
        </button>
      </div>

      <div className="w-full h-px bg-slate-200" />

      {/* Edit Stats */}
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">编辑统计</span>

        <div className="flex gap-3">
          <div className="flex flex-col gap-0.5 flex-1 px-3 py-3 bg-slate-50 rounded-lg">
            <span className="font-mono text-[22px] font-bold text-slate-900">{totalCuts}</span>
            <span className="text-[11px] text-slate-400">处剪切</span>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 px-3 py-3 bg-slate-50 rounded-lg">
            <span className="font-mono text-[22px] font-bold text-slate-900">{savedMinutes}:{String(savedSeconds).padStart(2, '0')}</span>
            <span className="text-[11px] text-slate-400">已节省</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 px-3 py-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600">原始时长</span>
            <span className="font-mono text-xs font-medium text-slate-600">03:24</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-green-700">剪辑后</span>
            <span className="font-mono text-xs font-semibold text-green-700">02:39</span>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-slate-200" />

      {/* AI Content */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">AI 内容生成</span>

        <button
          onClick={handleShowNotes}
          disabled={contentLoading}
          className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <div className="w-7 h-7 bg-blue-100 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-xs">📝</span>
          </div>
          <span className="text-[13px] font-medium text-slate-800">生成 Show Notes</span>
        </button>

        <button
          onClick={handleMarketingCopy}
          disabled={contentLoading}
          className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <div className="w-7 h-7 bg-pink-100 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-xs">📣</span>
          </div>
          <span className="text-[13px] font-medium text-slate-800">生成营销文案</span>
        </button>
      </div>

      <div className="w-full h-px bg-slate-200" />

      {/* Export */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleExport}
          disabled={exportStatus === 'processing' || exportStatus === 'pending'}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <span className="text-white font-medium text-[14px]">
            {exportStatus === 'processing' || exportStatus === 'pending' ? '导出中...' : '导出 MP3'}
          </span>
        </button>

        {exportStatus === 'done' && exportId && (
          <a
            href={getDownloadUrl(exportId)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center py-2 text-[13px] font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            下载 MP3
          </a>
        )}
      </div>

      {/* Generated Content Display */}
      {showNotes && (
        <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <strong className="text-[13px] text-slate-900">Show Notes</strong>
          <pre className="text-[11px] text-slate-600 whitespace-pre-wrap">{showNotes}</pre>
        </div>
      )}

      {marketingCopy && (
        <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <strong className="text-[13px] text-slate-900">营销文案</strong>
          <pre className="text-[11px] text-slate-600 whitespace-pre-wrap">{marketingCopy}</pre>
        </div>
      )}
    </div>
  )
}
