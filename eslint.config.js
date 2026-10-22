// Linting do projeto: erros comuns e boas praticas de JavaScript.
// E o equivalente, em Node.js, ao flake8/pylint/ruff pedidos na atividade de CI.
// A formatacao fica com o Prettier (.prettierrc.json) e a ordem dos imports com
// o eslint.imports.config.js, cada um num passo proprio do pipeline.

const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
    { ignores: ['node_modules/'] },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: { ...globals.node }
        },
        rules: {
            eqeqeq: 'error',
            'no-var': 'error',
            'prefer-const': 'error'
        }
    },
    // Desliga as regras de estilo que brigariam com o Prettier
    prettier
];
