-- Tabelas do banco de destino (db-tapra-rosera-werner), schema dbo.
--
-- Uma tabela para cada tabela extraida do schema itsm do banco de origem
-- (db-univille), com as mesmas colunas, tipos e nulidade. A estrutura foi
-- conferida com os arquivos da camada bronze do Data Lake e com o
-- INFORMATION_SCHEMA da origem.
--
-- Diferencas em relacao a origem, de proposito:
--   - sem IDENTITY: os ids vem da origem e sao gravados como estao, sem
--     precisar de SET IDENTITY_INSERT na carga;
--   - sem FOREIGN KEY: cada tabela e capturada por uma function propria, em
--     horarios independentes, entao a carga de uma nao pode depender da ordem
--     das outras. As PKs e os UNIQUE da origem foram mantidos.
--
-- Pode ser executado mais de uma vez: tabela que ja existe nao e alterada.
-- As tabelas sao criadas vazias; a carga dos dados e a proxima etapa.

IF OBJECT_ID('dbo.fila', 'U') IS NULL
CREATE TABLE dbo.fila (
    id_fila                     INT            NOT NULL,
    cd_fila                     NVARCHAR(50)   NOT NULL,
    nm_fila                     NVARCHAR(150)  NOT NULL,
    ds_descricao                NVARCHAR(300)  NULL,
    fl_ativo                    BIT            NOT NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_fila PRIMARY KEY (id_fila),
    CONSTRAINT UQ_fila_cd UNIQUE (cd_fila)
);

IF OBJECT_ID('dbo.categoria', 'U') IS NULL
CREATE TABLE dbo.categoria (
    id_categoria                INT            NOT NULL,
    cd_categoria                NVARCHAR(50)   NOT NULL,
    nm_categoria                NVARCHAR(150)  NOT NULL,
    ds_descricao                NVARCHAR(300)  NULL,
    fl_ativo                    BIT            NOT NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_categoria PRIMARY KEY (id_categoria),
    CONSTRAINT UQ_categoria_cd UNIQUE (cd_categoria)
);

IF OBJECT_ID('dbo.sla', 'U') IS NULL
CREATE TABLE dbo.sla (
    id_sla                      INT            NOT NULL,
    cd_sla                      NVARCHAR(50)   NOT NULL,
    nm_sla                      NVARCHAR(150)  NOT NULL,
    qt_meta_minutos             INT            NOT NULL,
    ds_descricao                NVARCHAR(300)  NULL,
    fl_ativo                    BIT            NOT NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_sla PRIMARY KEY (id_sla),
    CONSTRAINT UQ_sla_cd UNIQUE (cd_sla)
);

IF OBJECT_ID('dbo.cliente_organizacao', 'U') IS NULL
CREATE TABLE dbo.cliente_organizacao (
    id_cliente_organizacao      INT            NOT NULL,
    cd_cliente_organizacao      NVARCHAR(50)   NOT NULL,
    nm_cliente_organizacao      NVARCHAR(200)  NOT NULL,
    nr_cnpj                     NVARCHAR(20)   NULL,
    fl_ativo                    BIT            NOT NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_cliente_organizacao PRIMARY KEY (id_cliente_organizacao),
    CONSTRAINT UQ_cliente_organizacao_cd UNIQUE (cd_cliente_organizacao)
);

IF OBJECT_ID('dbo.analista', 'U') IS NULL
CREATE TABLE dbo.analista (
    id_analista                 INT            NOT NULL,
    cd_analista                 NVARCHAR(50)   NOT NULL,
    nm_analista                 NVARCHAR(200)  NOT NULL,
    ds_email                    NVARCHAR(200)  NULL,
    ds_nivel                    NVARCHAR(10)   NOT NULL,
    id_fila_atual               INT            NULL,
    fl_ativo                    BIT            NOT NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_analista PRIMARY KEY (id_analista),
    CONSTRAINT UQ_analista_cd UNIQUE (cd_analista)
);

