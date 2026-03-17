# Wave Visualizer — Design Spec

**Date:** 2026-03-17
**Package name:** `vue-wave-visualizer`
**Status:** Approved

---

## Overview

A standalone Vue 3 npm package that renders real-time audio waveform visualizations from a `MediaStream`. The consumer passes a `MediaStream` and selects a visual mode via props. No external dependencies beyond Vue 3.

---

## Goals

- Accept a `MediaStream` and visualize it in real time using Web Audio API
- Support 4 visualization modes switchable via a `mode` prop
- Publish as an npm package usable in any Vue 3 project
- Provide full TypeScript type definitions
- Expose a clean, minimal API (props + emits only)

## Non-Goals

- Does not handle `getUserMedia` permission — consumer is responsible for obtaining the stream
- Does not support React, Angular, or other frameworks (Vue 3 only)
- Does not provide CSS variable-based theming — styling via props only
- Does not support SSR — all Web Audio API and canvas operations are guarded inside lifecycle hooks (`onMounted`); no Web Audio API references exist at module scope

---

## Architecture

### Pattern

Single Fat Component (`WaveVisualizer.vue`) — one component, all modes, internal logic split into composables and renderer functions.

### Project Structure

```
vue-wave-visualizer/
├── src/
│   ├── components/
│   │   └── WaveVisualizer.vue        # Public component, template + props only
│   ├── composables/
│   │   ├── useAudioAnalyser.ts       # Web Audio API pipeline
│   │   └── useCanvasRenderer.ts      # rAF loop + draw dispatch
│   ├── renderers/
│   │   ├── drawWaveform.ts           # Mode: waveform
│   │   ├── drawBars.ts               # Mode: bars
│   │   ├── drawCircular.ts           # Mode: circular
│   │   └── drawMirrorBars.ts         # Mode: mirror-bars
│   ├── types/
│   │   └── index.ts                  # All TypeScript types
│   └── index.ts                      # Package entry point
├── package.json
├── vite.config.ts                    # Lib mode build
└── tsconfig.json
```

### Design Principles

- `WaveVisualizer.vue` contains zero Audio or Canvas logic — only template and prop declarations
- Each renderer is a pure function: `(ctx: CanvasRenderingContext2D, data: Uint8Array, options: RendererOptions) => void` — independently testable
- `useAudioAnalyser` owns the Web Audio pipeline only
- `useCanvasRenderer` owns the animation loop and renderer dispatch only
- All `AudioContext` and canvas operations are created inside `onMounted` — never at module scope (SSR safety)

---

## Component API

### Props

```typescript
interface WaveVisualizerProps {
  // Core — required
  stream: MediaStream | null         // null is valid; renders calm state and waits

  mode: 'waveform' | 'bars' | 'circular' | 'mirror-bars'

  // Dimensions
  height?: number
  // Canvas height in px. Default: 120. Must be > 0; values <= 0 are treated as 120.
  // Width is always 100% of parent container, updated via ResizeObserver.

  // Visual
  color?: string
  // Primary color for the visualization. Default: '#58a6ff'.
  // waveform: stroke color
  // bars / mirror-bars: fill color for bars
  // circular: stroke color for radial lines
  // Applies uniformly — no per-mode color splitting.

  backgroundColor?: string
  // Canvas fill color. Default: 'transparent' (canvas is cleared each frame, not filled).

  barCount?: number
  // Number of bars/segments rendered for bars, mirror-bars, circular modes. Default: 64.
  // Clamped at runtime to [1, frequencyBinCount] where frequencyBinCount = fftSize / 2.
  // No effect in waveform mode (ignored, no warning).

  lineWidth?: number
  // Stroke line width in px for waveform mode. Default: 2.
  // Also used as the arc stroke width in circular mode.
  // Ignored in bars and mirror-bars modes (no warning).

  fftSize?: number
  // AnalyserNode FFT size. Must be a power of two in [32, 32768]. Default: 2048.
  // Invalid values (not a power of two, out of range) → console.warn + fallback to 2048.

  smoothingTimeConstant?: number
  // Audio smoothing coefficient in [0, 1]. Default: 0.8.
  // Values outside [0, 1] → console.warn + clamped to nearest valid value (0 or 1).

  // Silence detection
  silenceThreshold?: number
  // RMS volume (0–1) below which audio is considered silent. Default: 0.01.
  // Set to 0 to disable silence detection: since RMS >= 0 always, condition rms < 0 never fires.

  silenceDuration?: number
  // Duration in milliseconds of continuous silence before emitting 'silence'. Default: 1500.
}
```

