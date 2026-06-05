# Funcionalidades e Camadas de Protecao

Este documento descreve detalhadamente o funcionamento do sistema de bloqueio de redirecionamentos da extensao, as otimizacoes de performance aplicadas e o historico de versoes do projeto.

---

## Sistema de Protecao em 5 Camadas

A extensao No Redirect (Detect Automatic) implementa barreiras de seguranca em cinco niveis diferentes da navegacao web:

### 1. Camada de Rede (declarativeNetRequest)
- Bloqueia requisicoes de redirecionamento diretamente no nivel de rede, antes mesmo da execucao.
- Filtra padroes de URLs suspeitas, rastreadores e links de anuncios conhecidos.
- Alta eficiencia utilizando a API nativa declarativeNetRequest do Chrome, reduzindo o impacto de processamento.

### 2. Camada de Navegacao (webNavigation e Navigation API)
- **webNavigation**: Monitora eventos de navegacao no nivel do navegador para detectar redirecionamentos gerados pelo servidor ou cliente.
- **Navigation API**: Intercepta tentativas de mudanca de URL via scripts na thread principal (como alteracoes em `location.href`, `assign`, `replace`), permitindo o cancelamento seguro da operacao.

### 3. Camada de Injecao (Main World Protection)
- **Zombie Window Pattern**: Retorna uma referencia de janela (proxy window) vazia e inofensiva para scripts que tentam invocar o metodo `window.open()`, evitando travamento de scripts legitimos.
- **Anti-Tampering**: Protecao contra tecnicas que tentam desativar os interceptadores.
- Interceptacao de execucoes baseadas em strings temporizadas (`setTimeout`).

### 4. Camada de Contencao (Form e Iframe Shield)
- **Iframe Lockdown**: Forca a utilizacao de atributos de sandboxing em iframes, impedindo que frames de terceiros alterem a janela pai ou abram popups sem permissao.
- **Form Hijacking Protection**: Varre formularios e impede envios suspeitos direcionados a dominios externos nao autorizados.

### 5. Camada de Interface (UI Shield)
- **Overlay Buster**: Detecta e remove cortinas invisiveis (overlays) que cobrem a pagina para capturar cliques do usuario (clickjacking) utilizando MutationObservers.
- **Click Forensics**: Analisa eventos de clique para identificar cliques simulados via script (`isTrusted: false`) ou acoes em botoes ocultos.
- **Safe Navigation Guard**: Limpa listeners maliciosos de links de navegacao legitimos (como paginacao de sites de midia), preservando a acao original.
- **Anti-Tab-Under**: Bloqueia tecnicas de alternancia de foco rapido usadas por popups de anuncios.

---

## Otimizacoes de Performance (Smart Performance)

A extensao foi otimizada para manter baixo uso de CPU e memoria mesmo em paginas pesadas:

1. **Processamento em Lote de Mutacoes (MutationObserver)**
   - Agrupa as alteracoes do DOM e as processa a cada 5ms, evitando execucoes sucessivas e reduzindo o uso de CPU entre 70% e 80% durante o carregamento.

2. **Cache de Compilacao Regex**
   - Compila as expressoes regulares de URLs suspeitas apenas uma vez globalmente, poupando processamento por clique.

3. **Leitura Otimizada de Estilos**
   - Evita chamadas pesadas ao metodo `getComputedStyle()`, analisando atributos inline para prevencao de clickjacking sem forcar reflows visuais no navegador.

4. **WeakSet para Elementos Validados**
   - Armazena elementos ja verificados em cache WeakSet com autolimpeza a cada 30 segundos, garantindo coleta de lixo eficiente e economia de memoria.

5. **Prerenderer de Produtos (`product_prerenderer.js`)**
   - Identifica containers de produtos em sites de midia e e-commerce.
   - Aplica skeleton loaders visuais e pre-carrega links proximos em background usando Intersection Observer, tornando o clique instantaneo.

### Resultados de Performance Medidos

| Metrica | Versao Anterior | Versao 1.4.0 (Otimizada) | Melhora |
|---------|-----------------|---------------------------|---------|
| Tempo de Resposta de Clique | 250-500ms | 50-100ms | 70-80% mais rapido |
| Uso de CPU no Carregamento | 45-60% | 15-25% | Reducao de 65-75% |
| Atualizacao de Estatisticas | 600ms | 300ms | 2x mais veloz |
| Vazamento de Memoria | Crescimento continuo | Estavel (autolimpeza) | Resolvido |

---

## Recursos da Interface do Usuario (Popup Interface)

- **Dark Mode Premium**: Design baseado em glassmorphism com transicoes e animacoes suaves.
- **Estatisticas em Tempo Real**: Contador de redirecionamentos bloqueados por sessao e acumulados desde a instalacao.
- **Registro de Atividades**: Historico com os ultimos bloqueios contendo a URL, o tipo da camada e o horario do evento.
- **Controle Rápido**: Interruptor geral de ligar/desligar com feedback visual instantaneo.
- **Badge do Icone**: O icone da extensao exibe um contador numerico atualizado dos bloqueios na aba ativa.

---

## Historico de Versoes

### Versao 1.4.0
- Adicao do MutationObserver em lote, cache de regex e deteccao de estilos otimizada.
- Implementacao do pre-carregamento inteligente de produtos e skeleton loaders.

### Versao 1.3.2
- Aprimoramento da seguranca na captura de eventos de mousedown e mouseup para prevenir ad-hijacking.

### Versao 1.3.1
- Ajuste no Safe Navigation para evitar bloqueio de links de paginacao legitimos.

### Versao 1.3.0
- Separacao arquitetural das camadas de Interface (UI Shield) e Contencao (Form Shield).
- Introducao do detector de cortinas de cliques invisiveis (Overlay Buster).

### Versao 1.2.0
- Substituicao de overrides de funcoes nativas pela interceptacao baseada em Navigation API.
- Adicao do Zombie Window para mitigar scripts maliciosos de window.open().
- Protecao contra submissao forçada de formularios.

### Versao 1.1.0
- Adicao da camada de lockdown de sandboxing em iframes.

### Versao 1.0.0
- Lancamento inicial com protecao em tres camadas e estatisticas locais.
