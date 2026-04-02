// tests/composables/useCanvasRenderer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCanvasRenderer } from '@/composables/useCanvasRenderer'
import type { RendererOptions } from '@/types'

function makeMockAnalyser() {
  const analyser = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => arr.fill(128)),
    getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(0)),
  }
  return analyser as unknown as AnalyserNode
}

function makeCanvas() {
  return {
    width: 300,
    height: 120,
    style: { width: '', height: '' },
    getContext: vi.fn(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      fillStyle: '',
    })),
    getBoundingClientRect: vi.fn(() => ({ width: 300 })),
  } as unknown as HTMLCanvasElement
}

describe('useCanvasRenderer', () => {
  it('starts and stops the rAF loop', async () => {
    const analyserRef = ref(makeMockAnalyser())
    const canvasRef = ref(makeCanvas())
    const { start, stop } = useCanvasRenderer()
    start(canvasRef, analyserRef, ref('bars'), ref({ color: '#fff', backgroundColor: 'transparent', barCount: 64, lineWidth: 2, width: 300, height: 120 } as RendererOptions))
    await new Promise(r => setTimeout(r, 50))
    stop()
  })

  it('emits silence after threshold duration', async () => {
    const onSilence = vi.fn()
    const analyserRef = ref(makeMockAnalyser())
    const canvasRef = ref(makeCanvas())
    const { start, stop } = useCanvasRenderer()

    // All samples at 128 = zero RMS = silence
    start(canvasRef, analyserRef, ref('bars'), ref({ color: '#fff', backgroundColor: 'transparent', barCount: 64, lineWidth: 2, width: 300, height: 120 } as RendererOptions), {
      silenceThreshold: 0.01,
      silenceDuration: 0, // fire immediately
      onSilence,
    })
    await new Promise(r => setTimeout(r, 50))
    expect(onSilence).toHaveBeenCalled()
    stop()
  })
})
