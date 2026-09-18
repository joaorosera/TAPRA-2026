const { app } = require('@azure/functions');

app.http('httpParametro', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'parametro',
    handler: async (request, context) => {
        const nome = request.query.get('nome');

        if (!nome) {
            context.log('[httpParametro] chamada sem o parametro "nome"');
            return {
                status: 400,
                body: 'Informe o parametro na URL. Exemplo: /api/parametro?nome=Joao'
            };
        }

        context.log(`[httpParametro] parametro recebido: ${nome}`);
        return { body: `Parametro recebido: ${nome}` };
    }
});
