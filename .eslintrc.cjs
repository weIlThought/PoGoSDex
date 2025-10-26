module.exports = {
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    'no-empty': 'off',
  },
  overrides: [
    {
      files: ['tests/**/*.js', 'tests/*.js'],
      env: { jest: true },
    },
    {
      files: ['server/**/*.js'],
      parserOptions: { sourceType: 'module' },
    },
  ],
};
