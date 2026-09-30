const { app } = require('@azure/functions');
const sql = require('mssql');

// Tabela escolhida para a captura no banco de origem (itsm)
const TABELA = 'chamado';

// Endereco e credenciais do banco vem apenas de variaveis de ambiente:
// local.settings.json no ambiente local e Application settings no Azure.
const VARIAVEIS_OBRIGATORIAS = ['ITSM_DB_SERVER', 'ITSM_DB_NAME', 'ITSM_DB_USER', 'ITSM_DB_PASSWORD'];

function montarConfigBanco() {
    const faltando = VARIAVEIS_OBRIGATORIAS.filter((nome) => !process.env[nome]);
    if (faltando.length > 0) {
        throw new Error(`variaveis de ambiente nao configuradas: ${faltando.join(', ')}`);
    }

    return {
        server: process.env.ITSM_DB_SERVER,
        port: Number(process.env.ITSM_DB_PORT ?? 1433),
        database: process.env.ITSM_DB_NAME,
        user: process.env.ITSM_DB_USER,
        password: process.env.ITSM_DB_PASSWORD,
        options: {
            encrypt: process.env.ITSM_DB_ENCRYPT !== 'false',
            trustServerCertificate: process.env.ITSM_DB_TRUST_SERVER_CERTIFICATE === 'true'
        }
    };
}

app.timer('timerCapturaChamados', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        let pool;

        try {
            const config = montarConfigBanco();

            context.log(`[timerCapturaChamados] abrindo conexao com o banco ${config.database}`);
            pool = await new sql.ConnectionPool(config).connect();

            const resultado = await pool.request().query(`SELECT * FROM ${TABELA}`);
            const registros = resultado.recordset;

            context.log(`[timerCapturaChamados] ${registros.length} registro(s) capturado(s) da tabela ${TABELA}`);
            context.log(`[timerCapturaChamados] colunas: ${Object.keys(registros.columns).join(', ')}`);
            context.log(`[timerCapturaChamados] primeiros registros: ${JSON.stringify(registros.slice(0, 5))}`);
        } catch (erro) {
            context.error(`[timerCapturaChamados] falha ao capturar a tabela ${TABELA}: ${erro.message}`);
        } finally {
            if (pool) {
                await pool.close();
                context.log('[timerCapturaChamados] conexao encerrada');
            }
        }
    }
});
