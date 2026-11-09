const { app } = require('@azure/functions');
const { carregarDestino } = require('../lib/cargaDestino');

// Atualiza o banco de destino uma vez ao dia, as 09:03 UTC (06:03 em Brasilia).
// O minuto 3 fica de proposito entre duas capturas, que rodam a cada 5 minutos,
// para todas as tabelas virem da mesma rodada de captura.
app.timer('timerCargaDestino', {
    schedule: '0 3 9 * * *',
    handler: async (myTimer, context) => {
        await carregarDestino(context);
    }
});
