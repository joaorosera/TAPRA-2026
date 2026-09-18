# TAPRA-2026

Projeto da disciplina TAPRA (2026) com Azure Functions usando os gatilhos **Timer Trigger** e **HTTP Trigger**.

## Integrantes da equipe

- João Vitor Rosera
- Vinicius Werner ([@lvwerner](https://github.com/lvwerner))

## Tecnologias

- Azure Functions v4 (modelo de programação Node.js v4)
- Node.js / JavaScript
- Azure Functions Core Tools v4
- Azurite (emulador de storage, necessário para os timer triggers rodarem localmente)

## Functions do projeto

| Function | Gatilho | O que faz |
| --- | --- | --- |
| `timerLog` | Timer (a cada 1 minuto) | Imprime apenas um log no terminal a cada execução. |
| `httpParametro` | HTTP GET `/api/parametro?nome=Valor` | Recebe um parâmetro pela URL e imprime esse parâmetro na tela. |
| `httpEco` | HTTP GET `/api/eco?mensagem=Texto` | Retorna a informação recebida acrescida de um texto de identificação. |
| `timerChamaHttp` | Timer (a cada 2 minutos) | Faz uma chamada HTTP para a function `httpEco` e imprime a resposta no log. |

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

## Como executar localmente

Pré-requisitos: [Node.js 20 ou 22 LTS](https://nodejs.org) (versões suportadas pelo Azure Functions v4) e [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) — o Core Tools e o Azurite já vêm como `devDependencies` deste projeto.

```bash
git clone https://github.com/<usuario>/TAPRA-2026.git
cd TAPRA-2026
npm install
cp local.settings.json.example local.settings.json   # no Windows: copy local.settings.json.example local.settings.json
```

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

Os dois timers passam a escrever no terminal automaticamente conforme o agendamento.

## Configurações

| Configuração | Descrição | Valor local |
| --- | --- | --- |
| `AzureWebJobsStorage` | Conta de storage usada pelo host e pelos timer triggers | `UseDevelopmentStorage=true` (Azurite) |
| `FUNCTIONS_WORKER_RUNTIME` | Runtime da function app | `node` |
| `ECO_FUNCTION_URL` | URL da function `httpEco` chamada pelo `timerChamaHttp` | `http://localhost:7071/api/eco` |

Ao publicar no Azure, defina `ECO_FUNCTION_URL` nas *Application settings* da Function App apontando para `https://<nome-da-function-app>.azurewebsites.net/api/eco`.

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
  --settings ECO_FUNCTION_URL=https://<nome-da-function-app>.azurewebsites.net/api/eco

func azure functionapp publish <nome-da-function-app>
```
