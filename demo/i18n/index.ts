import { ref } from 'vue'
import zhTW from './zh-TW'
import en from './en'

export type Locale = 'zh-TW' | 'en'
export type Messages = Record<keyof typeof zhTW | keyof typeof en, string>

const locale = ref<Locale>('zh-TW')
const messages: Record<Locale, Messages> = { 'zh-TW': zhTW, en }

function t(key: keyof Messages, vars?: Record<string, string>): string {
  let str: string = messages[locale.value][key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v)
    }
  }
  return str
}

function setLocale(lang: Locale) { locale.value = lang }

export function useLocale() {
  return { locale, t, setLocale }
}
