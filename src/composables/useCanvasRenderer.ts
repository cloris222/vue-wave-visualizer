// src/composables/useCanvasRenderer.ts
import type { Ref } from 'vue'
import type { WaveMode, RendererOptions } from '@/types'
import { drawWaveform } from '@/renderers/drawWaveform'
import { drawBars } from '@/renderers/drawBars'
import { drawCircular } from '@/renderers/drawCircular'
import { drawMirrorBars } from '@/renderers/drawMirrorBars'

interface RendererCallbacks {
  silenceThreshold?: number
  silenceDuration?: number
  onSilence?: (payload: { duration: number }) => void
  onAudioActive?: () => void
}

interface UseCanvasRendererReturn {
  start: (
    canvasRef: Ref<HTMLCanvasElement | null>,
    analyserRef: Ref<AnalyserNode | null>,
    modeRef: Ref<WaveMode>,
    optionsRef: Ref<RendererOptions>,
    callbacks?: RendererCallbacks
  ) => void
  stop: () => void
  renderCalmState: (
    canvasRef: Ref<HTMLCanvasElement | null>,
    modeRef: Ref<WaveMode>,
    optionsRef: Ref<RendererOptions>,
    analyserRef?: Ref<AnalyserNode | null>
  ) => void
}

export function useCanvasRenderer(): UseCanvasRendererReturn {
  let rafId: number | null = null
  let silenceElapsed = 0
  let alreadySilent = false
  let lastTime: number | null = null

  function computeRMS(data: Uint8Array): number {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0 - 1.0
      sum += v * v
    }
    return Math.sqrt(sum / data.length)
  }

  function getCanvasOptions(
    canvas: HTMLCanvasElement,
    options: RendererOptions,
  ): RendererOptions {
    return {
      ...options,
      width: canvas.width,
      height: canvas.height,
    }
  }

  function draw(
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    mode: WaveMode,
    options: RendererOptions,
  ) {
    switch (mode) {
      case 'waveform': drawWaveform(ctx, data, options); break
      case 'bars': drawBars(ctx, data, options); break
      case 'circular': drawCircular(ctx, data, options); break
      case 'mirror-bars': drawMirrorBars(ctx, data, options); break
    }
  }

  function start(
    canvasRef: Ref<HTMLCanvasElement | null>,
    analyserRef: Ref<AnalyserNode | null>,
    modeRef: Ref<WaveMode>,
    optionsRef: Ref<RendererOptions>,
    callbacks: RendererCallbacks = {},
  ) {
    const {
      silenceThreshold = 0.01,
      silenceDuration = 1500,
      onSilence,
      onAudioActive,
    } = callbacks

    function loop(timestamp: number) {
      const canvas = canvasRef.value
      const analyser = analyserRef.value
      if (!canvas || !analyser) { rafId = requestAnimationFrame(loop); return }

      const ctx = canvas.getContext('2d')
      if (!ctx) { rafId = requestAnimationFrame(loop); return }

      const frameDelta = lastTime !== null ? timestamp - lastTime : 0
      lastTime = timestamp

      const mode = modeRef.value
      const opts = getCanvasOptions(canvas, optionsRef.value)

      // Get data
      let data: Uint8Array<ArrayBuffer>
      if (mode === 'waveform') {
        data = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
        analyser.getByteTimeDomainData(data)
      } else {
        data = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
        analyser.getByteFrequencyData(data)
      }

      // Silence detection always uses time domain RMS.
      // In waveform mode, `data` is already time-domain — reuse it to avoid a second read.
      let tdData: Uint8Array<ArrayBuffer>
      if (mode === 'waveform') {
        tdData = data
      } else {
        tdData = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
        analyser.getByteTimeDomainData(tdData)
      }
      const rms = computeRMS(tdData)

      if (rms < silenceThreshold) {
        silenceElapsed += frameDelta
        if (silenceElapsed >= silenceDuration && !alreadySilent) {
          alreadySilent = true
          onSilence?.({ duration: silenceElapsed })
        }
      } else {
        if (alreadySilent) {
          alreadySilent = false
          silenceElapsed = 0
          onAudioActive?.()
        } else {
          silenceElapsed = 0
        }
      }

      draw(ctx, data, mode, opts)
      rafId = requestAnimationFrame(loop)
    }

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    rafId = requestAnimationFrame(loop)
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    silenceElapsed = 0
    alreadySilent = false
    lastTime = null
  }

  function renderCalmState(
    canvasRef: Ref<HTMLCanvasElement | null>,
    modeRef: Ref<WaveMode>,
    optionsRef: Ref<RendererOptions>,
    analyserRef?: Ref<AnalyserNode | null>,
  ) {
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const opts = getCanvasOptions(canvas, optionsRef.value)
    const fftSize = analyserRef?.value?.fftSize ?? 2048
    const zeros = new Uint8Array(
      modeRef.value === 'waveform' ? fftSize : opts.barCount
    ).fill(modeRef.value === 'waveform' ? 128 : 0)
    draw(ctx, zeros, modeRef.value, opts)
  }

  return { start, stop, renderCalmState }
}
