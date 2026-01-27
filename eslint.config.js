import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import n from 'eslint-plugin-n';
import promise from 'eslint-plugin-promise';
import security from 'eslint-plugin-security';
import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));
const tsFiles = ['**/*.ts', '**/*.tsx'];

export default tseslint.config(
  {
    // Keep API code strict; skip built web UI sources.
    ignores: [
      'dist/**',
      'node_modules/**',
      'eslint.config.js',
      'scripts/**',
      '**/scripts/**',
      'webapp/**',
      '**/webapp/**',
    ],
  },
  js.configs.recommended,
  n.configs['flat/recommended'],
  promise.configs['flat/recommended'],
  security.configs.recommended,
  prettier,
  // Allow CommonJS config files (module/require) without weakening TS linting.
  {
    files: ['**/*.cjs', 'tailwind.webapp.config.cjs'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // Tooling config may legally import devDependencies.
      'n/no-unpublished-require': 'off',
    },
  },
  {
    files: ['vite.webapp.config.ts'],
    rules: {
      // Tooling config may legally import devDependencies.
      'n/no-unpublished-import': 'off',
    },
  },
  // IMPORTANT: scope type-aware TypeScript rules to TS files only.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  ...tseslint.configs.stylistic.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
        project: ['./tsconfig.eslint.json'],
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'promise/always-return': 'off',
      'promise/catch-or-return': 'off',
      'n/no-process-exit': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
      'no-empty': 'off',
    },
  },
  // Test files live under src/ for now; allow dev-only deps and loosen import checks.
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'n/no-unpublished-import': 'off',
      'n/no-missing-import': 'off',
    },
  },
);
