import { expect, test } from '@playwright/test'

/**
 * Comportamiento en movil: la interfaz no debe desbordarse horizontalmente
 * ni dejar controles inutilizables.
 */
test.describe('Laboratorio en movil', () => {
  test('no desborda horizontalmente y permite ejecutar', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('devlab.tour.completed', '1')
    })
    await page.goto('/')
    // Se espera a que React haya hidratado: sin esto, el clic puede caer
    // antes de que los manejadores esten conectados.
    await expect(page.getByTestId('step-counter')).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)

    // En movil el editor y la consola se muestran en vistas separadas.
    await page.getByRole('radio', { name: /Consola|Console/ }).click()
    await page.getByRole('button', { name: /Ejecutar|Run/ }).first().click()
    await expect(page.getByTestId('console-output')).toContainText('Hola, DevLab')
  })
})
