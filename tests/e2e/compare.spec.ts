import { expect, test } from '@playwright/test'

/**
 * Comparacion de algoritmos: ejecuta las dos implementaciones y muestra las
 * metricas medidas.
 */
test.describe('Comparacion de algoritmos', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('devlab.tour.completed', '1')
      window.localStorage.setItem('devlab.locale', 'es')
    })
    await page.goto('/compare')
    // Se espera a que React haya hidratado: sin esto, el clic puede caer
    // antes de que los manejadores esten conectados.
    await expect(
      page.getByRole('button', { name: /Ejecutar ambas|Run both/ }),
    ).toBeVisible()
  })

  test('ejecuta ambas implementaciones y muestra los resultados', async ({ page }) => {
    await page.getByRole('button', { name: /Ejecutar ambas|Run both/ }).click()

    const results = page.getByRole('region', { name: /Resultados|Results/ })
    await expect(results).toBeVisible()

    // La metrica de pasos instrumentados solo existe en el motor educativo.
    await expect(
      page.getByText(/Pasos instrumentados|Instrumented steps/).first(),
    ).toBeVisible()
    // La complejidad se presenta como analisis, no como medicion.
    await expect(page.getByText(/O\(log n\) tiempo, O\(1\) memoria/)).toBeVisible()
  })

  test('permite cambiar de escenario de comparacion', async ({ page }) => {
    await page.getByRole('button', { name: /Fibonacci recursivo/ }).click()
    await page.getByRole('button', { name: /Ejecutar ambas|Run both/ }).click()
    await expect(page.getByText(/O\(2\^n\) tiempo/)).toBeVisible()
  })
})
