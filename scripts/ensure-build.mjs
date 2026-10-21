/**
 * Asegura que exista una build de produccion antes de arrancar el servidor.
 *
 * `next start` necesita una build previa: si falta, se genera. Asi los tests
 * E2E pueden ejecutarse con un único comando.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const buildId = path.join(process.cwd(), '.next', 'BUILD_ID')

if (existsSync(buildId)) {
  console.log('[ensure-build] build existente, se reutiliza')
  process.exit(0)
}

console.log('[ensure-build] no hay build: ejecutando next build')
const result = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', shell: false })

if (result.status !== 0) {
  console.error('[ensure-build] la build ha fallado')
  process.exit(result.status ?? 1)
}
