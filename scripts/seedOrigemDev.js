// Cria e popula as 10 tabelas do ITSM no banco de origem de DESENVOLVIMENTO.
//
// Serve para as functions timerCaptura* terem uma origem real enquanto o endereco
// do banco `itsm` do professor nao for informado. Nao roda dentro do Functions
// host: fica fora de src/functions/ de proposito, porque todo .js daquela pasta
// e carregado como function.
//
// Credenciais vem das mesmas variaveis ITSM_DB_* usadas pelas functions. Fora do
// host nao existe process.env preenchido, entao o script le o local.settings.json
// (que esta no .gitignore) para nao duplicar o lugar onde a senha mora.
//
// Uso:
//   node scripts/seedOrigemDev.js             cria as tabelas que faltam e popula as que estao vazias
//   node scripts/seedOrigemDev.js --recriar   descarta as tabelas antes (apaga os dados)

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

// Todos os schemas deste script sao SUPOSICOES feitas a partir dos nomes das
// tabelas do ITSM. Quando o schema real do professor aparecer, sao estes
// CREATE TABLE que precisam ser conferidos (as functions nao, porque fazem
// SELECT * e serializam as colunas que vierem).
//
// As chaves batem entre as tabelas (os ids usados em chamado existem nas tabelas
// de cadastro), mas nao ha FOREIGN KEY: a origem so precisa ser lida, e assim o
// --recriar descarta as tabelas em qualquer ordem.

const DDL_FILA = `
CREATE TABLE fila (
    id_fila      INT            PRIMARY KEY,
    nome         NVARCHAR(100)  NOT NULL,
    descricao    NVARCHAR(300)  NULL,
    email_grupo  VARCHAR(120)   NULL,
    ativa        BIT            NOT NULL
)`;

const CARGA_FILA = `
INSERT INTO fila (id_fila, nome, descricao, email_grupo, ativa) VALUES
    (1, N'Service Desk N1', N'Primeiro atendimento de incidentes', 'servicedesk@exemplo.edu.br', 1),
    (2, N'Suporte de Campo', N'Atendimento presencial e de equipamentos', 'campo@exemplo.edu.br', 1),
    (3, N'Requisições', N'Solicitações de serviço, acessos e licenças', NULL, 1)`;

const DDL_CATEGORIA = `
CREATE TABLE categoria (
    id_categoria  INT            PRIMARY KEY,
    nome          NVARCHAR(100)  NOT NULL,
    tipo          VARCHAR(20)    NOT NULL,
    descricao     NVARCHAR(300)  NULL,
    ativa         BIT            NOT NULL
)`;

const CARGA_CATEGORIA = `
INSERT INTO categoria (id_categoria, nome, tipo, descricao, ativa) VALUES
    (1, N'Acesso remoto (VPN)', 'Incidente', N'Conexão à rede interna fora do câmpus', 1),
    (2, N'Impressão', 'Incidente', NULL, 1),
    (3, N'Sistemas acadêmicos', 'Incidente', N'Matrícula, notas e portal do aluno', 1),
    (4, N'Licenças de software', 'Requisicao', N'Pedidos de licença e instalação', 1),
    (5, N'ERP', 'Incidente', N'Sistema de gestão administrativa', 1),
    (6, N'E-mail corporativo', 'Incidente', NULL, 1),
    (7, N'Equipamentos', 'Incidente', N'Notebooks, desktops e periféricos', 1),
    (8, N'Rede sem fio', 'Incidente', N'Wi-Fi dos prédios e laboratórios', 1),
    (9, N'Armazenamento', 'Requisicao', N'Cotas e compartilhamentos de arquivos', 1),
    (10, N'Integrações', 'Incidente', N'Integrações com sistemas de terceiros', 0)`;

const DDL_CLIENTE_ORGANIZACAO = `
CREATE TABLE cliente_organizacao (
    id_cliente_organizacao  INT            PRIMARY KEY,
    nome                    NVARCHAR(150)  NOT NULL,
    cnpj                    CHAR(18)       NOT NULL,
    segmento                NVARCHAR(60)   NOT NULL,
    ativo                   BIT            NOT NULL,
    criado_em               DATETIME2(3)   NOT NULL
)`;

