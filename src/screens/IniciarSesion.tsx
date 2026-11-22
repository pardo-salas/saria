import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  AUTH_ERROR_MESSAGES,
  sendPasswordReset,
  signIn,
  type AuthError,
} from '@/auth/authService'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { TextField } from '@/ui/TextField'
import { AuthScreen } from './AuthScreen'

const RESET_ERROR_MESSAGES: Record<AuthError, string> = {
  offline: 'Necesitas internet para enviar el correo.',
  misconfigured: AUTH_ERROR_MESSAGES.misconfigured,
  invalid_credentials:
    'No se pudo enviar el correo. Revisa que esté bien escrito e intenta de nuevo.',
  unknown:
    'No se pudo enviar el correo. Revisa que esté bien escrito e intenta de nuevo.',
}

function ErrorText({ children }: { children: string }) {
  return (
    <p role="alert" className="text-sm text-gasto">
      {children}
    </p>
  )
}

function ForgotPassword({
  open,
  onClose,
  initialEmail,
}: {
  open: boolean
  onClose(): void
  initialEmail: string
}) {
  const [email, setEmail] = useState(initialEmail)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    const result = await sendPasswordReset(email.trim())
    setSending(false)
    if (result.ok) setSent(true)
    else setError(RESET_ERROR_MESSAGES[result.error])
  }

  return (
    <Sheet open={open} onClose={onClose} title="Restablecer contraseña">
      {sent ? (
        <div aria-live="polite">
          <p className="font-semibold">
            Te enviamos un correo para restablecer tu contraseña.
          </p>
          <p className="mt-2 text-texto-suave">
            Abre el enlace del correo en este dispositivo para elegir una nueva.
          </p>
          <Button variant="primaria" className="mt-6 w-full" onClick={onClose}>
            Listo
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-texto-suave">
            Te enviaremos un enlace para elegir una nueva contraseña.
          </p>
          <TextField
            label="Correo de tu cuenta"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <ErrorText>{error}</ErrorText>}
          <Button variant="primaria" type="submit" loading={sending}>
            Enviar correo
          </Button>
        </form>
      )}
    </Sheet>
  )
}

export function IniciarSesion() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotOpen, setForgotOpen] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    // Si sale bien, supabase-js emite SIGNED_IN y la ruta lleva a Inicio.
    const result = await signIn(email.trim(), password)
    setLoading(false)
    if (!result.ok) setError(AUTH_ERROR_MESSAGES[result.error])
  }

  return (
    <AuthScreen title="Saria" intro="Entra con tu correo y tu contraseña.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button
          variant="primaria"
          type="submit"
          loading={loading}
          className="mt-2"
        >
          Iniciar sesión
        </Button>
      </form>
      <Button
        variant="fantasma"
        className="mt-2 w-full text-texto-suave"
        onClick={() => setForgotOpen(true)}
      >
        ¿Olvidaste tu contraseña?
      </Button>
      {forgotOpen && (
        <ForgotPassword
          open
          onClose={() => setForgotOpen(false)}
          initialEmail={email.trim()}
        />
      )}
    </AuthScreen>
  )
}
