/**
 * Limitador de peticiones en memoria.
 *
 * Limitación conocida y documentada: en despliegues serverless cada
 * instancia tiene su propio contador, así que el limite es aproximado
 * (por instancia). No se usa para proteger datos, solo para evitar el
 * abuso evidente de un endpoint público.
 */
interface Bucket {
  tokens: number
  updatedAt: number
}

const buckets = new Map<string, Bucket>()
let callsSincePrune = 0

export interface RateLimitOptions {
  /** Ventana en milisegundos. */
  windowMs: number
  /** Peticiones permitidas por ventana. */
  limit: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  callsSincePrune += 1
  if (callsSincePrune >= 100) {
    callsSincePrune = 0
    pruneRateLimitBuckets()
  }

  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.updatedAt > options.windowMs) {
    buckets.set(key, { tokens: options.limit - 1, updatedAt: now })
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 }
  }

  if (bucket.tokens <= 0) {
    const retryAfter = Math.ceil((options.windowMs - (now - bucket.updatedAt)) / 1000)
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfter) }
  }

  bucket.tokens -= 1
  return { allowed: true, remaining: bucket.tokens, retryAfterSeconds: 0 }
}

/** Descarta los contadores antiguos para que no crezcan sin limite. */
function pruneRateLimitBuckets(): void {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > 60 * 60 * 1000) buckets.delete(key)
  }
}
