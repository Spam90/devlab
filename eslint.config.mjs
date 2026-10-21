import next from 'eslint-config-next'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Configuración de ESLint (formato plano de ESLint 9).
 *
 * `eslint-config-next` ya exporta una configuración plana, así que no hace
 * falta el adaptador `FlatCompat`.
 */
const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/pyodide/**',
      'public/devlab/**',
      'next-env.d.ts',
    ],
  },
  ...next,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Los scripts de build son utilidades de línea de comandos: su salida por
    // consola es intencional.
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
]

export default eslintConfig
