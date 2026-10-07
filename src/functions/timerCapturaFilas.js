const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela fila do banco de origem (itsm) e grava um JSON na camada raw do Data Lake
app.timer('timerCapturaFilas', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('timerCapturaFilas', 'fila', context);
    }
});
