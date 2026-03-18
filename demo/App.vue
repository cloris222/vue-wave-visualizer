<script setup lang="ts">
import { ref, computed } from 'vue'
import WaveVisualizer from '../src/components/WaveVisualizer.vue'
import type { WaveMode } from '../src/types'

// ── types ──────────────────────────────────────────────────
interface Cfg {
  height: number
  color: string
  useTransparentBg: boolean
  backgroundColor: string
  barCount: number
  lineWidth: number
  fftSize: number
  smoothingTimeConstant: number
  silenceThreshold: number
  silenceDuration: number
}

const DEFAULT_CFG: Cfg = {
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
}

// ── cfg state ──────────────────────────────────────────────
const savedCfg = ref<Cfg>({ ...DEFAULT_CFG })
const workCfg  = ref<Cfg>({ ...DEFAULT_CFG })

const effectiveBg = computed(() =>
  workCfg.value.useTransparentBg ? 'transparent' : workCfg.value.backgroundColor
)

// ── settings panel ─────────────────────────────────────────
const panelOpen = ref(false)
const hasUnsaved = computed(() =>
  JSON.stringify(workCfg.value) !== JSON.stringify(savedCfg.value)
)

function openPanel() { workCfg.value = { ...savedCfg.value }; panelOpen.value = true }
function savePanel()  { savedCfg.value = { ...workCfg.value }; panelOpen.value = false }
function resetWork()  { workCfg.value = { ...savedCfg.value } }
function closePanel() { workCfg.value = { ...savedCfg.value }; panelOpen.value = false }

// ── mode ───────────────────────────────────────────────────
const modes: WaveMode[] = ['waveform', 'bars', 'circular', 'mirror-bars']
const mode = ref<WaveMode>('waveform')

const showBarCount = computed(() => mode.value !== 'waveform')
const showLineWidth = computed(() => mode.value === 'waveform' || mode.value === 'circular')
const fftSizeOptions = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768]

// ── code dialog ────────────────────────────────────────────
const codeDialogRef = ref<HTMLDialogElement | null>(null)
const copiedInstall = ref(false)
const copiedUsage   = ref(false)

function openCodeDialog() { codeDialogRef.value?.showModal() }
function closeCodeDialog() { codeDialogRef.value?.close() }
function onCodeBackdrop(e: MouseEvent) { if (e.target === codeDialogRef.value) closeCodeDialog() }

const installCode = `npm install vue-wave-visualizer`

const usageCode = computed(() => {
  const c = savedCfg.value
  const bg = c.useTransparentBg ? 'transparent' : c.backgroundColor
  return `<script setup>
import { ref } from 'vue'
import { WaveVisualizer } from 'vue-wave-visualizer'

const stream = ref(null)

async function startMic() {
  stream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
}

function stopMic() {
  stream.value?.getTracks().forEach(t => t.stop())
  stream.value = null
}
<\/script>

<template>
  <button @click="startMic">開啟麥克風</button>
  <button @click="stopMic">停止</button>

  <WaveVisualizer
    :stream="stream"
    mode="${mode.value}"
    :height="${c.height}"
    color="${c.color}"
    background-color="${bg}"
    :bar-count="${c.barCount}"
    :line-width="${c.lineWidth}"
    :fft-size="${c.fftSize}"
    :smoothing-time-constant="${c.smoothingTimeConstant}"
    :silence-threshold="${c.silenceThreshold}"
    :silence-duration="${c.silenceDuration}"
    @silence="(e) => console.log('silence', e)"
    @audio-active="() => console.log('audio active')"
    @stream-end="stopMic"
  />
</template>`
})

async function copy(text: string, which: 'install' | 'usage') {
  await navigator.clipboard.writeText(text)
  if (which === 'install') {
    copiedInstall.value = true
    setTimeout(() => { copiedInstall.value = false }, 2000)
  } else {
    copiedUsage.value = true
    setTimeout(() => { copiedUsage.value = false }, 2000)
  }
}

// ── mic ───────────────────────────────────────────────────
const stream     = ref<MediaStream | null>(null)
const isRecording = ref(false)
const micError   = ref<string | null>(null)
const silenceMsg  = ref<string | null>(null)

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
function onStreamEnd()   { isRecording.value = false; stream.value = null }
</script>

