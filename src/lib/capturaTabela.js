// Captura de uma tabela do banco de origem para a camada bronze do Data Lake.
//
// Compartilhado pelas functions timerCaptura* (uma por tabela). Fica fora de
// src/functions/ de proposito, porque todo .js daquela pasta e carregado pelo
// host como function.

const { BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');

// Endereco e credenciais vem apenas de variaveis de ambiente:
// local.settings.json no ambiente local e Application settings no Azure.
const VARIAVEIS_OBRIGATORIAS = ['ITSM_DB_SERVER', 'ITSM_DB_NAME', 'ITSM_DB_USER', 'ITSM_DB_PASSWORD', 'DATALAKE_CONNECTION_STRING'];

// Schema e tabela entram no texto da consulta, entao so aceitam nomes simples
const NOME_VALIDO = /^[A-Za-z_][A-Za-z0-9_]*$/;

function validarVariaveis() {
    const faltando = VARIAVEIS_OBRIGATORIAS.filter((nome) => !process.env[nome]);
    if (faltando.length > 0) {
        throw new Error(`variaveis de ambiente nao configuradas: ${faltando.join(', ')}`);
    }
    if (!NOME_VALIDO.test(obterSchema())) {
        throw new Error('variavel de ambiente ITSM_DB_SCHEMA com nome de schema invalido');
    }
}

// No banco do professor as tabelas ficam no schema itsm (ex.: itsm.chamado)
function obterSchema() {
    return process.env.ITSM_DB_SCHEMA || 'itsm';
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
async function lerTabela(tabela, prefixo, context) {
    const config = montarConfigBanco();
    let pool;

    try {
        context.log(`${prefixo} abrindo conexao com o banco ${config.database}`);
        pool = await new sql.ConnectionPool(config).connect();

        const resultado = await pool.request().query(`SELECT * FROM [${obterSchema()}].[${tabela}]`);
        return resultado.recordset;
    } finally {
        if (pool) {
            await pool.close();
            context.log(`${prefixo} conexao encerrada`);
        }
    }
}

// Fonte dos dados: primeira pasta dentro do container. Fixa, porque nao depende
// do schema (a origem substituta usa dbo e continua sendo o ITSM)
const FONTE = 'itsm';

// Camada bronze do Data Lake: um arquivo JSON por captura, separado por fonte,
// entidade (a tabela) e data, com as pastas de data no formato chave=valor
// Ex.: bronze/itsm/chamado/ano=2026/mes=10/dia=16/chamado_20261016T134500Z.json
function montarCaminhoArquivo(tabela, dataCaptura) {
    const iso = dataCaptura.toISOString();
    const [ano, mes, dia] = iso.slice(0, 10).split('-');
    const carimbo = iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return `${FONTE}/${tabela}/ano=${ano}/mes=${mes}/dia=${dia}/${tabela}_${carimbo}.json`;
}

async function gravarNoDataLake(tabela, registros, dataCaptura) {
    const nomeContainer = process.env.DATALAKE_CONTAINER || 'bronze';
    const servico = BlobServiceClient.fromConnectionString(process.env.DATALAKE_CONNECTION_STRING);
    const container = servico.getContainerClient(nomeContainer);
    await container.createIfNotExists();

    const caminho = montarCaminhoArquivo(tabela, dataCaptura);
    const conteudo = JSON.stringify({
        origem: process.env.ITSM_DB_NAME,
        schema: obterSchema(),
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

// Execucao completa de uma captura. Como nos outros timers, a falha e registrada
// com context.error e nao e relancada.
async function capturarTabela(tabela, context) {
    const prefixo = `[${context.functionName}]`;

    try {
        if (!NOME_VALIDO.test(tabela)) {
            throw new Error('nome de tabela invalido');
        }
        validarVariaveis();

        const dataCaptura = new Date();
        const registros = await lerTabela(tabela, prefixo, context);

        context.log(`${prefixo} ${registros.length} registro(s) capturado(s) da tabela ${obterSchema()}.${tabela}`);
        context.log(`${prefixo} colunas: ${Object.keys(registros.columns).join(', ')}`);
        context.log(`${prefixo} primeiros registros: ${JSON.stringify(registros.slice(0, 5))}`);

        const arquivo = await gravarNoDataLake(tabela, registros, dataCaptura);
        context.log(`${prefixo} dados gravados no Data Lake: ${arquivo}`);
    } catch (erro) {
        context.error(`${prefixo} falha ao capturar a tabela ${tabela}: ${erro.message}`);
    }
}

module.exports = { capturarTabela };
