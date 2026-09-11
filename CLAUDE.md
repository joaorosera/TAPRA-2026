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

- **Azure CLI (`az`) não é opção**: numa sessão anterior estava quebrado (`ImportError: DLL load failed while importing win32file`, instalação incompleta em `C:\Program Files\Microsoft SDKs\Azure\CLI2`, sem admin para reinstalar); em 2026-09-11 nem estava mais no PATH. `azd` também não está instalado. **Caminho usado: módulo `Az` do Windows PowerShell 5.1.**
- Em 2026-09-11 o módulo `Az` e o login salvo tinham sumido, e tudo precisou ser refeito. Antes de instalar é preciso o provedor NuGet:
  ```powershell
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Scope CurrentUser -Force
  Install-Module Az.Accounts, Az.Storage, Az.Functions -Scope CurrentUser -Repository PSGallery -Force -AllowClobber
  Connect-AzAccount -UseDeviceAuthentication -Subscription 574b5eab-8380-4d55-b2bb-70666c58cd5b
  ```
  Esses três módulos bastam; o que faltar dá para fazer com `Invoke-AzRestMethod` (vem no `Az.Accounts`). Rodando o `Connect-AzAccount` em segundo plano com a saída num arquivo, o código do device login aparece nesse arquivo.
- O login do usuário **na extensão Azure do VS Code não serve** para scripts; é outra sessão de credenciais.
- **GitHub CLI não estava instalado** e o MSI via winget falha com 1603 (sem admin). Foi usada a versão portátil em `%LOCALAPPDATA%\gh-cli\bin\gh.exe` — adicione essa pasta ao `PATH` da sessão antes de usar `gh`.
- **Node.js v25** está instalado e o host do Functions avisa `Incompatible Node.js version v25`. Funciona para desenvolvimento, mas o suportado pelo Azure Functions v4 é Node 20 ou 22.
- A conta Azure é **"Azure for Students"** no tenant **Univille**.

## Estado atual

- Repositório criado, público, com o código enviado na branch `main`.
- Convite de colaborador enviado para `lvwerner` (permissão de escrita) — depende de ele aceitar.
- Validação local concluída com as quatro functions funcionando.
- Deploy no Azure em **Central US** (`func-tapra-2026-jvr-cus`) **feito e verificado em 2026-09-11**:
  - as 4 functions aparecem indexadas;
  - os dois endpoints HTTP respondem 200;
  - o Application Insights mostra `timerLog` a cada minuto e `timerChamaHttp` chamando a `httpEco` publicada com resposta HTTP 200.
- Antes disso a app estava em Brazil South (`func-tapra-2026-jvr`), onde os 404 foram corrigidos e verificados. Depois ela foi recriada em Central US para gastar menos crédito.
- `README.md` ganhou a seção "Publicado no Azure" com as URLs públicas de Central US. A mudança foi enviada para a `main` em 2026-09-11.
- **A pasta `Downloads\TAPRA-2026-main` é um zip baixado do GitHub, não um clone git.** Para mudar o repositório: clonar numa pasta temporária, copiar os arquivos, conferir o `git diff` e fazer commit/push por lá. O `gh` está logado como `joaorosera`, e o `git` usa o Git Credential Manager.

## Azure — recursos já criados

Conta usada: `joao.rosera@univille.br` · Assinatura: `Azure for Students` (`574b5eab-8380-4d55-b2bb-70666c58cd5b`).

| Recurso | Nome |
| --- | --- |
Região: **Central US** (`centralus`). Em 2026-09-11 o usuário pediu para sair de Brazil South porque lá o consumo é mais caro.

| Recurso | Nome |
| --- | --- |
| Resource Group | `rg-tapra-2026-cus` (`centralus`) |
| Storage Account | `sttapra2026jvrcus` |
| Function App | `func-tapra-2026-jvr-cus` (Linux, Consumption, Node 22, Functions v4, plano `CentralUSLinuxDynamicPlan`) |
| Application Insights | `func-tapra-2026-jvr-cus` (workspace gerenciado no grupo `ai_func-tapra-2026-jvr-cus_..._managed`) |
| Host | `https://func-tapra-2026-jvr-cus.azurewebsites.net` |

App settings já configuradas:

- `ECO_FUNCTION_URL` = `https://func-tapra-2026-jvr-cus.azurewebsites.net/api/eco`
- `WEBSITE_RUN_FROM_PACKAGE` = URL SAS do pacote no blob (container `deployments`, blob `tapra-2026-20260911142534.zip`, SAS válida até ~2027-09-11)

Regiões que a policy da assinatura permite: `chilecentral`, `southafricanorth`, `mexicocentral`, `centralus`, `brazilsouth`. Não dá para mudar a região de uma Function App existente; é preciso recriar. Os nomes são globais e os antigos ainda existiam, então os recursos novos foram criados antes e ganharam o sufixo `-cus`. Assim a troca não deixou a app fora do ar.

**Recursos de Brazil South: apagados em 2026-09-11** a pedido do usuário. Foi removido o grupo `rg-tapra-2026` inteiro (`func-tapra-2026-jvr`, `BrazilSouthLinuxDynamicPlan`, `sttapra2026jvr` e o App Insights), e o grupo gerenciado `ai_func-tapra-2026-jvr_..._managed` foi removido junto. A URL `func-tapra-2026-jvr.azurewebsites.net` não existe mais.
- O classificador de permissões do Claude Code **nega exclusões irreversíveis** (DELETE de resource group) enquanto o usuário não pede isso explicitamente. Com o pedido dele, o `Invoke-AzRestMethod -Method DELETE` no resource group passou.

