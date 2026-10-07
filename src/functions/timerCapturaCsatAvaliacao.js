const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela csat_avaliacao do banco de origem e grava um JSON no Data Lake
app.timer('timerCapturaCsatAvaliacao', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('csat_avaliacao', context);
    }
});
