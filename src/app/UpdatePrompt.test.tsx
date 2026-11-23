import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdatePrompt } from './UpdatePrompt'

const pwa = vi.hoisted(() => ({
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [pwa.needRefresh, pwa.setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: pwa.updateServiceWorker,
  }),
}))

beforeEach(() => {
  pwa.needRefresh = false
  pwa.setNeedRefresh.mockClear()
  pwa.updateServiceWorker.mockClear()
})

describe('UpdatePrompt', () => {
  it('sin versión nueva no muestra nada', () => {
    const { container } = render(<UpdatePrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('con versión nueva avisa y "Actualizar" llama updateServiceWorker(true)', async () => {
    pwa.needRefresh = true
    render(<UpdatePrompt />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Hay una versión nueva',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('"Ahora no" cierra el aviso sin actualizar', async () => {
    pwa.needRefresh = true
    render(<UpdatePrompt />)
    await userEvent.click(screen.getByRole('button', { name: 'Ahora no' }))
    expect(pwa.setNeedRefresh).toHaveBeenCalledWith(false)
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
  })
})
