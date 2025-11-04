// Minimal flat config to enable ESLint v9 programmatic runs
// and syntax checking without external dependencies.

export default [
  {
    files: ['**/*.{js,mjs,cjs}'],
    ignores: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.vscode/**',
      '**/dist/**',
      '**/coverage/**',
      '**/server/admin/**',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
    },
    rules: {},
  },
];