<template>
  <div class="container">
    <h1>vue-wave-visualizer demo</h1>

    <!-- toolbar -->
    <div class="toolbar">
      <div class="toolbar-top">
        <button :class="['btn', isRecording ? 'btn-danger' : '']" @click="toggleMic">
          {{ isRecording ? '⏹ 停止麥克風' : '🎤 開啟麥克風' }}
        </button>
        <div class="toolbar-right">
          <button :class="['btn', panelOpen ? 'btn-selected' : '']" @click="openPanel">⚙ 設定</button>
        </div>
      </div>
      <div class="toolbar-modes">
        <button
          v-for="m in modes" :key="m"
          :class="['btn', mode === m ? 'btn-selected' : '']"
          @click="mode = m"
        >{{ m }}</button>
      </div>
    </div>

    <p v-if="micError"   class="msg-error">{{ micError }}</p>
    <p v-if="silenceMsg" class="msg-silence">{{ silenceMsg }}</p>

    <!-- visualizer -->
    <div class="visualizer-wrap">
      <WaveVisualizer
        :stream="stream"
        :mode="mode"
        :height="workCfg.height"
        :color="workCfg.color"
        :background-color="effectiveBg"
        :bar-count="workCfg.barCount"
        :line-width="workCfg.lineWidth"
        :fft-size="workCfg.fftSize"
        :smoothing-time-constant="workCfg.smoothingTimeConstant"
        :silence-threshold="workCfg.silenceThreshold"
        :silence-duration="workCfg.silenceDuration"
        @silence="onSilence"
        @audio-active="onAudioActive"
        @stream-end="onStreamEnd"
      />
    </div>

    <!--quick start-->
    <button class="btn" @click="openCodeDialog">&lt;/&gt; 程式碼</button>

    <div class="info">
      <span>狀態：<strong>{{ isRecording ? '錄音中' : '待機' }}</strong></span>
      <span>模式：<strong>{{ mode }}</strong></span>
    </div>
  </div>

  <!-- ── settings side panel ── -->
  <Transition name="panel">
    <div v-if="panelOpen" class="side-panel">
      <div class="panel-header">
        <h2>設定 <span v-if="hasUnsaved" class="unsaved-dot" title="有未儲存的變更">●</span></h2>
        <button class="icon-btn" @click="closePanel" title="關閉（放棄變更）">✕</button>
      </div>

      <div class="panel-body">
        <section>
          <h4>通用設定</h4>

          <label class="field">
            <span>高度 (height)</span>
            <div class="input-row">
              <input type="range"  v-model.number="workCfg.height" min="40" max="400" step="10" />
              <input type="number" v-model.number="workCfg.height" min="40" max="400" step="10" class="num-input" />
            </div>
          </label>

          <label class="field">
            <span>波形顏色 (color)</span>
            <div class="input-row">
              <input type="color" v-model="workCfg.color" class="color-input" />
              <input type="text"  v-model="workCfg.color" class="text-input" placeholder="#58a6ff" />
            </div>
          </label>

          <label class="field">
            <span>背景顏色 (backgroundColor)</span>
            <div class="input-row">
              <input type="color" v-model="workCfg.backgroundColor" class="color-input" :disabled="workCfg.useTransparentBg" />
              <input type="text"  v-model="workCfg.backgroundColor" class="text-input"  :disabled="workCfg.useTransparentBg" placeholder="#0d1117" />
              <label class="check-label">
                <input type="checkbox" v-model="workCfg.useTransparentBg" />
                transparent
              </label>
            </div>
          </label>

          <label class="field">
            <span>靜音閾值 (silenceThreshold) — {{ workCfg.silenceThreshold.toFixed(3) }}</span>
            <div class="input-row">
              <input type="range"  v-model.number="workCfg.silenceThreshold" min="0" max="0.5" step="0.005" />
              <input type="number" v-model.number="workCfg.silenceThreshold" min="0" max="0.5" step="0.005" class="num-input" />
            </div>
          </label>

          <label class="field">
            <span>靜音時長 (silenceDuration) ms</span>
            <div class="input-row">
              <input type="range"  v-model.number="workCfg.silenceDuration" min="100" max="5000" step="100" />
              <input type="number" v-model.number="workCfg.silenceDuration" min="100" max="5000" step="100" class="num-input" />
            </div>
          </label>
        </section>

        <section>
          <h4>模式設定 <span class="mode-tag">{{ mode }}</span></h4>

          <label v-if="showBarCount" class="field">
            <span>Bar 數量 (barCount)</span>
            <div class="input-row">
              <input type="range"  v-model.number="workCfg.barCount" min="4" max="256" step="1" />
              <input type="number" v-model.number="workCfg.barCount" min="4" max="256" step="1" class="num-input" />
            </div>
          </label>

          <label v-if="showLineWidth" class="field">
            <span>線條寬度 (lineWidth)</span>
            <div class="input-row">
              <input type="range"  v-model.number="workCfg.lineWidth" min="1" max="10" step="0.5" />
              <input type="number" v-model.number="workCfg.lineWidth" min="1" max="10" step="0.5" class="num-input" />
            </div>
          </label>

          <label class="field">
            <span>FFT 大小 (fftSize)</span>
            <select v-model.number="workCfg.fftSize" class="select-input">
              <option v-for="s in fftSizeOptions" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>

          <label class="field">
            <span>平滑係數 (smoothingTimeConstant) — {{ workCfg.smoothingTimeConstant.toFixed(2) }}</span>
            <div class="input-row">
              <input type="range"  v-model.number="workCfg.smoothingTimeConstant" min="0" max="1" step="0.01" />
              <input type="number" v-model.number="workCfg.smoothingTimeConstant" min="0" max="1" step="0.01" class="num-input" />
            </div>
          </label>
        </section>
      </div>

      <div class="panel-footer">
        <button class="footer-btn footer-btn-reset" @click="resetWork" :disabled="!hasUnsaved">重設</button>
        <button class="footer-btn footer-btn-save"  @click="savePanel" :disabled="!hasUnsaved">儲存</button>
      </div>
    </div>
  </Transition>

  <!-- ── code dialog ── -->
  <dialog ref="codeDialogRef" class="code-dialog" @click="onCodeBackdrop">
    <div class="code-dialog-inner">
      <div class="code-dialog-header">
        <h2>&lt;/&gt; 快速使用指南</h2>
        <button class="icon-btn" @click="closeCodeDialog">✕</button>
      </div>

      <div class="code-dialog-body">
        <p class="code-tip">依照以下步驟將 WaveVisualizer 嵌入你的 Vue 3 專案。<br>程式碼已反映目前儲存的設定（模式：<strong>{{ mode }}</strong>）。</p>

        <!-- Step 1: install -->
        <div class="code-section">
          <div class="code-section-label">
            <span class="step-badge">1</span> 安裝套件
          </div>
          <div class="code-block-wrap">
            <pre class="code-block">{{ installCode }}</pre>
            <button class="copy-btn" @click="copy(installCode, 'install')">
              {{ copiedInstall ? '✓ 已複製' : '複製' }}
            </button>
          </div>
        </div>

        <!-- Step 2: usage -->
        <div class="code-section">
          <div class="code-section-label">
            <span class="step-badge">2</span> 貼入你的元件
          </div>
          <div class="code-block-wrap">
            <pre class="code-block">{{ usageCode }}</pre>
            <button class="copy-btn" @click="copy(usageCode, 'usage')">
              {{ copiedUsage ? '✓ 已複製' : '複製' }}
            </button>
          </div>
        </div>
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
  min-height: 100vh;
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
.toolbar { display: flex; flex-direction: column; gap: 8px; }

