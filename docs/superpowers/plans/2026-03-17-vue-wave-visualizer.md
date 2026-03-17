# vue-wave-visualizer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a Vue 3 npm package that renders real-time audio waveform visualizations from a MediaStream using Web Audio API.

**Architecture:** Single `WaveVisualizer.vue` component with logic split into two composables (`useAudioAnalyser` for Web Audio pipeline, `useCanvasRenderer` for rAF draw loop) and four pure renderer functions. AudioContext is created once on mount and reused across stream changes — only `MediaStreamSourceNode` is rebuilt per stream.

**Tech Stack:** Vue 3, TypeScript, Vite (lib mode), Vitest, @vue/test-utils, Web Audio API, Canvas API

---

## ⚠️ New Project Notice

This plan creates a **brand new npm package project** from scratch. Before starting, create a new directory (e.g. `vue-wave-visualizer/`) and run all commands from within it. Do not implement this inside an existing project.

**Reference spec:** `docs/superpowers/specs/2026-03-17-wave-visualizer-design.md` (in the SPA_VoiceQuiz repo)

---

## File Map

```
vue-wave-visualizer/
├── src/
│   ├── components/
│   │   └── WaveVisualizer.vue          # Public component (template + props only)
│   ├── composables/
│   │   ├── useAudioAnalyser.ts         # Web Audio API pipeline
│   │   └── useCanvasRenderer.ts        # rAF loop + draw dispatch + silence detection
│   ├── renderers/
│   │   ├── drawWaveform.ts             # Pure fn: waveform mode
│   │   ├── drawBars.ts                 # Pure fn: bars mode
│   │   ├── drawCircular.ts             # Pure fn: circular mode
│   │   └── drawMirrorBars.ts           # Pure fn: mirror-bars mode
│   ├── utils/
│   │   └── validateProps.ts            # Prop validation + normalization
│   ├── types/
│   │   └── index.ts                    # All exported TypeScript types
│   └── index.ts                        # Package entry point + Vue plugin
├── tests/
│   ├── setup.ts                        # Vitest global setup (AudioContext mock)
│   ├── utils/
│   │   └── validateProps.test.ts
│   ├── renderers/
│   │   ├── drawWaveform.test.ts
│   │   ├── drawBars.test.ts
│   │   ├── drawCircular.test.ts
│   │   └── drawMirrorBars.test.ts
│   ├── composables/
│   │   ├── useAudioAnalyser.test.ts
│   │   └── useCanvasRenderer.test.ts
│   └── WaveVisualizer.test.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create the project directory and initialise git**

```bash
mkdir vue-wave-visualizer && cd vue-wave-visualizer
git init
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "vue-wave-visualizer",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/vue-wave-visualizer.umd.cjs",
  "module": "./dist/vue-wave-visualizer.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/vue-wave-visualizer.es.js",
      "require": "./dist/vue-wave-visualizer.umd.cjs"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vite build && vue-tsc --declaration --emitDeclarationOnly --outDir dist",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "peerDependencies": {
    "vue": "^3.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "@vue/test-utils": "^2.4.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vite-plugin-dts": "^3.0.0",
    "vitest": "^1.0.0",
    "vue": "^3.4.0",
    "vue-tsc": "^2.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "jsdom": "^24.0.0",
    "@testing-library/vue": "^8.0.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "declaration": true,
    "declarationDir": "dist",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*'],
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueWaveVisualizer',
      fileName: 'vue-wave-visualizer',
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
})
```

- [ ] **Step 6: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
})
```

- [ ] **Step 7: Create `tests/setup.ts` — global AudioContext mock**

Web Audio API is not available in jsdom. This mock covers everything the composables need.

```typescript
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

// Mock requestAnimationFrame
let rafId = 0
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  rafId++
  Promise.resolve().then(() => cb(performance.now()))
  return rafId
})
vi.stubGlobal('cancelAnimationFrame', (_id: number) => {})

// Mock ResizeObserver
vi.stubGlobal('ResizeObserver', class {
  observe(_el: Element) {}
  unobserve(_el: Element) {}
  disconnect() {}
})
```

