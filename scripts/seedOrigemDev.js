// Cria e popula a tabela `chamado` no banco de origem de DESENVOLVIMENTO.
//
// Serve para testar a timerCapturaChamado fora do banco do professor (use
// ITSM_DB_SCHEMA=dbo, porque a tabela e criada no dbo). Nao roda dentro do Functions
// host: fica fora de src/functions/ de proposito, porque todo .js daquela pasta
// e carregado como function.
//
// Credenciais vem das mesmas variaveis ITSM_DB_* usadas pela function. Fora do
// host nao existe process.env preenchido, entao o script le o local.settings.json
// (que esta no .gitignore) para nao duplicar o lugar onde a senha mora.
//
// Uso:
//   node scripts/seedOrigemDev.js             cria a tabela se faltar e popula se estiver vazia
//   node scripts/seedOrigemDev.js --recriar   descarta a tabela antes (apaga os dados)

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const VARIAVEIS_OBRIGATORIAS = ['ITSM_DB_SERVER', 'ITSM_DB_NAME', 'ITSM_DB_USER', 'ITSM_DB_PASSWORD'];

function carregarLocalSettings() {
    const arquivo = path.join(__dirname, '..', 'local.settings.json');
    if (!fs.existsSync(arquivo)) {
        return;
    }
    const valores = JSON.parse(fs.readFileSync(arquivo, 'utf8')).Values || {};
    for (const [nome, valor] of Object.entries(valores)) {
        if (process.env[nome] === undefined) {
            process.env[nome] = valor;
        }
    }
    console.log('[seedOrigemDev] configuracao lida do local.settings.json');
}

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
        },
        connectionTimeout: 60000,
        requestTimeout: 60000
    };
}

// Formato suposto, no padrao das outras tabelas do ITSM
// (analista, categoria, fila, solicitante, cliente_organizacao). Quando o schema
// real do professor aparecer, e este CREATE TABLE que precisa ser conferido.
const DDL = `
CREATE TABLE chamado (
    id_chamado              INT IDENTITY(1,1) PRIMARY KEY,
    codigo                  VARCHAR(20)    NOT NULL UNIQUE,
    titulo                  NVARCHAR(200)  NOT NULL,
    descricao               NVARCHAR(MAX)  NULL,
    id_solicitante          INT            NOT NULL,
    id_analista             INT            NULL,
    id_categoria            INT            NOT NULL,
    id_fila                 INT            NOT NULL,
    id_cliente_organizacao  INT            NOT NULL,
    prioridade              VARCHAR(20)    NOT NULL,
    status                  VARCHAR(30)    NOT NULL,
    canal_abertura          VARCHAR(20)    NULL,
    aberto_em               DATETIME2(3)   NOT NULL,
    primeira_resposta_em    DATETIME2(3)   NULL,
    resolvido_em            DATETIME2(3)   NULL,
    fechado_em              DATETIME2(3)   NULL,
    reaberturas             INT            NOT NULL CONSTRAINT DF_chamado_reaberturas DEFAULT 0,
    sla_violado             BIT            NOT NULL CONSTRAINT DF_chamado_sla_violado DEFAULT 0,
    atualizado_em           DATETIME2(3)   NOT NULL
)`;

// Dados ficticios com acento, NULL, datas em meses diferentes e todos os status,
// para a captura exercitar conversao de texto, de data e de valor ausente.
const REGISTROS = [
    ['INC0000101', 'Não consigo acessar a VPN', 'Erro de autenticação ao conectar fora do câmpus.', 11, 3, 1, 1, 1, 'Alta', 'Resolvido', 'Portal', '2026-08-04T12:10:00Z', '2026-08-04T12:35:00Z', '2026-08-04T15:02:00Z', '2026-08-05T12:00:00Z', 0, 0, '2026-08-05T12:00:00Z'],
    ['INC0000102', 'Impressora do 3º andar sem comunicação', null, 12, 4, 2, 2, 1, 'Media', 'Fechado', 'Telefone', '2026-08-11T17:45:00Z', '2026-08-11T18:20:00Z', '2026-08-12T13:30:00Z', '2026-08-14T13:30:00Z', 1, 0, '2026-08-14T13:30:00Z'],
    ['INC0000103', 'Sistema de matrícula fora do ar', 'Indisponibilidade total relatada por vários usuários.', 13, 3, 3, 1, 2, 'Critica', 'Resolvido', 'Telefone', '2026-08-19T11:02:00Z', '2026-08-19T11:08:00Z', '2026-08-19T14:47:00Z', '2026-08-20T11:00:00Z', 0, 1, '2026-08-20T11:00:00Z'],
    ['REQ0000104', 'Solicitação de licença do Office', 'Usuário novo do setor financeiro.', 14, 5, 4, 3, 1, 'Baixa', 'Fechado', 'Portal', '2026-08-26T13:30:00Z', '2026-08-27T12:15:00Z', '2026-08-28T18:00:00Z', '2026-08-31T18:00:00Z', 0, 0, '2026-08-31T18:00:00Z'],
    ['INC0000105', 'Lentidão no acesso ao ERP', 'Relatos de lentidão no período da manhã.', 15, 6, 5, 2, 3, 'Media', 'Em andamento', 'Email', '2026-09-02T12:20:00Z', '2026-09-02T14:05:00Z', null, null, 0, 0, '2026-09-10T19:30:00Z'],
    ['INC0000106', 'Email corporativo rejeitando anexos', 'Anexos acima de 10 MB são recusados.', 16, 4, 6, 1, 2, 'Media', 'Pendente', 'Portal', '2026-09-08T18:40:00Z', '2026-09-09T11:50:00Z', null, null, 0, 1, '2026-09-15T13:10:00Z'],
    ['REQ0000107', 'Criação de usuário para estagiário', null, 11, null, 4, 3, 1, 'Baixa', 'Novo', 'Portal', '2026-09-15T14:05:00Z', null, null, null, 0, 0, '2026-09-15T14:05:00Z'],
    ['INC0000108', 'Notebook não liga após atualização', 'Tela preta depois da atualização do sistema.', 17, 5, 7, 2, 4, 'Alta', 'Em andamento', 'Chat', '2026-09-21T16:25:00Z', '2026-09-21T16:55:00Z', null, null, 1, 0, '2026-09-28T17:40:00Z'],
    ['INC0000109', 'Wi-Fi instável no laboratório de redes', 'Queda intermitente de conexão.', 18, 6, 8, 2, 3, 'Media', 'Resolvido', 'Email', '2026-09-24T13:15:00Z', '2026-09-24T15:40:00Z', '2026-09-26T19:20:00Z', null, 0, 0, '2026-09-26T19:20:00Z'],
    ['REQ0000110', 'Aumento de cota no compartilhamento', 'Setor de pesquisa sem espaço em disco.', 19, 3, 9, 3, 2, 'Baixa', 'Pendente', 'Portal', '2026-09-29T11:50:00Z', '2026-09-30T13:20:00Z', null, null, 0, 0, '2026-10-01T12:05:00Z'],
    ['INC0000111', 'Falha na integração com o gateway de pagamento', 'Transações retornando timeout.', 20, 4, 10, 1, 5, 'Critica', 'Em andamento', 'Telefone', '2026-10-01T14:35:00Z', '2026-10-01T14:42:00Z', null, null, 0, 1, '2026-10-02T18:15:00Z'],
    ['INC0000112', 'Chamado aberto por engano', null, 12, null, 1, 1, 1, 'Baixa', 'Cancelado', 'Chat', '2026-10-02T12:08:00Z', null, null, '2026-10-02T12:40:00Z', 0, 0, '2026-10-02T12:40:00Z']
];

