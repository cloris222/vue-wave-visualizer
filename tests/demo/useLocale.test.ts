import { describe, it, expect, beforeEach } from 'vitest'
import { useLocale } from '../../demo/i18n'

describe('useLocale', () => {
  beforeEach(() => {
    // 每次測試前重設為預設語言，避免 module-level ref 狀態污染
    const { setLocale } = useLocale()
    setLocale('zh-TW')
  })

  it('預設語言為 zh-TW', () => {
    const { locale } = useLocale()
    expect(locale.value).toBe('zh-TW')
  })

  it('t() 在 zh-TW 回傳中文字串', () => {
    const { t } = useLocale()
    expect(t('startMic')).toBe('🎤 開啟麥克風')
    expect(t('save')).toBe('儲存')
  })

  it('setLocale("en") 切換為英文', () => {
    const { setLocale, locale } = useLocale()
    setLocale('en')
    expect(locale.value).toBe('en')
  })

  it('t() 在 en 回傳英文字串', () => {
    const { setLocale, t } = useLocale()
    setLocale('en')
    expect(t('startMic')).toBe('🎤 Start Mic')
    expect(t('save')).toBe('Save')
  })

  it('切換語言後 t() 即時反映新語言', () => {
    const { setLocale, t } = useLocale()
    expect(t('reset')).toBe('重設')
    setLocale('en')
    expect(t('reset')).toBe('Reset')
  })
})
