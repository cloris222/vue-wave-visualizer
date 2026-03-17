// src/types/index.ts

export type WaveMode = 'waveform' | 'bars' | 'circular' | 'mirror-bars'

export interface WaveVisualizerProps {
  stream: MediaStream | null
  mode: WaveMode
  height?: number
  color?: string
  backgroundColor?: string
  barCount?: number
  lineWidth?: number
  fftSize?: number
  smoothingTimeConstant?: number
  silenceThreshold?: number
  silenceDuration?: number
}

export interface WaveVisualizerEmits {
  (event: 'stream-end'): void
  (event: 'silence', payload: { duration: number }): void
  (event: 'audio-active'): void
  (event: 'error', payload: { code: string; message: string }): void
}

export interface RendererOptions {
  color: string
  backgroundColor: string
  barCount: number
  lineWidth: number
  width: number   // logical CSS pixels
  height: number
}

export interface ValidatedProps {
  height: number
  color: string
  backgroundColor: string
  barCount: number
  lineWidth: number
  fftSize: number
  smoothingTimeConstant: number
  silenceThreshold: number
  silenceDuration: number
  mode: WaveMode
}
