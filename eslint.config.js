import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', '.trash', '.backup']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', caughtErrorsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'max-len': ['warn', { code: 100, ignoreStrings: true, ignoreTemplateLiterals: true }],
    },
  },
  {
    files: ['server/**/*.js', 'scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Controllers call these via bare identifiers, but they're only ever
    // declared as `window.fnName = ...` (in index.html or the controller
    // itself) - a pattern ESLint's no-undef can't trace as a declaration.
    // Verified live in the browser that all of these resolve correctly.
    files: ['ui_design/**/*.js'],
    languageOptions: {
      globals: {
        openModal: 'readonly',
        openEntryModal: 'readonly',
        selectOrder: 'readonly',
        switchTab: 'readonly',
        closeCustomerModal: 'readonly',
        closeSupplierModal: 'readonly',
        closeProductModal: 'readonly',
        closeOrderModal: 'readonly',
        selectMaintenanceCase: 'readonly',
        switchSettingsTab: 'readonly',
      },
    },
  },
]);

