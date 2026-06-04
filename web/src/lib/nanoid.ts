export function nanoid(size = 21): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  for (const byte of bytes) {
    id += chars[byte % chars.length]
  }
  return id
}
