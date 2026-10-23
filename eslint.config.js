import js from '@eslint/js';
import globals from 'globals';

export default [
  {ignores: ['coverage/**', 'lib/**', 'dist/**']},
  {
    files: ['**/*.js', 'bin/basic'],
    languageOptions: {globals: globals.node},
    rules: {
      ...js.configs.recommended.rules,
      eqeqeq: ['error', 'always'],
      quotes: ['error', 'single', {avoidEscape: true}],
      semi: ['error', 'always'],
      'max-len': ['error', {
        code: 80,
        ignorePattern: '^import .*|^export .*',
      }],
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: {globals: globals.jest},
  },
];
