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
- Data Lake: ADLS Gen2, acessado pelo `@azure/storage-blob` (a API de blob funciona em contas com namespace hierárquico). No ambiente local, o Azurite faz o papel do Data Lake
- Pipeline: GitHub Actions em `.github/workflows/function-app.yml`
- Core Tools e Azurite são `devDependencies` e não ficam instalados globalmente. Use `npm start` e `npm run azurite` (ou `npx func`), não `func` direto

```
src/functions/          uma function por arquivo (todo .js aqui é carregado pelo host)
docs/                   desenho da arquitetura (.drawio editável + .png exportado)
.github/workflows/      pipeline do GitHub Actions (valida e publica)
.funcignore             o que fica fora do pacote publicado no Azure
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
| `timerCapturaChamados` | Timer `0 */5 * * * *` | Captura a tabela `chamado` do banco `itsm` e grava um JSON no Data Lake |

## Convenções

- Um arquivo por function, autocontido, no estilo dos existentes: 4 espaços, aspas simples, `const { app } = require('@azure/functions')`
- Nomes de functions em camelCase com prefixo do gatilho (`timer...`, `http...`)
- Toda mensagem de log começa com `[nomeDaFunction]`. Os textos dos logs ficam em português **sem acento** (`conexao`, `nao`)
- Falhas em timers são tratadas com `try/catch` e `context.error(...)`, sem relançar a exceção
- **Credenciais nunca vão para o código, o README ou o `local.settings.json.example`.** Tudo vem de `process.env`, que é o `local.settings.json` no ambiente local e as *Application settings* no Azure. Logs de erro podem citar o **nome** de uma variável, nunca o valor
- Ao criar uma variável de ambiente, atualize juntos o `local.settings.json.example`, a tabela "Configurações" do README e a tabela abaixo. O diagrama só cita os grupos `ITSM_DB_*` e `DATALAKE_*` na linha *Application settings*; atualize essa linha se surgir um grupo novo

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
| `DATALAKE_CONNECTION_STRING` | sim | `UseDevelopmentStorage=true` no local (Azurite). No Azure, a connection string da conta ADLS Gen2 (cadastrar pelo portal) |
| `DATALAKE_CONTAINER` | não | padrão `raw` |

## Comandos

```bash
npm install                      # baixa também o binário do Core Tools (demorado)
npm run azurite                  # terminal 1: emulador de storage, obrigatório para os timers
npm start                        # terminal 2: host em http://localhost:7071

