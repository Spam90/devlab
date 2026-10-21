/**
 * Genera `supabase/apply-migrations.sql` a partir de los ficheros de
 * `supabase/migrations/`.
 *
 * Uso: node scripts/build-migration-bundle.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')
const OUTPUT = path.join(process.cwd(), 'supabase', 'apply-migrations.sql')

const HEADER = `-- =============================================================================
-- DevLab · Migraciones aplicables desde el SQL Editor de Supabase
-- -----------------------------------------------------------------------------
-- Este fichero es la concatenacion de los ficheros de
-- \`supabase/migrations/\`, en el orden correcto. Se puede pegar entero en
-- Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Alternativa automática (con personal access token):
--   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migrations.mjs
--
-- Es idempotente: se puede ejecutar más de una vez sin romper nada.
-- =============================================================================

`

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()

const parts = files.map((file) => {
  const content = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
  return `-- >>> supabase/migrations/${file} <<<\n${content.trim()}\n`
})

writeFileSync(OUTPUT, HEADER + parts.join('\n'), 'utf8')
console.log(`Generado ${path.relative(process.cwd(), OUTPUT)} (${files.length} migraciones)`)
