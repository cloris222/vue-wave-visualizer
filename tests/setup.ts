// tests/setup.ts

class MockAnalyserNode {
  fftSize = 2048
  smoothingTimeConstant = 0.8
  frequencyBinCount = 1024
  private _timeDomainData: Uint8Array
  private _frequencyData: Uint8Array

  constructor() {
    this._timeDomainData = new Uint8Array(this.frequencyBinCount * 2).fill(128)
    this._frequencyData = new Uint8Array(this.frequencyBinCount).fill(0)
  }

  getByteTimeDomainData(arr: Uint8Array) {
    arr.set(this._timeDomainData.subarray(0, arr.length))
  }

  getByteFrequencyData(arr: Uint8Array) {
    arr.set(this._frequencyData.subarray(0, arr.length))
  }

  connect(_node: unknown) {}
  disconnect() {}

  // Test helper: simulate audio input
  __setTimeDomainData(data: number[]) {
    this._timeDomainData = new Uint8Array(data)
  }

  __setFrequencyData(data: number[]) {
    this._frequencyData = new Uint8Array(data)
  }
}

class MockMediaStreamSourceNode {
  connect(_node: unknown) {}
  disconnect() {}
}

class MockAudioContext {
  state: 'running' | 'suspended' | 'closed' = 'running'
  private _analyser = new MockAnalyserNode()

  createAnalyser() {
    return this._analyser
  }

  createMediaStreamSource(_stream: MediaStream) {
    return new MockMediaStreamSourceNode()
  }

  async resume() {
    this.state = 'running'
  }

  async close() {
    this.state = 'closed'
  }

  // Test helper: expose the internal analyser
  get __analyser() {
    return this._analyser
  }
}

// Install mocks globally
;(global as unknown as Record<string, unknown>).AudioContext = MockAudioContext
;(global as unknown as Record<string, unknown>).webkitAudioContext = MockAudioContext

// Mock requestAnimationFrame — uses setTimeout (macrotask) so cancelAnimationFrame
// can actually cancel pending callbacks before they fire.
const _pendingFrames = new Map<number, ReturnType<typeof setTimeout>>()
let rafId = 0
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  const id = ++rafId
  const timer = setTimeout(() => {
    _pendingFrames.delete(id)
    cb(performance.now())
  }, 0)
  _pendingFrames.set(id, timer)
  return id
})
vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  const timer = _pendingFrames.get(id)
  if (timer !== undefined) {
    clearTimeout(timer)
    _pendingFrames.delete(id)
  }
})

// Mock ResizeObserver
vi.stubGlobal('ResizeObserver', class {
  observe(_el: Element) {}
  unobserve(_el: Element) {}
  disconnect() {}
})
