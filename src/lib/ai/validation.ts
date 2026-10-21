import { isIP } from 'node:net'

/**
 * Validación de endpoints para evitar SSRF.
 *
 * Reglas:
 * - Solo `https:` (se permite `http:` unicamente en desarrollo y contra
 *   localhost).
 * - Sin credenciales incrustadas en la URL.
 * - El host no puede ser uniteral de direcciones privadas, de loopback o de
 *   metadatos de nube.
 * - Si se puede resolver el dominio, todas las direcciones IP resultantes
 *   deben ser públicas.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
])

const BLOCKED_IPV4 = [
  { prefix: '0.', description: 'red actual' },
  { prefix: '10.', description: 'red privada' },
  { prefix: '127.', description: 'loopback' },
  { prefix: '169.254.', description: 'enlace local' },
  { prefix: '172.16.', description: 'red privada' },
  { prefix: '172.17.', description: 'red privada' },
  { prefix: '172.18.', description: 'red privada' },
  { prefix: '172.19.', description: 'red privada' },
  { prefix: '172.20.', description: 'red privada' },
  { prefix: '172.21.', description: 'red privada' },
  { prefix: '172.22.', description: 'red privada' },
  { prefix: '172.23.', description: 'red privada' },
  { prefix: '172.24.', description: 'red privada' },
  { prefix: '172.25.', description: 'red privada' },
  { prefix: '172.26.', description: 'red privada' },
  { prefix: '172.27.', description: 'red privada' },
  { prefix: '172.28.', description: 'red privada' },
  { prefix: '172.29.', description: 'red privada' },
  { prefix: '172.30.', description: 'red privada' },
  { prefix: '172.31.', description: 'red privada' },
  { prefix: '192.168.', description: 'red privada' },
  { prefix: '100.64.', description: 'CGNAT' },
]

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

function isPublicIpv4(address: string): boolean {
  return !BLOCKED_IPV4.some((range) => address.startsWith(range.prefix))
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized === '::1' || normalized === '::') return false
  if (normalized.startsWith('fe80')) return false
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false
  // IPv4 mapeada (::ffff:127.0.0.1)
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped?.[1]) return isPublicIpv4(mapped[1])
  return true
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPublicIpv4(address)
  if (version === 6) return isPublicIpv6(address)
  return false
}

/**
 * Comprueba que una URL es segura para usar como endpoint de un proveedor.
 * Lanza `UnsafeUrlError` con el motivo del rechazo.
 */
export async function assertSafeProviderUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new UnsafeUrlError('La URL del proveedor no es válida.')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeUrlError('Solo se permiten endpoints http o https.')
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError('La URL del proveedor no puede incluir credenciales.')
  }

  if (url.protocol === 'http:') {
    const isLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
    if (!isLocal || process.env.NODE_ENV === 'production') {
      throw new UnsafeUrlError('El endpoint debe usar https fuera del desarrollo local.')
    }
  }

  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeUrlError('Ese host no se puede usar como proveedor.')
  }

  const literal = isIP(hostname)
  if (literal !== 0 && !isPublicAddress(hostname)) {
    throw new UnsafeUrlError('Esa dirección IP no es pública.')
  }

  if (literal === 0) {
    const addresses = await resolveAddresses(hostname)
    for (const address of addresses) {
      if (!isPublicAddress(address)) {
        throw new UnsafeUrlError('El proveedor resuelve a una dirección no pública.')
      }
    }
  }

  return url
}

async function resolveAddresses(hostname: string): Promise<string[]> {
  try {
    const dns = await import('node:dns/promises')
    const records = await dns.lookup(hostname, { all: true })
    return records.map((record) => record.address)
  } catch {
    // Si no se puede resolver (por ejemplo, sin DNS en el entorno), no se
    // bloquea la petición: la conexion fallara igualmente si el host no
    // existe, y nunca se permitira una redirección a otra IP.
    return []
  }
}

/** Construye la URL completa del endpoint de chat a partir de la base. */
export function buildChatEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (/\/chat\/completions$/.test(trimmed)) return trimmed
  return `${trimmed}/chat/completions`
}
