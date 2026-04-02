// src/renderers/drawCircular.ts
import type { RendererOptions } from '@/types'
import { clearCanvas } from './clearCanvas'

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

  ctx.save()
  clearCanvas(ctx, width, height, backgroundColor)

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const barLength = Math.max(2, (data[i] / 255) * maxBarLength)
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    const x1 = cx + cosA * baseRadius
    const y1 = cy + sinA * baseRadius
    const x2 = cx + cosA * (baseRadius + barLength)
    const y2 = cy + sinA * (baseRadius + barLength)

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.restore()
}
