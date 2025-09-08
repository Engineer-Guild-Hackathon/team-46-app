// ESLint flat config for ESLint v9+ (Svelte + TypeScript)
import js from '@eslint/js'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import svelteParser from 'svelte-eslint-parser'
import sveltePlugin from 'eslint-plugin-svelte'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', '.svelte-kit/**', 'storybook-static/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.ts']
    ,languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest'
      },
      globals: globals.browser
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.svelte']
      },
      globals: globals.browser
    },
    plugins: { svelte: sveltePlugin },
    rules: {
      ...sveltePlugin.configs['flat/recommended'].rules
    }
  },
  // Disable rules that conflict with Prettier formatting
  eslintConfigPrettier
]
