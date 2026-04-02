// src/renderers/drawMirrorBars.ts
import type { RendererOptions } from '@/types'
import { clearCanvas } from './clearCanvas'

export function drawMirrorBars(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  options: RendererOptions,
): void {
  const { color, backgroundColor, barCount, width, height } = options
  const count = Math.min(barCount, data.length)
  const centerY = height / 2

  ctx.save()
  clearCanvas(ctx, width, height, backgroundColor)

  const barWidth = width / count
  ctx.fillStyle = color

  for (let i = 0; i < count; i++) {
    const halfHeight = Math.max(1, (data[i] / 255) * centerY)
    const x = i * barWidth
    ctx.fillRect(x, centerY - halfHeight, barWidth - 1, halfHeight * 2)
  }
  ctx.restore()
}
