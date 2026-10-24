import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  {ignores: ['coverage/**', 'lib/**', 'dist/**']},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js', 'bin/basic'],
    languageOptions: {globals: globals.node},
    rules: {'max-len': ['error', {code: 100, ignorePattern: '^import .*|^export .*'}]},
  },
];
