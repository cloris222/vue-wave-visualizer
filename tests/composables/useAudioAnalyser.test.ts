// tests/composables/useAudioAnalyser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAudioAnalyser } from '@/composables/useAudioAnalyser'

function makeStream(ended = false): MediaStream {
  const track = {
    kind: 'audio',
    readyState: ended ? 'ended' : 'live',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  return {
    getAudioTracks: () => [track],
  } as unknown as MediaStream
}

describe('useAudioAnalyser', () => {
  it('initialises and exposes an analyser node', () => {
    const { analyser, init, cleanup } = useAudioAnalyser()
    init(makeStream(), 2048, 0.8)
    expect(analyser.value).not.toBeNull()
    cleanup()
  })

  it('emits stream-end immediately if track is already ended', () => {
    const onStreamEnd = vi.fn()
    const { init, cleanup } = useAudioAnalyser()
    init(makeStream(true), 2048, 0.8, { onStreamEnd })
    expect(onStreamEnd).toHaveBeenCalled()
    cleanup()
  })

  it('emits error if AudioContext is not supported', () => {
    const onError = vi.fn()
    const original = (globalThis as unknown as Record<string, unknown>).AudioContext
    delete (globalThis as unknown as Record<string, unknown>).AudioContext
    delete (globalThis as unknown as Record<string, unknown>).webkitAudioContext

    const { init } = useAudioAnalyser()
    init(makeStream(), 2048, 0.8, { onError })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNSUPPORTED' }))

    ;(globalThis as unknown as Record<string, unknown>).AudioContext = original
    ;(globalThis as unknown as Record<string, unknown>).webkitAudioContext = original
  })

  it('cleanup closes the AudioContext', async () => {
    const { init, cleanup } = useAudioAnalyser()
    init(makeStream(), 2048, 0.8)
    const closeSpy = vi.spyOn(
      (globalThis as unknown as { AudioContext: { prototype: { close: () => void } } })
        .AudioContext.prototype,
      'close'
    )
    await cleanup()
    expect(closeSpy).toHaveBeenCalled()
  })

  it('rebuilds MediaStreamSourceNode when reconnect is called', () => {
    const { init, reconnect, cleanup } = useAudioAnalyser()
    init(makeStream(), 2048, 0.8)
    const newStream = makeStream()
    reconnect(newStream)
    cleanup()
  })
})
