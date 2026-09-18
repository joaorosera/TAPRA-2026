const { app } = require('@azure/functions');

app.timer('timerChamaHttp', {
    schedule: '0 */2 * * * *',
    handler: async (myTimer, context) => {
        const urlBase = process.env.ECO_FUNCTION_URL ?? 'http://localhost:7071/api/eco';
        const mensagem = `chamada do timerChamaHttp em ${new Date().toISOString()}`;
        const url = `${urlBase}?mensagem=${encodeURIComponent(mensagem)}`;

        context.log(`[timerChamaHttp] chamando a function httpEco: ${url}`);

        try {
            const resposta = await fetch(url);
            const texto = await resposta.text();
            context.log(`[timerChamaHttp] resposta (HTTP ${resposta.status}): ${texto}`);
        } catch (erro) {
            context.error(`[timerChamaHttp] falha ao chamar a function httpEco: ${erro.message}`);
        }
    }
});
