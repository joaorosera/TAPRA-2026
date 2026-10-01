const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');

// Tabela escolhida para a captura no banco de origem (itsm)
const TABELA = 'chamado';

// Endereco e credenciais vem apenas de variaveis de ambiente:
// local.settings.json no ambiente local e Application settings no Azure.
const VARIAVEIS_OBRIGATORIAS = ['ITSM_DB_SERVER', 'ITSM_DB_NAME', 'ITSM_DB_USER', 'ITSM_DB_PASSWORD', 'DATALAKE_CONNECTION_STRING'];

function validarVariaveis() {
    const faltando = VARIAVEIS_OBRIGATORIAS.filter((nome) => !process.env[nome]);
    if (faltando.length > 0) {
        throw new Error(`variaveis de ambiente nao configuradas: ${faltando.join(', ')}`);
    }
}

function montarConfigBanco() {
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

// Abre a conexao, le a tabela inteira e fecha a conexao antes de gravar no Data Lake
async function capturarTabela(context) {
    const config = montarConfigBanco();
    let pool;

    try {
        context.log(`[timerCapturaChamados] abrindo conexao com o banco ${config.database}`);
        pool = await new sql.ConnectionPool(config).connect();

        const resultado = await pool.request().query(`SELECT * FROM ${TABELA}`);
        return resultado.recordset;
    } finally {
        if (pool) {
            await pool.close();
            context.log('[timerCapturaChamados] conexao encerrada');
        }
    }
}

// Camada bruta (raw) do Data Lake: um arquivo JSON por captura, separado por data
// Ex.: raw/itsm/chamado/2026/10/01/chamado_20261001T190500Z.json
function montarCaminhoArquivo(dataCaptura) {
    const iso = dataCaptura.toISOString();
    const [ano, mes, dia] = iso.slice(0, 10).split('-');
    const carimbo = iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return `itsm/${TABELA}/${ano}/${mes}/${dia}/${TABELA}_${carimbo}.json`;
}

async function gravarNoDataLake(registros, dataCaptura) {
    const nomeContainer = process.env.DATALAKE_CONTAINER || 'raw';
    const servico = BlobServiceClient.fromConnectionString(process.env.DATALAKE_CONNECTION_STRING);
    const container = servico.getContainerClient(nomeContainer);
    await container.createIfNotExists();

    const caminho = montarCaminhoArquivo(dataCaptura);
    const conteudo = JSON.stringify({
        origem: process.env.ITSM_DB_NAME,
        tabela: TABELA,
        capturadoEm: dataCaptura.toISOString(),
        quantidade: registros.length,
        registros
    });

    await container.getBlockBlobClient(caminho).upload(conteudo, Buffer.byteLength(conteudo), {
        blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' }
    });
    return `${nomeContainer}/${caminho}`;
}

app.timer('timerCapturaChamados', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        try {
            validarVariaveis();

            const dataCaptura = new Date();
            const registros = await capturarTabela(context);

            context.log(`[timerCapturaChamados] ${registros.length} registro(s) capturado(s) da tabela ${TABELA}`);
            context.log(`[timerCapturaChamados] colunas: ${Object.keys(registros.columns).join(', ')}`);
            context.log(`[timerCapturaChamados] primeiros registros: ${JSON.stringify(registros.slice(0, 5))}`);

            const arquivo = await gravarNoDataLake(registros, dataCaptura);
            context.log(`[timerCapturaChamados] dados gravados no Data Lake: ${arquivo}`);
        } catch (erro) {
            context.error(`[timerCapturaChamados] falha ao capturar a tabela ${TABELA}: ${erro.message}`);
        }
    }
});
