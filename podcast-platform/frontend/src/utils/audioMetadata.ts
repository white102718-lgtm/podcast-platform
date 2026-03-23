export interface AudioMetadata {
  duration_ms: number | null
  sample_rate: number | null
  channels: number | null
}

/**
 * Extract audio metadata using an <audio> element + AudioContext.
 * This streams the file via object URL instead of decoding the entire
 * buffer into memory, so it works fine for large files (100MB+).
 */
export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  const url = URL.createObjectURL(file)
  try {
    // Use HTMLAudioElement to get duration without full decode
    const duration_ms = await new Promise<number | null>((resolve) => {
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        const dur = audio.duration
        resolve(Number.isFinite(dur) ? Math.round(dur * 1000) : null)
      }
      audio.onerror = () => resolve(null)
      audio.src = url
    })

    // Use AudioContext to sniff sample rate & channels from a tiny slice
    let sample_rate: number | null = null
    let channels: number | null = null
    try {
      const SLICE_SIZE = 256 * 1024 // 256KB is enough for header parsing
      const slice = file.slice(0, Math.min(SLICE_SIZE, file.size))
      const buf = await slice.arrayBuffer()
      const ctx = new AudioContext()
      try {
        const decoded = await ctx.decodeAudioData(buf)
        sample_rate = decoded.sampleRate
        channels = decoded.numberOfChannels
      } finally {
        await ctx.close()
      }
    } catch {
      // Some codecs may fail to decode a partial slice — that's fine
    }

    return { duration_ms, sample_rate, channels }
  } finally {
    URL.revokeObjectURL(url)
  }
}