const CARGA_CLIENTE_ORGANIZACAO = `
INSERT INTO cliente_organizacao (id_cliente_organizacao, nome, cnpj, segmento, ativo, criado_em) VALUES
    (1, N'Universidade Exemplo - Reitoria', '12.345.678/0001-90', N'Educação', 1, '2024-02-01T12:00:00'),
    (2, N'Faculdade de Tecnologia Exemplo', '23.456.789/0001-01', N'Educação', 1, '2024-02-01T12:00:00'),
    (3, N'Hospital Escola São Lucas', '34.567.890/0001-12', N'Saúde', 1, '2024-06-17T13:30:00'),
    (4, N'Colégio de Aplicação', '45.678.901/0001-23', N'Educação', 1, '2025-01-20T11:00:00'),
    (5, N'Fundação de Apoio à Pesquisa', '56.789.012/0001-34', N'Pesquisa', 1, '2025-08-04T14:15:00')`;

// Um SLA por prioridade; o chamado_sla e ligado ao chamado pela prioridade
const DDL_SLA = `
CREATE TABLE sla (
    id_sla                     INT           PRIMARY KEY,
    nome                       NVARCHAR(60)  NOT NULL,
    prioridade                 VARCHAR(20)   NOT NULL UNIQUE,
    minutos_primeira_resposta  INT           NOT NULL,
    minutos_resolucao          INT           NOT NULL,
    ativo                      BIT           NOT NULL
)`;

const CARGA_SLA = `
INSERT INTO sla (id_sla, nome, prioridade, minutos_primeira_resposta, minutos_resolucao, ativo) VALUES
    (1, N'SLA Crítica', 'Critica', 15, 240, 1),
    (2, N'SLA Alta', 'Alta', 30, 480, 1),
    (3, N'SLA Média', 'Media', 120, 1440, 1),
    (4, N'SLA Baixa', 'Baixa', 480, 4320, 1)`;

const DDL_ANALISTA = `
CREATE TABLE analista (
    id_analista  INT            PRIMARY KEY,
    nome         NVARCHAR(120)  NOT NULL,
    email        VARCHAR(120)   NOT NULL,
    nivel        VARCHAR(5)     NOT NULL,
    id_fila      INT            NOT NULL,
    ativo        BIT            NOT NULL,
    admitido_em  DATE           NOT NULL
)`;

const CARGA_ANALISTA = `
INSERT INTO analista (id_analista, nome, email, nivel, id_fila, ativo, admitido_em) VALUES
    (1, N'Ana Paula Conceição', 'ana.conceicao@exemplo.edu.br', 'N1', 1, 1, '2021-03-01'),
    (2, N'Bruno Héber Lima', 'bruno.lima@exemplo.edu.br', 'N1', 1, 0, '2020-07-15'),
    (3, N'Carla Gonçalves', 'carla.goncalves@exemplo.edu.br', 'N2', 1, 1, '2019-02-11'),
    (4, N'Diego Araújo', 'diego.araujo@exemplo.edu.br', 'N2', 2, 1, '2022-05-02'),
    (5, N'Elisa Menezes', 'elisa.menezes@exemplo.edu.br', 'N2', 2, 1, '2023-01-16'),
    (6, N'Fábio Ribeiro', 'fabio.ribeiro@exemplo.edu.br', 'N3', 3, 1, '2018-09-03')`;

// Ids 11 a 20, que sao os usados em chamado.id_solicitante
const DDL_SOLICITANTE = `
CREATE TABLE solicitante (
    id_solicitante          INT            PRIMARY KEY,
    nome                    NVARCHAR(120)  NOT NULL,
    email                   VARCHAR(120)   NOT NULL,
    telefone                VARCHAR(20)    NULL,
    departamento            NVARCHAR(80)   NOT NULL,
    id_cliente_organizacao  INT            NOT NULL,
    criado_em               DATETIME2(3)   NOT NULL
)`;

const CARGA_SOLICITANTE = `
INSERT INTO solicitante (id_solicitante, nome, email, telefone, departamento, id_cliente_organizacao, criado_em) VALUES
    (11, N'Gabriela Souza', 'gabriela.souza@exemplo.edu.br', '(47) 3461-0011', N'Secretaria Acadêmica', 1, '2024-03-04T12:00:00'),
    (12, N'Henrique Matos', 'henrique.matos@exemplo.edu.br', NULL, N'Biblioteca', 1, '2024-03-04T12:00:00'),
    (13, N'Isabela Freitas', 'isabela.freitas@exemplo.edu.br', '(47) 3461-0013', N'Coordenação de Curso', 2, '2024-04-22T17:10:00'),
    (14, N'João Pedro Alves', 'joao.alves@exemplo.edu.br', '(47) 3461-0014', N'Financeiro', 1, '2024-05-13T13:00:00'),
    (15, N'Karina Lopes', 'karina.lopes@exemplo.edu.br', NULL, N'Faturamento', 3, '2024-06-17T14:00:00'),
    (16, N'Lucas Antunes', 'lucas.antunes@exemplo.edu.br', '(47) 3461-0016', N'TI Acadêmica', 2, '2024-09-02T12:30:00'),
    (17, N'Mariana Peixoto', 'mariana.peixoto@exemplo.edu.br', '(47) 3461-0017', N'Direção', 4, '2025-01-20T11:30:00'),
    (18, N'Nícolas Barros', 'nicolas.barros@exemplo.edu.br', NULL, N'Laboratório de Redes', 3, '2025-03-10T18:45:00'),
    (19, N'Olívia Teixeira', 'olivia.teixeira@exemplo.edu.br', '(47) 3461-0019', N'Pesquisa', 2, '2025-05-05T12:00:00'),
    (20, N'Paulo César Dias', 'paulo.dias@exemplo.edu.br', '(47) 3461-0020', N'Tesouraria', 5, '2025-08-04T14:30:00')`;

