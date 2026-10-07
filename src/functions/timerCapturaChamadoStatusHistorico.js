const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela chamado_status_historico do banco de origem e grava um JSON no Data Lake
app.timer('timerCapturaChamadoStatusHistorico', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('chamado_status_historico', context);
    }
});