- [ ] **Step 8: Verify setup compiles cleanly**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: initialise vue-wave-visualizer project scaffold"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create `src/types/index.ts`**

```typescript
// src/types/index.ts

export type WaveMode = 'waveform' | 'bars' | 'circular' | 'mirror-bars'

export interface WaveVisualizerProps {
  stream: MediaStream | null
  mode: WaveMode
  height?: number
  color?: string
  backgroundColor?: string
  barCount?: number
  lineWidth?: number
  fftSize?: number
  smoothingTimeConstant?: number
  silenceThreshold?: number
  silenceDuration?: number
}

export interface WaveVisualizerEmits {
  (event: 'stream-end'): void
  (event: 'silence', payload: { duration: number }): void
  (event: 'audio-active'): void
  (event: 'error', payload: { code: string; message: string }): void
}

export interface RendererOptions {
  color: string
  backgroundColor: string
  barCount: number
  lineWidth: number
  width: number   // logical CSS pixels
  height: number
}

export interface ValidatedProps {
  height: number
  color: string
  backgroundColor: string
  barCount: number
  lineWidth: number
  fftSize: number
  smoothingTimeConstant: number
  silenceThreshold: number
  silenceDuration: number
  mode: WaveMode
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 3: Prop Validation Utilities

**Files:**
- Create: `src/utils/validateProps.ts`
- Create: `tests/utils/validateProps.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/utils/validateProps.test.ts
```

Expected: FAIL — "Cannot find module '@/utils/validateProps'"

- [ ] **Step 3: Implement `src/utils/validateProps.ts`**

```typescript
// src/utils/validateProps.ts
import type { WaveVisualizerProps, ValidatedProps, WaveMode } from '@/types'

const VALID_MODES: WaveMode[] = ['waveform', 'bars', 'circular', 'mirror-bars']

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