// As tres tabelas abaixo sao derivadas do chamado ja gravado, para os prazos,
// as transicoes de status e as avaliacoes baterem com as datas de cada chamado.

const DDL_CHAMADO_SLA = `
CREATE TABLE chamado_sla (
    id_chamado_sla              INT IDENTITY(1,1) PRIMARY KEY,
    id_chamado                  INT           NOT NULL,
    id_sla                      INT           NOT NULL,
    prazo_primeira_resposta     DATETIME2(3)  NOT NULL,
    prazo_resolucao             DATETIME2(3)  NOT NULL,
    primeira_resposta_no_prazo  BIT           NULL,
    resolucao_no_prazo          BIT           NULL,
    violado                     BIT           NOT NULL
)`;

const CARGA_CHAMADO_SLA = `
INSERT INTO chamado_sla
    (id_chamado, id_sla, prazo_primeira_resposta, prazo_resolucao,
     primeira_resposta_no_prazo, resolucao_no_prazo, violado)
SELECT
    c.id_chamado,
    s.id_sla,
    DATEADD(MINUTE, s.minutos_primeira_resposta, c.aberto_em),
    DATEADD(MINUTE, s.minutos_resolucao, c.aberto_em),
    CASE WHEN c.primeira_resposta_em IS NULL THEN NULL
         WHEN c.primeira_resposta_em <= DATEADD(MINUTE, s.minutos_primeira_resposta, c.aberto_em) THEN 1 ELSE 0 END,
    CASE WHEN c.resolvido_em IS NULL THEN NULL
         WHEN c.resolvido_em <= DATEADD(MINUTE, s.minutos_resolucao, c.aberto_em) THEN 1 ELSE 0 END,
    c.sla_violado
FROM chamado c
JOIN sla s ON s.prioridade = c.prioridade
ORDER BY c.id_chamado`;

const DDL_CHAMADO_STATUS_HISTORICO = `
CREATE TABLE chamado_status_historico (
    id_status_historico  INT IDENTITY(1,1) PRIMARY KEY,
    id_chamado           INT            NOT NULL,
    status_anterior      VARCHAR(30)    NULL,
    status_novo          VARCHAR(30)    NOT NULL,
    alterado_em          DATETIME2(3)   NOT NULL,
    id_analista          INT            NULL,
    observacao           NVARCHAR(300)  NULL
)`;

// Uma linha por transicao: abertura, primeira resposta, pendencia, resolucao,
// fechamento ou cancelamento, conforme as datas e o status atual do chamado
const CARGA_CHAMADO_STATUS_HISTORICO = `
INSERT INTO chamado_status_historico
    (id_chamado, status_anterior, status_novo, alterado_em, id_analista, observacao)
SELECT id_chamado, status_anterior, status_novo, alterado_em, id_analista, observacao
FROM (
    SELECT id_chamado, NULL AS status_anterior, 'Novo' AS status_novo, aberto_em AS alterado_em,
           NULL AS id_analista, N'Chamado aberto via ' + canal_abertura AS observacao
    FROM chamado
    UNION ALL
    SELECT id_chamado, 'Novo', 'Em andamento', primeira_resposta_em, id_analista, NULL
    FROM chamado WHERE primeira_resposta_em IS NOT NULL
    UNION ALL
    SELECT id_chamado, 'Em andamento', 'Pendente', atualizado_em, id_analista, N'Aguardando retorno do solicitante'
    FROM chamado WHERE status = 'Pendente'
    UNION ALL
    SELECT id_chamado, 'Em andamento', 'Resolvido', resolvido_em, id_analista, N'Solução aplicada'
    FROM chamado WHERE resolvido_em IS NOT NULL
    UNION ALL
    SELECT id_chamado, 'Resolvido', 'Fechado', fechado_em, id_analista, NULL
    FROM chamado WHERE status = 'Fechado'
    UNION ALL
    SELECT id_chamado, 'Novo', 'Cancelado', fechado_em, NULL, N'Cancelado a pedido do solicitante'
    FROM chamado WHERE status = 'Cancelado'
) AS transicoes
ORDER BY id_chamado, alterado_em`;

