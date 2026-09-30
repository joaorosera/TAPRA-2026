# TAPRA-2026

Projeto da disciplina TAPRA (2026) com Azure Functions usando os gatilhos **Timer Trigger** e **HTTP Trigger**, incluindo a captura de dados de uma tabela do banco de origem (SQL Server, banco `itsm`).

## Integrantes da equipe

- João Vitor Rosera
- Vinicius Werner ([@lvwerner](https://github.com/lvwerner))

## Tecnologias

- Azure Functions v4 (modelo de programação Node.js v4)
- Node.js / JavaScript
- Azure Functions Core Tools v4
- Azurite (emulador de storage, necessário para os timer triggers rodarem localmente)
- SQL Server / Azure SQL (banco de origem `itsm`), acessado com o driver [`mssql`](https://www.npmjs.com/package/mssql)

## Arquitetura

![Arquitetura do projeto TAPRA-2026](docs/arquitetura.png)

O desenho foi feito no draw.io e está em [`docs/arquitetura.drawio`](docs/arquitetura.drawio). Para editar, abra o arquivo em [app.diagrams.net](https://app.diagrams.net) ou na extensão *Draw.io Integration* do VS Code e, depois de salvar, exporte de novo para `docs/arquitetura.png` (*File > Export as > PNG*).

- A **Function App** hospeda todas as functions do projeto (Node.js, Azure Functions v4).
- Os **HTTP triggers** atendem chamadas do navegador e da própria `timerChamaHttp`.
- A **`timerCapturaChamados`** abre uma conexão com o **banco de origem `itsm`** (SQL Server / Azure SQL) e captura os dados da tabela `chamado`.
- Endereços e credenciais ficam em **variáveis de ambiente**: *Application settings* no Azure e `local.settings.json` no ambiente local, arquivo que não vai para o Git.
- O **Azure Storage** (Azurite no ambiente local) guarda o estado dos timers, e o **Application Insights** recebe os logs das execuções.

## Functions do projeto

| Function | Gatilho | O que faz |
| --- | --- | --- |
| `timerLog` | Timer (a cada 1 minuto) | Imprime apenas um log no terminal a cada execução. |
| `httpParametro` | HTTP GET `/api/parametro?nome=Valor` | Recebe um parâmetro pela URL e imprime esse parâmetro na tela. |
| `httpEco` | HTTP GET `/api/eco?mensagem=Texto` | Retorna a informação recebida acrescida de um texto de identificação. |
| `timerChamaHttp` | Timer (a cada 2 minutos) | Faz uma chamada HTTP para a function `httpEco` e imprime a resposta no log. |
| `timerCapturaChamados` | Timer (a cada 5 minutos) | Abre uma conexão com o banco de origem `itsm` e captura os dados da tabela `chamado`. |

### 1. `timerLog` — Timer Trigger

Arquivo: [`src/functions/timerLog.js`](src/functions/timerLog.js)

Executa a cada 1 minuto (NCRONTAB `0 */1 * * * *`) e escreve uma linha no terminal:

```
[timerLog] TAPRA-2026 | execucao agendada em 2026-09-09T18:30:00.012Z
```

### 2. `httpParametro` — HTTP Trigger

Arquivo: [`src/functions/httpParametro.js`](src/functions/httpParametro.js)

Recebe o parâmetro `nome` pela query string do método GET, imprime no log e devolve na tela:

```
GET http://localhost:7071/api/parametro?nome=Joao
-> Parametro recebido: Joao
```

Se o parâmetro não for informado, retorna HTTP 400 com uma mensagem explicando o formato esperado.

### 3. `httpEco` — HTTP Trigger (chamada pelo timer)

Arquivo: [`src/functions/httpEco.js`](src/functions/httpEco.js)

Recebe o parâmetro `mensagem` e retorna a informação recebida junto de um texto de identificação:

```
GET http://localhost:7071/api/eco?mensagem=teste
-> [httpEco - TAPRA-2026] Recebi a seguinte mensagem: "teste"
```

### 4. `timerChamaHttp` — Timer Trigger que chama outra Azure Function

Arquivo: [`src/functions/timerChamaHttp.js`](src/functions/timerChamaHttp.js)

A cada 2 minutos monta uma mensagem, faz uma chamada HTTP para a function `httpEco` e imprime a resposta no terminal:

```
[timerChamaHttp] chamando a function httpEco: http://localhost:7071/api/eco?mensagem=...
[timerChamaHttp] resposta (HTTP 200): [httpEco - TAPRA-2026] Recebi a seguinte mensagem: "chamada do timerChamaHttp em 2026-09-09T18:32:00.008Z"
```

A URL de destino vem da configuração `ECO_FUNCTION_URL`, para que o mesmo código funcione localmente e publicado no Azure.

### 5. `timerCapturaChamados` — Timer Trigger que captura os dados de uma tabela do banco de origem

Arquivo: [`src/functions/timerCapturaChamados.js`](src/functions/timerCapturaChamados.js)

A cada 5 minutos (NCRONTAB `0 */5 * * * *`) a function:

1. monta a configuração da conexão a partir das variáveis de ambiente `ITSM_DB_*` (nenhuma credencial fica no código);
2. abre uma conexão com o banco de origem `itsm` (SQL Server / Azure SQL);
3. executa `SELECT * FROM chamado`, tabela escolhida pela equipe por ser a tabela central do ITSM;
4. imprime no log a quantidade de registros capturados, as colunas e os primeiros registros;
5. encerra a conexão.

```
[timerCapturaChamados] abrindo conexao com o banco itsm
[timerCapturaChamados] <N> registro(s) capturado(s) da tabela chamado
[timerCapturaChamados] colunas: id_chamado, titulo, ...
[timerCapturaChamados] primeiros registros: [{"id_chamado":1, ...}]
[timerCapturaChamados] conexao encerrada
```

Se faltar alguma variável obrigatória, a execução registra um erro com o **nome** das variáveis ausentes (nunca os valores) e não tenta conectar.

## Como executar localmente

Pré-requisitos: [Node.js 20 ou 22 LTS](https://nodejs.org) (versões suportadas pelo Azure Functions v4) e [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) — o Core Tools e o Azurite já vêm como `devDependencies` deste projeto.

```bash
git clone https://github.com/<usuario>/TAPRA-2026.git
cd TAPRA-2026
npm install
cp local.settings.json.example local.settings.json   # no Windows: copy local.settings.json.example local.settings.json
```

Edite o `local.settings.json` e preencha as variáveis `ITSM_DB_*` com os dados de acesso ao banco `itsm`. Esse arquivo está no `.gitignore` e **não deve ser commitado**. Somente o modelo `local.settings.json.example`, com valores de exemplo, fica no repositório.

Os timer triggers precisam de uma conta de storage. Para desenvolvimento local, suba o emulador Azurite em um terminal:

```bash
npm run azurite
```

Em outro terminal, inicie as functions:

```bash
npm start
```

O host sobe em `http://localhost:7071` e expõe:

- `http://localhost:7071/api/parametro?nome=Joao`
- `http://localhost:7071/api/eco?mensagem=teste`

Os timers passam a escrever no terminal automaticamente conforme o agendamento. Para executar a captura na hora, sem esperar os 5 minutos, chame o endpoint de administração do host local:

```bash
curl -X POST http://localhost:7071/admin/functions/timerCapturaChamados -H "Content-Type: application/json" -d "{}"
```

## Configurações

| Configuração | Descrição | Valor local |
| --- | --- | --- |
| `AzureWebJobsStorage` | Conta de storage usada pelo host e pelos timer triggers | `UseDevelopmentStorage=true` (Azurite) |
| `FUNCTIONS_WORKER_RUNTIME` | Runtime da function app | `node` |
| `ECO_FUNCTION_URL` | URL da function `httpEco` chamada pelo `timerChamaHttp` | `http://localhost:7071/api/eco` |
| `ITSM_DB_SERVER` | Servidor do banco de origem | `<servidor>.database.windows.net` |
| `ITSM_DB_PORT` | Porta do SQL Server (opcional) | `1433` |
| `ITSM_DB_NAME` | Nome do banco de origem | `itsm` |
| `ITSM_DB_USER` | Usuário do banco | definido pela equipe |
| `ITSM_DB_PASSWORD` | Senha do banco | definida pela equipe |
| `ITSM_DB_ENCRYPT` | Usa conexão criptografada (TLS). Mantenha `true` no Azure SQL (opcional) | `true` |
| `ITSM_DB_TRUST_SERVER_CERTIFICATE` | Aceita certificado autoassinado. Use `true` só em SQL Server local (opcional) | `false` |

Ao publicar no Azure, defina `ECO_FUNCTION_URL` nas *Application settings* da Function App apontando para `https://<nome-da-function-app>.azurewebsites.net/api/eco`, e cadastre também as variáveis `ITSM_DB_*`.

> **Credenciais:** usuário e senha do banco existem apenas no `local.settings.json` (ignorado pelo Git) e nas *Application settings* da Function App. Nunca coloque esses valores no código, no `local.settings.json.example` ou no README.

## Publicação no Azure

```bash
az login
az functionapp create \
  --resource-group <grupo> \
  --consumption-plan-location brazilsouth \
  --runtime node \
  --runtime-version 22 \
  --functions-version 4 \
  --name <nome-da-function-app> \
  --storage-account <conta-de-storage>

az functionapp config appsettings set \
  --name <nome-da-function-app> \
  --resource-group <grupo> \
  --settings ECO_FUNCTION_URL=https://<nome-da-function-app>.azurewebsites.net/api/eco \
             ITSM_DB_SERVER=<servidor>.database.windows.net \
             ITSM_DB_NAME=itsm \
             ITSM_DB_USER=<usuario>

func azure functionapp publish <nome-da-function-app>
```

Cadastre a `ITSM_DB_PASSWORD` pelo portal (*Function App > Settings > Environment variables*) para que a senha não fique no histórico do terminal. Se o banco for um Azure SQL, libere o acesso da Function App no firewall do servidor (*Networking > Allow Azure services and resources to access this server*).
