// ============================================================
// No Redirect (Detect Automatic) — Content Script (Isolated World)
// Camada 3: Bridge entre o MAIN world script e o background
// ============================================================

(function () {
    'use strict';

    let isEnabled = false;

    // OTIMIZAÇÃO: Cache de padrões suspeitos compilados uma vez
    const suspiciousPatterns = [
        /redirect/i, /redir/i, /clicktrack/i, /go\.php/i,
        /track/i, /out\./i, /leave/i, /exit/i, /away/i,
        /ad\./i, /ads\./i, /banner/i
    ];

    // Verificar se a extensão está ativa
    try {
        chrome.runtime.sendMessage({ action: 'isEnabled' }, (response) => {
            if (response) {
                isEnabled = response.enabled;
            }
        });
    } catch (e) { /* extensão pode não estar respondendo ainda */ }

    // Ouvir mudanças de estado do background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'stateChanged') {
            isEnabled = message.enabled;
        }
    });

    // ---- Receber mensagens do MAIN world script via postMessage ----
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== 'no-redirect-extension') return;
        if (!isEnabled) return;

        if (event.data.action === 'blocked') {
            // Encaminhar o bloqueio para o background
            try {
                chrome.runtime.sendMessage({
                    action: 'contentScriptBlocked',
                    from: event.data.from || window.location.href,
                    to: event.data.to || '(desconhecido)',
                    type: event.data.type || 'js_redirect'
                });
            } catch (e) { /* fallback silencioso */ }
        }
    });

    // ---- Observar <meta http-equiv="refresh"> ----
    function isSuspiciousRedirect(url) {
        if (!url) return false;
        try {
            const target = new URL(url, window.location.href);
            if (target.origin !== window.location.origin) return true;
            // OTIMIZAÇÃO: Usar cache de padrões
            return suspiciousPatterns.some(p => p.test(target.href));
        } catch {
            return false;
        }
    }

    function checkMetaRefresh(node) {
        if (!isEnabled) return;

        if (node.nodeName === 'META') {
            const httpEquiv = node.getAttribute('http-equiv');
            const content = node.getAttribute('content');

            if (httpEquiv && httpEquiv.toLowerCase() === 'refresh' && content) {
                const match = content.match(/url\s*=\s*['"]?(.+?)['"]?\s*$/i);
                if (match && match[1]) {
                    const redirectUrl = match[1];
                    if (isSuspiciousRedirect(redirectUrl)) {
                        node.remove();
                        try {
                            chrome.runtime.sendMessage({
                                action: 'contentScriptBlocked',
                                from: window.location.href,
                                to: redirectUrl,
                                type: 'meta_refresh'
                            });
                        } catch (e) { /* fallback silencioso */ }
                        console.log('[No Redirect] Bloqueado <meta refresh>:', redirectUrl);
                    }
                }
            }
        }
    }

    // ---- [Camada 4] Iframe Lockdown: Forçar sandbox em iframes de terceiros ----
    function enforceSandbox(iframe) {
        if (!isEnabled) return;

        try {
            // Se já tem sandbox, garantir que não tem allow-popups ou allow-top-navigation
            // Mas para garantir segurança máxima em sites de anime/filmes, vamos forçar um set restrito
            // a menos que seja mesma origem exata.

            const src = iframe.src;
            let isSameOrigin = false;
            try {
                if (src) {
                    const url = new URL(src, window.location.href);
                    isSameOrigin = url.origin === window.location.origin;
                } else {
                    // sem src geralmente é same-origin (about:blank) ou srcdoc
                    isSameOrigin = true;
                }
            } catch (e) { isSameOrigin = false; }

            if (!isSameOrigin) {
                // Bloqueio agressivo para iframes de terceiros (anúncios)
                // Removemos 'allow-popups', 'allow-popups-to-escape-sandbox', 'allow-top-navigation'
                const safeSandbox = 'allow-scripts allow-forms allow-same-origin';

                if (iframe.getAttribute('sandbox') !== safeSandbox) {
                    iframe.setAttribute('sandbox', safeSandbox);
                }
            }
        } catch (e) { /* ignore */ }
    }

    // ---- Observar <meta http-equiv="refresh"> E Iframes ----
    function checkNode(node) {
        if (!isEnabled) return;
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // Verificação de Meta Refresh
        if (node.nodeName === 'META') {
            checkMetaRefresh(node);
        }

        // Verificação de Iframe
        if (node.nodeName === 'IFRAME') {
            enforceSandbox(node);
        }

        // OTIMIZAÇÃO: Apenas checar diretos filhos, não subtree completa
        if (node.children && node.children.length > 0) {
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                if (child.nodeName === 'META') checkMetaRefresh(child);
                if (child.nodeName === 'IFRAME') enforceSandbox(child);
                if (child.nodeName === 'DIV') checkOverlay(child);
            }
        }
    }

    // ---- [Camada 5] UI Shield: Overlay Cleanup (Mutation Observer) ----
    // OTIMIZAÇÃO: Cache de elementos já checados para evitar re-processing
    const checkedOverlays = new WeakSet();
    
    function checkOverlay(node) {
        if (!isEnabled || node.nodeName !== 'DIV') return;
        if (checkedOverlays.has(node)) return; // Já foi checado
        checkedOverlays.add(node);

        // Otimização: só checar se tiver style inline (muito comum nesses overlays)
        // ou IDs suspeitos
        if (!node.hasAttribute('style') && !node.id) return;

        try {
            // Checagem rápida por estilo inline antes de computar estilo (caro)
            const inlineStyle = node.getAttribute('style') || '';
            if (inlineStyle.includes('fixed') || inlineStyle.includes('absolute')) {
                // Agora sim, checar propriedades computadas se necessário, ou confiar no inline
                // O elemento do usuário tinha z-index 2147483647
                if (inlineStyle.includes('2147483647') || (node.style.zIndex && parseInt(node.style.zIndex) > 100000)) {
                    // Verificar se cobre a tela?
                    // Se tem z-index máximo e é fixed/absolute, é 99% lixo de ad ou overlay impeditivo
                    console.log('[No Redirect] Overlay agressivo detectado e removido (Mutation):', node);
                    node.remove();
                }
            }
        } catch (e) { }
    }

    // MutationObserver para detectar meta tags e iframes inseridos dinamicamente
    // OTIMIZAÇÃO: Acumular mutações em batch para processar de uma vez
    let mutationTimeout = null;
    let accumulatedMutations = [];
    
    const observer = new MutationObserver((mutations) => {
        if (!isEnabled) return;
        
        // Acumular mutações
        accumulatedMutations = accumulatedMutations.concat(mutations);
        
        // Se já tem timeout agendado, não agenda novamente
        if (mutationTimeout) return;
        
        // Agendar processamento em batch
        mutationTimeout = setTimeout(() => {
            accumulatedMutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    checkNode(node);
                });
            });
            accumulatedMutations = [];
            mutationTimeout = null;
        }, 5); // Processar em batch a cada 5ms
    });

    if (document.documentElement) {
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }

    // OTIMIZAÇÃO: Limpar cache de overlays checados a cada 30 segundos para evitar memory leak
    setInterval(() => {
        if (checkedOverlays && typeof checkedOverlays.clear === 'function') {
            checkedOverlays.clear();
        }
    }, 30000);

    // Verificar meta refresh e iframes que já existem
    document.addEventListener('DOMContentLoaded', () => {
        if (!isEnabled) return;
        const metas = document.querySelectorAll('meta[http-equiv="refresh"]');
        metas.forEach(checkMetaRefresh);

        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(enforceSandbox);
    });

    // ---- [Camada 5] Clean Click Enforcer (Impositor de Clique Limpo) ----
    // OTIMIZAÇÃO: Combinar mousedown/mouseup em um único listener + less checks
    window.addEventListener('click', (e) => {
        if (!isEnabled) return;

        const target = e.target.closest('a');
        if (!target) return;

        const href = target.getAttribute('href');
        if (!href) return;

        // Lógica para identificar "Navegação Segura" (Paginação, Próximo Episódio)
        const isPagination = target.classList.contains('page-link') ||
            /page-link|pagination|next|prev/i.test(target.className);

        const isInternalNav = href.startsWith('/') ||
            (!href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#'));

        // Se for link seguro de navegação
        if ((isPagination || isInternalNav) && target.target !== '_blank') {
            // Ignorar links falsos
            if (href === '#' || href.toLowerCase() === 'about:blank') return;

            console.log('[No Redirect] Clean Click -> Navegação segura:', href);

            // Mata listeners do site (Ads que usam mousedown/up)
            e.stopImmediatePropagation();
            e.stopPropagation();

            // NÃO impedimos o default do click (navegação)
            return;
        }
    }, true); // TRUE = Capture Phase

    // ---- [Camada 4] Bloqueio avançado de cliques (Captura) ----
    // OTIMIZAÇÃO: Usar apenas getAttribute em vez de getComputedStyle (operação cara)
    window.addEventListener('click', (e) => {
        if (!isEnabled) return;

        // Verificar se clicou em um elemento "estranho" (ex: div flutuante transparente)
        // Heurística OTIMIZADA: Apenas check style inline em vez de getComputedStyle
        try {
            const inlineStyle = e.target.getAttribute('style') || '';
            const zIndexMatch = inlineStyle.match(/z-index\s*:\s*(\d+)/i);
            const isHighZ = zIndexMatch && parseInt(zIndexMatch[1]) > 100000;

            if (isHighZ && (inlineStyle.includes('absolute') || inlineStyle.includes('fixed'))) {
                const isTransparent = inlineStyle.includes('opacity: 0') || 
                                     inlineStyle.includes('visibility: hidden') ||
                                     inlineStyle.includes('rgba(0, 0, 0, 0)') ||
                                     inlineStyle.includes('transparent');

                if (isTransparent) {
                    console.log('[No Redirect] Overlay invisível detectado');
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.target.parentNode) e.target.remove();
                    return;
                }
            }
        } catch (err) { }

        // Verificar se é um clique fake/simulado por script
        if (!e.isTrusted) {
            // Cliques simulados em links para fora OU vazios (about:blank) são suspeitos
            const target = e.target.closest('a');
            if (target) {
                const h = target.getAttribute('href');
                // Adscore usa href="about:blank" ou href="" e clica via script
                if (!h || h === '#' || h === 'about:blank' || h.trim() === '') {
                    console.log('[No Redirect] Clique simulado em link vazio/blank detectado e bloqueado');
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }

                if (target.href) {
                    console.log('[No Redirect] Clique simulado detectado e bloqueado:', target.href);
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }
            }
        }

        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Se abre em nova aba/janela (_blank) OU se não tem target (padrão) mas site força window.open
        // sites de anime costumam usar <a href="#" onclick="window.open(...)">
        if (href === '#' || href.startsWith('javascript:')) {
            // Deixa content_main lidar com window.open
            return;
        }

        if (link.target === '_blank') {
            try {
                const url = new URL(href, window.location.href);
                // Se for para outro domínio, aplicar verificação extra
                if (url.origin !== window.location.origin) {
                    // Verificar padrões de ad server conhecidos
                    if (isSuspiciousRedirect(href)) {
                        e.preventDefault();
                        e.stopPropagation();

                        try {
                            chrome.runtime.sendMessage({
                                action: 'contentScriptBlocked',
                                from: window.location.href,
                                to: href,
                                type: 'popup_click_intercept'
                            });
                        } catch (err) { }
                        console.log('[No Redirect] Clique em popup suspeito bloqueado:', href);
                        return;
                    }
                }
            } catch (e) { }
        }

        // Verificação original de parâmetros de URL (anti-hijacking)
        try {
            const url = new URL(href, window.location.href);
            const params = url.searchParams;

            for (const [key, value] of params.entries()) {
                if (/^(redirect|redir|url|goto|next|return|continue|dest|destination|target|link|out)$/i.test(key)) {
                    try {
                        const embeddedUrl = new URL(value);
                        if (embeddedUrl.origin !== window.location.origin) {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = value;
                            try {
                                chrome.runtime.sendMessage({
                                    action: 'contentScriptBlocked',
                                    from: window.location.href,
                                    to: href,
                                    type: 'link_redirect'
                                });
                            } catch (err) { /* fallback silencioso */ }
                            //console.log('[No Redirect] Link redirect interceptado → indo direto para:', value);
                            return;
                        }
                    } catch { /* valor não é URL válida */ }
                }
            }
        } catch { /* href não é URL válida */ }
    }, true); // UseCapture = true é crucial aqui

    // ---- [Camada 4] Bloqueio de Form Hijacking ----
    document.addEventListener('submit', (e) => {
        if (!isEnabled) return;

        const form = e.target;
        const action = form.getAttribute('action');

        if (action) {
            try {
                const url = new URL(action, window.location.href);
                if (url.origin !== window.location.origin) {
                    if (isSuspiciousRedirect(action)) {
                        e.preventDefault();
                        e.stopPropagation();
                        chrome.runtime.sendMessage({
                            action: 'contentScriptBlocked',
                            from: window.location.href,
                            to: action,
                            type: 'form_submit'
                        });
                        console.log('[No Redirect] Form submit bloqueado:', action);
                    }
                }
            } catch (e) { }
        }
    }, true);

    console.log('[No Redirect] Content script ativo (Camadas 3, 4 & 5) ✓');
})();
