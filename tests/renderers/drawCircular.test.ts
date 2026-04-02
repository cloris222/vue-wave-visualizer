// tests/renderers/drawCircular.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drawCircular } from '@/renderers/drawCircular'
import type { RendererOptions } from '@/types'

function makeCtx() {
  return {
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
  } as unknown as CanvasRenderingContext2D
}

const opts: RendererOptions = {
  color: '#d2a8ff', backgroundColor: 'transparent',
  barCount: 8, lineWidth: 2, width: 200, height: 200,
}

describe('drawCircular', () => {
  it('calls stroke barCount times', () => {
    const ctx = makeCtx()
    drawCircular(ctx, new Uint8Array(128).fill(128), opts)
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBe(8)
  })

  it('sets strokeStyle to color', () => {
    const ctx = makeCtx()
    drawCircular(ctx, new Uint8Array(128).fill(128), opts)
    expect(ctx.strokeStyle).toBe('#d2a8ff')
  })

  it('calls clearRect', () => {
    const ctx = makeCtx()
    drawCircular(ctx, new Uint8Array(128).fill(0), opts)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 200, 200)
  })
})
