import { BrowserRouter } from 'react-router'
import { AppRoutes } from './router'
import { SessionProvider } from './SessionProvider'
import { UpdatePrompt } from './UpdatePrompt'

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <UpdatePrompt />
    </SessionProvider>
  )
}
