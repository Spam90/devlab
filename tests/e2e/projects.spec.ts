import { expect, test } from '@playwright/test'

/**
 * Gestion de proyectos en modo invitado: crear, abrir en el laboratorio y
 * guardar los cambios.
 */
test.describe('Proyectos en modo invitado', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('devlab.tour.completed', '1')
      window.localStorage.setItem('devlab.locale', 'es')
      window.localStorage.removeItem('devlab.projects.v1')
    })
    await page.goto('/projects')
  })

  test('crea un proyecto y lo abre en el laboratorio', async ({ page }) => {
    await page.getByRole('button', { name: /Nuevo proyecto|New project/ }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox').fill('Prueba E2E')
    await dialog.getByRole('button', { name: /^Crear$|^Create$/ }).click()

    await expect(page.getByText('Prueba E2E').first()).toBeVisible()

    // Abrir el proyecto lo lleva al laboratorio con el proyecto vinculado.
    await page
      .getByRole('button', { name: /Abrir|Open/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTitle('Prueba E2E')).toBeVisible()
  })

  test('filtra los proyectos por nombre', async ({ page }) => {
    await page.getByRole('button', { name: /Nuevo proyecto|New project/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox').fill('Proyecto Alpha')
    await dialog.getByRole('button', { name: /^Crear$|^Create$/ }).click()

    await page.getByRole('button', { name: /Nuevo proyecto|New project/ }).click()
    const second = page.getByRole('dialog')
    await second.getByRole('textbox').fill('Proyecto Beta')
    await second.getByRole('button', { name: /^Crear$|^Create$/ }).click()

    const filter = page.getByRole('searchbox', { name: /Filtrar por nombre|Filter by name/ })
    await filter.fill('Alpha')

    // Solo la lista se filtra: el panel lateral sigue mostrando el proyecto
    // seleccionado.
    const items = page.getByRole('listitem')
    await expect(items.filter({ hasText: 'Proyecto Alpha' })).toHaveCount(1)
    await expect(items.filter({ hasText: 'Proyecto Beta' })).toHaveCount(0)
  })
})
