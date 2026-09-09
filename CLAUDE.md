# CLAUDE.md

Contexto do projeto para sessões futuras do Claude Code.

## O que é este repositório

Trabalho da disciplina TAPRA (2026), da Univille. Equipe: João Vitor Rosera (`joaorosera`, dono do repositório) e Vinicius Werner (`lvwerner`, colaborador com permissão de escrita).

Repositório público: https://github.com/joaorosera/TAPRA-2026

## Requisitos do trabalho (enunciado do professor)

1. Projeto no GitHub chamado `TAPRA-2026`, público, compartilhado com os integrantes da equipe.
2. `README.md` com os integrantes da equipe.
3. Azure Functions com gatilhos timer trigger e http trigger:
   - Timer trigger que imprime apenas um log no terminal.
   - HTTP trigger que recebe um parâmetro via URL (GET) e imprime esse parâmetro na tela.
   - Timer trigger que faz uma chamada HTTP para outra Azure Function, e essa function retorna a informação passada mais algum texto para identificar.

## Como os requisitos foram atendidos

| Requisito | Arquivo | Function |
| --- | --- | --- |
| Timer que só loga | `src/functions/timerLog.js` | `timerLog`, NCRONTAB `0 */1 * * * *` |
| HTTP que imprime parâmetro da URL | `src/functions/httpParametro.js` | `httpParametro`, `GET /api/parametro?nome=Valor` |
| Function que devolve a informação + texto identificador | `src/functions/httpEco.js` | `httpEco`, `GET /api/eco?mensagem=Texto` |
| Timer que chama outra function por HTTP | `src/functions/timerChamaHttp.js` | `timerChamaHttp`, NCRONTAB `0 */2 * * * *` |

## Stack e decisões

- Azure Functions v4 com o **modelo de programação Node.js v4** (registro via `app.timer()` / `app.http()` em `src/functions/*.js`; não existem pastas com `function.json`).
- `package.json` aponta `"main": "src/functions/*.js"` — é assim que o host descobre as functions.
- `azure-functions-core-tools` e `azurite` estão em `devDependencies`, então `npx func` e `npm run azurite` funcionam sem instalação global.
- A URL que o `timerChamaHttp` chama vem da configuração `ECO_FUNCTION_URL`, para o mesmo código rodar local e publicado.
- `local.settings.json` é ignorado pelo git; o modelo versionado é `local.settings.json.example`.

## Como rodar e validar localmente

Os timer triggers exigem storage, então o Azurite precisa estar de pé antes do host.

```
Terminal 1: npm run azurite
Terminal 2: npm start
```

Endpoints: `http://localhost:7071/api/parametro?nome=Joao` e `http://localhost:7071/api/eco?mensagem=teste`.

Validação já executada com sucesso — logs reais observados no terminal do `func start`:

```
[timerLog] TAPRA-2026 | execucao agendada em 2026-09-09T22:55:34.295Z
[httpParametro] parametro recebido: Vinicius
[timerChamaHttp] chamando a function httpEco: http://localhost:7071/api/eco?mensagem=...
[timerChamaHttp] resposta (HTTP 200): [httpEco - TAPRA-2026] Recebi a seguinte mensagem: "chamada do timerChamaHttp em ..."
```

## Particularidades do ambiente desta máquina (Windows)

Anotado porque custou tempo descobrir:

- **Azure CLI (`az`) está quebrado**: falha com `ImportError: DLL load failed while importing win32file`. A instalação em `C:\Program Files\Microsoft SDKs\Azure\CLI2` está incompleta (falta o `win32file.pyd`); pôr `pywin32_system32` no PATH não resolve. Sem direitos de administrador não dá para reinstalar. **Alternativa usada: módulo `Az` do PowerShell** (`Install-Module Az.Accounts, Az.Resources, Az.Storage, Az.Websites, Az.Functions -Scope CurrentUser`) com `Connect-AzAccount -UseDeviceAuthentication`.
- **GitHub CLI não estava instalado** e o MSI via winget falha com 1603 (sem admin). Foi usada a versão portátil em `%LOCALAPPDATA%\gh-cli\bin\gh.exe` — adicione essa pasta ao `PATH` da sessão antes de usar `gh`.
- **Node.js v25** está instalado e o host do Functions avisa `Incompatible Node.js version v25`. Funciona para desenvolvimento, mas o suportado pelo Azure Functions v4 é Node 20 ou 22.
- A conta Azure é **"Azure for Students"** no tenant **Univille**.

## Estado atual

- Repositório criado, público, com o código enviado na branch `main`.
- Convite de colaborador enviado para `lvwerner` (permissão de escrita) — depende de ele aceitar.
- Validação local concluída com as quatro functions funcionando.
- Publicação no Azure: em andamento nesta sessão (Resource Group, Storage Account e Function App via módulo `Az`).
