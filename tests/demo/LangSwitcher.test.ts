import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LangSwitcher from '../../demo/components/LangSwitcher.vue'
import { useLocale } from '../../demo/i18n'

describe('LangSwitcher', () => {
  beforeEach(() => {
    const { setLocale } = useLocale()
    setLocale('zh-TW')
  })

  it('預設不顯示下拉選單', () => {
    const wrapper = mount(LangSwitcher)
    expect(wrapper.find('[data-testid="lang-dropdown"]').exists()).toBe(false)
  })

  it('點擊 globe 按鈕後顯示下拉選單', async () => {
    const wrapper = mount(LangSwitcher)
    await wrapper.find('[data-testid="lang-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="lang-dropdown"]').exists()).toBe(true)
  })

  it('顯示兩個語言選項', async () => {
    const wrapper = mount(LangSwitcher)
    await wrapper.find('[data-testid="lang-btn"]').trigger('click')
    const items = wrapper.findAll('[data-testid="lang-item"]')
    expect(items).toHaveLength(2)
  })

  it('點擊 English 後切換語言並關閉選單', async () => {
    const wrapper = mount(LangSwitcher)
    await wrapper.find('[data-testid="lang-btn"]').trigger('click')
    const items = wrapper.findAll('[data-testid="lang-item"]')
    await items[1].trigger('click') // English
    const { locale } = useLocale()
    expect(locale.value).toBe('en')
    expect(wrapper.find('[data-testid="lang-dropdown"]').exists()).toBe(false)
  })

  it('按 Escape 關閉選單', async () => {
    const wrapper = mount(LangSwitcher, { attachTo: document.body })
    await wrapper.find('[data-testid="lang-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="lang-dropdown"]').exists()).toBe(true)
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-testid="lang-dropdown"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
