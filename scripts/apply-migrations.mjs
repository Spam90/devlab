/**
 * Aplica las migraciones de DevLab a un proyecto de Supabase.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migrations.mjs
 *
 * El token es un *personal access token* de Supabase (Settings -> Access
 * Tokens). Es la unica via para ejecutar DDL de forma remota sin acceso
 * directo a Postgres.
 *
 * Alternativa sin token: pegar `supabase/apply-migrations.sql` en el SQL
 * Editor del panel de Supabase.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')

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
    // Sin .env se usan las variables del entorno.
  }
}

loadEnv()

const token = process.env.SUPABASE_ACCESS_TOKEN
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL

if (!token) {
  console.error(
    'Falta SUPABASE_ACCESS_TOKEN.\n' +
      'Crea un personal access token en Supabase (Account -> Access Tokens) y ejecuta:\n' +
      '  SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migrations.mjs',
  )
  process.exit(1)
}

if (!url) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL.')
  process.exit(1)
}

const projectRef = url.replace('https://', '').split('.')[0]
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()

console.log(`Proyecto: ${projectRef}`)
console.log(`Migraciones a aplicar: ${files.length}`)

for (const file of files) {
  const query = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
  process.stdout.write(`  ${file} ... `)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, read_only: false }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.log('FALLO')
    console.error(detail.slice(0, 1200))
    process.exit(1)
  }
  console.log('ok')
}

console.log('\nMigraciones aplicadas. Verifica con:')
console.log('  node scripts/check-supabase.mjs')
