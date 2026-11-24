import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
export default [
  { ignores: ['node_modules/**', '.next/**', 'src/generated/**'] },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/workouts/*.mjs', 'scripts/*.mjs'],
    languageOptions: {
      parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: { '@typescript-eslint': plugin },
    rules: {
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-constant-condition': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
];
