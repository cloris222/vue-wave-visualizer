import { ref } from 'vue'
import zhTW from './zh-TW'
import en from './en'

export type Locale = 'zh-TW' | 'en'
export type Messages = typeof zhTW

// module-level ref：全 app 共享同一個語言狀態
const locale = ref<Locale>('zh-TW')
const messages: Record<Locale, Messages> = { 'zh-TW': zhTW, en }

export function useLocale() {
  const t = (key: keyof Messages): string => messages[locale.value][key]
  const setLocale = (lang: Locale) => { locale.value = lang }
  return { locale, t, setLocale }
}
