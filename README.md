# vue-wave-visualizer

A Vue 3 component for real-time audio waveform visualization from a `MediaStream` (e.g. microphone input) using the Web Audio API and Canvas API.

**[Live Demo](https://cloris222.github.io/vue-wave-visualizer/)**

## Features

- 4 visualization modes: `waveform`, `bars`, `mirror-bars`, `circular`
- Silence detection with configurable threshold and duration
- Stream lifecycle events (`stream-end`, `silence`, `audio-active`, `error`)
- Responsive canvas with device pixel ratio (HiDPI/Retina) support
- Fully typed with TypeScript
- Zero dependencies (Vue 3 peer dependency only)

## Installation

```bash
npm install vue-wave-visualizer
```

## Usage

### Local import

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WaveVisualizer } from 'vue-wave-visualizer'

const stream = ref<MediaStream | null>(null)

async function startMic() {
  stream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
}
</script>

<template>
  <button @click="startMic">Start</button>
  <WaveVisualizer
    :stream="stream"
    mode="waveform"
    :height="120"
    color="#58a6ff"
  />
</template>
```

### Global plugin registration

```typescript
import { createApp } from 'vue'
import App from './App.vue'
import VueWaveVisualizer from 'vue-wave-visualizer'

createApp(App).use(VueWaveVisualizer).mount('#app')
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stream` | `MediaStream \| null` | — **required** | Audio stream to visualize. Pass `null` to show idle state. |
| `mode` | `'waveform' \| 'bars' \| 'circular' \| 'mirror-bars'` | — **required** | Visualization mode. |
| `height` | `number` | `120` | Canvas height in CSS pixels. |
| `color` | `string` | `'#58a6ff'` | Color of the waveform / bars. Any valid CSS color. |
| `backgroundColor` | `string` | `'transparent'` | Canvas background color. |
| `barCount` | `number` | `64` | Number of bars or spikes (`bars`, `circular`, `mirror-bars` modes). |
| `lineWidth` | `number` | `2` | Stroke width in pixels (`waveform`, `circular` modes). |
| `fftSize` | `number` | `2048` | Web Audio `AnalyserNode.fftSize`. Must be a power of two between 32–32768. |
| `smoothingTimeConstant` | `number` | `0.8` | Web Audio smoothing factor, clamped to `[0, 1]`. |
| `silenceThreshold` | `number` | `0.01` | RMS amplitude below which audio is considered silent. |
| `silenceDuration` | `number` | `1500` | Milliseconds of sustained silence before the `silence` event fires. |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `stream-end` | — | Fires when the audio track ends (e.g. mic unplugged or permission revoked). |
| `silence` | `{ duration: number }` | Fires once when silence persists beyond `silenceDuration` ms. |
| `audio-active` | — | Fires when audio resumes after a silence period. |
| `error` | `{ code: string; message: string }` | Fires on AudioContext failure. Codes: `UNSUPPORTED`, `AUDIO_CONTEXT_FAILED`. |

## Examples

### Handling events

```vue
<WaveVisualizer
  :stream="stream"
  mode="bars"
  :height="160"
  color="#3fb950"
  :bar-count="80"
  :silence-duration="2000"
  @stream-end="onStreamEnd"
  @silence="onSilence"
  @audio-active="onAudioActive"
  @error="onError"
/>
```

```typescript
function onSilence({ duration }: { duration: number }) {
  console.log(`Silence detected after ${duration}ms`)
}

function onError({ code, message }: { code: string; message: string }) {
  console.error(`[${code}] ${message}`)
}
```

### Visualization modes

```vue
<!-- Time-domain waveform -->
<WaveVisualizer :stream="stream" mode="waveform" />

<!-- Frequency bars -->
<WaveVisualizer :stream="stream" mode="bars" :bar-count="64" />

<!-- Mirrored frequency bars -->
<WaveVisualizer :stream="stream" mode="mirror-bars" :bar-count="64" />

<!-- Circular frequency spikes -->
<WaveVisualizer :stream="stream" mode="circular" :bar-count="128" />
```

## Browser Support

Requires a browser with support for:
- Web Audio API (`AudioContext`)
- Canvas API
- `MediaStream` / `getUserMedia`
- `ResizeObserver`

## License

MIT
