// src/renderers/drawCircular.ts
import type { RendererOptions } from '@/types'

export function drawCircular(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  options: RendererOptions,
): void {
  const { color, backgroundColor, barCount, lineWidth, width, height } = options
  const count = Math.min(barCount, data.length)
  const cx = width / 2
  const cy = height / 2
  const baseRadius = Math.min(cx, cy) * 0.35
  const maxBarLength = Math.min(cx, cy) * 0.55

  ctx.clearRect(0, 0, width, height)
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)
  }

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const barLength = Math.max(2, (data[i] / 255) * maxBarLength)
    const x1 = cx + Math.cos(angle) * baseRadius
    const y1 = cy + Math.sin(angle) * baseRadius
    const x2 = cx + Math.cos(angle) * (baseRadius + barLength)
    const y2 = cy + Math.sin(angle) * (baseRadius + barLength)

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}
