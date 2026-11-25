-- Usuario que o Power BI usa para ler o banco de destino (db-tapra-rosera-werner).
--
-- E um usuario do proprio banco, sem login no servidor, e so tem SELECT nas 10
-- tabelas. Nao use o carga_destino no Power BI: ele tambem pode apagar dados.
--
-- Troque <senha> antes de executar e informe o mesmo valor no Power BI Desktop e
-- nas credenciais do modelo publicado. A senha nao fica no repositorio.
--
-- Pode ser executado mais de uma vez: o usuario so e criado se ainda nao
-- existir, e repetir um GRANT nao muda nada. Rode no Query editor do banco,
-- entrando com a conta do Microsoft Entra.

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'leitura_powerbi')
    CREATE USER leitura_powerbi WITH PASSWORD = '<senha>';

GRANT SELECT ON dbo.fila TO leitura_powerbi;
GRANT SELECT ON dbo.categoria TO leitura_powerbi;
GRANT SELECT ON dbo.sla TO leitura_powerbi;
GRANT SELECT ON dbo.cliente_organizacao TO leitura_powerbi;
GRANT SELECT ON dbo.analista TO leitura_powerbi;
GRANT SELECT ON dbo.solicitante TO leitura_powerbi;
GRANT SELECT ON dbo.chamado TO leitura_powerbi;
GRANT SELECT ON dbo.chamado_sla TO leitura_powerbi;
GRANT SELECT ON dbo.chamado_status_historico TO leitura_powerbi;
GRANT SELECT ON dbo.csat_avaliacao TO leitura_powerbi;

-- Consulta 1: permissoes do usuario (devem aparecer 10 linhas, uma por tabela)
SELECT OBJECT_NAME(p.major_id) AS tabela, p.permission_name AS permissao
FROM sys.database_permissions p
JOIN sys.database_principals u ON u.principal_id = p.grantee_principal_id
WHERE u.name = 'leitura_powerbi'
ORDER BY tabela;

-- Consulta 2: valores reais dos campos de texto usados no modelo. As colunas
-- Grupo Status e Ordem Prioridade (powerbi/, tabela dbo_chamado)
-- comparam esses textos; se vierem diferentes (por exemplo EM_ANDAMENTO),
-- ajuste as colunas.
SELECT ds_status_chamado, COUNT(*) AS qtd FROM dbo.chamado GROUP BY ds_status_chamado ORDER BY qtd DESC;
SELECT ds_prioridade, COUNT(*) AS qtd FROM dbo.chamado GROUP BY ds_prioridade ORDER BY qtd DESC;
SELECT ds_tipo_chamado, COUNT(*) AS qtd FROM dbo.chamado GROUP BY ds_tipo_chamado ORDER BY qtd DESC;
SELECT ds_nivel, COUNT(*) AS qtd FROM dbo.analista GROUP BY ds_nivel ORDER BY qtd DESC;

-- Consulta 3: numeros que o painel deve mostrar, para conferir depois de cada
-- atualizacao (indicadores #1, #5, #13, #16, #18 e #19)
SELECT
    (SELECT COUNT(*) FROM dbo.chamado) AS total_chamados,
    (SELECT COUNT(*) FROM dbo.chamado
      WHERE LOWER(LTRIM(RTRIM(ds_status_chamado))) IN ('aberto', 'em andamento', 'pendente')) AS backlog,
    (SELECT CAST(100.0 * SUM(CASE WHEN LOWER(LTRIM(RTRIM(ds_status_chamado))) IN ('resolvido', 'fechado') THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0) AS DECIMAL(5, 1)) FROM dbo.chamado) AS taxa_resolucao_pct,
    (SELECT COUNT(DISTINCT id_chamado) FROM dbo.chamado_sla) AS chamados_com_sla,
    (SELECT COUNT(DISTINCT id_chamado) FROM dbo.chamado_sla WHERE fl_breach = 1) AS chamados_violacao_sla,
    (SELECT CAST(100.0 * (COUNT(DISTINCT id_chamado) - COUNT(DISTINCT CASE WHEN fl_breach = 1 THEN id_chamado END))
            / NULLIF(COUNT(DISTINCT id_chamado), 0) AS DECIMAL(5, 1)) FROM dbo.chamado_sla) AS dentro_sla_pct,
    (SELECT CAST(AVG(CAST(nr_score AS DECIMAL(5, 2))) AS DECIMAL(5, 2)) FROM dbo.csat_avaliacao) AS nota_media_csat,
    (SELECT CAST(100.0 * SUM(CASE WHEN nr_score >= 4 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(5, 1))
       FROM dbo.csat_avaliacao) AS satisfeitos_pct;
