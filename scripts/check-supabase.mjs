/**
 * Comprobacion de la conexion con Supabase.
 *
 * Uso: node scripts/check-supabase.mjs
 *
 * No imprime secretos: solo indica si cada operación funciona.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function loadEnv() {
  const file = path.join(process.cwd(), '.env')
  try {
    const content = readFileSync(file, 'utf8')
    for (const line of content.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!match) continue
      const [, key, raw] = match
      if (!key || raw === undefined) continue
      const value = raw.replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    console.warn('No se ha encontrado .env')
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  console.log('Proyecto:', url.replace('https://', '').split('.')[0])

  // 1. Estado de la autenticación
  const { data: userData, error: authError } = await supabase.auth.getUser()
  console.log(
    'Auth:',
    authError
      ? `sesión no iniciada (${authError.message})`
      : `sesión de ${userData.user?.email ?? 'usuario desconocido'}`,
  )

  // 2. Tablas del esquema
  for (const table of ['profiles', 'user_settings', 'projects', 'project_versions', 'public_shares']) {
    const { error } = await supabase.from(table).select('*').limit(1)
    console.log(`Tabla ${table}:`, error ? `NO EXISTE (${error.code ?? error.message})` : 'ok')
  }

  // 3. Función pública de enlaces
  const { error: rpcError } = await supabase.rpc('resolve_public_share', {
    p_token_hash: '0'.repeat(64),
  })
  console.log(
    'RPC resolve_public_share:',
    rpcError ? `NO EXISTE (${rpcError.code ?? rpcError.message})` : 'ok',
  )
}

void main()
