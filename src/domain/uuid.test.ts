import { describe, expect, it } from 'vitest'
import { uuidV5 } from './uuid'

describe('uuidV5', () => {
  it('coincide con el vector de prueba conocido (namespace DNS)', async () => {
    expect(
      await uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
    ).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2')
  })
})