### Emits

```typescript
interface WaveVisualizerEmits {
  'stream-end': []
  // Fired once when the stream's first audio track fires its 'ended' event.
  // If the stream has no audio tracks, this fires immediately on mount.

  'silence': [payload: { duration: number }]
  // Fired once when silence is first detected (not on every frame).
  // Re-arms after 'audio-active' is emitted, so the cycle can repeat.

  'audio-active': []
  // Fired once when RMS exceeds silenceThreshold for the first frame after a silence period.
  // Debounce: 1 frame only (no additional delay).

  'error': [payload: { code: string; message: string }]
  // Non-fatal error. Always accompanied by console.error.
}
```

### Usage Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WaveVisualizer } from 'vue-wave-visualizer'

const micStream = ref<MediaStream | null>(null)

async function startMic() {
  micStream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
}
</script>

<template>
  <div style="width: 100%">
    <WaveVisualizer
      :stream="micStream"
      mode="bars"
      :height="80"
      color="#3fb950"
      @stream-end="handleStop"
      @silence="handleSilence"
      @error="handleError"
    />
  </div>
</template>
```

---

## Data Flow

```
MediaStream (props.stream)
    │
    ▼
useAudioAnalyser
    ├── AudioContext.createMediaStreamSource(stream)
    ├── AnalyserNode
    │     ├── fftSize (validated prop)
    │     └── smoothingTimeConstant (validated prop)
    ├── audioContext.resume()  ← called immediately after creation (autoplay policy)
    ├── getByteTimeDomainData()  →  waveform mode
    └── getByteFrequencyData()   →  bars / circular / mirror-bars modes
    │
    ▼
useCanvasRenderer  (requestAnimationFrame loop)
    ├── Read Uint8Array from AnalyserNode
    ├── Compute RMS → silence detection logic
    ├── Emit events as needed
    └── switch(mode)
          ├── drawWaveform(ctx, data, options)
          ├── drawBars(ctx, data, options)
          ├── drawCircular(ctx, data, options)
          └── drawMirrorBars(ctx, data, options)
