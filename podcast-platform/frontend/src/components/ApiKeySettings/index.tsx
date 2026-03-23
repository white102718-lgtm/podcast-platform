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
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl p-10 w-[480px] max-w-[90vw] shadow-2xl flex flex-col gap-7">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-primary-500 rounded-[14px] flex items-center justify-center">
            <span className="text-white font-bold text-[26px]">P</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <h3 className="text-[22px] font-bold text-slate-900 tracking-tight">欢迎使用 PodCraft</h3>
            <p className="text-sm text-slate-500 text-center leading-[22px]">
              开始之前，请设置你的 API 密钥。密钥仅保存在浏览器本地，不会上传到服务器。
            </p>
          </div>
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-4.5">
          {/* OpenAI Key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[13px] font-semibold text-slate-700">OpenAI API Key</label>
              <div className="px-1.5 py-0.5 bg-amber-100 rounded">
                <span className="text-[10px] font-medium text-amber-800">必填</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-400">用于 Whisper 语音转文字</span>
            <input
              type="password"
              value={oKey}
              onChange={e => setOKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Anthropic Key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Anthropic API Key</label>
              <div className="px-1.5 py-0.5 bg-slate-100 rounded">
                <span className="text-[10px] font-medium text-slate-600">可选</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-400">用于 AI 生成 Show Notes 和营销文案</span>
            <input
              type="password"
              value={aKey}
              onChange={e => setAKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2.5 px-3.5 py-3 bg-green-50 rounded-lg">
          <span className="text-sm flex-shrink-0 mt-0.5">🔒</span>
          <span className="text-xs text-green-700 leading-[18px]">
            你的密钥通过 HTTPS 直接发送到 OpenAI / Anthropic，服务器不会存储任何密钥信息。
          </span>
        </div>

        {/* Action button */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center py-2.75 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
        >
          <span className="text-white font-semibold text-sm">保存并开始</span>
        </button>
      </div>
    </div>
  )
}
