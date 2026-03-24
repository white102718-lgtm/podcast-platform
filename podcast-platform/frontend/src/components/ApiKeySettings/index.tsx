import React, { useState } from 'react'
import { useStore } from '@/store'
import type { AIProvider } from '@/store'

interface Props {
  onClose: () => void
}

const PROVIDERS: { value: AIProvider; label: string; placeholder: string; hint: string }[] = [
  { value: 'openai', label: 'OpenAI', placeholder: 'sk-...', hint: '支持语音转文字 (Whisper) + 文本生成 (GPT-4o)' },
  { value: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...', hint: '支持语音转文字 + 文本生成 (Claude)' },
  { value: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...', hint: '仅支持文本生成，转录需切换到 OpenAI/Anthropic/Gemini' },
  { value: 'gemini', label: 'Google Gemini', placeholder: 'AIza...', hint: '支持语音转文字 + 文本生成 (Gemini 2.0)' },
  { value: 'qwen', label: '通义千问 (Qwen)', placeholder: 'sk-...', hint: '仅支持文本生成，转录需切换到 OpenAI/Anthropic/Gemini' },
]

export function ApiKeySettings({ onClose }: Props) {
  const { aiProvider, aiKey, aiBaseUrl, setAiProvider, setAiKey, setAiBaseUrl } = useStore()
  const [provider, setProvider] = useState<AIProvider>(aiProvider)
  const [key, setKey] = useState(aiKey)
  const [baseUrl, setBaseUrl] = useState(aiBaseUrl)

  const current = PROVIDERS.find(p => p.value === provider)!

  const handleSave = () => {
    setAiProvider(provider)
    setAiKey(key)
    setAiBaseUrl(baseUrl.trim())
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
              选择一个 AI 服务商，所有功能（转录、生成 Show Notes、营销文案）都将使用同一个模型。
            </p>
          </div>
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-4.5">
          {/* Provider selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-slate-700">AI 服务商</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value as AIProvider)}
              className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400">{current.hint}</span>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[13px] font-semibold text-slate-700">{current.label} API Key</label>
              <div className="px-1.5 py-0.5 bg-amber-100 rounded">
                <span className="text-[10px] font-medium text-amber-800">必填</span>
              </div>
            </div>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder={current.placeholder}
              className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* API Base URL (proxy) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[13px] font-semibold text-slate-700">API Base URL</label>
              <div className="px-1.5 py-0.5 bg-slate-100 rounded">
                <span className="text-[10px] font-medium text-slate-500">选填</span>
              </div>
            </div>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="留空使用官方地址，填写代理地址如 https://your-proxy.com/v1"
              className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <span className="text-[11px] text-slate-400">使用第三方代理时填写，如 one-api、new-api 等中转服务地址</span>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2.5 px-3.5 py-3 bg-green-50 rounded-lg">
          <span className="text-sm flex-shrink-0 mt-0.5">🔒</span>
          <span className="text-xs text-green-700 leading-[18px]">
            密钥仅保存在浏览器本地，通过 HTTPS 直接发送到对应服务商，服务器不会存储。
          </span>
        </div>

        {/* Action button */}
        <button
          onClick={handleSave}
          disabled={!key.trim()}
          className="w-full flex items-center justify-center py-2.75 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <span className="text-white font-semibold text-sm">保存并开始</span>
        </button>
      </div>
    </div>
  )
}
