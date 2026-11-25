# Power BI

Os 20 indicadores de [`docs/indicadores.md`](../indicadores.md) são entregues num relatório do Power BI que lê o banco de destino (`db-tapra-rosera-werner`, schema `dbo`). O projeto fica em [`powerbi/`](../../powerbi/), no formato **PBIP** (Power BI Project): o modelo semântico em TMDL e o relatório em PBIR, tudo em arquivos de texto versionados no Git. Nenhum dado nem senha fica no repositório.

```
powerbi/
├── TAPRA-2026.pbip                  # atalho: é o arquivo que se abre no Power BI Desktop
├── TAPRA-2026.SemanticModel/        # modelo semântico (TMDL)
│   └── definition/
│       ├── expressions.tmdl         # parâmetros ServidorSql e BancoSql
│       ├── relationships.tmdl       # relacionamentos (ativos e inativos)
│       └── tables/                  # dbo_<tabela>, Calendario e _Medidas
└── TAPRA-2026.Report/               # relatório (PBIR), 5 páginas
    └── definition/pages/
```

## O que tem no modelo

- **10 tabelas** `dbo_<tabela>`, em modo *Import*, lidas com `Sql.Database(ServidorSql, BancoSql)`.
- **Calendario**, tabela calculada que vai de 1º de janeiro do ano do primeiro chamado até 31 de dezembro do ano da última criação ou resolução. Está marcada como tabela de datas, e `Mês/Ano` é ordenado por `AnoMes`.
- **Colunas calculadas** em `dbo_chamado` (`Grupo Status`, `Ordem Prioridade`, `Analista`, `Categoria`, `Fila` etc.) e as **medidas** dos indicadores na tabela `_Medidas`. Tudo vem de [`medidas.dax`](medidas.dax), e cada medida tem na descrição o número do indicador.
- **Relacionamentos:** os ativos são chamado→analista, categoria, fila e cliente, chamado_sla→chamado e sla, chamado_status_historico→chamado, csat_avaliacao→analista e chamado[Data Criacao]→Calendario. Outros 7 ficam inativos para não criar dois caminhos entre as mesmas tabelas. Um deles é o chamado[Data Resolucao]→Calendario, que a medida `Chamados Resolvidos (mês resolução)` liga com `USERELATIONSHIP` (indicador #3).

| Página | Indicadores |
| --- | --- |
| Visão geral | cartões #1, #5, #13, #14, #16 e #18, e a linha de abertos x resolvidos por mês (#3) |
| Volume | #2, #4, #6 a #10, com segmentações por ano e por prioridade |
| Analistas | #11, #12 e #13 |
| Tempo e SLA | #14, #15, #16 e a matriz prioridade × SLA com as violações (#17) |
| Satisfação | #18, #19, #20 e a quantidade de avaliações por nota |

## 1. Preparar o banco

Rode [`sql/criarUsuarioPowerBi.sql`](../../sql/criarUsuarioPowerBi.sql) no *Query editor* do banco (*SQL database > Query editor*, entrando com a conta do Microsoft Entra), trocando `<senha>` antes. O script cria o usuário `leitura_powerbi`, que só tem `SELECT` nas 10 tabelas, e pode ser executado mais de uma vez. Guarde a senha: ela é digitada no Power BI Desktop e no serviço, e não vai para nenhum arquivo.

O script também traz três consultas de conferência:

1. as permissões do usuário (10 linhas);
2. os valores reais de status, prioridade, tipo e nível. As colunas `Grupo Status` e `Ordem Prioridade` comparam esses textos (`aberto`, `em andamento`, `crítica`, ...). Se vierem escritos de outro jeito, ajuste as duas colunas na tabela `dbo_chamado`;
3. os números que o painel deve mostrar (veja [Conferir os números](#5-conferir-os-números)).

## 2. Liberar o firewall

O servidor `sv-tapra-rosera-werber` só aceita conexões dos IPs liberados em *SQL server > Security > Networking*:

- **Power BI Desktop:** adicione o IP da sua máquina em *Firewall rules* (*Add your client IPv4 address*). Em outra rede (casa, faculdade), o IP muda e a regra precisa ser adicionada de novo.
- **Serviço do Power BI (atualização agendada):** marque *Allow Azure services and resources to access this server*. É a mesma opção que a Function App usa, então já deve estar ligada. O Azure SQL não precisa de gateway.

## 3. Abrir no Power BI Desktop

1. Abra o `powerbi/TAPRA-2026.pbip` (*Arquivo > Abrir*). As versões recentes do Desktop abrem PBIP, TMDL e PBIR direto. Numa versão mais antiga, ligue em *Arquivo > Opções e configurações > Opções > Recursos de visualização* as opções do formato de projeto (.pbip), do TMDL e do PBIR, e reinicie o Desktop.
2. O projeto vem **sem dados**, porque o cache (`.pbi/cache.abf`) fica fora do Git. Os visuais aparecem vazios até a primeira atualização.
3. Confira os parâmetros em *Página Inicial > Transformar dados > Editar parâmetros*: `ServidorSql` = `sv-tapra-rosera-werber.database.windows.net` e `BancoSql` = `db-tapra-rosera-werner`, que já vêm preenchidos.
4. Clique em *Atualizar*. Quando o Desktop pedir as credenciais do servidor, escolha a aba **Banco de dados**, digite `leitura_powerbi` e a senha, e aplique ao nível do servidor.
5. Depois de salvar no Desktop, o projeto pode ganhar arquivos novos (por exemplo `diagramLayout.json` e `.pbi/editorSettings.json`) e anotações nos `.tmdl`. Eles podem ser commitados. Os únicos que ficam fora são `.pbi/localSettings.json` e `.pbi/cache.abf`, que estão no `.gitignore`.

Os arquivos também podem ser editados fora do Desktop, por exemplo no VS Code com a extensão *TMDL*. Com o projeto aberto, o Desktop mostra o aviso *Aplicar alterações externas* quando um arquivo muda.

## 4. Publicar e agendar a atualização

1. No Desktop, *Página Inicial > Publicar* e escolha o workspace.
2. No serviço ([app.powerbi.com](https://app.powerbi.com)), abra o workspace e, no modelo semântico `TAPRA-2026`, vá em *Configurações*.
3. Em *Credenciais da fonte de dados > Editar credenciais*, use autenticação **Básica** com `leitura_powerbi` e a senha.
4. Em *Atualizar*, ligue a atualização agendada: frequência **diária**, fuso **(UTC-03:00) Brasília** e horário **07:00**.

A function `timerCargaDestino` carrega o banco de destino uma vez ao dia, às **06:03 em Brasília** (09:03 UTC). Por isso a atualização fica depois desse horário, com folga para a carga terminar. Se a Function App estiver parada (workflow *Parar Function App*), a carga não roda e o painel continua mostrando os dados da última carga.

## 5. Conferir os números

Depois de atualizar, rode a **consulta 3** do `sql/criarUsuarioPowerBi.sql` e compare com os cartões da página **Visão geral**, que não tem segmentação:

| Coluna da consulta 3 | Visual |
| --- | --- |
| `total_chamados` | #1 Total de chamados |
| `backlog` | #5 Backlog |
| `taxa_resolucao_pct` | #13 Taxa de resolução |
| `dentro_sla_pct` | #16 % dentro do SLA |
| `nota_media_csat` | #18 Nota média CSAT |
| `satisfeitos_pct` | #19 % satisfeitos (página Satisfação) |

A consulta 3 usa os mesmos textos de status das colunas calculadas. Se `backlog` e `taxa_resolucao_pct` vierem zerados nos dois lados, os status do banco estão escritos de outro jeito: confira com a consulta 2 e ajuste a `Grupo Status` e a consulta 3. Se os números do Power BI forem os de um dia antes, a atualização rodou antes da carga.
