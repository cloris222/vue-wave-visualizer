// tests/renderers/drawMirrorBars.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drawMirrorBars } from '@/renderers/drawMirrorBars'
import type { RendererOptions } from '@/types'

function makeCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

const opts: RendererOptions = {
  color: '#f78166', backgroundColor: 'transparent',
  barCount: 4, lineWidth: 2, width: 200, height: 100,
}

describe('drawMirrorBars', () => {
  it('draws barCount bars (each bar is one fillRect call)', () => {
    const ctx = makeCtx()
    drawMirrorBars(ctx, new Uint8Array(128).fill(200), opts)
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(4)
  })

  it('bars are centered vertically when data is full (255)', () => {
    const ctx = makeCtx()
    const fillSpy = vi.spyOn(ctx, 'fillRect')
    drawMirrorBars(ctx, new Uint8Array(128).fill(255), opts)
    // Each bar y should start at 0 and height should equal opts.height
    fillSpy.mock.calls.forEach(call => {
      expect(call[1]).toBe(0)        // y = top
      expect(call[3]).toBe(100)      // height = full
    })
  })
})
