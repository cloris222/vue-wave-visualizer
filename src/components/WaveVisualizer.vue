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
  // Guard: only start if analyser was created AND the stream track is still active.
  // init() sets analyser.value before attachTrackListener runs, so if the track was
  // already ended, onStreamEnd fired synchronously (calling stop()), but analyser.value
  // is still non-null. Re-checking the track state here avoids a stale RAF loop.
  const tracks = stream.getAudioTracks()
  const trackAlive = tracks.length > 0 && tracks[0].readyState !== 'ended'
  if (analyser.value && trackAlive) {
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

watch(() => validated.value.height, () => {
  updateCanvasSize()
  renderCalmState(canvasRef, modeRef, rendererOptions)
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
