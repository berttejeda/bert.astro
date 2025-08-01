/* eslint-disable */

module.exports = {
  root: true,
  env: { node: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  ignores: [".eslintrc.cjs", ".remarkrc.cjs", "dist/", "node_modules/"],
  settings: {
    react: {
      version: "detect",
    },
  },  
  plugins: ['astro', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:astro/recommended',
    'plugin:mdx/recommended',
    'prettier'
  ],
  overrides: [
    {
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro'],
      },
    },
    {
      files: ['*.md', '*.mdx'],
      extends: ['plugin:mdx/recommended'],
    },
  ],
};
