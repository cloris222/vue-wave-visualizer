// src/composables/useAudioAnalyser.ts
import { ref } from 'vue'
import type { Ref } from 'vue'

interface AudioAnalyserCallbacks {
  onStreamEnd?: () => void
  onError?: (payload: { code: string; message: string }) => void
}

interface UseAudioAnalyserReturn {
  analyser: Ref<AnalyserNode | null>
  init: (stream: MediaStream, fftSize: number, smoothing: number, callbacks?: AudioAnalyserCallbacks) => void
  reconnect: (stream: MediaStream) => void
  cleanup: () => void
}

export function useAudioAnalyser(): UseAudioAnalyserReturn {
  const analyser = ref<AnalyserNode | null>(null)
  let ctx: AudioContext | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let callbacks: AudioAnalyserCallbacks = {}
  let trackEndedHandler: (() => void) | null = null
  let currentTrack: MediaStreamTrack | null = null

  function attachTrackListener(stream: MediaStream) {
    const tracks = stream.getAudioTracks()
    if (tracks.length === 0) {
      callbacks.onStreamEnd?.()
      return
    }
    currentTrack = tracks[0]
    if (currentTrack.readyState === 'ended') {
      callbacks.onStreamEnd?.()
      return
    }
    trackEndedHandler = () => callbacks.onStreamEnd?.()
    currentTrack.addEventListener('ended', trackEndedHandler)
  }

  function detachTrackListener() {
    if (currentTrack && trackEndedHandler) {
      currentTrack.removeEventListener('ended', trackEndedHandler)
    }
    currentTrack = null
    trackEndedHandler = null
  }

  function init(
    stream: MediaStream,
    fftSize: number,
    smoothing: number,
    cbs: AudioAnalyserCallbacks = {},
  ) {
    callbacks = cbs

    const AudioContextClass =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) {
      console.error('[WaveVisualizer] Web Audio API is not supported in this browser.')
      callbacks.onError?.({ code: 'UNSUPPORTED', message: 'Web Audio API not supported.' })
      return
    }

    try {
      ctx = new AudioContextClass()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[WaveVisualizer] Failed to create AudioContext:', msg)
      callbacks.onError?.({ code: 'AUDIO_CONTEXT_FAILED', message: msg })
      return
    }

    ctx.resume().catch(() => {
      // Degraded mode: autoplay policy suspended the context
    })

    const node = ctx.createAnalyser()
    node.fftSize = fftSize
    node.smoothingTimeConstant = smoothing
    analyser.value = node

    sourceNode = ctx.createMediaStreamSource(stream)
    sourceNode.connect(node)

    attachTrackListener(stream)
  }

  function reconnect(stream: MediaStream) {
    detachTrackListener()
    sourceNode?.disconnect()
    if (ctx && analyser.value) {
      sourceNode = ctx.createMediaStreamSource(stream)
      sourceNode.connect(analyser.value)
    }
    attachTrackListener(stream)
  }

  async function cleanup() {
    detachTrackListener()
    sourceNode?.disconnect()
    sourceNode = null
    analyser.value?.disconnect()
    analyser.value = null
    if (ctx) {
      await ctx.close()
      ctx = null
    }
  }

  return { analyser, init, reconnect, cleanup }
}