```

### Reactive Prop Changes

| Prop changes | Behaviour |
|---|---|
| `stream` changes to valid stream | Cancel rAF loop → disconnect old source node → reconnect new source → restart rAF loop |
| `stream` changes to `null` | Cancel rAF loop → disconnect source node → render calm state → wait |
| `mode` changes | Switch draw function only — no Audio pipeline rebuild, canvas cleared once |
| `color`, `height`, `barCount`, etc. | Take effect on next animation frame |

### AudioContext Lifecycle

`AudioContext` is created once on `onMounted` and kept alive for the entire component lifetime. When `stream` changes, only the `MediaStreamSourceNode` is torn down and recreated — the `AudioContext` and `AnalyserNode` are reused. This avoids repeated context creation and respects browser limits on concurrent `AudioContext` instances (typically 6 in Chrome).

`AudioContext` is closed only in `onUnmounted`.

### Rapid `stream` Prop Changes

If `stream` changes multiple times before a reconnect completes (e.g., user switches microphone devices quickly), reconnects are serialized with a generation counter. Any reconnect started for an older generation is cancelled before the new one begins.

### Sizing

- Canvas CSS width: always `100%`
- Canvas pixel buffer: `canvas.width = container.clientWidth * window.devicePixelRatio`; `canvas.height = height * window.devicePixelRatio`; canvas CSS dimensions set to `clientWidth × height` (px) so drawing coordinates match CSS pixels
- Updated on mount and on every `ResizeObserver` callback
- If `clientWidth` is 0 on mount (hidden container), canvas is initialized with width 0 and resized when `ResizeObserver` fires a non-zero width
- `ResizeObserver` callbacks are NOT debounced — they reset canvas dimensions only (canvas.width / canvas.height), then call `cancelAnimationFrame` and restart the draw loop. The `AudioContext` and `AnalyserNode` are unaffected.

### Calm State

"Calm state" means: clear the canvas to `backgroundColor` (or transparent if default), then draw the visualization at zero amplitude:
- **waveform**: flat horizontal line at vertical midpoint, using `color` and `lineWidth`
- **bars / mirror-bars**: all bars at height 0 (1px minimum so bars are still visible)
- **circular**: all radial lines at minimum length (base radius only)

Calm state is rendered as a single static frame (no rAF loop running).

### Silence Detection

```
Each rAF frame:
  data = getByteTimeDomainData()            // 0–255, center at 128
  rms = sqrt(mean((sample/128 - 1)^2))     // normalized 0–1

  if rms < silenceThreshold:
    silenceElapsed += frameDeltaMs
    if silenceElapsed >= silenceDuration AND NOT alreadySilent:
      alreadySilent = true
      emit('silence', { duration: silenceElapsed })
  else:
    if alreadySilent:
      alreadySilent = false
      silenceElapsed = 0
      emit('audio-active')
    else:
      silenceElapsed = 0

stream.audioTrack.onended:
  emit('stream-end')
  render calm state (static frame)
```

`frameDeltaMs` is computed from `performance.now()` delta between frames, so silence timing is correct even when the tab is hidden and rAF is throttled.

---

## Error Handling

All errors use `console.error` (always visible in DevTools) + `emit('error')` (optional handler for parent).

| Scenario | Behaviour |
|---|---|
| `stream` is `null` | Render calm state. No error. Wait for non-null stream. |
| `stream` has no audio tracks | Emit `'stream-end'` immediately. Render calm state. No rAF loop started. |
| Invalid `mode` prop | `console.warn` + fallback to `'bars'`. No emit. |
| Invalid `fftSize` (not power-of-two or out of range) | `console.warn` + fallback to `2048`. No emit. |
| `smoothingTimeConstant` out of [0,1] | `console.warn` + clamped to nearest bound. No emit. |
| `height` <= 0 | `console.warn` + treated as `120`. No emit. |
| Web Audio API not supported | `console.error` + `emit('error', { code: 'UNSUPPORTED', message: '...' })`. Render calm state. |
| `AudioContext` creation fails | `console.error` + `emit('error', { code: 'AUDIO_CONTEXT_FAILED', message: '...' })`. Render calm state. |
| Stream track already ended on mount | Detected via `track.readyState === 'ended'` check on mount. `emit('stream-end')`. Render calm state. |

All errors are **non-fatal** — the component degrades gracefully.

### AudioContext Autoplay Policy

Browsers may create `AudioContext` in `suspended` state if no user gesture has occurred. The component calls `audioContext.resume()` immediately after creation. If `resume()` is rejected, the component continues in a degraded mode: silence detection and emits still function, but visualization may show calm state until the context is resumed by a later user gesture.

---

## Lifecycle & Cleanup

```
onMounted    → validate props → build AudioContext → call audioContext.resume()
             → attach audio track 'ended' listener
             → start rAF loop → attach ResizeObserver

onUnmounted  → cancel rAF loop → disconnect ResizeObserver
             → disconnect MediaStreamSourceNode → disconnect AnalyserNode
             → close AudioContext (only here — not on stream changes)
             → generation counter incremented to invalidate any pending reconnect callbacks

