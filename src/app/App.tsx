import { BrowserRouter } from 'react-router'
import { AppRoutes } from './router'
import { SessionProvider } from './SessionProvider'

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  )
}
