import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSessionContext } from '@/app/SessionProvider'
import { useTheme } from '@/app/ThemeProvider'
import { updateSettings } from '@/db/settings'
import type { ThemePref } from '@/domain/theme'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Sheet } from '@/ui/Sheet'
import { TabScreen } from './TabScreen'

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]

function ThemePicker() {
  const { pref, setPref } = useTheme()
  const { userId } = useSessionContext()
  const labelId = useId()
  const hintId = useId()
  const name = useId()

  function choose(theme: ThemePref) {
    setPref(theme)
    if (userId === null) return
    updateSettings({ theme }).catch(() => {
      // El tema ya se aplicó y quedó en este dispositivo; si la escritura
      // local falla, solo se pierde que viaje a otros dispositivos.
    })
  }

  return (
    <Card>
      <p id={labelId} className="font-semibold">
        Tema
      </p>
      <p id={hintId} className="mt-0.5 text-sm text-texto-suave">
        Sistema sigue el modo claro u oscuro de tu dispositivo.
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="mt-3 grid grid-cols-3 gap-1 rounded-boton bg-superficie-2 p-1"
      >
        {THEME_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-[1rem] text-sm font-medium text-texto-suave transition-colors duration-150 hover:text-texto has-checked:bg-cobalto has-checked:font-semibold has-checked:text-sobre-cobalto has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={pref === option.value}
              onChange={() => choose(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </Card>
  )
}

function SignOut() {
  const { signOut } = useSessionContext()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)

  async function confirm() {
    setLeaving(true)
    try {
      await signOut()
    } finally {
      navigate('/iniciar-sesion', { replace: true })
    }
  }

  return (
    <Card>
      <p className="font-semibold">Sesión</p>
      <p className="mt-0.5 text-sm text-texto-suave">
        Tus datos se quedan en este dispositivo.
      </p>
      <Button
        variant="secundaria"
        className="mt-3 w-full"
        onClick={() => setConfirming(true)}
      >
        Cerrar sesión
      </Button>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Cerrar sesión en este dispositivo?"
      >
        <p className="text-texto-suave">
          Para volver a entrar necesitarás tu correo y tu contraseña.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="peligro" loading={leaving} onClick={confirm}>
            Cerrar sesión
          </Button>
          <Button
            variant="fantasma"
            disabled={leaving}
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </Button>
        </div>
      </Sheet>
    </Card>
  )
}

export function Mas() {
  return (
    <TabScreen title="Más">
      <div className="flex flex-col gap-3">
        <ThemePicker />
        <SignOut />
      </div>
      <p className="mt-8 text-center text-sm text-texto-suave cifras">
        Versión {import.meta.env.VITE_APP_VERSION}
      </p>
    </TabScreen>
  )
}