watch(stream, { immediate: false })
  → increment generation counter (cancels any in-flight reconnect)
  → cancel rAF loop → disconnect old MediaStreamSourceNode
  → if new stream is null: render calm state, stop
  → if new stream has no audio tracks: emit 'stream-end', render calm state, stop
  → otherwise: create new MediaStreamSourceNode from new stream
              → connect to existing AnalyserNode → restart rAF loop
```

---

## Package Distribution

### Entry (`src/index.ts`)

```typescript
export { default as WaveVisualizer } from './components/WaveVisualizer.vue'
export type { WaveVisualizerProps, WaveMode, WaveVisualizerEmits, RendererOptions } from './types'

// Vue plugin default export
import WaveVisualizer from './components/WaveVisualizer.vue'
import type { App } from 'vue'

const plugin = {
  install(app: App) {
    app.component('WaveVisualizer', WaveVisualizer)
  }
}

export default plugin
```

### Registration

```typescript
// Global (plugin) — component available everywhere as <WaveVisualizer>
import WaveVisualizerPlugin from 'vue-wave-visualizer'
app.use(WaveVisualizerPlugin)

// Local (recommended — explicit, tree-shaking friendly)
import { WaveVisualizer } from 'vue-wave-visualizer'
```

Both methods use the same component with identical props and emits.

### Build Output (Vite lib mode)

```
dist/
├── vue-wave-visualizer.es.js    # ESM — primary
├── vue-wave-visualizer.umd.js   # UMD — CDN compatible
└── index.d.ts                   # TypeScript declarations
```

### `package.json` Key Fields

```json
{
  "name": "vue-wave-visualizer",
  "main": "./dist/vue-wave-visualizer.umd.js",
  "module": "./dist/vue-wave-visualizer.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/vue-wave-visualizer.es.js",
      "require": "./dist/vue-wave-visualizer.umd.js"
    }
  },
  "peerDependencies": {
    "vue": "^3.0.0"
  }
}
```

Vue is a `peerDependency` to prevent bundling two copies of Vue.

---

## Visualization Modes

| Mode | Data Source | `color` meaning | `lineWidth` used | `barCount` used |
|---|---|---|---|---|
| `waveform` | `getByteTimeDomainData()` | Stroke color | Yes | No |
| `bars` | `getByteFrequencyData()` | Fill color | No | Yes |
| `circular` | `getByteFrequencyData()` | Stroke color | Yes | Yes |
| `mirror-bars` | `getByteFrequencyData()` | Fill color | No | Yes |

All modes share the same Audio pipeline. Switching `mode` at runtime clears the canvas once and switches the draw function on the next rAF frame — no audio pipeline rebuild.

---

## TypeScript Types

```typescript
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

