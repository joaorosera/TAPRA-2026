const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela sla do banco de origem e grava um JSON no Data Lake
app.timer('timerCapturaSla', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('sla', context);
    }
});
