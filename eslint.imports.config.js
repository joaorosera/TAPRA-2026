// Verificacao dos imports: equivalente, em Node.js, ao isort pedido na atividade de CI.
// Os require ficam no topo, agrupados (modulos do Node, pacotes do npm, arquivos do
// projeto) e em ordem alfabetica dentro de cada grupo. "npm run imports:fix" corrige.

const importX = require('eslint-plugin-import-x');

module.exports = [
    { ignores: ['node_modules/'] },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs'
        },
        plugins: { 'import-x': importX },
        rules: {
            'import-x/order': [
                'error',
                {
                    groups: ['builtin', 'external', ['parent', 'sibling', 'index']],
                    'newlines-between': 'never',
                    alphabetize: { order: 'asc', caseInsensitive: true }
                }
            ],
            'import-x/newline-after-import': 'error'
        }
    }
];