const DDL_CSAT_AVALIACAO = `
CREATE TABLE csat_avaliacao (
    id_csat_avaliacao  INT IDENTITY(1,1) PRIMARY KEY,
    id_chamado         INT            NOT NULL,
    nota               TINYINT        NOT NULL,
    comentario         NVARCHAR(500)  NULL,
    respondido_em      DATETIME2(3)   NOT NULL
)`;

// So chamados resolvidos ou fechados recebem a pesquisa de satisfacao
const CARGA_CSAT_AVALIACAO = `
INSERT INTO csat_avaliacao (id_chamado, nota, comentario, respondido_em)
SELECT c.id_chamado, v.nota, v.comentario, DATEADD(HOUR, 3, COALESCE(c.fechado_em, c.resolvido_em))
FROM chamado c
JOIN (VALUES
    ('INC0000101', 5, N'Resolvido rápido, obrigado!'),
    ('INC0000102', 3, NULL),
    ('INC0000103', 2, N'Demorou demais para um sistema crítico.'),
    ('REQ0000104', 4, N'Atendimento cordial.'),
    ('INC0000109', 4, NULL)
) AS v (codigo, nota, comentario) ON v.codigo = c.codigo
ORDER BY c.id_chamado`;

const DDL_CHAMADO = `
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

async function carregarChamado(pool) {
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
}

// Ordem de carga: cadastros, depois chamado, depois as tabelas derivadas do chamado
const TABELAS = [
    { nome: 'fila', ddl: DDL_FILA, carga: CARGA_FILA },
    { nome: 'categoria', ddl: DDL_CATEGORIA, carga: CARGA_CATEGORIA },
    { nome: 'cliente_organizacao', ddl: DDL_CLIENTE_ORGANIZACAO, carga: CARGA_CLIENTE_ORGANIZACAO },
    { nome: 'sla', ddl: DDL_SLA, carga: CARGA_SLA },
    { nome: 'analista', ddl: DDL_ANALISTA, carga: CARGA_ANALISTA },
    { nome: 'solicitante', ddl: DDL_SOLICITANTE, carga: CARGA_SOLICITANTE },
    { nome: 'chamado', ddl: DDL_CHAMADO, carga: carregarChamado },
    { nome: 'chamado_sla', ddl: DDL_CHAMADO_SLA, carga: CARGA_CHAMADO_SLA },
    { nome: 'chamado_status_historico', ddl: DDL_CHAMADO_STATUS_HISTORICO, carga: CARGA_CHAMADO_STATUS_HISTORICO },
    { nome: 'csat_avaliacao', ddl: DDL_CSAT_AVALIACAO, carga: CARGA_CSAT_AVALIACAO }
];

// Cria a tabela se faltar e popula se estiver vazia; nunca mexe em tabela com dados
async function prepararTabela(pool, tabela) {
    const existe = await pool.request()
        .input('nome', sql.NVarChar(128), tabela.nome)
        .query('SELECT COUNT(*) AS total FROM sys.tables WHERE name = @nome');
    if (existe.recordset[0].total === 0) {
        await pool.request().query(tabela.ddl);
        console.log(`[seedOrigemDev] tabela ${tabela.nome} criada`);
    }

    const contagem = await pool.request().query(`SELECT COUNT(*) AS total FROM ${tabela.nome}`);
    if (contagem.recordset[0].total > 0) {
        console.log(`[seedOrigemDev] tabela ${tabela.nome} ja tem ${contagem.recordset[0].total} registro(s), nada inserido`);
        return;
    }

    if (typeof tabela.carga === 'function') {
        await tabela.carga(pool);
    } else {
        await pool.request().query(tabela.carga);
    }
    const total = await pool.request().query(`SELECT COUNT(*) AS total FROM ${tabela.nome}`);
    console.log(`[seedOrigemDev] ${total.recordset[0].total} registro(s) inserido(s) na tabela ${tabela.nome}`);
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
            for (const tabela of [...TABELAS].reverse()) {
                await pool.request().query(`DROP TABLE IF EXISTS ${tabela.nome}`);
            }
            console.log(`[seedOrigemDev] ${TABELAS.length} tabelas descartadas (--recriar)`);
        }

        for (const tabela of TABELAS) {
            await prepararTabela(pool, tabela);
        }
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
