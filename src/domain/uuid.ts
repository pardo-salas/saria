/** UUID v5 (RFC 4122 §4.3): SHA-1 de namespace + nombre, vía `crypto.subtle`. */
export async function uuidV5(name: string, namespace: string): Promise<string> {
  const nsBytes = new Uint8Array(16)
  const hex = namespace.replace(/-/g, '')
  for (let i = 0; i < 16; i++)
    nsBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  const nameBytes = new TextEncoder().encode(name)
  const data = new Uint8Array(16 + nameBytes.length)
  data.set(nsBytes, 0)
  data.set(nameBytes, 16)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', data))
  const b = hash.slice(0, 16)
  b[6] = (b[6]! & 0x0f) | 0x50 // versión 5
  b[8] = (b[8]! & 0x3f) | 0x80 // variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
