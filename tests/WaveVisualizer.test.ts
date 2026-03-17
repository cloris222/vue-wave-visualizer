// tests/WaveVisualizer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WaveVisualizer from '@/components/WaveVisualizer.vue'

function makeStream(): MediaStream {
  const track = {
    kind: 'audio',
    readyState: 'live',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  return { getAudioTracks: () => [track] } as unknown as MediaStream
}

describe('WaveVisualizer', () => {
  it('renders a canvas element', () => {
    const wrapper = mount(WaveVisualizer, {
      props: { stream: makeStream(), mode: 'bars' },
      attachTo: document.body,
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })

  it('accepts all optional props without throwing', () => {
    expect(() =>
      mount(WaveVisualizer, {
        props: {
          stream: makeStream(),
          mode: 'waveform',
          height: 80,
          color: '#ff0000',
          backgroundColor: '#000',
          barCount: 32,
          lineWidth: 3,
          fftSize: 1024,
          smoothingTimeConstant: 0.5,
          silenceThreshold: 0.02,
          silenceDuration: 2000,
        },
        attachTo: document.body,
      })
    ).not.toThrow()
  })

  it('renders calm state when stream is null', () => {
    const wrapper = mount(WaveVisualizer, {
      props: { stream: null, mode: 'bars' },
      attachTo: document.body,
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })

  it('emits stream-end when stream has no audio tracks', async () => {
    const stream = { getAudioTracks: () => [] } as unknown as MediaStream
    const wrapper = mount(WaveVisualizer, {
      props: { stream, mode: 'bars' },
      attachTo: document.body,
    })
    await new Promise(r => setTimeout(r, 50))
    expect(wrapper.emitted('stream-end')).toBeTruthy()
    wrapper.unmount()
  })
})