// Used with defineEmits<WaveVisualizerEmits>()
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
  width: number    // logical CSS pixels (already accounts for devicePixelRatio scaling)
  height: number
}
```

<!-- zh-TW translation -->

<!-- zh-TW content below -->

# 聲波可視化器 — 設計規格

**日期：** 2026-03-17
**套件名稱：** `vue-wave-visualizer`
**狀態：** 已核准

---

## 概覽

一個獨立的 Vue 3 npm 套件，可從 `MediaStream` 即時渲染音訊波形可視化效果。使用者傳入 `MediaStream` 並透過 props 選擇視覺模式，除 Vue 3 外無任何外部依賴。

---

## 目標

- 接收 `MediaStream`，使用 Web Audio API 即時可視化
- 透過 `mode` prop 支援 4 種可視化模式，可即時切換
- 發佈為可在任何 Vue 3 專案中使用的 npm 套件
- 提供完整的 TypeScript 型別定義
- 僅透過 props 與 emits 提供簡潔最小化的 API

## 非目標

- 不處理 `getUserMedia` 權限 —— 使用者負責取得 stream
- 僅支援 Vue 3，不支援 React、Angular 等其他框架
- 樣式僅透過 props 設定，不提供 CSS 變數主題化
- 不支援 SSR —— 所有 Web Audio API 與 canvas 操作皆封裝於生命週期 hook（`onMounted`）內；模組頂層不存在任何 Web Audio API 參照

---

## 架構

### 模式

Single Fat Component（`WaveVisualizer.vue`）—— 單一元件涵蓋所有模式，內部邏輯拆分為 composable 與 renderer 函式。

### 專案結構

```
vue-wave-visualizer/
├── src/
│   ├── components/
│   │   └── WaveVisualizer.vue        # 對外公開元件，僅含 template 與 props
│   ├── composables/
│   │   ├── useAudioAnalyser.ts       # Web Audio API pipeline
│   │   └── useCanvasRenderer.ts      # rAF loop + draw 分派
│   ├── renderers/
│   │   ├── drawWaveform.ts           # 模式：waveform
│   │   ├── drawBars.ts               # 模式：bars
│   │   ├── drawCircular.ts           # 模式：circular
│   │   └── drawMirrorBars.ts         # 模式：mirror-bars
│   ├── types/
│   │   └── index.ts                  # 所有 TypeScript 型別
│   └── index.ts                      # 套件入口
├── package.json
├── vite.config.ts                    # Lib 模式建置
└── tsconfig.json
```

### 設計原則

- `WaveVisualizer.vue` 不含任何 Audio 或 Canvas 邏輯 —— 僅含 template 與 prop 宣告
- 每個 renderer 皆為純函式：`(ctx: CanvasRenderingContext2D, data: Uint8Array, options: RendererOptions) => void` —— 可獨立測試
- `useAudioAnalyser` 只負責 Web Audio pipeline
- `useCanvasRenderer` 只負責動畫 loop 與 renderer 分派
- 所有 `AudioContext` 與 canvas 操作皆在 `onMounted` 內建立 —— 不在模組頂層（SSR 安全）

---

## 元件 API

### Props

```typescript
interface WaveVisualizerProps {
  // 核心 —— 必填
  stream: MediaStream | null         // null 為合法值；渲染平靜狀態並等待

  mode: 'waveform' | 'bars' | 'circular' | 'mirror-bars'

  // 尺寸
  height?: number
  // Canvas 高度（px），預設值：120。<= 0 時視為 120。
  // 寬度永遠為父容器的 100%，透過 ResizeObserver 更新。

  // 視覺
  color?: string
  // 可視化的主要顏色，預設值：'#58a6ff'。
  // waveform：筆觸顏色
  // bars / mirror-bars：柱狀填充顏色
  // circular：放射線筆觸顏色
  // 統一套用 —— 不依模式分色。

  backgroundColor?: string
  // Canvas 背景填充顏色，預設值：'transparent'（每幀清除，不填滿）。

  barCount?: number
  // bars、mirror-bars、circular 模式渲染的柱狀數量，預設值：64。
  // 執行時夾限（clamp）至 [1, frequencyBinCount]，其中 frequencyBinCount = fftSize / 2。
  // waveform 模式無效果（忽略，不發出警告）。

  lineWidth?: number
  // waveform 模式的筆觸線條寬度（px），預設值：2。
  // 同時作為 circular 模式的弧線筆觸寬度。
  // bars 與 mirror-bars 模式忽略（不發出警告）。

  fftSize?: number
  // AnalyserNode 的 FFT 大小，必須為 [32, 32768] 範圍內的 2 的冪，預設值：2048。
  // 無效值（非 2 的冪或超出範圍）→ console.warn + 回退至 2048。

  smoothingTimeConstant?: number
  // 音訊平滑係數，範圍 [0, 1]，預設值：0.8。
  // 超出範圍 → console.warn + 夾限至最近的合法值（0 或 1）。

  // 靜音偵測
  silenceThreshold?: number
  // 被視為靜音的 RMS 音量（0–1），預設值：0.01。
  // 設為 0 可停用靜音偵測：由於 RMS >= 0 恆成立，rms < 0 永不觸發。

