<script setup lang="ts">
import { ref, computed } from 'vue'
import WaveVisualizer from '../src/components/WaveVisualizer.vue'
import type { WaveMode } from '../src/types'

// ── mic state ──────────────────────────────────────────────
const stream = ref<MediaStream | null>(null)
const isRecording = ref(false)
const micError = ref<string | null>(null)
const silenceMsg = ref<string | null>(null)

// ── mode ───────────────────────────────────────────────────
const modes: WaveMode[] = ['waveform', 'bars', 'circular', 'mirror-bars']
const mode = ref<WaveMode>('waveform')

// ── props (all adjustable) ─────────────────────────────────
const cfg = ref({
  height: 120,
  color: '#58a6ff',
  useTransparentBg: true,
  backgroundColor: '#0d1117',
  barCount: 64,
  lineWidth: 2,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  silenceThreshold: 0.01,
  silenceDuration: 1500,
})

const effectiveBg = computed(() =>
  cfg.value.useTransparentBg ? 'transparent' : cfg.value.backgroundColor
)

const fftSizeOptions = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768]

// ── dialog ────────────────────────────────────────────────
const dialogRef = ref<HTMLDialogElement | null>(null)
function openDialog() { dialogRef.value?.showModal() }
function closeDialog() { dialogRef.value?.close() }
function onBackdropClick(e: MouseEvent) {
  if (e.target === dialogRef.value) closeDialog()
}

// ── section visibility per mode ───────────────────────────
const showBarCount = computed(() => mode.value !== 'waveform')
const showLineWidth = computed(() => mode.value === 'waveform' || mode.value === 'circular')

// ── mic ───────────────────────────────────────────────────
async function toggleMic() {
  if (isRecording.value) {
    stream.value?.getTracks().forEach(t => t.stop())
    stream.value = null
    isRecording.value = false
    silenceMsg.value = null
  } else {
    try {
      micError.value = null
      stream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
      isRecording.value = true
    } catch (e) {
      micError.value = '無法存取麥克風：' + (e instanceof Error ? e.message : String(e))
    }
  }
}

function onSilence(payload: { duration: number }) {
  silenceMsg.value = `偵測到靜音 (${(payload.duration / 1000).toFixed(1)}s)`
}
function onAudioActive() { silenceMsg.value = null }
function onStreamEnd() { isRecording.value = false; stream.value = null }
</script>

<template>
  <div class="container">
    <h1>vue-wave-visualizer demo</h1>

    <!-- toolbar -->
    <div class="toolbar">
      <button :class="['mic-btn', isRecording ? 'active' : '']" @click="toggleMic">
        {{ isRecording ? '⏹ 停止麥克風' : '🎤 開啟麥克風' }}
      </button>

      <div class="modes">
        <button
          v-for="m in modes" :key="m"
          :class="['mode-btn', mode === m ? 'selected' : '']"
          @click="mode = m"
        >{{ m }}</button>
      </div>

      <button class="settings-btn" @click="openDialog" title="調整設定">⚙ 設定</button>
    </div>

    <p v-if="micError" class="error">{{ micError }}</p>
    <p v-if="silenceMsg" class="silence">{{ silenceMsg }}</p>

    <!-- visualizer -->
    <div class="visualizer-wrap">
      <WaveVisualizer
        :stream="stream"
        :mode="mode"
        :height="cfg.height"
        :color="cfg.color"
        :background-color="effectiveBg"
        :bar-count="cfg.barCount"
        :line-width="cfg.lineWidth"
        :fft-size="cfg.fftSize"
        :smoothing-time-constant="cfg.smoothingTimeConstant"
        :silence-threshold="cfg.silenceThreshold"
        :silence-duration="cfg.silenceDuration"
        @silence="onSilence"
        @audio-active="onAudioActive"
        @stream-end="onStreamEnd"
      />
    </div>

    <div class="info">
      <span>狀態：<strong>{{ isRecording ? '錄音中' : '待機' }}</strong></span>
      <span>模式：<strong>{{ mode }}</strong></span>
    </div>
  </div>

  <!-- settings dialog -->
  <dialog ref="dialogRef" class="settings-dialog" @click="onBackdropClick">
    <div class="dialog-inner">
      <div class="dialog-header">
        <h2>設定</h2>
        <button class="close-btn" @click="closeDialog">✕</button>
      </div>

      <div class="dialog-body">

        <!-- 通用設定 -->
        <section>
          <h3>通用設定</h3>

          <label class="field">
            <span>高度 (height)</span>
            <div class="input-row">
              <input type="range" v-model.number="cfg.height" min="40" max="400" step="10" />
              <input type="number" v-model.number="cfg.height" min="40" max="400" step="10" />
            </div>
          </label>

          <label class="field">
            <span>波形顏色 (color)</span>
            <div class="input-row">
              <input type="color" v-model="cfg.color" />
              <input type="text" v-model="cfg.color" placeholder="#58a6ff" />
            </div>
          </label>

          <label class="field">
            <span>背景顏色 (backgroundColor)</span>
            <div class="input-row">
              <input type="color" v-model="cfg.backgroundColor" :disabled="cfg.useTransparentBg" />
              <input type="text" v-model="cfg.backgroundColor" :disabled="cfg.useTransparentBg" placeholder="#0d1117" />
              <label class="checkbox-label">
                <input type="checkbox" v-model="cfg.useTransparentBg" />
                transparent
              </label>
            </div>
          </label>

          <label class="field">
            <span>靜音閾值 (silenceThreshold) {{ cfg.silenceThreshold.toFixed(3) }}</span>
            <div class="input-row">
              <input type="range" v-model.number="cfg.silenceThreshold" min="0" max="0.5" step="0.005" />
              <input type="number" v-model.number="cfg.silenceThreshold" min="0" max="0.5" step="0.005" />
            </div>
          </label>

          <label class="field">
            <span>靜音持續時間 (silenceDuration) ms</span>
            <div class="input-row">
              <input type="range" v-model.number="cfg.silenceDuration" min="100" max="5000" step="100" />
              <input type="number" v-model.number="cfg.silenceDuration" min="100" max="5000" step="100" />
            </div>
          </label>
        </section>

        <!-- 模式專屬設定 -->
        <section>
          <h3>模式設定 <span class="mode-tag">{{ mode }}</span></h3>

          <!-- bars / mirror-bars / circular -->
          <label v-if="showBarCount" class="field">
            <span>Bar 數量 (barCount)</span>
            <div class="input-row">
              <input type="range" v-model.number="cfg.barCount" min="4" max="256" step="1" />
              <input type="number" v-model.number="cfg.barCount" min="4" max="256" step="1" />
            </div>
          </label>

          <!-- waveform / circular -->
          <label v-if="showLineWidth" class="field">
            <span>線條寬度 (lineWidth)</span>
            <div class="input-row">
              <input type="range" v-model.number="cfg.lineWidth" min="1" max="10" step="0.5" />
              <input type="number" v-model.number="cfg.lineWidth" min="1" max="10" step="0.5" />
            </div>
          </label>

          <!-- all modes -->
          <label class="field">
            <span>FFT 大小 (fftSize)</span>
            <select v-model.number="cfg.fftSize">
              <option v-for="s in fftSizeOptions" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>

          <label class="field">
            <span>平滑係數 (smoothingTimeConstant) {{ cfg.smoothingTimeConstant.toFixed(2) }}</span>
            <div class="input-row">
              <input type="range" v-model.number="cfg.smoothingTimeConstant" min="0" max="1" step="0.01" />
              <input type="number" v-model.number="cfg.smoothingTimeConstant" min="0" max="1" step="0.01" />
            </div>
          </label>
        </section>

      </div>
    </div>
  </dialog>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

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
  gap: 20px;
}

