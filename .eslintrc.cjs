module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  globals: {
    // Inyectados en algunos entornos de hosting (fallback si no hay VITE_FIREBASE_CONFIG); ver src/config/firebase.js
    __firebase_config: 'readonly',
    __app_id: 'readonly',
  },
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // Proyecto sin PropTypes (JS, no TS); no se exige tipado de props.
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-unused-vars': ['error', { ignoreRestSiblings: true }],
  },
}
