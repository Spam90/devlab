import { UnsafeUrlError, assertSafeProviderUrl, buildChatEndpoint } from './validation'

/**
 * Adaptador para proveedores compatibles con la API de chat de OpenAI.
 *
 * No se presupone que todos los proveedores funcionen: el endpoint se
 * valida, la respuesta se comprueba y los errores se reportan con claridad.
 */

export type AiRole = 'system' | 'user' | 'assistant'

export interface AiMessage {
  role: AiRole
  content: string
}

export interface AiRequest {
  baseUrl: string
  model: string
  apiKey: string
  messages: AiMessage[]
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

export interface AiResult {
  content: string
  model: string
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}

export class AiProviderError extends Error {
  readonly status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'AiProviderError'
    this.status = status
  }
}

const MAX_RESPONSE_BYTES = 200_000

export async function requestCompletion(request: AiRequest): Promise<AiResult> {
  if (!request.apiKey) {
    throw new AiProviderError('Falta la clave de API del proveedor.', 401)
  }

  let endpoint: string
  try {
    const base = await assertSafeProviderUrl(request.baseUrl)
    endpoint = buildChatEndpoint(base.toString())
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new AiProviderError(error.message, 400)
    }
    throw new AiProviderError('No se ha podido validar el endpoint del proveedor.', 400)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 30_000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 800,
        stream: false,
      }),
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
    })

    if (!response.ok) {
      // No se incluye el cuerpo del proveedor en el error: podria contener
      // información sensible o claves.
      throw new AiProviderError(
        `El proveedor respondio con estado ${response.status}.`,
        response.status === 401 || response.status === 403 ? 401 : 502,
      )
    }

    const text = await readLimited(response)
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      throw new AiProviderError('La respuesta del proveedor no es JSON valido.', 502)
    }

    const content = extractContent(payload)
    if (!content) {
      throw new AiProviderError('La respuesta del proveedor no contiene texto.', 502)
    }

    const usage = (payload as { usage?: AiResult['usage'] }).usage
    return {
      content,
      model: (payload as { model?: string }).model ?? request.model,
      usage,
    }
  } catch (error) {
    if (error instanceof AiProviderError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AiProviderError('El proveedor ha tardado demasiado en responder.', 504)
    }
    throw new AiProviderError('No se ha podido contactar con el proveedor.', 502)
  } finally {
    clearTimeout(timeout)
  }
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return await response.text()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new AiProviderError('La respuesta del proveedor es demasiado grande.', 502)
    }
    chunks.push(value)
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

function extractContent(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const message = (choices[0] as { message?: { content?: unknown }; text?: unknown })
  if (message?.message && typeof message.message.content === 'string') {
    return message.message.content
  }
  if (typeof message?.text === 'string') return message.text
  return null
}
