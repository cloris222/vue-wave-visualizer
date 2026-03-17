// tests/utils/validateProps.test.ts
import { describe, it, expect, vi } from 'vitest'
import { validateProps } from '@/utils/validateProps'

describe('validateProps', () => {
  it('returns defaults when no optional props provided', () => {
    const result = validateProps({ stream: null, mode: 'bars' })
    expect(result.height).toBe(120)
    expect(result.color).toBe('#58a6ff')
    expect(result.backgroundColor).toBe('transparent')
    expect(result.barCount).toBe(64)
    expect(result.lineWidth).toBe(2)
    expect(result.fftSize).toBe(2048)
    expect(result.smoothingTimeConstant).toBe(0.8)
    expect(result.silenceThreshold).toBe(0.01)
    expect(result.silenceDuration).toBe(1500)
  })

  it('passes through valid props unchanged', () => {
    const result = validateProps({
      stream: null, mode: 'waveform',
      height: 80, color: '#ff0000', barCount: 32, lineWidth: 3,
      fftSize: 1024, smoothingTimeConstant: 0.5,
      silenceThreshold: 0.05, silenceDuration: 2000,
    })
    expect(result.height).toBe(80)
    expect(result.fftSize).toBe(1024)
    expect(result.smoothingTimeConstant).toBe(0.5)
  })

  it('falls back to 120 when height <= 0', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(validateProps({ stream: null, mode: 'bars', height: 0 }).height).toBe(120)
    expect(validateProps({ stream: null, mode: 'bars', height: -10 }).height).toBe(120)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('falls back fftSize to 2048 when not a power of two', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(validateProps({ stream: null, mode: 'bars', fftSize: 500 }).fftSize).toBe(2048)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('falls back fftSize to 2048 when out of range', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(validateProps({ stream: null, mode: 'bars', fftSize: 16 }).fftSize).toBe(2048)
    expect(validateProps({ stream: null, mode: 'bars', fftSize: 65536 }).fftSize).toBe(2048)
    warn.mockRestore()
  })

  it('clamps smoothingTimeConstant to [0, 1]', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(validateProps({ stream: null, mode: 'bars', smoothingTimeConstant: 1.5 }).smoothingTimeConstant).toBe(1)
    expect(validateProps({ stream: null, mode: 'bars', smoothingTimeConstant: -0.1 }).smoothingTimeConstant).toBe(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('accepts smoothingTimeConstant of 0 without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(validateProps({ stream: null, mode: 'bars', smoothingTimeConstant: 0 }).smoothingTimeConstant).toBe(0)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
