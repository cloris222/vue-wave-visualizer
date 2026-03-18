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
