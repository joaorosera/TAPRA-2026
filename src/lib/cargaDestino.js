// Carga do banco de destino a partir da camada bronze do Data Lake.
//
// Le a captura mais recente de cada tabela e substitui o conteudo do destino.
// E tudo uma transacao so: se qualquer tabela falhar, nada muda e o destino
// continua com os dados da ultima carga completa.

const { BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');
const { FONTE } = require('./capturaTabela');

// Credenciais do destino vem apenas de variaveis de ambiente:
// local.settings.json no ambiente local e Application settings no Azure.
const VARIAVEIS_OBRIGATORIAS = ['DESTINO_DB_SERVER', 'DESTINO_DB_NAME', 'DESTINO_DB_USER', 'DESTINO_DB_PASSWORD', 'DATALAKE_CONNECTION_STRING'];

// Ordem que respeita as chaves estrangeiras: quem e referenciado vem antes.
// A insercao segue esta ordem e a limpeza, a ordem inversa.
const TABELAS = [
    'fila',
    'categoria',
    'sla',
    'cliente_organizacao',
    'analista',
    'solicitante',
    'chamado',
    'chamado_sla',
    'chamado_status_historico',
    'csat_avaliacao'
];

function validarVariaveis() {
    const faltando = VARIAVEIS_OBRIGATORIAS.filter((nome) => !process.env[nome]);
    if (faltando.length > 0) {
        throw new Error(`variaveis de ambiente nao configuradas: ${faltando.join(', ')}`);
    }
}

function montarConfigBanco() {
    return {
        server: process.env.DESTINO_DB_SERVER,
        database: process.env.DESTINO_DB_NAME,
        user: process.env.DESTINO_DB_USER,
        password: process.env.DESTINO_DB_PASSWORD,
        options: { encrypt: true },
        connectionTimeout: 60000,
        requestTimeout: 60000
    };
}

// Desce pelas pastas ano=/mes=/dia= sempre pela maior. Os nomes tem tamanho fixo,
// entao a maior em ordem alfabetica e tambem a mais recente.
async function encontrarUltimoArquivo(container, prefixo) {
    let ultimo = null;
    for await (const item of container.listBlobsByHierarchy('/', { prefix: prefixo })) {
        if (!ultimo || item.name > ultimo.name) {
            ultimo = item;
        }
    }
    if (!ultimo) {
        return null;
    }
    return ultimo.kind === 'prefix' ? encontrarUltimoArquivo(container, ultimo.name) : ultimo.name;
}

// Tudo e lido antes de abrir o banco: sem as 10 capturas, a carga nem comeca
async function lerCapturas() {
    const servico = BlobServiceClient.fromConnectionString(process.env.DATALAKE_CONNECTION_STRING);
    const container = servico.getContainerClient(process.env.DATALAKE_CONTAINER || 'bronze');

    const capturas = new Map();
    for (const tabela of TABELAS) {
        const arquivo = await encontrarUltimoArquivo(container, `${FONTE}/${tabela}/`);
        if (!arquivo) {
            throw new Error(`nenhuma captura da tabela ${tabela} no Data Lake`);
        }
        const captura = JSON.parse(await container.getBlobClient(arquivo).downloadToBuffer());
        // Captura vazia apagaria a tabela de destino e as que dependem dela
        if (captura.registros.length === 0) {
            throw new Error(`captura sem registros: ${arquivo}`);
        }
        capturas.set(tabela, captura);
    }
    return capturas;
}

// As colunas vem da propria tabela de destino, para o script SQL continuar sendo
// o unico lugar onde a estrutura esta definida
async function inserirCaptura(transacao, tabela, captura) {
    const { recordset } = await new sql.Request(transacao).query(`SELECT TOP 0 * FROM [dbo].[${tabela}]`);
    const destino = recordset.toTable(`dbo.${tabela}`);

    const colunasDaCaptura = Object.keys(captura.registros[0]).sort().join();
    const colunasDoDestino = destino.columns
        .map((coluna) => coluna.name)
        .sort()
        .join();
    if (colunasDaCaptura !== colunasDoDestino) {
        throw new Error(`colunas diferentes na tabela ${tabela}: captura (${colunasDaCaptura}), destino (${colunasDoDestino})`);
    }

    for (const registro of captura.registros) {
        const valores = destino.columns.map((coluna) => {
            const valor = registro[coluna.name];
            return coluna.type === sql.DateTime2 && valor !== null ? new Date(valor) : valor;
        });
        destino.rows.push(valores);
    }

    // Sem checkConstraints o SQL Server ignora as chaves estrangeiras na carga em
    // bulk e passa a tratar a constraint como nao confiavel
    await new sql.Request(transacao).bulk(destino, { checkConstraints: true });
}

async function substituirDados(pool, capturas, prefixo, context) {
    const transacao = new sql.Transaction(pool);
    await transacao.begin();

    try {
        for (const tabela of [...TABELAS].reverse()) {
            await new sql.Request(transacao).query(`DELETE FROM [dbo].[${tabela}]`);
        }
        for (const tabela of TABELAS) {
            const captura = capturas.get(tabela);
            await inserirCaptura(transacao, tabela, captura);
            context.log(`${prefixo} ${tabela}: ${captura.registros.length} registro(s), capturados em ${captura.capturadoEm}`);
        }
        await transacao.commit();
    } catch (erro) {
        // Um erro grave ja desfaz a transacao no servidor; o que importa e o erro original
        await transacao.rollback().catch(() => {});
        throw erro;
    }
}

// Execucao completa da carga. Como nos outros timers, a falha e registrada com
// context.error e nao e relancada.
async function carregarDestino(context) {
    const prefixo = `[${context.functionName}]`;
    let pool;

    try {
        validarVariaveis();
        const capturas = await lerCapturas();

        const config = montarConfigBanco();
        context.log(`${prefixo} abrindo conexao com o banco ${config.database}`);
        pool = await new sql.ConnectionPool(config).connect();

        await substituirDados(pool, capturas, prefixo, context);
        context.log(`${prefixo} carga concluida: ${TABELAS.length} tabelas atualizadas`);
    } catch (erro) {
        context.error(`${prefixo} falha na carga, o destino ficou como estava: ${erro.message}`);
    } finally {
        if (pool) {
            await pool.close();
            context.log(`${prefixo} conexao encerrada`);
        }
    }
}

module.exports = { carregarDestino };
