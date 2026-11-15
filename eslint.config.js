import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';

export default ts.config(
  { ignores: ['dist/**', 'coverage/**', '**/.next/**', '**/next-env.d.ts'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: { 'no-nested-ternary': 'error' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['scripts/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
);
