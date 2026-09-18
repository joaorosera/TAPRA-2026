const { app } = require('@azure/functions');

app.http('httpEco', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'eco',
    handler: async (request, context) => {
        const mensagem = request.query.get('mensagem') ?? '(nenhuma mensagem enviada)';

        context.log(`[httpEco] mensagem recebida: ${mensagem}`);
        return { body: `[httpEco - TAPRA-2026] Recebi a seguinte mensagem: "${mensagem}"` };
    }
});
