# CLAUDE.md

Contexto do projeto TAPRA-2026 para o Claude Code e para a equipe. Leia antes de alterar o código.

## Projeto

Trabalho em equipe da disciplina TAPRA (2026): Azure Functions em Node.js que, entre outras coisas, capturam dados de um banco de origem de ITSM.

- Equipe: João Vitor Rosera e Vinicius Werner ([@lvwerner](https://github.com/lvwerner))
- Repositório: https://github.com/joaorosera/TAPRA-2026 (branch `main`)
- Documentação para usuários: [README.md](README.md). Arquitetura: [docs/arquitetura.drawio](docs/arquitetura.drawio) e [docs/arquitetura.png](docs/arquitetura.png)

## Stack e estrutura

- Azure Functions v4, **modelo de programação Node.js v4** (`app.timer`, `app.http` de `@azure/functions`), JavaScript CommonJS
- Banco de origem: SQL Server / Azure SQL, banco `itsm`, acessado pelo pacote `mssql`
- Core Tools e Azurite são `devDependencies` e não ficam instalados globalmente. Use `npm start` e `npm run azurite` (ou `npx func`), não `func` direto

```
src/functions/          uma function por arquivo (todo .js aqui é carregado pelo host)
docs/                   desenho da arquitetura (.drawio editável + .png exportado)
host.json               configuração do host
local.settings.json     configuração local com credenciais (NÃO versionado)
local.settings.json.example  modelo versionado, apenas valores de exemplo
```

O `main` do `package.json` é `src/functions/*.js`, então **todo arquivo nessa pasta é carregado como function**. Código auxiliar compartilhado precisa ficar fora dela (ex.: `src/lib/`).

## Functions

| Function | Gatilho | O que faz |
| --- | --- | --- |
| `timerLog` | Timer `0 */1 * * * *` | Só escreve um log |
| `httpParametro` | HTTP GET `/api/parametro?nome=` | Devolve o parâmetro recebido (400 se faltar) |
| `httpEco` | HTTP GET `/api/eco?mensagem=` | Devolve a mensagem com um texto de identificação |
| `timerChamaHttp` | Timer `0 */2 * * * *` | Chama a `httpEco` pela URL em `ECO_FUNCTION_URL` |
| `timerCapturaChamados` | Timer `0 */5 * * * *` | Conecta no banco `itsm` e captura a tabela `chamado` |

## Convenções

- Um arquivo por function, autocontido, no estilo dos existentes: 4 espaços, aspas simples, `const { app } = require('@azure/functions')`
- Nomes de functions em camelCase com prefixo do gatilho (`timer...`, `http...`)
- Toda mensagem de log começa com `[nomeDaFunction]`. Os textos dos logs ficam em português **sem acento** (`conexao`, `nao`)
- Falhas em timers são tratadas com `try/catch` e `context.error(...)`, sem relançar a exceção
- **Credenciais nunca vão para o código, o README ou o `local.settings.json.example`.** Tudo vem de `process.env`, que é o `local.settings.json` no ambiente local e as *Application settings* no Azure. Logs de erro podem citar o **nome** de uma variável, nunca o valor
- Ao criar uma variável de ambiente, atualize juntos o `local.settings.json.example`, a tabela "Configurações" do README e a caixa de variáveis no diagrama

## Variáveis de ambiente

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `AzureWebJobsStorage` | sim | `UseDevelopmentStorage=true` no local (Azurite) |
| `FUNCTIONS_WORKER_RUNTIME` | sim | `node` |
| `ECO_FUNCTION_URL` | não | padrão `http://localhost:7071/api/eco` |
| `ITSM_DB_SERVER` | sim | servidor do banco de origem |
| `ITSM_DB_PORT` | não | padrão `1433` |
| `ITSM_DB_NAME` | sim | `itsm` |
| `ITSM_DB_USER` | sim | fornecido pelo professor |
| `ITSM_DB_PASSWORD` | sim | fornecido pelo professor |
| `ITSM_DB_ENCRYPT` | não | padrão `true`. Só `false` desliga |
| `ITSM_DB_TRUST_SERVER_CERTIFICATE` | não | padrão `false`. Use `true` só em SQL Server local com certificado autoassinado |

## Comandos

```bash
npm install                      # baixa também o binário do Core Tools (demorado)
npm run azurite                  # terminal 1: emulador de storage, obrigatório para os timers
npm start                        # terminal 2: host em http://localhost:7071

# executa um timer na hora, sem esperar o agendamento
curl -X POST http://localhost:7071/admin/functions/timerCapturaChamados -H "Content-Type: application/json" -d "{}"
```

Não há testes automatizados nem lint configurados.

## Banco de origem `itsm`

Tabelas: `analista`, `categoria`, `chamado`, `chamado_sla`, `chamado_status_historico`, `cliente_organizacao`, `csat_avaliacao`, `fila`, `sla`, `solicitante`.

- A equipe escolheu a tabela `chamado` para a captura por ser a tabela central do ITSM
- A consulta usa o nome sem schema (`SELECT * FROM chamado`), então vale para `dbo` ou para o schema padrão do usuário. Se a tabela estiver em outro schema, qualifique o nome
- A conexão é aberta e fechada a cada execução, como pede a atividade

## Diagrama de arquitetura

- A fonte é o `docs/arquitetura.drawio`, e o `docs/arquitetura.png` é a exportação usada no README
- Depois de editar o `.drawio` (em app.diagrams.net ou na extensão *Draw.io Integration* do VS Code), **exporte de novo o PNG** para manter os dois iguais
- O diagrama mostra só o que existe no projeto. Acrescente novas etapas (por exemplo, o destino dos dados capturados) quando forem implementadas

## Histórico

### 2026-09-30: Atividades 2B (equipe)

**[2B] Capturar os dados de uma tabela do banco de origem: feito**
- Criada a `src/functions/timerCapturaChamados.js`: timer trigger que abre uma conexão com o SQL Server via `mssql`, roda `SELECT * FROM chamado`, registra a quantidade de registros, as colunas e os 5 primeiros registros, e fecha a conexão
- Configuração lida só de variáveis de ambiente `ITSM_DB_*`, com validação das obrigatórias antes de conectar
- Adicionado `mssql` às dependências. Criado o `.gitignore` (antes não existia) para ignorar `node_modules/`, `local.settings.json` e `.azurite/`
- `local.settings.json.example` atualizado com as variáveis `ITSM_DB_*` (valores de exemplo)

**[2B] Desenhar a arquitetura do projeto: feito**
- Criados `docs/arquitetura.drawio` e `docs/arquitetura.png`, com Function App, triggers HTTP e Timer, variáveis de ambiente, banco de origem `itsm`, Azure Storage/Azurite, Application Insights, GitHub e ambiente local
- Nova seção "Arquitetura" no README com a imagem, além da documentação da nova function, das variáveis e dos passos de publicação

**Validação feita**
- Fora do host: variáveis ausentes geram erro com os nomes; servidor inacessível gera erro de conexão; com o `mssql` simulado, os logs saem certos e a conexão é fechada. A senha não aparece nos logs
- No host local (Azurite + `npm start`): as 5 functions foram registradas, `/api/parametro` e `/api/eco` responderam, e a `timerCapturaChamados` disparada pelo endpoint de administração executou e registrou a falta de `ITSM_DB_SERVER`, `ITSM_DB_USER` e `ITSM_DB_PASSWORD`

## Pendências

- [ ] O professor vai passar as credenciais do banco `itsm`. Preencher `ITSM_DB_SERVER`, `ITSM_DB_USER` e `ITSM_DB_PASSWORD` no `local.settings.json`, que já existe localmente e está ignorado pelo Git
- [ ] Com as credenciais, rodar a captura de verdade e conferir: schema da tabela `chamado`, necessidade de `ITSM_DB_TRUST_SERVER_CERTIFICATE=true` (SQL Server local) e liberação no firewall (Azure SQL)
- [ ] Ao publicar no Azure, cadastrar as variáveis `ITSM_DB_*` nas *Application settings* (a senha pelo portal)

## Observações do ambiente (laboratório)

- O computador do laboratório tem **Node 25**. O host avisa `Incompatible Node.js version v25`, mas funciona. Se aparecer erro estranho, use o Node 22 LTS. No Azure, publique com `--runtime-version 22`
- Não há identidade git configurada na máquina. Faça commit com `git -c user.name="..." -c user.email="..." commit ...` para não gravar a identidade de um colega na configuração global
- Parar o terminal do `npm start` ou do `npm run azurite` nem sempre encerra o `func.exe` e o `node` do Azurite. Se as portas 7071 ou 10000–10002 ficarem ocupadas, encerre esses processos
