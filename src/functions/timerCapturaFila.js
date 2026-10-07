const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela fila do banco de origem e grava um JSON no Data Lake
app.timer('timerCapturaFila', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('fila', context);
    }
});
