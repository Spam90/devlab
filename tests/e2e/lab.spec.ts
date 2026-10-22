import { expect, test } from '@playwright/test'

/**
 * Recorrido principal en modo invitado:
 * abrir el laboratorio, ejecutar el ejemplo inicial, recorrer el historial y
 * cambiar de idioma.
 */
test.describe('Laboratorio en modo invitado', () => {
  test.beforeEach(async ({ page }) => {
    // El recorrido de bienvenida solo se muestra la primera vez: se marca
    // como completado para que no interfiera con las pruebas. La marca se
    // puede desactivar con la bandera de sesion para probar el recorrido.
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('devlab.tour.forced')) {
        window.localStorage.setItem('devlab.tour.completed', '1')
      }
    })
    await page.goto('/')
    // Se espera a que React haya hidratado: sin esto, el clic puede
    // caer antes de que los manejadores esten conectados.
    await expect(page.getByTestId('step-counter')).toBeVisible()
  })

  test('ejecuta el programa de bienvenida y muestra la salida', async ({ page }) => {
    const run = page.getByRole('button', { name: /Ejecutar|Run/ }).first()
    await run.click()

    const console_ = page.getByTestId('console-output')
    await expect(console_).toContainText('Hola, DevLab')
    await expect(console_).toContainText('numero 42')
  })

  test('registra pasos y permite avanzar y retroceder', async ({ page }) => {
    await page.getByRole('button', { name: /Ejecutar|Run/ }).first().click()

    const counter = page.getByTestId('step-counter')
    await expect(counter).not.toHaveText('—')

    const stepForward = page.getByRole('button', { name: /Avanzar|Step forward/ })
    const stepBackward = page.getByRole('button', { name: /Retroceder|Step back/ })
    const jumpToStart = page.getByRole('button', { name: /Ir al inicio|Jump to start/ })

    // Tras ejecutar, la vista se queda en el ultimo paso: se vuelve al
    // principio para poder avanzar paso a paso.
    await jumpToStart.click()
    const atStart = await counter.textContent()

    await stepForward.click()
    await expect(counter).not.toHaveText(atStart ?? '')

    await stepBackward.click()
    await expect(counter).toHaveText(atStart ?? '')
  })

  test('muestra las variables en el inspector', async ({ page }) => {
    await page.getByRole('button', { name: /Ejecutar|Run/ }).first().click()
    const panel = page.getByRole('table', { name: /Variables table|Tabla de variables/ })
    await expect(panel).toBeVisible()
  })

  test('cambia el idioma de la interfaz', async ({ page }) => {
    const selector = page.locator('header select')
    await selector.selectOption('en')
    await expect(page.getByRole('button', { name: 'Run' }).first()).toBeVisible()

    await selector.selectOption('es')
    await expect(page.getByRole('button', { name: 'Ejecutar' }).first()).toBeVisible()
  })

  test('la galeria de ejemplos carga un programa en el laboratorio', async ({ page }) => {
    await page.goto('/examples')
    await page.getByRole('button', { name: /Busqueda lineal|Linear search/ }).first().click()
    await page.getByRole('button', { name: /Cargar en el laboratorio|Load in the lab/ }).click()

    await expect(page).toHaveURL(/\/$/)
    await page.getByRole('button', { name: /Ejecutar|Run/ }).first().click()
    await expect(page.getByTestId('console-output')).toContainText('4')
  })

  test('el recorrido de bienvenida se muestra una sola vez', async ({ page }) => {
    await page.evaluate(() => {
      window.sessionStorage.setItem('devlab.tour.forced', '1')
      window.localStorage.removeItem('devlab.tour.completed')
    })
    await page.reload()

    const dialog = page.getByRole('dialog', { name: /Recorrido|Welcome/ })
    await expect(dialog).toBeVisible()
    await page.getByRole('button', { name: /Omitir|Skip/ }).click()
    await expect(dialog).toBeHidden()
  })
})