export function validateProps(props: WaveVisualizerProps): ValidatedProps {
  let { height = 120, fftSize = 2048, smoothingTimeConstant = 0.8, mode } = props

  if (height <= 0) {
    console.warn('[WaveVisualizer] height must be > 0. Using default 120.')
    height = 120
  }

  if (!isPowerOfTwo(fftSize) || fftSize < 32 || fftSize > 32768) {
    console.warn(`[WaveVisualizer] fftSize must be a power of two in [32, 32768]. Got ${fftSize}. Using 2048.`)
    fftSize = 2048
  }

  if (smoothingTimeConstant < 0 || smoothingTimeConstant > 1) {
    console.warn(`[WaveVisualizer] smoothingTimeConstant must be in [0, 1]. Got ${smoothingTimeConstant}. Clamping.`)
    smoothingTimeConstant = Math.max(0, Math.min(1, smoothingTimeConstant))
  }

  if (!VALID_MODES.includes(mode)) {
    console.warn(`[WaveVisualizer] Unknown mode "${mode}". Falling back to "bars".`)
    mode = 'bars'
  }

  return {
    height,
    color: props.color ?? '#58a6ff',
    backgroundColor: props.backgroundColor ?? 'transparent',
    barCount: props.barCount ?? 64,
    lineWidth: props.lineWidth ?? 2,
    fftSize,
    smoothingTimeConstant,
    silenceThreshold: props.silenceThreshold ?? 0.01,
    silenceDuration: props.silenceDuration ?? 1500,
    mode,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/utils/validateProps.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/validateProps.ts tests/utils/validateProps.test.ts
git commit -m "feat: add prop validation utilities"
```

---

## Task 4: Renderer Pure Functions

All four renderers are pure functions: `(ctx, data, options) => void`. They are testable by verifying canvas context method calls.

**Files:**
- Create: `src/renderers/drawWaveform.ts`
- Create: `src/renderers/drawBars.ts`
- Create: `src/renderers/drawCircular.ts`
- Create: `src/renderers/drawMirrorBars.ts`
- Create: `tests/renderers/drawWaveform.test.ts`
- Create: `tests/renderers/drawBars.test.ts`
- Create: `tests/renderers/drawCircular.test.ts`
- Create: `tests/renderers/drawMirrorBars.test.ts`

### 4a — drawWaveform

- [ ] **Step 1: Write failing test**

```typescript
// tests/renderers/drawWaveform.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drawWaveform } from '@/renderers/drawWaveform'
import type { RendererOptions } from '@/types'

function makeCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

const opts: RendererOptions = {
  color: '#ff0000', backgroundColor: 'transparent',
  barCount: 64, lineWidth: 2, width: 300, height: 120,
}

describe('drawWaveform', () => {
  it('calls beginPath and stroke', () => {
    const ctx = makeCtx()
    const data = new Uint8Array(2048).fill(128)
    drawWaveform(ctx, data, opts)
    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('sets strokeStyle to color', () => {
    const ctx = makeCtx()
    drawWaveform(ctx, new Uint8Array(2048).fill(128), opts)
    expect(ctx.strokeStyle).toBe('#ff0000')
  })

  it('clears canvas before drawing', () => {
    const ctx = makeCtx()
    drawWaveform(ctx, new Uint8Array(2048).fill(128), opts)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 300, 120)
  })

  it('fills background when backgroundColor is not transparent', () => {
    const ctx = makeCtx()
    drawWaveform(ctx, new Uint8Array(2048).fill(128), { ...opts, backgroundColor: '#000' })
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 300, 120)
    expect(ctx.fillStyle).toBe('#000')
  })

  it('draws a flat line when all samples are at center (128)', () => {
    const ctx = makeCtx()
    const moveSpy = vi.spyOn(ctx, 'moveTo')
    drawWaveform(ctx, new Uint8Array(2048).fill(128), opts)
    // First point should be at y = height/2 = 60
    expect(moveSpy.mock.calls[0][1]).toBeCloseTo(60, 0)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/renderers/drawWaveform.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement `src/renderers/drawWaveform.ts`**

```typescript
// src/renderers/drawWaveform.ts
import type { RendererOptions } from '@/types'

export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  options: RendererOptions,
): void {
  const { color, backgroundColor, lineWidth, width, height } = options

  ctx.clearRect(0, 0, width, height)
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)
  }

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()

  const sliceWidth = width / data.length
  let x = 0

  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0
    const y = (v * height) / 2

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    x += sliceWidth
  }

  ctx.lineTo(width, height / 2)
  ctx.stroke()
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- tests/renderers/drawWaveform.test.ts
```

Expected: all PASS

### 4b — drawBars

- [ ] **Step 5: Write failing test**

```typescript
// tests/renderers/drawBars.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drawBars } from '@/renderers/drawBars'
import type { RendererOptions } from '@/types'

function makeCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

const opts: RendererOptions = {
  color: '#3fb950', backgroundColor: 'transparent',
  barCount: 4, lineWidth: 2, width: 200, height: 100,
}

describe('drawBars', () => {
  it('draws exactly barCount bars', () => {
    const ctx = makeCtx()
    const data = new Uint8Array(128).fill(200)
    drawBars(ctx, data, opts)
    // clearRect once + barCount fillRects
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(4)
  })

  it('draws no bars (height 0) when data is all zero', () => {
    const ctx = makeCtx()
    const fillSpy = vi.spyOn(ctx, 'fillRect')
    drawBars(ctx, new Uint8Array(128).fill(0), opts)
    // Each bar should have height 0 (minimum 1px enforced)
    fillSpy.mock.calls.forEach(call => {
      expect(call[3]).toBe(1) // height argument = 1px minimum
    })
  })

  it('sets fillStyle to color', () => {
    const ctx = makeCtx()
    drawBars(ctx, new Uint8Array(128).fill(100), opts)
    expect(ctx.fillStyle).toBe('#3fb950')
  })

  it('clamps barCount to frequencyBinCount', () => {
    const ctx = makeCtx()
    // barCount=200 but data only has 10 entries — clamp to 10
    drawBars(ctx, new Uint8Array(10).fill(128), { ...opts, barCount: 200 })
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(10)
  })
})
```

- [ ] **Step 6: Run test to confirm it fails**

```bash
npm test -- tests/renderers/drawBars.test.ts
```

Expected: FAIL

- [ ] **Step 7: Implement `src/renderers/drawBars.ts`**

```typescript
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
```

- [ ] **Step 8: Run test to confirm it passes**

```bash
npm test -- tests/renderers/drawBars.test.ts
```

Expected: all PASS

### 4c — drawMirrorBars

- [ ] **Step 9: Write failing test**

```typescript
// tests/renderers/drawMirrorBars.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drawMirrorBars } from '@/renderers/drawMirrorBars'
import type { RendererOptions } from '@/types'

function makeCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

const opts: RendererOptions = {
  color: '#f78166', backgroundColor: 'transparent',
  barCount: 4, lineWidth: 2, width: 200, height: 100,
}

describe('drawMirrorBars', () => {
  it('draws barCount bars (each bar is one fillRect call)', () => {
    const ctx = makeCtx()
    drawMirrorBars(ctx, new Uint8Array(128).fill(200), opts)
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(4)
  })

  it('bars are centered vertically when data is full (255)', () => {
    const ctx = makeCtx()
    const fillSpy = vi.spyOn(ctx, 'fillRect')
    drawMirrorBars(ctx, new Uint8Array(128).fill(255), opts)
    // Each bar y should start at 0 and height should equal opts.height
    fillSpy.mock.calls.forEach(call => {
      expect(call[1]).toBe(0)        // y = top
      expect(call[3]).toBe(100)      // height = full
    })
  })
})
```

- [ ] **Step 10: Run test to confirm it fails**

```bash
npm test -- tests/renderers/drawMirrorBars.test.ts
```

Expected: FAIL

- [ ] **Step 11: Implement `src/renderers/drawMirrorBars.ts`**

```typescript
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
```

- [ ] **Step 12: Run test to confirm it passes**

```bash
npm test -- tests/renderers/drawMirrorBars.test.ts
```

Expected: all PASS

### 4d — drawCircular

- [ ] **Step 13: Write failing test**

```typescript
// tests/renderers/drawCircular.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drawCircular } from '@/renderers/drawCircular'
import type { RendererOptions } from '@/types'

function makeCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

const opts: RendererOptions = {
  color: '#d2a8ff', backgroundColor: 'transparent',
  barCount: 8, lineWidth: 2, width: 200, height: 200,
}

describe('drawCircular', () => {
  it('calls stroke barCount times', () => {
    const ctx = makeCtx()
    drawCircular(ctx, new Uint8Array(128).fill(128), opts)
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBe(8)
  })

  it('sets strokeStyle to color', () => {
    const ctx = makeCtx()
    drawCircular(ctx, new Uint8Array(128).fill(128), opts)
    expect(ctx.strokeStyle).toBe('#d2a8ff')
  })

  it('calls clearRect', () => {
    const ctx = makeCtx()
    drawCircular(ctx, new Uint8Array(128).fill(0), opts)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 200, 200)
  })
})
```

- [ ] **Step 14: Run test to confirm it fails**

```bash
npm test -- tests/renderers/drawCircular.test.ts
```

Expected: FAIL

- [ ] **Step 15: Implement `src/renderers/drawCircular.ts`**

```typescript
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
```

- [ ] **Step 16: Run all renderer tests**

```bash
npm test -- tests/renderers/
```

Expected: all PASS

- [ ] **Step 17: Commit all renderers**

```bash
git add src/renderers/ tests/renderers/
git commit -m "feat: add four wave renderer pure functions"
```

---

## Task 5: useAudioAnalyser Composable

**Files:**
- Create: `src/composables/useAudioAnalyser.ts`
- Create: `tests/composables/useAudioAnalyser.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
    const original = (global as unknown as Record<string, unknown>).AudioContext
    delete (global as unknown as Record<string, unknown>).AudioContext
    delete (global as unknown as Record<string, unknown>).webkitAudioContext

    const { init } = useAudioAnalyser()
    init(makeStream(), 2048, 0.8, { onError })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNSUPPORTED' }))

    ;(global as unknown as Record<string, unknown>).AudioContext = original
    ;(global as unknown as Record<string, unknown>).webkitAudioContext = original
  })

  it('cleanup closes the AudioContext', async () => {
    const { init, cleanup } = useAudioAnalyser()
    init(makeStream(), 2048, 0.8)
    const closeSpy = vi.spyOn(
      (global as unknown as { AudioContext: { prototype: { close: () => void } } })
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/composables/useAudioAnalyser.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement `src/composables/useAudioAnalyser.ts`**

```typescript
// src/composables/useAudioAnalyser.ts
import { ref } from 'vue'
import type { Ref } from 'vue'

interface AudioAnalyserCallbacks {
  onStreamEnd?: () => void
  onError?: (payload: { code: string; message: string }) => void
}

interface UseAudioAnalyserReturn {
  analyser: Ref<AnalyserNode | null>
  init: (stream: MediaStream, fftSize: number, smoothing: number, callbacks?: AudioAnalyserCallbacks) => void
  reconnect: (stream: MediaStream) => void
  cleanup: () => void
}

export function useAudioAnalyser(): UseAudioAnalyserReturn {
  const analyser = ref<AnalyserNode | null>(null)
  let ctx: AudioContext | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let callbacks: AudioAnalyserCallbacks = {}
  let trackEndedHandler: (() => void) | null = null
  let currentTrack: MediaStreamTrack | null = null

  function attachTrackListener(stream: MediaStream) {
    const tracks = stream.getAudioTracks()
    if (tracks.length === 0) {
      callbacks.onStreamEnd?.()
      return
    }
    currentTrack = tracks[0]
    if (currentTrack.readyState === 'ended') {
      callbacks.onStreamEnd?.()
      return
    }
    trackEndedHandler = () => callbacks.onStreamEnd?.()
    currentTrack.addEventListener('ended', trackEndedHandler)
  }

  function detachTrackListener() {
    if (currentTrack && trackEndedHandler) {
      currentTrack.removeEventListener('ended', trackEndedHandler)
    }
    currentTrack = null
    trackEndedHandler = null
  }

  function init(
    stream: MediaStream,
    fftSize: number,
    smoothing: number,
    cbs: AudioAnalyserCallbacks = {},
  ) {
    callbacks = cbs

    const AudioContextClass =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) {
      console.error('[WaveVisualizer] Web Audio API is not supported in this browser.')
      callbacks.onError?.({ code: 'UNSUPPORTED', message: 'Web Audio API not supported.' })
      return
    }

    try {
      ctx = new AudioContextClass()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[WaveVisualizer] Failed to create AudioContext:', msg)
      callbacks.onError?.({ code: 'AUDIO_CONTEXT_FAILED', message: msg })
      return
    }

    ctx.resume().catch(() => {
      // Degraded mode: autoplay policy suspended the context
    })

    const node = ctx.createAnalyser()
    node.fftSize = fftSize
    node.smoothingTimeConstant = smoothing
    analyser.value = node

    sourceNode = ctx.createMediaStreamSource(stream)
    sourceNode.connect(node)

    attachTrackListener(stream)
  }

  function reconnect(stream: MediaStream) {
    detachTrackListener()
    sourceNode?.disconnect()
    if (ctx && analyser.value) {
      sourceNode = ctx.createMediaStreamSource(stream)
      sourceNode.connect(analyser.value)
    }
    attachTrackListener(stream)
  }

  async function cleanup() {
    detachTrackListener()
    sourceNode?.disconnect()
    sourceNode = null
    analyser.value?.disconnect()
    analyser.value = null
    if (ctx) {
      await ctx.close()
      ctx = null
    }
  }

  return { analyser, init, reconnect, cleanup }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/composables/useAudioAnalyser.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useAudioAnalyser.ts tests/composables/useAudioAnalyser.test.ts
git commit -m "feat: add useAudioAnalyser composable"
```

---

## Task 6: useCanvasRenderer Composable

**Files:**
- Create: `src/composables/useCanvasRenderer.ts`
- Create: `tests/composables/useCanvasRenderer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/composables/useCanvasRenderer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCanvasRenderer } from '@/composables/useCanvasRenderer'
import type { RendererOptions } from '@/types'

function makeMockAnalyser() {
  const analyser = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => arr.fill(128)),
    getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(0)),
  }
  return analyser as unknown as AnalyserNode
}

function makeCanvas() {
  return {
    width: 300,
    height: 120,
    style: { width: '', height: '' },
    getContext: vi.fn(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      fillStyle: '',
    })),
    getBoundingClientRect: vi.fn(() => ({ width: 300 })),
  } as unknown as HTMLCanvasElement
}

