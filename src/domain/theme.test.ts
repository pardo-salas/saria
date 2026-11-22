import { resolveTheme, THEME_STORAGE_KEY } from './theme'

describe('resolveTheme', () => {
  it('sigue al sistema cuando la preferencia es system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('respeta la preferencia explícita aunque el sistema diga otra cosa', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('usa la clave saria.theme', () => {
    expect(THEME_STORAGE_KEY).toBe('saria.theme')
  })
})
