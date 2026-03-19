<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useLocale, type Locale } from '../i18n'

const { locale, setLocale } = useLocale()
const open = ref(false)

const langs: { code: Locale; label: string }[] = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en',    label: 'English'  },
]

function toggle() { open.value = !open.value }

function select(lang: Locale) {
  setLocale(lang)
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

function onClickOutside(e: MouseEvent) {
  if (!(e.target as Element).closest('.lang-switcher')) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="lang-switcher">
    <button
      class="lang-btn"
      data-testid="lang-btn"
      aria-label="選擇語言 / Select language"
      @click.stop="toggle"
    >
      <!-- Globe SVG icon -->
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    </button>

    <div v-if="open" class="lang-dropdown" data-testid="lang-dropdown">
      <button
        v-for="lang in langs"
        :key="lang.code"
        class="lang-item"
        :class="{ 'lang-item--active': locale === lang.code }"
        data-testid="lang-item"
        @click.stop="select(lang.code)"
      >{{ lang.label }}</button>
    </div>
  </div>
</template>

<style scoped>
.lang-switcher {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.lang-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
  line-height: 1;
}
.lang-btn:hover { color: #e6edf3; }

.lang-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .5);
  min-width: 130px;
  z-index: 200;
  overflow: hidden;
}

.lang-item {
  display: block;
  width: 100%;
  padding: 9px 16px;
  font-size: 0.82rem;
  color: #8b949e;
  background: none;
  border: none;
  border-bottom: 1px solid #30363d;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s, color 0.1s;
}
.lang-item:last-child { border-bottom: none; }
.lang-item:hover { background: #21262d; color: #e6edf3; }
.lang-item--active { color: #58a6ff; background: #1f3a5f; }
</style>
