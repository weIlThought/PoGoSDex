module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    // Allow modern syntax (top-level await etc.) to match Node 20
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // Allow console.log in addition to warn/error for controlled debug output
    'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: {
        jest: true,
      },
    },
  ],
};
