# Indicadores do projeto

Indicadores que a equipe vai entregar no Power BI ao final do projeto, calculados sobre as tabelas do banco de destino (`db-tapra-rosera-werner`, schema `dbo`), que são atualizadas uma vez ao dia.

## Volume de chamados

| # | Indicador | Como é calculado | Tabelas |
| --- | --- | --- | --- |
| 1 | Total de chamados | Quantidade de chamados | `chamado` |
| 2 | Chamados abertos por mês | Chamados agrupados pelo mês de `dt_criacao` | `chamado` |
| 3 | Chamados abertos x resolvidos por mês | Abertos pelo mês de `dt_criacao` comparados com resolvidos pelo mês de `dt_resolucao` | `chamado` |
| 4 | Chamados por status | Chamados agrupados por `ds_status_chamado` (aberto, em andamento, pendente, resolvido, fechado, cancelado) | `chamado` |
| 5 | Backlog (chamados em aberto) | Chamados com status aberto, em andamento ou pendente | `chamado` |
| 6 | Chamados por prioridade | Chamados agrupados por `ds_prioridade` (baixa, média, alta, crítica) | `chamado` |
| 7 | Chamados por tipo | Chamados agrupados por `ds_tipo_chamado` (incidente, requisição, tarefa, problema, mudança) | `chamado` |
| 8 | Chamados por categoria | Chamados agrupados pela categoria | `chamado`, `categoria` |
| 9 | Chamados por cliente | Chamados agrupados pela organização do cliente | `chamado`, `cliente_organizacao` |
| 10 | Chamados por fila | Chamados agrupados pela fila de atendimento atual | `chamado`, `fila` |

## Analistas

| # | Indicador | Como é calculado | Tabelas |
| --- | --- | --- | --- |
| 11 | Chamados x analista | Chamados agrupados pelo analista atual, incluindo os chamados ainda sem analista | `chamado`, `analista` |
| 12 | Chamados por nível de analista | Chamados agrupados pelo nível do analista (N1, N2, N3) | `chamado`, `analista` |
| 13 | Taxa de resolução | Chamados resolvidos ou fechados ÷ total de chamados | `chamado` |

## Tempo de atendimento

| # | Indicador | Como é calculado | Tabelas |
| --- | --- | --- | --- |
| 14 | Tempo médio de resolução | Média de `dt_resolucao` − `dt_criacao`, em horas, no total e por prioridade | `chamado` |
| 15 | Tempo médio em cada status | Média de `qt_tempo_status_minutos` por status, só nos períodos já encerrados | `chamado_status_historico` |

## SLA

| # | Indicador | Como é calculado | Tabelas |
| --- | --- | --- | --- |
| 16 | % de chamados dentro do SLA | Chamados com `fl_breach` falso ÷ total de chamados com SLA | `chamado_sla` |
| 17 | Violações de SLA por prioridade e por SLA | Chamados com `fl_breach` verdadeiro, agrupados pela prioridade do chamado e pelo SLA aplicado | `chamado_sla`, `chamado`, `sla` |

## Satisfação do cliente (CSAT)

| # | Indicador | Como é calculado | Tabelas |
| --- | --- | --- | --- |
| 18 | Nota média de satisfação | Média de `nr_score` (de 1 a 5) | `csat_avaliacao` |
| 19 | % de clientes satisfeitos | Avaliações com nota 4 ou 5 ÷ total de avaliações | `csat_avaliacao` |
| 20 | Satisfação por analista | Nota média de `nr_score` agrupada pelo analista avaliado | `csat_avaliacao`, `analista` |

## Observações sobre os dados

- O sistema de origem não registra a primeira resposta ao cliente, então não há indicador de tempo de primeira resposta. O mais próximo é o tempo em que o chamado fica com status aberto (indicador 15).
- O histórico de status (indicador 15) e as avaliações de CSAT (indicadores 18 a 20) existem só para parte dos chamados e dos analistas. Esses indicadores mostram apenas os chamados que têm esses dados.
