import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import {defineConfig} from 'eslint/config';

export default defineConfig([
  {ignores: ['coverage/**', 'lib/**', 'dist/**']},
  {
    files: ['**/*.js', 'bin/basic'],
    extends: [js.configs.recommended],
    languageOptions: {globals: globals.node},
  },
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    rules: {'@typescript-eslint/switch-exhaustiveness-check': 'error'},
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname},
    },
  },
]);
