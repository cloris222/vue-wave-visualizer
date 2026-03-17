// tests/renderers/drawBars.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drawBars } from '@/renderers/drawBars'
import type { RendererOptions } from '@/types'

function makeCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

const opts: RendererOptions = {
  color: '#3fb950', backgroundColor: 'transparent',
  barCount: 4, lineWidth: 2, width: 200, height: 100,
}

describe('drawBars', () => {
  it('draws exactly barCount bars', () => {
    const ctx = makeCtx()
    const data = new Uint8Array(128).fill(200)
    drawBars(ctx, data, opts)
    // clearRect once + barCount fillRects
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(4)
  })

  it('draws no bars (height 0) when data is all zero', () => {
    const ctx = makeCtx()
    const fillSpy = vi.spyOn(ctx, 'fillRect')
    drawBars(ctx, new Uint8Array(128).fill(0), opts)
    // Each bar should have height 0 (minimum 1px enforced)
    fillSpy.mock.calls.forEach(call => {
      expect(call[3]).toBe(1) // height argument = 1px minimum
    })
  })

  it('sets fillStyle to color', () => {
    const ctx = makeCtx()
    drawBars(ctx, new Uint8Array(128).fill(100), opts)
    expect(ctx.fillStyle).toBe('#3fb950')
  })

  it('clamps barCount to frequencyBinCount', () => {
    const ctx = makeCtx()
    // barCount=200 but data only has 10 entries — clamp to 10
    drawBars(ctx, new Uint8Array(10).fill(128), { ...opts, barCount: 200 })
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(10)
  })
})
