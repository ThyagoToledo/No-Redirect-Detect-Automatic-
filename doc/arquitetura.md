# Arquitetura Tecnica e Customizacao

Este documento descreve as especificidades arquiteturais da extensao, a compatibilidade com o Manifest V3, a politica de privacidade adotada e o guia de customizacao dos seletores de pre-carregamento.

---

## Conformidade com Manifest V3

A extensao No Redirect (Detect Automatic) adota o padrao moderno Manifest V3, utilizando os seguintes recursos recomendados pelas diretrizes da Chrome Web Store:

- **Service Workers**: Substitui a pagina de background persistente (Manifest V2) por um service worker nao persistente (`background.js`), ativado apenas quando eventos de rede ou navegacao sao disparados.
- **declarativeNetRequest**: Define as regras de rede no arquivo `rules.json`. O bloqueio ocorre de forma nativa e segura pelo proprio navegador, eliminando gargalos de performance e reduzindo o consumo de recursos da extensao.
- **Interacoes Declarativas**: Uso de APIs modernas e declarativas para registrar scripts e alterar o estado do popup sem manter scripts desnecessarios em execucao.

---

## Isolamento de Contexto (Isolated vs Main World)

Para contornar as limitacoes de escopo impostas pelo Google Chrome, a extensao executa scripts em dois contextos separados:

- **Mundo Isolado (`content.js`)**:
  - Tem acesso total ao DOM da pagina para inspecionar overlays, interceptar cliques e tratar sandboxes de iframes.
  - Nao compartilha o contexto de variaveis e funcoes JavaScript com a pagina, garantindo que scripts maliciosos nao possam alterar ou desabilitar o script de protecao.
  - Comunica-se com o service worker (`background.js`) via APIs de mensagem do Chrome.

- **Mundo da Pagina (`content_main.js` / Main World)**:
  - Injetado diretamente no contexto JavaScript principal do site.
  - Intercepta metodos nativos de redirecionamento (como alteracoes de `window.location`, funcoes do tipo `window.open`, `location.replace`, etc.) antes que scripts maliciosos os chamem.
  - Reporta bloqueios de redirecionamento ao `content.js` atraves de eventos de mensagem do objeto window (`window.postMessage`).

---

## Permissoes Requeridas

A extensao solicita as seguintes permissoes no arquivo `manifest.json`:

* `declarativeNetRequest`: Bloqueio de rede baseado em regras pre-compiladas.
* `declarativeNetRequestFeedback`: Fornece informacoes de depuracao de regras em ambiente de desenvolvimento.
* `webNavigation`: Permite inspecionar a arvore de navegacao e capturar redirecionamentos de servidor e cliente.
* `storage`: Persistencia de configuracoes gerais e contadores de bloqueio locais.
* `activeTab`: Permite interagir com a aba em foco para aplicar protecoes imediatas.
* `tabs`: Acesso controlado ao estado das abas para atualizar badges e logs de eventos.
* `scripting`: Registro dinamico de scripts no contexto do Main World.
* `<all_urls>`: Garante que os escopos de protecao e os scripts sejam aplicados em todas as paginas visitadas pelo usuario.

---

## Diretrizes de Privacidade

Para garantir a total seguranca e privacidade do usuario:
- **Zero Captura de Dados**: Nao ha transmissao, envio ou captura de qualquer informacao de navegacao, historico ou dados de login para servidores externos.
- **Persistencia Local**: Todas as estatisticas de bloqueio sao armazenadas estritamente na maquina do usuario utilizando a API local `chrome.storage.local`.
- **Funcionamento Offline**: A extensao opera de forma 100% autônoma e offline, sem realizar chamadas de rede externas ou carregar scripts de terceiros.

---

## Guia de Customizacao do Prerenderer de Produtos

O arquivo `product_prerenderer.js` contem seletores padroes para identificar containers de produtos de sites comuns de e-commerce e entretenimento. Se um site customizado nao estiver pre-carregando os links corretamente, voce pode adicionar as regras de selecao no array de configuracao:

```javascript
// Localizacao: product_prerenderer.js (linhas 25-30)
const productSelectors = [
    '[class*="product"]',
    '[class*="anime-card"]',
    '[class*="your-custom-pattern"]', // <-- Adicione a classe ou seletor CSS do seu site aqui
];
```

### Exemplos comuns de seletores:
- `[class*="item-card"]`: Seleciona cards de itens genericos.
- `[data-product]`: Seleciona elementos baseados em atributos customizados.
- `article[class*="card"]`: Cards estruturados em elementos do tipo article.
