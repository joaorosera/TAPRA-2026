// Captura de uma tabela do banco de origem (itsm) para a camada raw do Data Lake.
//
// Compartilhado pelas functions timerCaptura*, uma por tabela. Fica fora de
// src/functions/ de proposito, porque todo .js daquela pasta e carregado como function.

const { BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');

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

// Abre a conexao, le a tabela inteira e fecha a conexao antes de gravar no Data Lake.
// O nome da tabela vem sempre de uma constante das functions, nunca de entrada externa.
async function lerTabela(prefixo, tabela) {
    const config = montarConfigBanco();
    let pool;

    try {
        prefixo.log(`abrindo conexao com o banco ${config.database}`);
        pool = await new sql.ConnectionPool(config).connect();

        const resultado = await pool.request().query(`SELECT * FROM ${tabela}`);
        return resultado.recordset;
    } finally {
        if (pool) {
            await pool.close();
            prefixo.log('conexao encerrada');
        }
    }
}

// Camada bruta (raw) do Data Lake: um arquivo JSON por captura, separado por tabela e data
// Ex.: raw/itsm/chamado/2026/10/01/chamado_20261001T190500Z.json
function montarCaminhoArquivo(tabela, dataCaptura) {
    const iso = dataCaptura.toISOString();
    const [ano, mes, dia] = iso.slice(0, 10).split('-');
    const carimbo = iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return `itsm/${tabela}/${ano}/${mes}/${dia}/${tabela}_${carimbo}.json`;
}

async function gravarNoDataLake(tabela, registros, dataCaptura) {
    const nomeContainer = process.env.DATALAKE_CONTAINER || 'raw';
    const servico = BlobServiceClient.fromConnectionString(process.env.DATALAKE_CONNECTION_STRING);
    const container = servico.getContainerClient(nomeContainer);
    await container.createIfNotExists();

    const caminho = montarCaminhoArquivo(tabela, dataCaptura);
    const conteudo = JSON.stringify({
        origem: process.env.ITSM_DB_NAME,
        tabela,
        capturadoEm: dataCaptura.toISOString(),
        quantidade: registros.length,
        registros
    });

    await container.getBlockBlobClient(caminho).upload(conteudo, Buffer.byteLength(conteudo), {
        blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' }
    });
    return `${nomeContainer}/${caminho}`;
}

// Mensagens de erro do driver podem trazer o valor de uma credencial (ex.: o SQL
// Server responde "Login failed for user '<usuario>'"). No log fica so o nome da variavel.
function ocultarCredenciais(mensagem) {
    return ['ITSM_DB_USER', 'ITSM_DB_PASSWORD'].reduce((texto, nome) => {
        const valor = process.env[nome];
        return valor ? texto.split(valor).join(`<${nome}>`) : texto;
    }, String(mensagem));
}

// Fluxo completo de uma execucao. Nao relanca a excecao: a falha fica registrada
// no log da function e a proxima execucao do timer tenta de novo.
async function capturarTabela(nomeFunction, tabela, context) {
    const prefixo = {
        log: (mensagem) => context.log(`[${nomeFunction}] ${mensagem}`),
        error: (mensagem) => context.error(`[${nomeFunction}] ${mensagem}`)
    };

    try {
        validarVariaveis();

        const dataCaptura = new Date();
        const registros = await lerTabela(prefixo, tabela);

        prefixo.log(`${registros.length} registro(s) capturado(s) da tabela ${tabela}`);
        prefixo.log(`colunas: ${Object.keys(registros.columns).join(', ')}`);
        prefixo.log(`primeiros registros: ${JSON.stringify(registros.slice(0, 5))}`);

        const arquivo = await gravarNoDataLake(tabela, registros, dataCaptura);
        prefixo.log(`dados gravados no Data Lake: ${arquivo}`);
    } catch (erro) {
        prefixo.error(`falha ao capturar a tabela ${tabela}: ${ocultarCredenciais(erro.message)}`);
    }
}

module.exports = { capturarTabela };
