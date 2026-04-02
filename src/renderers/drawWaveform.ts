// src/renderers/drawWaveform.ts
import type { RendererOptions } from '@/types'
import { clearCanvas } from './clearCanvas'

export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  options: RendererOptions,
): void {
  const { color, backgroundColor, lineWidth, width, height } = options

  ctx.save()
  clearCanvas(ctx, width, height, backgroundColor)

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()

  const sliceWidth = width / data.length
  let x = 0

  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0 - 1.0
    const y = (v * height) / 2 + height / 2

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    x += sliceWidth
  }

  ctx.lineTo(width, height / 2)
  ctx.stroke()
  ctx.restore()
}
