/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  countLocalProjects,
  createLocalProject,
  deleteLocalProject,
  duplicateLocalProject,
  listLocalProjects,
  removeImportedProjects,
  saveLocalVersion,
  listLocalVersions,
  updateLocalProject,
} from '@/lib/projects/local'

describe('almacenamiento local de proyectos', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('crea y lista proyectos', () => {
    createLocalProject({ name: 'Hola', source: 'print(1)' })
    createLocalProject({ name: 'Adios', source: 'print(2)' })
    const projects = listLocalProjects()
    expect(projects).toHaveLength(2)
    expect(countLocalProjects()).toBe(2)
  })

  it('actualiza nombre y codigo', () => {
    const project = createLocalProject({ name: 'Original', source: 'x = 1' })
    const updated = updateLocalProject(project.id, { name: 'Renombrado', source: 'x = 2' })
    expect(updated?.name).toBe('Renombrado')
    expect(updated?.source).toBe('x = 2')
  })

  it('duplica con otro nombre', () => {
    const project = createLocalProject({ name: 'Base', source: 'x = 1' })
    const copy = duplicateLocalProject(project.id)
    expect(copy?.name).toBe('Base (copia)')
    expect(listLocalProjects()).toHaveLength(2)
  })

  it('elimina un proyecto', () => {
    const project = createLocalProject({ name: 'Temporal', source: 'x = 1' })
    expect(deleteLocalProject(project.id)).toBe(true)
    expect(listLocalProjects()).toHaveLength(0)
  })

  it('no borra los proyectos que no se han importado', () => {
    const project = createLocalProject({ name: 'Local', source: 'x = 1' })
    updateLocalProject(project.id, { imported: true })
    expect(removeImportedProjects([project.id])).toBe(1)
    expect(listLocalProjects()).toHaveLength(0)
  })

  it('conserva los proyectos no marcados como importados', () => {
    const project = createLocalProject({ name: 'Local', source: 'x = 1' })
    expect(removeImportedProjects([project.id])).toBe(0)
    expect(listLocalProjects()).toHaveLength(1)
  })

  it('guarda versiones numeradas de forma creciente', () => {
    const project = createLocalProject({ name: 'Con versiones', source: 'x = 1' })
    saveLocalVersion(project.id, 'x = 2')
    saveLocalVersion(project.id, 'x = 3')
    const versions = listLocalVersions(project.id)
    expect(versions).toHaveLength(2)
    expect(versions[0]?.versionNumber).toBe(2)
    expect(versions[1]?.versionNumber).toBe(1)
  })

  it('ignora datos corruptos sin lanzar errores', () => {
    window.localStorage.setItem('devlab.projects.v1', 'no es json')
    expect(listLocalProjects()).toEqual([])
  })
})
