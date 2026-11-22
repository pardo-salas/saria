import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { updatePassword } from '@/auth/authService'
import { useSessionContext } from '@/app/SessionProvider'
import { Button } from '@/ui/Button'
import { TextField } from '@/ui/TextField'
import { AuthScreen } from './AuthScreen'

const MIN_PASSWORD_LENGTH = 8

/**
 * Destino del enlace de "¿Olvidaste tu contraseña?". supabase-js detecta la
 * sesión de recuperación en la URL y emite PASSWORD_RECOVERY, así que aquí se
 * llega con la puerta en signed-in: esta ruta no redirige a Inicio.
 */
export function Restablecer() {
  const { gate } = useSessionContext()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await updatePassword(password)
    setSaving(false)
    if (result.ok) setDone(true)
    else
      setError(
        result.error === 'offline'
          ? 'Necesitas internet para cambiar la contraseña.'
          : 'No se pudo cambiar la contraseña. Intenta de nuevo.',
      )
  }

  if (done) {
    return (
      <AuthScreen
        title="Listo, tu contraseña cambió."
        intro="La próxima vez que inicies sesión usa la nueva."
      >
        <Button
          variant="primaria"
          className="w-full"
          onClick={() => navigate('/', { replace: true })}
        >
          Ir a Inicio
        </Button>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      title="Cambia tu contraseña"
      intro="Elige una contraseña de al menos 8 caracteres."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-gasto">
            {error}
          </p>
        )}
        <Button
          variant="primaria"
          type="submit"
          loading={saving}
          className="mt-2"
        >
          Cambiar contraseña
        </Button>
      </form>
      {gate === 'signed-out' && (
        <p className="mt-6 text-center text-sm text-texto-suave">
          ¿Llegaste aquí sin el enlace del correo?{' '}
          <Link
            to="/iniciar-sesion"
            className="inline-flex min-h-11 items-center font-semibold text-texto underline underline-offset-4"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      )}
    </AuthScreen>
  )
}
