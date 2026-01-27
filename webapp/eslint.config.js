import js from '@eslint/js';
import reactPluginImport from 'eslint-plugin-react';
import reactHooksPluginImport from 'eslint-plugin-react-hooks';

const react = reactPluginImport?.default ?? reactPluginImport;
const reactHooks = reactHooksPluginImport?.default ?? reactHooksPluginImport;

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    files: ['webapp/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        Telegram: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,

      // JSX runtime is automatic (no React in scope needed)
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',

      // Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Telegram integration intentionally swallows some WebView errors.
      'no-empty': 'off',
    },
  },
];