  silenceDuration?: number
  // 持續靜音多少毫秒後 emit 'silence'，預設值：1500。
}
```

### Emits

```typescript
interface WaveVisualizerEmits {
  (event: 'stream-end'): void
  // stream 的第一個音訊 track 觸發 'ended' 事件時，emit 一次。
  // 若 stream 無音訊 track，則在 mount 時立即 emit。

  (event: 'silence', payload: { duration: number }): void
  // 首次偵測到靜音時 emit 一次（不是每幀都 emit）。
  // 在 'audio-active' emit 後重新啟用，可循環觸發。

  (event: 'audio-active'): void
  // 靜音期間後，第一幀 RMS 超過 silenceThreshold 時 emit 一次。
  // 去抖動（debounce）：僅 1 幀，無額外延遲。

  (event: 'error', payload: { code: string; message: string }): void
  // 非致命性錯誤，必定同時搭配 console.error。
}
```

### 使用範例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WaveVisualizer } from 'vue-wave-visualizer'

const micStream = ref<MediaStream | null>(null)

async function startMic() {
  micStream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
}
</script>

<template>
  <div style="width: 100%">
    <WaveVisualizer
      :stream="micStream"
      mode="bars"
      :height="80"
      color="#3fb950"
      @stream-end="handleStop"
      @silence="handleSilence"
      @error="handleError"
    />
  </div>
</template>
```

---

## 資料流

```
MediaStream (props.stream)
    │
    ▼
useAudioAnalyser
    ├── AudioContext.createMediaStreamSource(stream)
    ├── AnalyserNode
    │     ├── fftSize（已驗證的 prop）
    │     └── smoothingTimeConstant（已驗證的 prop）
    ├── audioContext.resume()  ← 建立後立即呼叫（autoplay 政策）
    ├── getByteTimeDomainData()  →  waveform 模式
    └── getByteFrequencyData()   →  bars / circular / mirror-bars 模式
    │
    ▼
useCanvasRenderer（requestAnimationFrame loop）
    ├── 從 AnalyserNode 讀取 Uint8Array
    ├── 計算 RMS → 靜音偵測邏輯
    ├── 視需要 emit 事件
    └── switch(mode)
          ├── drawWaveform(ctx, data, options)
          ├── drawBars(ctx, data, options)
          ├── drawCircular(ctx, data, options)
          └── drawMirrorBars(ctx, data, options)
```

### 響應式 Prop 變更

| Prop 變更 | 行為 |
|---|---|
| `stream` 變更為有效 stream | 取消 rAF loop → 斷開舊 source node → 重新連接新 source → 重啟 rAF loop |
| `stream` 變更為 `null` | 取消 rAF loop → 斷開 source node → 渲染平靜狀態 → 等待 |
| `mode` 變更 | 僅切換 draw 函式 —— 不重建 Audio pipeline，canvas 清除一次 |
| `color`、`height`、`barCount` 等 | 在下一個動畫幀生效 |

### AudioContext 生命週期

`AudioContext` 在 `onMounted` 時建立一次，並在整個元件生命週期中持續使用。當 `stream` 變更時，僅拆除並重建 `MediaStreamSourceNode`，`AudioContext` 與 `AnalyserNode` 維持不變。此設計可避免重複建立 context，並遵守瀏覽器對同時存在的 `AudioContext` 實例數量的限制（Chrome 通常為 6 個）。

`AudioContext` 僅在 `onUnmounted` 時關閉。

### 快速切換 `stream` Prop

若在重新連接完成前 `stream` 已多次變更（例如使用者快速切換麥克風裝置），則以世代計數器（generation counter）序列化所有重連操作。舊世代的重連在新世代開始前會被取消。

### 尺寸

