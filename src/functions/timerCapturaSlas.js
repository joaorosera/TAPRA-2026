const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela sla do banco de origem (itsm) e grava um JSON na camada raw do Data Lake
app.timer('timerCapturaSlas', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('timerCapturaSlas', 'sla', context);
    }
});
