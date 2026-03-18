<script setup lang="ts">
import { ref } from 'vue'
import WaveVisualizer from '../src/components/WaveVisualizer.vue'
import type { WaveMode } from '../src/types'

const stream = ref<MediaStream | null>(null)
const mode = ref<WaveMode>('waveform')
const isRecording = ref(false)
const error = ref<string | null>(null)
const silenceMsg = ref<string | null>(null)

const modes: WaveMode[] = ['waveform', 'bars', 'circular', 'mirror-bars']

async function toggleMic() {
  if (isRecording.value) {
    stream.value?.getTracks().forEach(t => t.stop())
    stream.value = null
    isRecording.value = false
    silenceMsg.value = null
  } else {
    try {
      error.value = null
      stream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
      isRecording.value = true
    } catch (e) {
      error.value = '無法存取麥克風：' + (e instanceof Error ? e.message : String(e))
    }
  }
}

function onSilence(payload: { duration: number }) {
  silenceMsg.value = `偵測到靜音 (${(payload.duration / 1000).toFixed(1)}s)`
}

function onAudioActive() {
  silenceMsg.value = null
}

function onStreamEnd() {
  isRecording.value = false
  stream.value = null
}
</script>

<template>
  <div class="container">
    <h1>vue-wave-visualizer demo</h1>

    <div class="controls">
      <button :class="['mic-btn', isRecording ? 'active' : '']" @click="toggleMic">
        {{ isRecording ? '⏹ 停止麥克風' : '🎤 開啟麥克風' }}
      </button>

      <div class="modes">
        <button
          v-for="m in modes"
          :key="m"
          :class="['mode-btn', mode === m ? 'selected' : '']"
          @click="mode = m"
        >
          {{ m }}
        </button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="silenceMsg" class="silence">{{ silenceMsg }}</p>

    <div class="visualizer-wrap">
      <WaveVisualizer
        :stream="stream"
        :mode="mode"
        :height="120"
        color="#58a6ff"
        background-color="#0d1117"
        :bar-count="64"
        :silence-threshold="0.01"
        :silence-duration="1500"
        @silence="onSilence"
        @audio-active="onAudioActive"
        @stream-end="onStreamEnd"
      />
    </div>

    <div class="info">
      <p>狀態：<strong>{{ isRecording ? '錄音中' : '待機' }}</strong></p>
      <p>模式：<strong>{{ mode }}</strong></p>
    </div>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #0d1117;
  color: #e6edf3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

.container {
  width: 100%;
  max-width: 700px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

h1 {
  font-size: 1.5rem;
  color: #58a6ff;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mic-btn {
  padding: 12px 24px;
  font-size: 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: #21262d;
  color: #e6edf3;
  transition: background 0.2s;
}
.mic-btn.active {
  background: #da3633;
}
.mic-btn:hover {
  filter: brightness(1.15);
}

.modes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mode-btn {
  padding: 6px 16px;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: #21262d;
  color: #8b949e;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
}
.mode-btn.selected {
  border-color: #58a6ff;
  color: #58a6ff;
  background: #1f3a5f;
}

.visualizer-wrap {
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: hidden;
}

.error {
  color: #f85149;
  font-size: 0.9rem;
}

.silence {
  color: #e3b341;
  font-size: 0.9rem;
}

.info {
  display: flex;
  gap: 24px;
  font-size: 0.85rem;
  color: #8b949e;
}
</style>