- Canvas CSS 寬度：永遠為 `100%`
- Canvas 像素緩衝區：`canvas.width = clientWidth * devicePixelRatio`；`canvas.height = height * devicePixelRatio`；CSS 尺寸設為 `clientWidth × height`（px），使繪製座標與 CSS 像素一致
- 在 mount 時及每次 `ResizeObserver` callback 後更新
- 若 mount 時 `clientWidth` 為 0（隱藏容器），canvas 以寬度 0 初始化，待 `ResizeObserver` 回報非零寬度後再調整
- `ResizeObserver` callback **不**做去抖動（debounce）—— 僅重設 canvas 尺寸（`canvas.width` / `canvas.height`），然後呼叫 `cancelAnimationFrame` 並重啟 draw loop。`AudioContext` 與 `AnalyserNode` 不受影響。

### 平靜狀態（Calm State）

「平靜狀態」意指：將 canvas 清除為 `backgroundColor`（若為預設值則清除為透明），再以零振幅渲染可視化效果：
- **waveform**：在垂直中點繪製水平直線，使用 `color` 與 `lineWidth`
- **bars / mirror-bars**：所有柱狀高度為 0（最小 1px，確保柱狀仍可見）
- **circular**：所有放射線維持最小長度（僅基礎半徑）

平靜狀態以單一靜態幀渲染（不執行 rAF loop）。

### 靜音偵測

```
每個 rAF 幀：
  data = getByteTimeDomainData()            // 0–255，中心值為 128
  rms = sqrt(mean((sample/128 - 1)^2))     // 正規化至 0–1

  if rms < silenceThreshold:
    silenceElapsed += frameDeltaMs
    if silenceElapsed >= silenceDuration AND NOT alreadySilent:
      alreadySilent = true
      emit('silence', { duration: silenceElapsed })
  else:
    if alreadySilent:
      alreadySilent = false
      silenceElapsed = 0
      emit('audio-active')
    else:
      silenceElapsed = 0

stream.audioTrack.onended:
  emit('stream-end')
  渲染平靜狀態（靜態幀）
```

`frameDeltaMs` 由 `performance.now()` 的幀間差值計算，因此即使分頁隱藏導致 rAF 被節流，靜音計時仍能保持正確。

---

## 錯誤處理

所有錯誤皆使用 `console.error`（DevTools 中永遠可見）搭配 `emit('error')`（父層可選擇性處理）。

| 情境 | 行為 |
|---|---|
| `stream` 為 `null` | 渲染平靜狀態，無錯誤，等待有效 stream。 |
| `stream` 無音訊 track | 立即 emit `'stream-end'`，渲染平靜狀態，不啟動 rAF loop。 |
| 無效的 `mode` prop | `console.warn` + 回退至 `'bars'`，不 emit。 |
| 無效的 `fftSize`（非 2 的冪或超出範圍）| `console.warn` + 回退至 `2048`，不 emit。 |
| `smoothingTimeConstant` 超出 [0,1] | `console.warn` + 夾限至最近的合法值，不 emit。 |
| `height` <= 0 | `console.warn` + 視為 `120`，不 emit。 |
| 瀏覽器不支援 Web Audio API | `console.error` + `emit('error', { code: 'UNSUPPORTED', message: '...' })`，渲染平靜狀態。 |
| `AudioContext` 建立失敗 | `console.error` + `emit('error', { code: 'AUDIO_CONTEXT_FAILED', message: '...' })`，渲染平靜狀態。 |
| stream track 在 mount 時已結束 | 透過 `track.readyState === 'ended'` 檢測，emit `'stream-end'`，渲染平靜狀態。 |

所有錯誤皆為**非致命性** —— 元件以降級（graceful）方式處理。

### AudioContext Autoplay 政策

若尚未發生使用者手勢，瀏覽器可能將 `AudioContext` 建立為 `suspended` 狀態。元件在建立後立即呼叫 `audioContext.resume()`。若 `resume()` 被拒絕，元件將以降級模式繼續運作：靜音偵測與事件 emit 仍可正常運作，但可視化效果可能顯示平靜狀態，直到 context 被後續的使用者手勢恢復為止。

