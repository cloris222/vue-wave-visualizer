// src/renderers/drawBars.ts
import type { RendererOptions } from '@/types'

export function drawBars(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  options: RendererOptions,
): void {
  const { color, backgroundColor, barCount, width, height } = options
  const count = Math.min(barCount, data.length)

  ctx.clearRect(0, 0, width, height)
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)
  }

  const barWidth = width / count
  ctx.fillStyle = color

  for (let i = 0; i < count; i++) {
    const barHeight = Math.max(1, (data[i] / 255) * height)
    const x = i * barWidth
    const y = height - barHeight
    ctx.fillRect(x, y, barWidth - 1, barHeight)
  }
}
