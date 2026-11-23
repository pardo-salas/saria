import { manifest } from '../../pwa-manifest'

describe('manifest de la PWA', () => {
  it('tiene nombre, idioma, modo y colores de Saria', () => {
    expect(manifest).toMatchObject({
      name: 'Saria',
      short_name: 'Saria',
      lang: 'es-MX',
      display: 'standalone',
      start_url: '/',
      theme_color: '#070F22',
      background_color: '#070F22',
    })
  })

  it('incluye iconos de 192 y 512 y uno maskable de 512', () => {
    const icons = manifest.icons ?? []
    const normal = (size: string) =>
      icons.filter((i) => i.sizes === size && i.purpose !== 'maskable')
    expect(normal('192x192')).toHaveLength(1)
    expect(normal('512x512')).toHaveLength(1)
    expect(
      icons.filter((i) => i.sizes === '512x512' && i.purpose === 'maskable'),
    ).toHaveLength(1)
  })
})
