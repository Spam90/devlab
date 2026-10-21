import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildExplanationMessages } from '@/lib/ai/prompts'
import { AiProviderError, requestCompletion } from '@/lib/ai/provider'
import { checkRateLimit } from '@/lib/ai/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 64 * 1024

const bodySchema = z.object({
  task: z.enum([
    'explain-code',
    'explain-error',
    'summarize-algorithm',
    'suggest-improvements',
    'compare-implementations',
  ]),
  locale: z.enum(['es', 'en']).default('es'),
  code: z.string().max(100_000),
  facts: z.string().max(20_000).optional(),
  question: z.string().max(2_000).optional(),
  extra: z.string().max(4_000).optional(),
  /** Clave proporcionada por el usuario para está sesión. */
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().max(500).optional(),
  model: z.string().max(200).optional(),
})

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return request.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Proxy del asistente de IA.
 *
 * - La clave del usuario viaja en el cuerpo de la petición y se reenvia al
 *   proveedor: nunca se guarda en el servidor ni en la base de datos.
 * - El endpoint se valida para evitar SSRF.
 * - Hay limite de peticiones y de tamaño de la petición.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'La peticion es demasiado grande.' },
      { status: 413 },
    )
  }

  const limit = checkRateLimit(`ai:${clientIp(request)}`, {
    windowMs: 60_000,
    limit: 12,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Has alcanzado el limite de peticiones. Intentalo mas tarde.' },
      {
        status: 429,
        headers: { 'retry-after': String(limit.retryAfterSeconds) },
      },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON invalido.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Los datos de la peticion no son validos.' },
      { status: 400 },
    )
  }

  const input = parsed.data
  const apiKey = input.apiKey?.trim() || process.env.AI_API_KEY?.trim() || ''
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No hay ninguna clave de API configurada para el proveedor.' },
      { status: 401 },
    )
  }

  const baseUrl = input.baseUrl?.trim() || process.env.AI_BASE_URL?.trim() || ''
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'No hay ningun endpoint de proveedor configurado.' },
      { status: 400 },
    )
  }

  const model = input.model?.trim() || process.env.AI_MODEL?.trim() || 'gpt-4o-mini'

  try {
    const result = await requestCompletion({
      baseUrl,
      model,
      apiKey,
      messages: buildExplanationMessages({
        task: input.task,
        locale: input.locale,
        code: input.code,
        facts: input.facts,
        question: input.question,
        extra: input.extra,
      }),
    })

    return NextResponse.json({
      content: result.content,
      model: result.model,
      usage: result.usage ?? null,
    })
  } catch (error) {
    if (error instanceof AiProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: 'No se ha podido completar la peticion al proveedor.' },
      { status: 502 },
    )
  }
}
