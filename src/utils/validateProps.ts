// src/utils/validateProps.ts
import type { WaveVisualizerProps, ValidatedProps, WaveMode } from '@/types'

const VALID_MODES: WaveMode[] = ['waveform', 'bars', 'circular', 'mirror-bars']

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

export function validateProps(props: WaveVisualizerProps): ValidatedProps {
  let { height = 120, fftSize = 2048, smoothingTimeConstant = 0.8, mode,
        barCount = 64, lineWidth = 2 } = props

  if (height <= 0) {
    console.warn('[WaveVisualizer] height must be > 0. Using default 120.')
    height = 120
  }

  if (!isPowerOfTwo(fftSize) || fftSize < 32 || fftSize > 32768) {
    console.warn(`[WaveVisualizer] fftSize must be a power of two in [32, 32768]. Got ${fftSize}. Using 2048.`)
    fftSize = 2048
  }

  if (smoothingTimeConstant < 0 || smoothingTimeConstant > 1) {
    console.warn(`[WaveVisualizer] smoothingTimeConstant must be in [0, 1]. Got ${smoothingTimeConstant}. Clamping.`)
    smoothingTimeConstant = Math.max(0, Math.min(1, smoothingTimeConstant))
  }

  if (!VALID_MODES.includes(mode)) {
    console.warn(`[WaveVisualizer] Unknown mode "${mode}". Falling back to "bars".`)
    mode = 'bars'
  }

  if (!Number.isInteger(barCount) || barCount <= 0) {
    console.warn(`[WaveVisualizer] barCount must be a positive integer. Got ${barCount}. Using 64.`)
    barCount = 64
  }

  if (lineWidth <= 0) {
    console.warn(`[WaveVisualizer] lineWidth must be > 0. Got ${lineWidth}. Using 2.`)
    lineWidth = 2
  }

  return {
    height,
    color: props.color ?? '#58a6ff',
    backgroundColor: props.backgroundColor ?? 'transparent',
    barCount,
    lineWidth,
    fftSize,
    smoothingTimeConstant,
    silenceThreshold: props.silenceThreshold ?? 0.01,
    silenceDuration: props.silenceDuration ?? 1500,
    mode,
  }
}
