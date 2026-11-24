import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SyncPill } from './SyncPill'

describe('SyncPill', () => {
  it('muestra "2 pendientes" con dos cambios por subir', () => {
    render(
      <SyncPill
        status={{
          state: 'pendiente',
          pending: 2,
          lastSyncedAt: null,
          message: null,
        }}
      />,
    )
    expect(screen.getByText('2 pendientes')).toBeInTheDocument()
  })
})
