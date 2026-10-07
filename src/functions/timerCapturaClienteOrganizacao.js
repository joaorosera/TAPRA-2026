const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela cliente_organizacao do banco de origem e grava um JSON no Data Lake
app.timer('timerCapturaClienteOrganizacao', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('cliente_organizacao', context);
    }
});
