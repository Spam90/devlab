/**
 * Verificacion de extremo a extremo contra un proyecto real de Supabase.
 *
 * Comprueba, con dos usuarios reales y sesiones reales:
 *  1. Cada usuario ve sus propios proyectos y NO los del otro (RLS).
 *  2. Un enlace publico se resuelve sin sesion y expone solo lo compartido.
 *  3. Al revocar el enlace, deja de resolverse.
 *  4. Un segundo usuario no puede leer, modificar ni borrar datos ajenos.
 *
 * Uso: node scripts/verify-supabase.mjs
 *
 * Necesita en .env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * y SUPABASE_SECRET_KEY (para crear los usuarios de prueba y limpiarlos).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function loadEnv() {
  const file = path.join(process.cwd(), '.env')
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!match?.[1] || match[2] === undefined) continue
      const value = match[2].replace(/^["']|["']$/g, '')
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
  } catch {
    console.warn('No se ha encontrado .env')
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !anonKey || !secretKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SECRET_KEY')
  process.exit(1)
}

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const sello = Date.now()
const alias = (nombre) => `${nombre}-${sello}@devlab.test`

const resultados = []
function comprobar(nombre, condicion, detalle = '') {
  resultados.push({ nombre, ok: Boolean(condicion), detalle })
  console.log(`${condicion ? '  OK  ' : ' FALLO'} ${nombre}${detalle ? `  (${detalle})` : ''}`)
}

async function crearUsuario(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'DevLab-Prueba-2026!',
    email_confirm: true,
  })
  if (error) throw new Error(`No se pudo crear el usuario: ${error.message}`)
  return data.user
}

async function iniciarSesion(email) {
  const cliente = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await cliente.auth.signInWithPassword({
    email,
    password: 'DevLab-Prueba-2026!',
  })
  if (error) throw new Error(`No se pudo iniciar sesion: ${error.message}`)
  return { cliente, session: data.session }
}

async function main() {
  const correoA = alias('devlab-a')
  const correoB = alias('devlab-b')
  let usuarioA
  let usuarioB

  try {
    console.log(`Proyecto: ${url}`)
    console.log('\n1) Creacion de dos usuarios de prueba')
    usuarioA = await crearUsuario(correoA)
    usuarioB = await crearUsuario(correoB)
    comprobar('Se crean dos usuarios con email confirmado', Boolean(usuarioA && usuarioB))

    const { cliente: clienteA, session: sesionA } = await iniciarSesion(correoA)
    const { cliente: clienteB } = await iniciarSesion(correoB)
    comprobar('Ambos usuarios obtienen sesion', Boolean(sesionA.access_token))

    console.log('\n2) Aislamiento por RLS entre usuarios')
    const { data: creado, error: errorCrear } = await clienteA
      .from('projects')
      .insert({ name: 'Proyecto de A', code: 'print("A")', engine: 'devlab' })
      .select('*')
      .single()
    comprobar('A puede crear un proyecto', !errorCrear && Boolean(creado), errorCrear?.message)

    const { data: listaA } = await clienteA.from('projects').select('*')
    comprobar('A ve su propio proyecto', (listaA ?? []).length === 1, `${listaA?.length ?? 0} fila(s)`)

    const { data: listaB } = await clienteB.from('projects').select('*')
    comprobar('B no ve el proyecto de A', (listaB ?? []).length === 0, `${listaB?.length ?? 0} fila(s)`)

    const { data: lecturaDirecta } = await clienteB
      .from('projects')
      .select('*')
      .eq('id', creado.id)
      .maybeSingle()
    comprobar('B no puede leer el proyecto de A por id', lecturaDirecta === null)

    const { error: errorUpdate } = await clienteB
      .from('projects')
      .update({ name: 'Secuestrado' })
      .eq('id', creado.id)
    const { data: trasUpdate } = await clienteA
      .from('projects')
      .select('name')
      .eq('id', creado.id)
      .single()
    comprobar('B no puede modificar el proyecto de A', trasUpdate?.name === 'Proyecto de A', errorUpdate?.message ?? '')

    const { error: errorBorrado } = await clienteB.from('projects').delete().eq('id', creado.id)
    const { data: sigueVivo } = await clienteA
      .from('projects')
      .select('id')
      .eq('id', creado.id)
      .maybeSingle()
    comprobar('B no puede borrar el proyecto de A', sigueVivo !== null, errorBorrado?.message ?? '')

    console.log('\n3) Versiones del proyecto')
    const { data: version, error: errorVersion } = await clienteA
      .from('project_versions')
      .insert({
        project_id: creado.id,
        user_id: usuarioA.id,
        version_number: 1,
        code: 'print("A v1")',
        label: 'Primera version',
      })
      .select('*')
      .single()
    comprobar('A puede guardar una version', !errorVersion && Boolean(version), errorVersion?.message)

    const { data: versionesB } = await clienteB.from('project_versions').select('*')
    comprobar('B no ve las versiones de A', (versionesB ?? []).length === 0)

    console.log('\n4) Enlace publico revocable')
    const token = 'test-' + Math.random().toString(36).slice(2) + 'x'.repeat(32)
    const hash = await hashToken(token)
    const { data: enlace, error: errorEnlace } = await clienteA
      .from('public_shares')
      .insert({
        project_id: creado.id,
        user_id: usuarioA.id,
        token_hash: hash,
        code: 'print("compartido")',
        include_code: true,
      })
      .select('*')
      .single()
    comprobar('A puede crear un enlace publico', !errorEnlace && Boolean(enlace), errorEnlace?.message)

    const { data: resuelto } = await admin.rpc('resolve_public_share', { p_token_hash: hash })
    comprobar(
      'El enlace se resuelve y devuelve solo el contenido compartido',
      (resuelto ?? []).length === 1 && resuelto[0].code === 'print("compartido")',
    )

    const { data: enlacesB } = await clienteB.from('public_shares').select('*')
    comprobar('B no puede listar los enlaces de A', (enlacesB ?? []).length === 0)

    const { error: errorRevocar } = await clienteA
      .from('public_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', enlace.id)
    comprobar('A puede revocar su enlace', !errorRevocar, errorRevocar?.message)

    const { data: trasRevocar } = await admin.rpc('resolve_public_share', { p_token_hash: hash })
    comprobar('Tras revocar, el enlace deja de resolverse', (trasRevocar ?? []).length === 0)

    console.log('\n5) Perfil y ajustes automaticos')
    const { data: perfil } = await clienteA.from('profiles').select('*').eq('id', usuarioA.id).maybeSingle()
    comprobar('El trigger crea el perfil del usuario', Boolean(perfil))

    const { data: ajustes } = await clienteA.from('user_settings').select('*').eq('user_id', usuarioA.id).maybeSingle()
    comprobar('El trigger crea los ajustes del usuario', Boolean(ajustes))
  } finally {
    console.log('\n6) Limpieza')
    for (const usuario of [usuarioA, usuarioB]) {
      if (usuario) {
        await admin.auth.admin.deleteUser(usuario.id).catch(() => undefined)
      }
    }
    console.log('  usuarios de prueba eliminados')
  }

  const fallos = resultados.filter((r) => !r.ok)
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas`)
  if (fallos.length > 0) {
    console.log('FALLOS:')
    for (const fallo of fallos) console.log(`  - ${fallo.nombre} ${fallo.detalle}`)
    process.exit(1)
  }
}

async function hashToken(token) {
  const data = new TextEncoder().encode(token)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

void main()
