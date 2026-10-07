const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela chamado_sla do banco de origem e grava um JSON no Data Lake
app.timer('timerCapturaChamadoSla', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('chamado_sla', context);
    }
});