describe('useCanvasRenderer', () => {
  it('starts and stops the rAF loop', async () => {
    const analyserRef = ref(makeMockAnalyser())
    const canvasRef = ref(makeCanvas())
    const { start, stop } = useCanvasRenderer()
    start(canvasRef, analyserRef, ref('bars'), ref({ color: '#fff', backgroundColor: 'transparent', barCount: 64, lineWidth: 2, width: 300, height: 120 } as RendererOptions))
    await new Promise(r => setTimeout(r, 50))
    stop()
  })

  it('emits silence after threshold duration', async () => {
    const onSilence = vi.fn()
    const analyserRef = ref(makeMockAnalyser())
    const canvasRef = ref(makeCanvas())
    const { start, stop } = useCanvasRenderer()

    // All samples at 128 = zero RMS = silence
    start(canvasRef, analyserRef, ref('bars'), ref({ color: '#fff', backgroundColor: 'transparent', barCount: 64, lineWidth: 2, width: 300, height: 120 } as RendererOptions), {
      silenceThreshold: 0.01,
      silenceDuration: 0, // fire immediately
      onSilence,
    })
    await new Promise(r => setTimeout(r, 50))
    expect(onSilence).toHaveBeenCalled()
    stop()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/composables/useCanvasRenderer.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement `src/composables/useCanvasRenderer.ts`**

```typescript
// src/composables/useCanvasRenderer.ts
import type { Ref } from 'vue'
import type { WaveMode, RendererOptions } from '@/types'
import { drawWaveform } from '@/renderers/drawWaveform'
import { drawBars } from '@/renderers/drawBars'
import { drawCircular } from '@/renderers/drawCircular'
import { drawMirrorBars } from '@/renderers/drawMirrorBars'

interface RendererCallbacks {
  silenceThreshold?: number
  silenceDuration?: number
  onSilence?: (payload: { duration: number }) => void
  onAudioActive?: () => void
}

interface UseCanvasRendererReturn {
  start: (
    canvasRef: Ref<HTMLCanvasElement | null>,
    analyserRef: Ref<AnalyserNode | null>,
    modeRef: Ref<WaveMode>,
    optionsRef: Ref<RendererOptions>,
    callbacks?: RendererCallbacks
  ) => void
  stop: () => void
  renderCalmState: (
    canvasRef: Ref<HTMLCanvasElement | null>,
    modeRef: Ref<WaveMode>,
    optionsRef: Ref<RendererOptions>
  ) => void
}

export function useCanvasRenderer(): UseCanvasRendererReturn {
  let rafId: number | null = null
  let silenceElapsed = 0
  let alreadySilent = false
  let lastTime: number | null = null

  function computeRMS(data: Uint8Array): number {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0 - 1.0
      sum += v * v
    }
    return Math.sqrt(sum / data.length)
  }

  function getCanvasOptions(
    canvas: HTMLCanvasElement,
    options: RendererOptions,
  ): RendererOptions {
    return {
      ...options,
      width: canvas.width,
      height: canvas.height,
    }
  }

  function draw(
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    mode: WaveMode,
    options: RendererOptions,
  ) {
    switch (mode) {
      case 'waveform': drawWaveform(ctx, data, options); break
      case 'bars': drawBars(ctx, data, options); break
      case 'circular': drawCircular(ctx, data, options); break
      case 'mirror-bars': drawMirrorBars(ctx, data, options); break
    }
  }

  function start(
    canvasRef: Ref<HTMLCanvasElement | null>,
    analyserRef: Ref<AnalyserNode | null>,
    modeRef: Ref<WaveMode>,
    optionsRef: Ref<RendererOptions>,
    callbacks: RendererCallbacks = {},
  ) {
    const {
      silenceThreshold = 0.01,
      silenceDuration = 1500,
      onSilence,
      onAudioActive,
    } = callbacks

    function loop(timestamp: number) {
      const canvas = canvasRef.value
      const analyser = analyserRef.value
      if (!canvas || !analyser) { rafId = requestAnimationFrame(loop); return }

      const ctx = canvas.getContext('2d')
      if (!ctx) { rafId = requestAnimationFrame(loop); return }

      const frameDelta = lastTime !== null ? timestamp - lastTime : 0
      lastTime = timestamp

      const mode = modeRef.value
      const opts = getCanvasOptions(canvas, optionsRef.value)

      // Get data
      let data: Uint8Array
      if (mode === 'waveform') {
        data = new Uint8Array(analyser.fftSize)
        analyser.getByteTimeDomainData(data)
      } else {
        data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
      }

      // Silence detection (always uses time domain RMS)
      const tdData = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(tdData)
      const rms = computeRMS(tdData)

      if (rms < silenceThreshold) {
        silenceElapsed += frameDelta
        if (silenceElapsed >= silenceDuration && !alreadySilent) {
          alreadySilent = true
          onSilence?.({ duration: silenceElapsed })
        }
      } else {
        if (alreadySilent) {
          alreadySilent = false
          silenceElapsed = 0
          onAudioActive?.()
        } else {
          silenceElapsed = 0
        }
      }

      draw(ctx, data, mode, opts)
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    silenceElapsed = 0
    alreadySilent = false
    lastTime = null
  }

  function renderCalmState(
    canvasRef: Ref<HTMLCanvasElement | null>,
    modeRef: Ref<WaveMode>,
    optionsRef: Ref<RendererOptions>,
  ) {
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const opts = getCanvasOptions(canvas, optionsRef.value)
    const zeros = new Uint8Array(
      modeRef.value === 'waveform' ? 2048 : opts.barCount
    ).fill(modeRef.value === 'waveform' ? 128 : 0)
    draw(ctx, zeros, modeRef.value, opts)
  }

  return { start, stop, renderCalmState }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/composables/useCanvasRenderer.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useCanvasRenderer.ts tests/composables/useCanvasRenderer.test.ts
git commit -m "feat: add useCanvasRenderer composable with silence detection"
```

---

## Task 7: WaveVisualizer Vue Component

**Files:**
- Create: `src/components/WaveVisualizer.vue`
- Create: `tests/WaveVisualizer.test.ts`

- [ ] **Step 1: Write failing component tests**

```typescript
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/WaveVisualizer.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement `src/components/WaveVisualizer.vue`**

```vue
<!-- src/components/WaveVisualizer.vue -->
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import type { WaveMode } from '@/types'
import { validateProps } from '@/utils/validateProps'
import { useAudioAnalyser } from '@/composables/useAudioAnalyser'
import { useCanvasRenderer } from '@/composables/useCanvasRenderer'

const props = withDefaults(defineProps<{
  stream: MediaStream | null
  mode: WaveMode
  height?: number
  color?: string
  backgroundColor?: string
  barCount?: number
  lineWidth?: number
  fftSize?: number
  smoothingTimeConstant?: number
  silenceThreshold?: number
  silenceDuration?: number
}>(), {
  height: 120,
  color: '#58a6ff',
  backgroundColor: 'transparent',
  barCount: 64,
  lineWidth: 2,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  silenceThreshold: 0.01,
  silenceDuration: 1500,
})

const emit = defineEmits<{
  'stream-end': []
  'silence': [payload: { duration: number }]
  'audio-active': []
  'error': [payload: { code: string; message: string }]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const resizeObserver = ref<ResizeObserver | null>(null)
const modeRef = computed(() => props.mode)

const validated = computed(() => validateProps(props))

const rendererOptions = computed(() => ({
  color: validated.value.color,
  backgroundColor: validated.value.backgroundColor,
  barCount: validated.value.barCount,
  lineWidth: validated.value.lineWidth,
  width: 0,
  height: validated.value.height,
}))

const { analyser, init, reconnect, cleanup: cleanupAudio } = useAudioAnalyser()
const { start, stop, renderCalmState } = useCanvasRenderer()

function updateCanvasSize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.getBoundingClientRect().width
  canvas.width = w * dpr
  canvas.height = validated.value.height * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${validated.value.height}px`
}

function startPipeline(stream: MediaStream) {
  stop()
  init(stream, validated.value.fftSize, validated.value.smoothingTimeConstant, {
    onStreamEnd: () => {
      stop()
      renderCalmState(canvasRef, modeRef, rendererOptions)
      emit('stream-end')
    },
    onError: (payload) => {
      renderCalmState(canvasRef, modeRef, rendererOptions)
      emit('error', payload)
    },
  })
  if (analyser.value) {
    start(canvasRef, analyser, modeRef, rendererOptions, {
      silenceThreshold: validated.value.silenceThreshold,
      silenceDuration: validated.value.silenceDuration,
      onSilence: (payload) => emit('silence', payload),
      onAudioActive: () => emit('audio-active'),
    })
  }
}

onMounted(() => {
  updateCanvasSize()

  resizeObserver.value = new ResizeObserver(() => {
    stop()
    updateCanvasSize()
    if (props.stream && analyser.value) {
      start(canvasRef, analyser, modeRef, rendererOptions, {
        silenceThreshold: validated.value.silenceThreshold,
        silenceDuration: validated.value.silenceDuration,
        onSilence: (payload) => emit('silence', payload),
        onAudioActive: () => emit('audio-active'),
      })
    }
  })

  if (canvasRef.value) {
    resizeObserver.value.observe(canvasRef.value.parentElement ?? canvasRef.value)
  }

  if (props.stream) {
    startPipeline(props.stream)
  } else {
    renderCalmState(canvasRef, modeRef, rendererOptions)
  }
})

onUnmounted(() => {
  stop()
  resizeObserver.value?.disconnect()
  cleanupAudio()
})

watch(() => props.stream, (newStream) => {
  stop()
  if (!newStream) {
    renderCalmState(canvasRef, modeRef, rendererOptions)
    return
  }
  if (analyser.value) {
    reconnect(newStream)
    start(canvasRef, analyser, modeRef, rendererOptions, {
      silenceThreshold: validated.value.silenceThreshold,
      silenceDuration: validated.value.silenceDuration,
      onSilence: (payload) => emit('silence', payload),
      onAudioActive: () => emit('audio-active'),
    })
  } else {
    startPipeline(newStream)
  }
})
</script>

<template>
  <canvas ref="canvasRef" style="width: 100%; display: block;" />
</template>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/WaveVisualizer.test.ts
```

Expected: all PASS

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/WaveVisualizer.vue tests/WaveVisualizer.test.ts
git commit -m "feat: add WaveVisualizer Vue component"
```

---

## Task 8: Package Entry Point + Plugin

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```typescript
// src/index.ts
import type { App } from 'vue'
import WaveVisualizer from './components/WaveVisualizer.vue'

export { default as WaveVisualizer } from './components/WaveVisualizer.vue'
export type { WaveVisualizerProps, WaveMode, WaveVisualizerEmits, RendererOptions } from './types'

const plugin = {
  install(app: App) {
    app.component('WaveVisualizer', WaveVisualizer)
  },
}

export default plugin
```

- [ ] **Step 2: Verify lint is clean**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add package entry point and Vue plugin"
```

---

## Task 9: Build and Verify

- [ ] **Step 1: Run full test suite one final time**

```bash
npm test
```

Expected: all PASS

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: build succeeds, no errors. `dist/` is populated.

- [ ] **Step 3: Verify dist contents**

```bash
ls dist/
```

Expected output includes:
```
index.d.ts
vue-wave-visualizer.es.js
vue-wave-visualizer.umd.cjs
```

- [ ] **Step 4: Smoke test the package locally**

In a separate Vue 3 project, link the package and verify it renders:

```bash
# In vue-wave-visualizer/
npm link

# In another Vue 3 project
npm link vue-wave-visualizer
```

Then in the test project:

```vue
<script setup>
import { ref } from 'vue'
import { WaveVisualizer } from 'vue-wave-visualizer'

const stream = ref(null)
async function start() {
  stream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
}
</script>

<template>
  <button @click="start">Start Mic</button>
  <div style="width: 400px">
    <WaveVisualizer v-if="stream" :stream="stream" mode="bars" :height="80" />
  </div>
</template>
```

Expected: wave visualization renders and responds to microphone input.

- [ ] **Step 5: Final commit**

```bash
git add dist/
git commit -m "build: add initial dist output"
```
