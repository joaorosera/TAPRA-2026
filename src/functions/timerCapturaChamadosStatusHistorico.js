const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela chamado_status_historico do banco de origem (itsm) e grava um JSON na camada raw do Data Lake
app.timer('timerCapturaChamadosStatusHistorico', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('timerCapturaChamadosStatusHistorico', 'chamado_status_historico', context);
    }
});
