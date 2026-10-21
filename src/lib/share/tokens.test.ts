import { describe, expect, it } from 'vitest'
import { generateShareToken, hashShareToken, isValidShareToken } from '@/lib/share/tokens'

describe('tokens de enlace publico', () => {
  it('genera tokens aleatorios con el formato esperado', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(43)
    expect(isValidShareToken(token)).toBe(true)
  })

  it('genera tokens distintos en cada llamada', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()))
    expect(tokens.size).toBe(50)
  })

  it('rechaza tokens con formato invalido', () => {
    expect(isValidShareToken('')).toBe(false)
    expect(isValidShareToken('corto')).toBe(false)
    expect(isValidShareToken('a'.repeat(42))).toBe(false)
    expect(isValidShareToken(`${'a'.repeat(42)}+`)).toBe(false)
    expect(isValidShareToken(`${'a'.repeat(42)}/`)).toBe(false)
  })

  it('hashea el token de forma determinista', async () => {
    const token = generateShareToken()
    const first = await hashShareToken(token)
    const second = await hashShareToken(token)
    expect(first).toBe(second)
    expect(first).toHaveLength(64)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes distintos para tokens distintos', async () => {
    const a = await hashShareToken(generateShareToken())
    const b = await hashShareToken(generateShareToken())
    expect(a).not.toBe(b)
  })

  it('el hash no contiene el token en claro', async () => {
    const token = generateShareToken()
    const hash = await hashShareToken(token)
    expect(hash).not.toContain(token)
  })
})
