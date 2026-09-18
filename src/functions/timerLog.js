const { app } = require('@azure/functions');

app.timer('timerLog', {
    schedule: '0 */1 * * * *',
    handler: (myTimer, context) => {
        context.log(`[timerLog] TAPRA-2026 | execucao agendada em ${new Date().toISOString()}`);
    }
});
