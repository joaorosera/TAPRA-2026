-- Usuario que a function timerCargaDestino usa para gravar no banco de destino.
--
-- E um usuario do proprio banco, sem login no servidor, e so tem as permissoes
-- da carga, nas 10 tabelas dela.
--
-- Troque <senha> antes de executar e guarde o valor em DESTINO_DB_PASSWORD, nas
-- Application settings da Function App. A senha nao fica no repositorio.

CREATE USER carga_destino WITH PASSWORD = '<senha>';

GRANT SELECT, INSERT, DELETE ON dbo.fila TO carga_destino;
GRANT SELECT, INSERT, DELETE ON dbo.categoria TO carga_destino;
GRANT SELECT, INSERT, DELETE ON dbo.sla TO carga_destino;
GRANT SELECT, INSERT, DELETE ON dbo.cliente_organizacao TO carga_destino;
GRANT SELECT, INSERT, DELETE ON dbo.analista TO carga_destino;
GRANT SELECT, INSERT, DELETE ON dbo.solicitante TO carga_destino;
GRANT SELECT, INSERT, DELETE ON dbo.chamado TO carga_destino;
GRANT SELECT, INSERT, DELETE ON dbo.chamado_sla TO carga_destino;
GRANT SELECT, INSERT, DELETE ON dbo.chamado_status_historico TO carga_destino;
GRANT SELECT, INSERT, DELETE ON dbo.csat_avaliacao TO carga_destino;
