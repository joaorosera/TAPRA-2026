const { app } = require('@azure/functions');
const { capturarTabela } = require('../lib/capturaTabela');

// Captura a tabela csat_avaliacao do banco de origem (itsm) e grava um JSON na camada raw do Data Lake
app.timer('timerCapturaCsatAvaliacoes', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        await capturarTabela('timerCapturaCsatAvaliacoes', 'csat_avaliacao', context);
    }
});