.toolbar-top {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 8px;
}

.toolbar-right { display: flex; gap: 8px; }

.toolbar-modes { 
  margin-top: 1rem;
  display: flex; gap: 8px;
 }

/* ── unified button ── */
.btn {
  flex: 1;
  padding: 10px 16px;
  font-size: 0.9rem;
  border: 1px solid #30363d;
  border-radius: 8px;
  background: #21262d;
  color: #8b949e;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  white-space: nowrap;
}
.btn:hover        { border-color: #58a6ff; color: #58a6ff; }
.btn-selected     { border-color: #58a6ff; color: #58a6ff; background: #1f3a5f; }
.btn-danger       { background: #da3633; color: #e6edf3; border-color: #da3633; }
.btn-danger:hover { background: #da3633; color: #e6edf3; border-color: #da3633; filter: brightness(1.15); }

/* ── visualizer ── */
.visualizer-wrap { border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }

.msg-error   { color: #f85149; font-size: 0.9rem; }
.msg-silence { color: #e3b341; font-size: 0.9rem; }

.info { display: flex; gap: 20px; font-size: 0.85rem; color: #8b949e; }

/* ── side panel ── */
.side-panel {
  position: fixed;
  top: 0; right: 0;
  width: 320px;
  height: 100vh;
  background: #161b22;
  border-left: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -8px 0 24px rgba(0,0,0,.4);
}

.panel-enter-active,
.panel-leave-active { transition: transform 0.25s ease; }
.panel-enter-from,
.panel-leave-to     { transform: translateX(100%); }

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
}
.panel-header h2 { font-size: 1rem; display: flex; align-items: center; gap: 8px; }

.unsaved-dot { color: #e3b341; font-size: 0.75rem; }

.icon-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
}
.icon-btn:hover { color: #e6edf3; background: #21262d; }

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

section { display: flex; flex-direction: column; gap: 14px; }

section:first-child {
  padding-bottom: 1rem;
  border-bottom: 1px solid #30363d;
}

section h4 {
  font-size: 0.75rem;
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
  font-size: 0.72rem;
  text-transform: none;
  letter-spacing: 0;
}

.field { display: flex; flex-direction: column; gap: 6px; cursor: default; }
.field > span { font-size: 0.8rem; color: #8b949e; }

.input-row { display: flex; align-items: center; gap: 8px; }
.input-row input[type="range"] {
  flex: 1; min-width: 0;
  accent-color: #58a6ff;
  cursor: pointer;
}

.num-input, .text-input {
  width: 80px;
  padding: 4px 8px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  font-size: 0.82rem;
  flex-shrink: 0;
}

.color-input {
  width: 34px; height: 30px;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: #0d1117;
  cursor: pointer;
  padding: 2px;
  flex-shrink: 0;
}

input:disabled, select:disabled { opacity: 0.35; cursor: not-allowed; }

.check-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  color: #8b949e;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.select-input {
  width: 100%;
  padding: 6px 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  font-size: 0.82rem;
  cursor: pointer;
}

/* ── panel footer ── */
.panel-footer {
  display: flex;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #30363d;
  flex-shrink: 0;
}

.footer-btn {
  flex: 1;
  padding: 9px;
  font-size: 0.88rem;
  border-radius: 8px;
  border: 1px solid #30363d;
  cursor: pointer;
  transition: all 0.15s;
}
.footer-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.footer-btn-reset { background: #21262d; color: #8b949e; }
.footer-btn-reset:not(:disabled):hover { border-color: #f85149; color: #f85149; }
.footer-btn-save  { background: #1f3a5f; color: #58a6ff; border-color: #58a6ff44; }
.footer-btn-save:not(:disabled):hover { background: #58a6ff; color: #0d1117; border-color: #58a6ff; }

/* ── code dialog ── */
.code-dialog {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 0;
  width: min(680px, 95vw);
  max-height: 85vh;
  color: #e6edf3;
  position: fixed;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
}

.code-dialog::backdrop {
  background: rgba(0,0,0,.65);
  backdrop-filter: blur(2px);
}

.code-dialog-inner { display: flex; flex-direction: column; max-height: 85vh; }

.code-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
}
.code-dialog-header h2 { font-size: 1rem; }

.code-dialog-body {
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.code-tip {
  font-size: 0.85rem;
  color: #8b949e;
  line-height: 1.6;
}
.code-tip strong { color: #58a6ff; }

.code-section { display: flex; flex-direction: column; gap: 8px; }

.code-section-label {
  font-size: 0.8rem;
  color: #8b949e;
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  background: #1f3a5f;
  color: #58a6ff;
  border: 1px solid #58a6ff44;
  border-radius: 50%;
  font-size: 0.72rem;
  font-weight: 600;
  flex-shrink: 0;
}

.code-block-wrap {
  position: relative;
}

.code-block {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 14px 16px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  color: #e6edf3;
  white-space: pre;
  overflow-x: auto;
  padding-right: 72px; /* space for copy btn */
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 10px;
  font-size: 0.75rem;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.copy-btn:hover { border-color: #58a6ff; color: #58a6ff; }
</style>
