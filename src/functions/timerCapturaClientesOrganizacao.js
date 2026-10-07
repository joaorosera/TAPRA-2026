const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela cliente_organizacao do banco de origem (itsm) e grava um JSON na camada raw do Data Lake
app.timer('timerCapturaClientesOrganizacao', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('timerCapturaClientesOrganizacao', 'cliente_organizacao', context);
    }
});
