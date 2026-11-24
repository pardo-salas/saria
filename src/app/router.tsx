import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AUTH_ERROR_MESSAGES } from '@/auth/authService'
import { AuthScreen } from '@/screens/AuthScreen'
import { Categorias } from '@/screens/Categorias'
import { CuentaDetalle } from '@/screens/CuentaDetalle'
import { Cuentas } from '@/screens/Cuentas'
import { CuentasArchivadas } from '@/screens/CuentasArchivadas'
import { Graficas } from '@/screens/Graficas'
import { IniciarSesion } from '@/screens/IniciarSesion'
import { Inicio } from '@/screens/Inicio'
import { Mas } from '@/screens/Mas'
import { Movimientos } from '@/screens/Movimientos'
import { Respaldo } from '@/screens/Respaldo'
import { Restablecer } from '@/screens/Restablecer'
import { Layout } from './Layout'
import { useSessionContext } from './SessionProvider'

// Solo existe en desarrollo: en el build de producción la rama se elimina y
// el módulo no se incluye.
const Componentes = import.meta.env.DEV
  ? lazy(() =>
      import('@/screens/Componentes').then((m) => ({ default: m.Componentes })),
    )
  : null

function Misconfigured() {
  return (
    <AuthScreen title="Saria">
      <p role="alert" className="text-texto-suave">
        {AUTH_ERROR_MESSAGES.misconfigured}
      </p>
    </AuthScreen>
  )
}

function RequireSession() {
  const { gate } = useSessionContext()
  if (gate !== 'signed-in') return <Navigate to="/iniciar-sesion" replace />
  return <Layout />
}

function SignedOutOnly() {
  const { gate } = useSessionContext()
  if (gate === 'signed-in') return <Navigate to="/" replace />
  return <IniciarSesion />
}

/**
 * Rutas de la app. Sin configuración de Supabase todas muestran el aviso. Las
 * 5 pestañas requieren sesión; /restablecer es accesible con y sin sesión
 * (la recuperación de contraseña llega con sesión).
 */
export function AppRoutes() {
  const { gate } = useSessionContext()
  if (gate === 'misconfigured') return <Misconfigured />

  return (
    <Routes>
      <Route element={<RequireSession />}>
        <Route index element={<Inicio />} />
        <Route path="movimientos" element={<Movimientos />} />
        <Route path="cuentas" element={<Cuentas />} />
        <Route path="cuentas/archivadas" element={<CuentasArchivadas />} />
        <Route path="cuentas/:id" element={<CuentaDetalle />} />
        <Route path="graficas" element={<Graficas />} />
        <Route path="mas" element={<Mas />} />
        <Route path="mas/categorias" element={<Categorias />} />
        <Route path="mas/respaldo" element={<Respaldo />} />
      </Route>
      <Route path="iniciar-sesion" element={<SignedOutOnly />} />
      <Route path="restablecer" element={<Restablecer />} />
      {Componentes && (
        <Route
          path="componentes"
          element={
            <Suspense fallback={null}>
              <Componentes />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