**Não mexer:** o grupo `RG-TAPRA-20262-ROSERA-WERNER` (Central US) tem a app `funcapp-tapra-ROSERA-WERNER`. Foi criada pelo usuário no portal em 2026-09-02 para outro exercício: Python 3.13, Flex Consumption, parada, 13 `timer_trigger_teste*`. Não faz parte deste projeto.

## Como verificar o que está publicado

1. Testar os endpoints publicados (pode levar 1-2 min de cold start na primeira chamada):

```powershell
Invoke-WebRequest "https://func-tapra-2026-jvr-cus.azurewebsites.net/api/parametro?nome=Joao" -UseBasicParsing | Select-Object -Expand Content
Invoke-WebRequest "https://func-tapra-2026-jvr-cus.azurewebsites.net/api/eco?mensagem=teste" -UseBasicParsing | Select-Object -Expand Content
```

2. Conferir os timers rodando no Azure pelo portal: Function App → **Log stream**, ou Application Insights → **Logs** (`traces | where message contains "timerLog" or message contains "timerChamaHttp"`). O `timerLog` roda a cada 1 min e o `timerChamaHttp` a cada 2 min.
3. Se os endpoints derem 404 com a raiz do host respondendo 200, a app subiu sem nenhuma function. Olhar o **conteúdo do zip** (caminhos com `\`, ver abaixo) antes de só reiniciar. Reiniciar não resolveu da primeira vez. Para diagnosticar:
   - listar as functions indexadas: `Invoke-AzRestMethod -Method GET -Path "<site>/functions?api-version=2023-12-01"`;
   - ver o estado do host: `/admin/host/status` com a master key obtida via `POST <site>/host/default/listkeys`.

### Como refazer o deploy depois de mudar o código

Kudu zip deploy (`Publish-AzWebApp`) **não funciona** neste tipo de plano — retorna `Deployment failed with status code NotFound`. O caminho que funciona é pacote no blob + `WEBSITE_RUN_FROM_PACKAGE`:

1. Copiar `host.json`, `package.json`, `package-lock.json` e `src/` para uma pasta temporária e rodar `npm install --omit=dev` lá.
2. Zipar o **conteúdo** da pasta (não a pasta) com caminhos usando `/`. **Não use `Compress-Archive` no Windows PowerShell 5.1**: ele grava as entradas com `\` (`src\functions\httpEco.js`), o Linux enxerga isso como um arquivo só na raiz, o `"main": "src/functions/*.js"` não encontra nada e a app sobe com zero functions (todo endpoint dá 404). Foi exatamente o que aconteceu no primeiro deploy. Use a API .NET:
   ```powershell
   Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
   $zip = [IO.Compression.ZipFile]::Open("tapra.zip", 'Create')
   foreach ($f in (Get-ChildItem -LiteralPath $pasta -Recurse -File)) {
     $rel = $f.FullName.Substring($pasta.Length + 1).Replace([char]92, [char]47)
     [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel, 'Optimal') | Out-Null
   }
   $zip.Dispose()
   ```
3. Subir o zip com `Set-AzStorageBlobContent` no container `deployments` do storage `sttapra2026jvrcus`.
4. Gerar SAS com `New-AzStorageBlobSASToken -Permission r -ExpiryTime (Get-Date).AddYears(1) -FullUri`. Sem `-ExpiryTime` a SAS vale só 1 hora e a app perde o pacote no próximo cold start. Depois apontar `WEBSITE_RUN_FROM_PACKAGE` para ela com `Update-AzFunctionAppSetting`.
5. `Restart-AzFunctionApp`.
6. **Sincronizar os triggers** (sem isso, no plano Consumption, o Azure não enxerga os timers e eles param quando a app hiberna):
   ```powershell
   Invoke-AzRestMethod -Method POST -Path "/subscriptions/574b5eab-8380-4d55-b2bb-70666c58cd5b/resourceGroups/rg-tapra-2026-cus/providers/Microsoft.Web/sites/func-tapra-2026-jvr-cus/syncfunctiontriggers?api-version=2023-12-01"
   ```
   Tem que voltar `{"status":"success"}`, e depois disso a lista `.../functions` mostra as 4 functions.

### Armadilhas do módulo Az nesta máquina

- **Sempre** definir a cultura antes de usar cmdlets do `Az.Functions`, senão `New-AzFunctionApp` quebra com `"Cadeia de caracteres não foi reconhecida como DateTime válido"`:
  ```powershell
  [System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::new('en-US')
  ```
- `Invoke-AzResourceAction ... -Action syncfunctiontriggers` falhou com `O inicializador de tipo de 'ApiVersionCache' acionou uma exceção`. **`Invoke-AzRestMethod -Method POST` no mesmo endpoint funciona** (passo 6 acima). `Restart-AzFunctionApp` sozinho não substitui a sincronização.
- Para ler os logs dos timers sem instalar mais módulos: pegar o `AppId` do componente `func-tapra-2026-jvr-cus` (`Microsoft.Insights/components`, grupo `rg-tapra-2026-cus`) via `Invoke-AzRestMethod` e fazer POST em `https://api.applicationinsights.io/v1/apps/<AppId>/query` com o token de `Get-AzAccessToken -ResourceUrl https://api.applicationinsights.io`.
- Em teoria o login do `Connect-AzAccount` fica salvo no perfil do usuário, mas em 2026-09-11 ele tinha sumido junto com o módulo. Se `Get-AzContext` não existir ou vier vazio, refazer a instalação e o login (ver "Particularidades do ambiente").
- A proteção de comandos do Claude Code bloqueia `Remove-Item` quando a mesma linha de comando tem `'\'` (por exemplo `.Replace('\', '/')`). Use `[char]92` / `[char]47` e pastas temporárias com timestamp em vez de apagar.
