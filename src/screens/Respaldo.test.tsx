import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/app/ThemeProvider'
import { downloadJson } from '@/app/download'
import { db } from '@/db/dexie'
import { buildBackup } from '@/domain/backup'
import { COLUMNS } from '@/db/schema'
import { Providers } from '@/features/forms/testUtils'
import { Respaldo } from './Respaldo'

vi.mock('@/app/download', () => ({ downloadJson: vi.fn() }))

afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(db.tables.map((t) => t.clear()))
})

function renderRespaldo() {
  render(
    <ThemeProvider>
      <Providers>
        <MemoryRouter>
          <Respaldo />
        </MemoryRouter>
      </Providers>
    </ThemeProvider>,
  )
}

const emptyTables = () =>
  Object.fromEntries(Object.keys(COLUMNS).map((t) => [t, []]))

describe('Respaldo: importar', () => {
  it('un archivo inválido muestra el error', async () => {
    const user = userEvent.setup()
    renderRespaldo()
    await user.upload(
      screen.getByLabelText('Archivo de respaldo'),
      new File(['hola'], 'x.json', { type: 'application/json' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo no es un respaldo de Saria',
    )
  })

  it('uno válido muestra la vista previa y al confirmar descarga el actual antes de restaurar', async () => {
    const user = userEvent.setup()
    renderRespaldo()
    const backup = buildBackup(emptyTables() as never, '2026-11-22T12:00:00Z')
    await user.upload(
      screen.getByLabelText('Archivo de respaldo'),
      new File([JSON.stringify(backup)], 'r.json', {
        type: 'application/json',
      }),
    )
    expect(
      await screen.findByText(
        /Este respaldo tiene 0 cuentas, 0 categorías, 0 movimientos y 0 transferencias \(exportado el /,
      ),
    ).toBeInTheDocument()
    expect(downloadJson).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Restaurar respaldo' }))
    await vi.waitFor(() => expect(downloadJson).toHaveBeenCalledTimes(1))
    expect(downloadJson).toHaveBeenCalledWith(
      expect.stringMatching(/^saria-respaldo-\d{4}-\d{2}-\d{2}\.json$/),
      expect.objectContaining({ format: 'saria-backup' }),
    )
    expect(await screen.findByText('Respaldo restaurado')).toBeInTheDocument()
  })
})
