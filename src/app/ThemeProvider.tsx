import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  isThemePref,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePref,
} from '@/domain/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'
// Color de la barra del navegador/sistema: el fondo de cada tema (ver src/ui/tokens.css).
const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: '#070F22',
  light: '#EEF2FA',
}

interface ThemeContextValue {
  pref: ThemePref
  resolved: ResolvedTheme
  setPref(p: ThemePref): void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredPref(): ThemePref {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePref(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function storePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    // Almacenamiento bloqueado (modo privado): el tema sigue aplicándose en esta sesión.
  }
}

function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readStoredPref)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  const resolved = resolveTheme(pref, systemDark)

  // Se escucha siempre (no solo con 'system') para que systemDark esté al día
  // si el usuario vuelve a 'system' después de elegir un tema fijo.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (e: { matches: boolean }) => setSystemDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[resolved])
  }, [resolved])

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p)
    storePref(p)
  }, [])

  const value = useMemo(
    () => ({ pref, resolved, setPref }),
    [pref, resolved, setPref],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}
