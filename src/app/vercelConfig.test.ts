import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface VercelConfig {
  rewrites: { source: string; destination: string }[]
  headers: {
    source: string
    headers: { key: string; value: string }[]
  }[]
}

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf-8'),
) as VercelConfig

const cacheControl = (source: string) =>
  config.headers
    .find((h) => h.source === source)
    ?.headers.find((h) => h.key === 'Cache-Control')?.value

describe('vercel.json', () => {
  it('reescribe cualquier ruta a /index.html (SPA)', () => {
    expect(config.rewrites).toContainEqual({
      source: '/(.*)',
      destination: '/index.html',
    })
  })

  it.each(['/sw.js', '/manifest.webmanifest', '/index.html'])(
    'no cachea %s para que un despliegue nuevo se detecte',
    (source) => {
      expect(cacheControl(source)).toBe('public, max-age=0, must-revalidate')
    },
  )

  it('cachea /assets de forma inmutable', () => {
    expect(cacheControl('/assets/(.*)')).toBe(
      'public, max-age=31536000, immutable',
    )
  })
})