---

## 生命週期與清理

```
onMounted    → 驗證 props → 建立 AudioContext → 呼叫 audioContext.resume()
             → 附加音訊 track 'ended' 監聽器
             → 啟動 rAF loop → 附加 ResizeObserver

onUnmounted  → 取消 rAF loop → 斷開 ResizeObserver
             → 斷開 MediaStreamSourceNode → 斷開 AnalyserNode
             → 關閉 AudioContext（僅在此處關閉，stream 變更時不關閉）
             → 遞增世代計數器，使所有待處理的重連 callback 失效

watch(stream, { immediate: false })
  → 遞增世代計數器（取消進行中的重連）
  → 取消 rAF loop → 斷開舊 MediaStreamSourceNode
  → 若新 stream 為 null：渲染平靜狀態，停止
  → 若新 stream 無音訊 track：emit 'stream-end'，渲染平靜狀態，停止
  → 否則：從新 stream 建立 MediaStreamSourceNode
          → 連接至現有 AnalyserNode → 重啟 rAF loop
```

---

## 套件發佈

### 入口（`src/index.ts`）

```typescript
export { default as WaveVisualizer } from './components/WaveVisualizer.vue'
export type { WaveVisualizerProps, WaveMode, WaveVisualizerEmits, RendererOptions } from './types'

// Vue plugin 預設 export
import WaveVisualizer from './components/WaveVisualizer.vue'
import type { App } from 'vue'

const plugin = {
  install(app: App) {
    app.component('WaveVisualizer', WaveVisualizer)
  }
}

export default plugin
```

### 註冊方式

```typescript
// 全域（plugin）—— 元件在整個 app 中以 <WaveVisualizer> 使用
import WaveVisualizerPlugin from 'vue-wave-visualizer'
app.use(WaveVisualizerPlugin)

// 局部（推薦 —— 明確，tree-shaking 友善）
import { WaveVisualizer } from 'vue-wave-visualizer'
```

兩種方式使用相同的元件，props 與 emits 完全一致。

### 建置輸出（Vite lib 模式）

```
dist/
├── vue-wave-visualizer.es.js    # ESM —— 主要
├── vue-wave-visualizer.umd.js   # UMD —— 相容 CDN
└── index.d.ts                   # TypeScript 型別宣告
```

### `package.json` 關鍵欄位

```json
{
  "name": "vue-wave-visualizer",
  "main": "./dist/vue-wave-visualizer.umd.js",
  "module": "./dist/vue-wave-visualizer.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/vue-wave-visualizer.es.js",
      "require": "./dist/vue-wave-visualizer.umd.js"
    }
  },
  "peerDependencies": {
    "vue": "^3.0.0"
  }
}
```

Vue 列為 `peerDependency`，以防止打包進兩份 Vue。

---

## 可視化模式

| 模式 | 資料來源 | `color` 意義 | 使用 `lineWidth` | 使用 `barCount` |
|---|---|---|---|---|
| `waveform` | `getByteTimeDomainData()` | 筆觸顏色 | 是 | 否 |
| `bars` | `getByteFrequencyData()` | 填充顏色 | 否 | 是 |
| `circular` | `getByteFrequencyData()` | 筆觸顏色 | 是 | 是 |
| `mirror-bars` | `getByteFrequencyData()` | 填充顏色 | 否 | 是 |

所有模式共用相同的 Audio pipeline。執行時切換 `mode` 會清除 canvas 一次，並在下一個 rAF 幀切換 draw 函式 —— 不重建 Audio pipeline。

---

## TypeScript 型別

```typescript
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

// 搭配 defineEmits<WaveVisualizerEmits>() 使用
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
  width: number    // 邏輯 CSS 像素（已考量 devicePixelRatio 縮放）
  height: number
}
```
