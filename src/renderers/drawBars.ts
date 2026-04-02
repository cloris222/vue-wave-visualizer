// src/renderers/drawBars.ts
import type { RendererOptions } from '@/types'
import { clearCanvas } from './clearCanvas'

export function drawBars(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  options: RendererOptions,
): void {
  const { color, backgroundColor, barCount, width, height } = options
  const count = Math.min(barCount, data.length)

  ctx.save()
  clearCanvas(ctx, width, height, backgroundColor)

  const barWidth = width / count
  ctx.fillStyle = color

  for (let i = 0; i < count; i++) {
    const barHeight = Math.max(1, (data[i] / 255) * height)
    const x = i * barWidth
    const y = height - barHeight
    ctx.fillRect(x, y, barWidth - 1, barHeight)
  }
  ctx.restore()
}
