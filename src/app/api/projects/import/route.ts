import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 512 * 1024
const MAX_PROJECTS = 50
const MAX_CODE_LENGTH = 100_000

const bodySchema = z.object({
  projects: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        code: z.string().max(MAX_CODE_LENGTH),
        engine: z.enum(['devlab', 'pyodide']).default('devlab'),
      }),
    )
    .min(1)
    .max(MAX_PROJECTS),
  /** Nombres ya existentes en la cuenta, para resolver duplicados. */
  existingNames: z.array(z.string().max(120)).max(500).default([]),
})

/**
 * Importación de proyectos de invitado.
 *
 * Se ejecuta en el servidor con la sesión del usuario: el `user_id` se toma
 * de la sesión, nunca del cuerpo de la petición. Los nombres duplicados se
 * resuelven anadiendo un sufijo en lugar de sobrescribir nada.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }

  const supabase = await createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'configuration' }, { status: 503 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const taken = new Set(parsed.data.existingNames.map((name) => name.toLowerCase()))
  const inserted: { id: string; name: string }[] = []
  const failed: { name: string; reason: string }[] = []

  for (const project of parsed.data.projects) {
    let name = project.name.trim()
    let counter = 2
    while (taken.has(name.toLowerCase())) {
      name = `${project.name.trim()} (${counter})`
      counter += 1
    }
    taken.add(name.toLowerCase())

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: name.slice(0, 120),
        code: project.code,
        engine: project.engine,
      })
      .select('id, name')
      .single()

    if (error) {
      failed.push({ name: project.name, reason: error.message })
      continue
    }
    inserted.push(data)
  }

  return NextResponse.json({ inserted, failed })
}
