import { expect, test } from '@playwright/test'

/**
 * Motor Pyodide: Python real ejecutandose en el navegador.
 *
 * El runtime se descarga la primera vez, asi que el test necesita un
 * margen amplio.
 */
test.describe('Motor Pyodide', () => {
  test.setTimeout(120_000)

  test('carga el runtime y ejecuta Python real', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('devlab.tour.completed', '1')
    })
    await page.goto('/')

    await page.getByRole('radio', { name: 'Pyodide' }).click()

    // El runtime se prepara de forma diferida: el indicador de estado
    // muestra la version de Python cuando esta listo.
    const status = page.locator('[aria-live="polite"]').filter({ hasText: /Python 3/i })
    await expect(status.first()).toBeVisible({ timeout: 90_000 })

    await page.getByRole('button', { name: /Ejecutar|Run/ }).first().click()

    const console_ = page.getByTestId('console-output')
    await expect(console_).toContainText('Hola, DevLab', { timeout: 90_000 })
  })
})
