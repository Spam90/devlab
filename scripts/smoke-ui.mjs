/**
 * Prueba de humo de la interfaz contra un despliegue real.
 *
 * Recorre el flujo completo en el navegador: iniciar sesion, crear un
 * proyecto, verlo en /projects, compartirlo, abrir el enlace en un contexto
 * sin sesion, revocarlo y comprobar que deja de funcionar.
 *
 * Requiere la aplicacion en marcha y las credenciales de Supabase en .env:
 *
 *   npm run build && npm start -- --port 3216
 *   APP_URL=http://127.0.0.1:3216 npm run smoke:ui
 *
 * El usuario de prueba se elimina al terminar.
 */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function loadEnv() {
  for (const line of readFileSync(path.join(process.cwd(), '.env'), 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (match?.[1] && match[2] !== undefined) {
      const value = match[2].replace(/^["']|["']$/g, '')
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
  }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const base = process.env.APP_URL ?? 'http://127.0.0.1:3216'

const admin = createClient(url, secretKey, { auth: { persistSession: false } })
const correo = `humo-${Date.now()}@devlab.test`
const clave = 'DevLab-Humo-2026!'

const pasos = []
const comprobar = (nombre, ok, detalle = '') => {
  pasos.push({ nombre, ok })
  console.log(`${ok ? '  OK  ' : ' FALLO'} ${nombre}${detalle ? `  (${detalle})` : ''}`)
}

const { data: creado, error: errorUsuario } = await admin.auth.admin.createUser({
  email: correo,
  password: clave,
  email_confirm: true,
})
if (errorUsuario) {
  console.error('No se pudo crear el usuario de prueba:', errorUsuario.message)
  process.exit(1)
}

const navegador = await chromium.launch()
const contexto = await navegador.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
const pagina = await contexto.newPage()
pagina.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

try {
  await pagina.addInitScript(() => {
    window.localStorage.setItem('devlab.locale', 'es')
    window.localStorage.setItem('devlab.tour.completed', '1')
  })

  console.log('\n1) Inicio de sesion en la interfaz')
  await pagina.goto(`${base}/auth/sign-in`)
  await pagina.getByLabel(/Correo/).fill(correo)
  await pagina.getByLabel(/Contrase/i).fill(clave)
  await pagina.getByRole('button', { name: /Entrar con correo/ }).click()
  await pagina.waitForURL(`${base}/`, { timeout: 20000 })
  comprobar('El inicio de sesion redirige al laboratorio', pagina.url().endsWith('/'))

  console.log('\n2) Crear un proyecto desde la barra del laboratorio')
  await pagina.getByRole('button', { name: 'Nuevo proyecto' }).click()
  await pagina.getByRole('dialog').getByRole('textbox').fill('Proyecto de humo')
  await pagina.getByRole('dialog').getByRole('button', { name: 'Crear' }).click()
  await pagina.waitForTimeout(1500)
  const barra = await pagina.locator('.dl-panel').first().innerText()
  comprobar('El proyecto queda vinculado en la barra', barra.includes('Proyecto de humo'), barra.replace(/\n/g, ' | '))

  console.log('\n3) El proyecto aparece en /projects sincronizado')
  await pagina.goto(`${base}/projects`)
  await pagina.waitForTimeout(1500)
  const fila = pagina.getByText('Proyecto de humo').first()
  comprobar('El proyecto aparece en la lista', await fila.isVisible())
  const textoProyecto = await pagina.locator('li').filter({ hasText: 'Proyecto de humo' }).first().innerText()
  comprobar('Marca de sincronizado', /sincronizado/i.test(textoProyecto), textoProyecto.replace(/\n/g, ' | '))

  console.log('\n4) Crear un enlace publico')
  await pagina.locator('li').filter({ hasText: 'Proyecto de humo' }).first().getByRole('button').first().click()
  await pagina.waitForTimeout(800)
  await pagina.getByRole('button', { name: /Crear enlace p/i }).click()
  await pagina.waitForTimeout(2000)
  const portapapeles = await pagina.evaluate(() => navigator.clipboard.readText())
  comprobar('El enlace se copia al portapapeles', portapapeles.includes('/share/'), portapapeles)

  console.log('\n5) El enlace se abre sin sesion')
  const contextoAnonimo = await navegador.newContext()
  const paginaAnonima = await contextoAnonimo.newPage()
  await paginaAnonima.goto(portapapeles)
  await paginaAnonima.waitForTimeout(2000)
  const cuerpo = await paginaAnonima.locator('body').innerText()
  comprobar('La pagina publica muestra el programa', cuerpo.includes('Proyecto de humo'), cuerpo.slice(0, 80).replace(/\n/g, ' | '))
  comprobar('La pagina publica es de solo lectura', !(await paginaAnonima.getByRole('button', { name: /Abrir en el laboratorio/ }).isVisible().catch(() => false)))
  await contextoAnonimo.close()

  console.log('\n6) Revocar el enlace')
  await pagina.getByRole('button', { name: /Revocar enlace/i }).first().click()
  await pagina.waitForTimeout(1500)
  const contexto2 = await navegador.newContext()
  const pagina2 = await contexto2.newPage()
  await pagina2.goto(portapapeles)
  await pagina2.waitForTimeout(1500)
  const cuerpo2 = await pagina2.locator('body').innerText()
  comprobar('Tras revocar, el enlace deja de funcionar', cuerpo2.includes('no existe o ha sido revocado'), cuerpo2.slice(0, 90).replace(/\n/g, ' | '))
  await contexto2.close()
} finally {
  await admin.auth.admin.deleteUser(creado.user.id).catch(() => undefined)
  await navegador.close()
  console.log('\nusuario de prueba eliminado')
}

const fallos = pasos.filter((p) => !p.ok)
console.log(`\n${pasos.length - fallos.length}/${pasos.length} comprobaciones correctas`)
process.exit(fallos.length > 0 ? 1 : 0)