# executa um timer na hora, sem esperar o agendamento
curl -X POST http://localhost:7071/admin/functions/timerCapturaChamados -H "Content-Type: application/json" -d "{}"
```

Não há testes automatizados nem lint configurados. O pipeline só confere a sintaxe e se todos os arquivos de `src/functions/` carregam com as dependências de produção (`npm ci --omit=dev`), o que pega, por exemplo, um pacote usado no código e esquecido no `package.json`.

## Data Lake

- Cada execução da `timerCapturaChamados` grava **um arquivo novo** (nunca sobrescreve) no container `raw`: `raw/itsm/chamado/AAAA/MM/DD/chamado_AAAAMMDDTHHMMSSZ.json`, com a data e a hora da captura em UTC
- O JSON tem `origem`, `tabela`, `capturadoEm`, `quantidade` e `registros` (as linhas como vieram do `mssql`; datas em ISO 8601 UTC)
- A conexão com o banco é fechada **antes** da gravação no Data Lake, para não ficar aberta enquanto o upload acontece
- O container é criado na primeira execução (`createIfNotExists`), então não precisa ser criado à mão

## Banco de origem `itsm`

Tabelas: `analista`, `categoria`, `chamado`, `chamado_sla`, `chamado_status_historico`, `cliente_organizacao`, `csat_avaliacao`, `fila`, `sla`, `solicitante`.

- A equipe escolheu a tabela `chamado` para a captura por ser a tabela central do ITSM
- A consulta usa o nome sem schema (`SELECT * FROM chamado`), então vale para `dbo` ou para o schema padrão do usuário. Se a tabela estiver em outro schema, qualifique o nome
- A conexão é aberta e fechada a cada execução, como pede a atividade

## Diagrama de arquitetura

- A fonte é o `docs/arquitetura.drawio`, e o `docs/arquitetura.png` é a exportação usada no README
- Depois de editar o `.drawio` (em app.diagrams.net ou na extensão *Draw.io Integration* do VS Code), **exporte de novo o PNG** para manter os dois iguais (*File > Export as > PNG*, zoom 200%)
- Segue o modelo passado pelo professor (`DESENHO_PROJETO.png`): camadas **Origem de dados → Ingestão → Armazenamento → Visualização**, com Ingestão e Armazenamento dentro da caixa *Microsoft Azure*, e embaixo a caixa **Desenvolvimento e deploy**. As setas indicam o sentido dos dados e do deploy
- Diferenças em relação ao modelo, feitas de propósito: no modelo, as setas da origem e do Power BI estavam invertidas em relação ao fluxo dos dados, e a da origem saía da borda do Azure, não da Function App. Usamos GitHub e GitHub Actions no lugar de Azure Repos e Azure Pipelines, porque o repositório está no GitHub. O Data Lake é o ADLS Gen2, porque o Gen1 foi descontinuado. Ficou sem a fonte "API", porque o projeto não tem API de origem
- O que ainda não existe aparece com a etiqueta *próxima etapa* e seta tracejada cinza. Ao implementar uma etapa, remova a etiqueta e troque a seta para contínua, no estilo das já implementadas
- Já implementados (seta contínua, sem etiqueta): Function App, Data Lake (camada raw) e pipeline do GitHub Actions. Ainda *próxima etapa*: Azure SQL Database (dados tratados) e Power BI
- A divisão Data Lake (dados brutos de cada captura) e SQL Database (dados tratados) foi uma suposição baseada no modelo. Confirme com o professor antes de implementar a carga no SQL Database
- O `.drawio` foi gerado por um script Python e o PNG foi renderizado no viewer oficial do draw.io (Chrome headless, escala 2x). Editar à mão em app.diagrams.net também funciona, desde que se exporte o PNG de novo

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

### 2026-10-01: Diagrama refeito no modelo da disciplina

- O diagrama anterior (componentes internos da Function App e caixa de variáveis de ambiente) não estava no formato pedido. Foi refeito no modelo em camadas do professor, com o que é do projeto e as diferenças descritas em "Diagrama de arquitetura"
- `docs/arquitetura.drawio` e `docs/arquitetura.png` substituídos. A seção "Arquitetura" do README foi reescrita por camada
- O PNG foi exportado renderizando o `.drawio` no viewer oficial do draw.io (Chrome headless, escala 2x), porque o laboratório não tem o draw.io desktop
- As credenciais do banco ainda não foram passadas pelo professor, então a captura real continua pendente

### 2026-10-01: Gravação no Data Lake e pipeline

- A `timerCapturaChamados` passou a gravar cada captura como JSON na camada raw do Data Lake (ADLS Gen2), com as variáveis novas `DATALAKE_CONNECTION_STRING` e `DATALAKE_CONTAINER`. Adicionado `@azure/storage-blob` às dependências. Detalhes em "Data Lake"
- Criado o pipeline `.github/workflows/function-app.yml` (validar a cada push e PR, publicar a cada push na `main`) e o `.funcignore`. O workflow passou no `actionlint`
- Diagrama: Data Lake e pipeline passaram a implementados, e a linha *Application settings* agora cita `DATALAKE_*`. Azure SQL Database e Power BI continuam como *próxima etapa*
- README: documentação do Data Lake, das variáveis novas, da criação da conta ADLS Gen2 e do pipeline

**Validação feita** (sem as credenciais do professor, com um SQL Server 2022 em Docker e uma tabela `chamado` fictícia de 7 linhas, com acentos e datas)
- Fora do host, com os pacotes reais: variáveis ausentes geram erro com os nomes; a captura completa grava no Azurite um JSON com os 7 registros (acentos, datas em UTC e `null` corretos, `Content-Type` `application/json; charset=utf-8`); com o Data Lake fora do ar, a conexão com o banco já está fechada quando o erro é registrado; com a senha errada, o erro é registrado. A senha não aparece em nenhum log
- No host local (Core Tools 4.14.0 + Azurite): as 5 functions foram registradas, `timerLog`, `timerChamaHttp` e `httpEco` executaram, e a `timerCapturaChamados` disparada pelo endpoint de administração capturou os 7 registros e gravou `raw/itsm/chamado/2026/10/01/chamado_20261001T225211Z.json` (111 ms)
- Passos de validação do pipeline (sintaxe e carga das functions) rodados localmente sem erro

## Pendências

- [ ] O professor vai passar as credenciais do banco `itsm` (em 2026-10-01 ainda não tinha passado). Preencher `ITSM_DB_SERVER`, `ITSM_DB_USER` e `ITSM_DB_PASSWORD` no `local.settings.json`, que fica só na máquina e está ignorado pelo Git
- [ ] Com as credenciais, rodar a captura de verdade e conferir: schema da tabela `chamado`, necessidade de `ITSM_DB_TRUST_SERVER_CERTIFICATE=true` (SQL Server local) e liberação no firewall (Azure SQL)
- [ ] Criar no Azure a conta ADLS Gen2 (storage account com `--hns true`) e a Function App. Os passos estão no README, em "Publicação no Azure"
- [ ] Ao publicar no Azure, cadastrar as variáveis `ITSM_DB_*` e `DATALAKE_*` nas *Application settings* (a senha e a connection string pelo portal)
- [ ] Ligar a publicação do pipeline: habilitar *SCM Basic Auth Publishing Credentials* na Function App, criar o segredo `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` e a variável `AZURE_FUNCTIONAPP_NAME` no GitHub (passo a passo no README, em "Pipeline (GitHub Actions)"). Até lá, o job de publicação fica pulado e o pipeline só valida
- [ ] Próximas etapas do diagrama: carga dos dados tratados no Azure SQL Database e Visualização (Power BI)
- [ ] Confirmar com o professor se a origem de dados deve ter também uma API, como no modelo. Hoje o projeto só lê o banco `itsm`

## Observações do ambiente (laboratório)

- Os computadores do laboratório têm Node fora do LTS (Node 25 em 2026-09-30, **Node 26.4** em 2026-10-01). O host avisa `Incompatible Node.js version`, mas funciona. Se aparecer erro estranho, use o Node 22 LTS. No Azure, publique com `--runtime-version 22`
- O **Azure CLI (`az`) está quebrado** no laboratório: qualquer comando falha com `ImportError: DLL load failed while importing win32file`, no PowerShell e no Git Bash. Para mexer no Azure, use a extensão Azure do VS Code (já conectada) ou o portal
- Não há draw.io desktop instalado. Edite o diagrama em app.diagrams.net
- Não há identidade git configurada na máquina. Faça commit com `git -c user.name="..." -c user.email="..." commit ...` para não gravar a identidade de um colega na configuração global
- Parar o terminal do `npm start` ou do `npm run azurite` nem sempre encerra o `func.exe` e o `node` do Azurite. Se as portas 7071 ou 10000–10002 ficarem ocupadas, encerre esses processos
- O acesso ao registry do npm é **muito lento** no laboratório (até 40 s por requisição em 2026-10-01). O `npm install` padrão falhou com `EIDLETIMEOUT` e deixou o `node_modules` pela metade. Se acontecer, apague o `node_modules` e rode `npm install --fetch-timeout=600000 --fetch-retries=6`. O download do Core Tools (zip de ~590 MB) levou uns 11 minutos
- Com o npm 11, o `npm install` pode terminar antes de o Core Tools acabar de extrair o zip, e o `func.exe` não aparece em `node_modules/azure-functions-core-tools/bin`. Se o zip ainda estiver lá, extraia-o nessa mesma pasta e apague o zip, em vez de baixar de novo
- O **Docker Desktop** está instalado (abra pelo menu Iniciar se o daemon estiver parado). Dá para testar a captura sem as credenciais do professor com um SQL Server 2022 em container (`mcr.microsoft.com/mssql/server:2022-latest`) e uma tabela `chamado` fictícia
