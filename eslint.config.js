import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {ignores: ['dist/', 'node_modules/', 'coverage/']},
  js.configs.recommended,
  prettier,
  {files: ['**/__tests__/**', '*.config.js'], languageOptions: {globals: {...globals.node}}},
  {
    languageOptions: {ecmaVersion: 2022, sourceType: 'module', globals: {...globals.browser}},
    rules: {
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'always'],
      'no-unused-vars': 'warn',
      // console is allowed for now; replace with a logger module when one exists
      'no-console': 'off'
    }
  }
];
