import { describe, expect, it } from 'vitest'
import { assertSafeProviderUrl, buildChatEndpoint, isPublicAddress } from '@/lib/ai/validation'
import { UnsafeUrlError } from '@/lib/ai/validation'
import { checkRateLimit } from '@/lib/ai/rateLimit'
import { buildExplanationMessages } from '@/lib/ai/prompts'

describe('validacion del endpoint de IA', () => {
  it('rechaza URLs que no son http(s)', async () => {
    await expect(assertSafeProviderUrl('file:///etc/passwd')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    )
    await expect(assertSafeProviderUrl('ftp://example.com')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    )
  })

  it('rechaza credenciales en la URL', async () => {
    await expect(
      assertSafeProviderUrl('https://usuario:clave@example.com/v1'),
    ).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  it('rechaza hosts internos y metadatos', async () => {
    await expect(assertSafeProviderUrl('https://metadata.google.internal/v1')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    )
    await expect(assertSafeProviderUrl('https://169.254.169.254/latest')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    )
    await expect(assertSafeProviderUrl('https://10.0.0.5/v1')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    )
    await expect(assertSafeProviderUrl('https://192.168.1.1/v1')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    )
    await expect(assertSafeProviderUrl('https://127.0.0.1/v1')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    )
  })

  it('acepta un endpoint publico valido', async () => {
    const url = await assertSafeProviderUrl('https://api.openai.com/v1')
    expect(url.hostname).toBe('api.openai.com')
  })

  it('clasifica correctamente las direcciones IP', () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true)
    expect(isPublicAddress('127.0.0.1')).toBe(false)
    expect(isPublicAddress('10.1.2.3')).toBe(false)
    expect(isPublicAddress('172.20.1.1')).toBe(false)
    expect(isPublicAddress('192.168.0.1')).toBe(false)
    expect(isPublicAddress('::1')).toBe(false)
    expect(isPublicAddress('fd00::1')).toBe(false)
  })

  it('construye la URL del endpoint de chat', () => {
    expect(buildChatEndpoint('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/chat/completions',
    )
    expect(buildChatEndpoint('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/chat/completions',
    )
    expect(buildChatEndpoint('https://api.openai.com/v1/chat/completions')).toBe(
      'https://api.openai.com/v1/chat/completions',
    )
  })
})

describe('limite de peticiones', () => {
  it('permite hasta el limite y luego bloquea', () => {
    const key = `test:${Math.random()}`
    expect(checkRateLimit(key, { windowMs: 60_000, limit: 2 }).allowed).toBe(true)
    expect(checkRateLimit(key, { windowMs: 60_000, limit: 2 }).allowed).toBe(true)
    const blocked = checkRateLimit(key, { windowMs: 60_000, limit: 2 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })
})

describe('prompts del asistente', () => {
  it('exige separar hechos e interpretacion', () => {
    const messages = buildExplanationMessages({
      task: 'explain-code',
      locale: 'es',
      code: 'print("hola")',
      facts: 'Salida real: hola',
    })
    const system = messages[0]?.content ?? ''
    expect(system).toContain('Hechos observados')
    expect(system).toContain('Interpretacion')
    expect(system).toContain('espanol')
  })

  it('incluye el codigo y los datos de ejecucion en el mensaje del usuario', () => {
    const messages = buildExplanationMessages({
      task: 'explain-error',
      locale: 'en',
      code: 'print(1/0)',
      facts: 'ZeroDivisionError: division by zero',
    })
    const user = messages[1]?.content ?? ''
    expect(user).toContain('print(1/0)')
    expect(user).toContain('ZeroDivisionError')
  })
})