h1 { font-size: 1.5rem; color: #58a6ff; }

/* ── toolbar ── */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.mic-btn {
  padding: 10px 20px;
  font-size: 0.95rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: #21262d;
  color: #e6edf3;
  transition: background 0.2s;
  white-space: nowrap;
}
.mic-btn.active { background: #da3633; }
.mic-btn:hover { filter: brightness(1.15); }

.modes { display: flex; gap: 6px; flex-wrap: wrap; }

.mode-btn {
  padding: 6px 14px;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: #21262d;
  color: #8b949e;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.15s;
}
.mode-btn.selected { border-color: #58a6ff; color: #58a6ff; background: #1f3a5f; }

.settings-btn {
  margin-left: auto;
  padding: 6px 14px;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: #21262d;
  color: #8b949e;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
  white-space: nowrap;
}
.settings-btn:hover { border-color: #58a6ff; color: #58a6ff; }

/* ── visualizer ── */
.visualizer-wrap { border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }

.error  { color: #f85149; font-size: 0.9rem; }
.silence { color: #e3b341; font-size: 0.9rem; }

.info { display: flex; gap: 20px; font-size: 0.85rem; color: #8b949e; }

/* ── dialog ── */
.settings-dialog {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 0;
  width: min(480px, 95vw);
  max-height: 85vh;
  color: #e6edf3;
}

.settings-dialog::backdrop {
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(2px);
}

.dialog-inner { display: flex; flex-direction: column; height: 100%; }

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #30363d;
}
.dialog-header h2 { font-size: 1rem; }

.close-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  border-radius: 4px;
}
.close-btn:hover { color: #e6edf3; background: #21262d; }

.dialog-body {
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

section { display: flex; flex-direction: column; gap: 16px; }

section h3 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8b949e;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-tag {
  background: #1f3a5f;
  color: #58a6ff;
  border: 1px solid #58a6ff44;
  border-radius: 4px;
  padding: 1px 8px;
  font-size: 0.75rem;
  text-transform: none;
  letter-spacing: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: default;
}

.field > span {
  font-size: 0.82rem;
  color: #8b949e;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.input-row input[type="range"] {
  flex: 1;
  accent-color: #58a6ff;
  cursor: pointer;
}

.input-row input[type="number"],
.input-row input[type="text"] {
  width: 90px;
  padding: 4px 8px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  font-size: 0.85rem;
}

.input-row input[type="color"] {
  width: 36px;
  height: 32px;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: #0d1117;
  cursor: pointer;
  padding: 2px;
}

.input-row input:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: #8b949e;
  cursor: pointer;
  white-space: nowrap;
}

select {
  padding: 6px 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  font-size: 0.85rem;
  cursor: pointer;
  width: 100%;
}
</style>
