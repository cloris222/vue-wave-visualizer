// src/renderers/drawMirrorBars.ts
import type { RendererOptions } from '@/types'

export function drawMirrorBars(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  options: RendererOptions,
): void {
  const { color, backgroundColor, barCount, width, height } = options
  const count = Math.min(barCount, data.length)
  const centerY = height / 2

  ctx.clearRect(0, 0, width, height)
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)
  }

  const barWidth = width / count
  ctx.fillStyle = color

  for (let i = 0; i < count; i++) {
    const halfHeight = Math.max(1, (data[i] / 255) * centerY)
    const x = i * barWidth
    ctx.fillRect(x, centerY - halfHeight, barWidth - 1, halfHeight * 2)
  }
}