IF OBJECT_ID('dbo.solicitante', 'U') IS NULL
CREATE TABLE dbo.solicitante (
    id_solicitante              INT            NOT NULL,
    cd_solicitante              NVARCHAR(50)   NOT NULL,
    id_cliente_organizacao      INT            NOT NULL,
    nm_solicitante              NVARCHAR(200)  NOT NULL,
    ds_email                    NVARCHAR(200)  NULL,
    ds_telefone                 NVARCHAR(50)   NULL,
    fl_ativo                    BIT            NOT NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_solicitante PRIMARY KEY (id_solicitante),
    CONSTRAINT UQ_solicitante_cd UNIQUE (cd_solicitante)
);

-- id_reporter e o id_solicitante de quem abriu o chamado
IF OBJECT_ID('dbo.chamado', 'U') IS NULL
CREATE TABLE dbo.chamado (
    id_chamado                  BIGINT         NOT NULL,
    nr_chamado                  NVARCHAR(50)   NOT NULL,
    ds_tipo_chamado             NVARCHAR(50)   NOT NULL,
    ds_status_chamado           NVARCHAR(30)   NOT NULL,
    ds_prioridade               NVARCHAR(20)   NOT NULL,
    dt_criacao                  DATETIME2(0)   NOT NULL,
    dt_resolucao                DATETIME2(0)   NULL,
    dt_ultima_atualizacao       DATETIME2(0)   NOT NULL,
    id_analista_atual           INT            NULL,
    id_reporter                 INT            NOT NULL,
    id_categoria                INT            NULL,
    id_cliente_organizacao      INT            NOT NULL,
    id_fila_atual               INT            NULL,
    ds_titulo                   NVARCHAR(250)  NULL,
    ds_descricao                NVARCHAR(MAX)  NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_chamado PRIMARY KEY (id_chamado),
    CONSTRAINT UQ_chamado_nr UNIQUE (nr_chamado)
);

IF OBJECT_ID('dbo.chamado_sla', 'U') IS NULL
CREATE TABLE dbo.chamado_sla (
    id_chamado_sla              BIGINT         NOT NULL,
    id_chamado                  BIGINT         NOT NULL,
    id_sla                      INT            NOT NULL,
    fl_breach                   BIT            NOT NULL,
    qt_tempo_restante_minutos   INT            NULL,
    qt_tempo_decorrido_minutos  INT            NULL,
    qt_meta_minutos             INT            NOT NULL,
    dt_referencia               DATETIME2(0)   NOT NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_chamado_sla PRIMARY KEY (id_chamado_sla)
);

IF OBJECT_ID('dbo.chamado_status_historico', 'U') IS NULL
CREATE TABLE dbo.chamado_status_historico (
    id_chamado_status_historico BIGINT         NOT NULL,
    id_chamado                  BIGINT         NOT NULL,
    ds_status_chamado           NVARCHAR(30)   NOT NULL,
    dt_inicio_status            DATETIME2(0)   NOT NULL,
    dt_fim_status               DATETIME2(0)   NULL,
    qt_tempo_status_minutos     INT            NULL,
    id_analista_responsavel     INT            NULL,
    id_fila                     INT            NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_chamado_status_historico PRIMARY KEY (id_chamado_status_historico)
);

IF OBJECT_ID('dbo.csat_avaliacao', 'U') IS NULL
CREATE TABLE dbo.csat_avaliacao (
    id_csat_avaliacao           BIGINT         NOT NULL,
    id_chamado                  BIGINT         NOT NULL,
    id_analista                 INT            NULL,
    nr_score                    INT            NOT NULL,
    ds_comentario               NVARCHAR(1000) NULL,
    dt_avaliacao                DATETIME2(0)   NOT NULL,
    dt_inclusao                 DATETIME2(0)   NOT NULL,
    dt_atualizacao              DATETIME2(0)   NULL,
    nm_sistema_origem           NVARCHAR(100)  NULL,
    cd_registro_origem          NVARCHAR(100)  NULL,
    CONSTRAINT PK_csat_avaliacao PRIMARY KEY (id_csat_avaliacao)
);

-- Conferencia: as 10 tabelas no schema dbo
SELECT t.name AS tabela, COUNT(c.column_id) AS colunas
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.schema_id = SCHEMA_ID('dbo')
  AND t.name IN ('analista', 'categoria', 'chamado', 'chamado_sla', 'chamado_status_historico',
                 'cliente_organizacao', 'csat_avaliacao', 'fila', 'sla', 'solicitante')
GROUP BY t.name
ORDER BY t.name;