const INSERT = `
INSERT INTO chamado
    (codigo, titulo, descricao, id_solicitante, id_analista, id_categoria, id_fila,
     id_cliente_organizacao, prioridade, status, canal_abertura, aberto_em,
     primeira_resposta_em, resolvido_em, fechado_em, reaberturas, sla_violado, atualizado_em)
VALUES
    (@codigo, @titulo, @descricao, @id_solicitante, @id_analista, @id_categoria, @id_fila,
     @id_cliente_organizacao, @prioridade, @status, @canal_abertura, @aberto_em,
     @primeira_resposta_em, @resolvido_em, @fechado_em, @reaberturas, @sla_violado, @atualizado_em)`;

function dataOuNulo(valor) {
    return valor === null ? null : new Date(valor);
}

async function main() {
    const recriar = process.argv.includes('--recriar');

    carregarLocalSettings();
    validarVariaveis();

    const config = montarConfigBanco();
    let pool;

    try {
        console.log(`[seedOrigemDev] abrindo conexao com o banco ${config.database}`);
        pool = await new sql.ConnectionPool(config).connect();

        if (recriar) {
            await pool.request().query('DROP TABLE IF EXISTS chamado');
            console.log('[seedOrigemDev] tabela chamado descartada (--recriar)');
        }

        const existe = await pool.request().query(
            'SELECT COUNT(*) AS total FROM sys.tables WHERE name = \'chamado\''
        );
        if (existe.recordset[0].total === 0) {
            await pool.request().query(DDL);
            console.log('[seedOrigemDev] tabela chamado criada');
        } else {
            console.log('[seedOrigemDev] tabela chamado ja existia');
        }

        const contagem = await pool.request().query('SELECT COUNT(*) AS total FROM chamado');
        if (contagem.recordset[0].total > 0) {
            console.log(`[seedOrigemDev] tabela ja tem ${contagem.recordset[0].total} registro(s), nada inserido`);
            console.log('[seedOrigemDev] use --recriar para repopular');
            return;
        }

        for (const r of REGISTROS) {
            await pool.request()
                .input('codigo', sql.VarChar(20), r[0])
                .input('titulo', sql.NVarChar(200), r[1])
                .input('descricao', sql.NVarChar(sql.MAX), r[2])
                .input('id_solicitante', sql.Int, r[3])
                .input('id_analista', sql.Int, r[4])
                .input('id_categoria', sql.Int, r[5])
                .input('id_fila', sql.Int, r[6])
                .input('id_cliente_organizacao', sql.Int, r[7])
                .input('prioridade', sql.VarChar(20), r[8])
                .input('status', sql.VarChar(30), r[9])
                .input('canal_abertura', sql.VarChar(20), r[10])
                .input('aberto_em', sql.DateTime2, dataOuNulo(r[11]))
                .input('primeira_resposta_em', sql.DateTime2, dataOuNulo(r[12]))
                .input('resolvido_em', sql.DateTime2, dataOuNulo(r[13]))
                .input('fechado_em', sql.DateTime2, dataOuNulo(r[14]))
                .input('reaberturas', sql.Int, r[15])
                .input('sla_violado', sql.Bit, r[16])
                .input('atualizado_em', sql.DateTime2, dataOuNulo(r[17]))
                .query(INSERT);
        }
        console.log(`[seedOrigemDev] ${REGISTROS.length} registro(s) inserido(s) na tabela chamado`);
    } finally {
        if (pool) {
            await pool.close();
            console.log('[seedOrigemDev] conexao encerrada');
        }
    }
}

main().catch((erro) => {
    console.error(`[seedOrigemDev] falha: ${erro.message}`);
    process.exitCode = 1;
});
