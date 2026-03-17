// tests/renderers/drawWaveform.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drawWaveform } from '@/renderers/drawWaveform'
import type { RendererOptions } from '@/types'

function makeCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

const opts: RendererOptions = {
  color: '#ff0000', backgroundColor: 'transparent',
  barCount: 64, lineWidth: 2, width: 300, height: 120,
}

describe('drawWaveform', () => {
  it('calls beginPath and stroke', () => {
    const ctx = makeCtx()
    const data = new Uint8Array(2048).fill(128)
    drawWaveform(ctx, data, opts)
    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('sets strokeStyle to color', () => {
    const ctx = makeCtx()
    drawWaveform(ctx, new Uint8Array(2048).fill(128), opts)
    expect(ctx.strokeStyle).toBe('#ff0000')
  })

  it('clears canvas before drawing', () => {
    const ctx = makeCtx()
    drawWaveform(ctx, new Uint8Array(2048).fill(128), opts)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 300, 120)
  })

  it('fills background when backgroundColor is not transparent', () => {
    const ctx = makeCtx()
    drawWaveform(ctx, new Uint8Array(2048).fill(128), { ...opts, backgroundColor: '#000' })
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 300, 120)
    expect(ctx.fillStyle).toBe('#000')
  })

  it('draws a flat line when all samples are at center (128)', () => {
    const ctx = makeCtx()
    const moveSpy = vi.spyOn(ctx, 'moveTo')
    drawWaveform(ctx, new Uint8Array(2048).fill(128), opts)
    // First point should be at y = height/2 = 60
    expect(moveSpy.mock.calls[0][1]).toBeCloseTo(60, 0)
  })
})
