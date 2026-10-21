/**
 * Tokens de enlace público.
 *
 * El token se genera con 32 bytes aleatorios (256 bits de entropia) en
 * formato base64url, y en la base de datos solo se guarda su hash SHA-256.
 * Un volcado de la base de datos, por tanto, no permite reconstruir las
 * URLs compartidas.
 *
 * Las funciones usan `globalThis.crypto`, disponible tanto en el navegador
 * como en el runtime de Node 20+ y en el Edge Runtime.
 */

const TOKEN_BYTES = 32

/** Genera un token aleatorio seguro (base64url, sin padding). */
export function generateShareToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES)
  globalThis.crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

/** Calcula el hash SHA-256 en hexadecimal del token. */
export async function hashShareToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return toHex(new Uint8Array(digest))
}

/** Longitud valida de un token (base64url de 32 bytes = 43 caracteres). */
export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const base64 =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
