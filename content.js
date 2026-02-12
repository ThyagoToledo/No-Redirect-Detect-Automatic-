// ============================================================
// No Redirect (Detect Automatic) — Content Script (Isolated World)
// Camada 3: Bridge entre o MAIN world script e o background
// ============================================================

(function () {
    'use strict';

    let isEnabled = true;

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
            const suspiciousPatterns = [
                /redirect/i, /redir/i, /clicktrack/i, /go\.php/i,
                /track/i, /out\./i, /leave/i, /exit/i, /away/i
            ];
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

        // Descer na árvore se necessário (tome cuidado com performance)
        if (node.querySelectorAll) {
            const metas = node.querySelectorAll('meta[http-equiv="refresh"]');
            metas.forEach(checkMetaRefresh);

            const iframes = node.querySelectorAll('iframe');
            iframes.forEach(enforceSandbox);
        }
    }

    // MutationObserver para detectar meta tags e iframes inseridos dinamicamente
    const observer = new MutationObserver((mutations) => {
        if (!isEnabled) return;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                checkNode(node);
            }
        }
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

    // Verificar meta refresh e iframes que já existem
    document.addEventListener('DOMContentLoaded', () => {
        if (!isEnabled) return;
        const metas = document.querySelectorAll('meta[http-equiv="refresh"]');
        metas.forEach(checkMetaRefresh);

        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(enforceSandbox);
    });

    // ---- [Camada 4] Bloqueio avançado de cliques (Captura) ----
    // Usamos capture=true para pegar o evento antes de qualquer script da página
    window.addEventListener('click', (e) => {
        if (!isEnabled) return;

        // 1. Detectar cliques em overlays invisíveis
        // Se o alvo não for um link, botão ou input, e ocupar a tela toda... suspeito.
        if (e.target === document.body || e.target === document.documentElement) {
            // Clique no body é normal, mas sites de anime usam um div transparente por cima de tudo
            // Vamos checar se o usuário clicou em algo que parece "vazio" mas tem listeners/scripts
            // Difícil saber se tem listener sem DevTools protocol. 
            // Mas podemos bloquear window.open se originado daqui (já feito no content_main)
        }

        // Verificar se clicou em um elemento "estranho" (ex: div flutuante transparente)
        // Heurística: div absoluto/fixo, z-index alto, opacidade 0 ou quase 0
        try {
            const style = window.getComputedStyle(e.target);
            if (style.position === 'absolute' || style.position === 'fixed') {
                if (style.opacity < 0.1 || style.visibility === 'hidden') {
                    console.log('[No Redirect] Clique em overlay invisível detectado');
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                // Outro caso: div vazio cobrindo tela
                if (e.target.tagName === 'DIV' &&
                    e.target.childNodes.length === 0 &&
                    parseInt(style.width) > window.innerWidth * 0.8 &&
                    parseInt(style.height) > window.innerHeight * 0.8) {

                    console.log('[No Redirect] Clique em overlay gigante vazio detectado');
                    e.preventDefault();
                    e.stopPropagation();
                    // Tentar remover o overlay
                    e.target.remove();
                    return;
                }
            }
        } catch (err) { }

        // Verificar se é um clique fake/simulado por script
        if (!e.isTrusted) {
            // Cliques simulados em links para fora são suspeitos
            const target = e.target.closest('a');
            if (target && target.href) {
                console.log('[No Redirect] Clique simulado detectado e bloqueado:', target.href);
                e.stopPropagation();
                e.preventDefault();
                return;
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

    console.log('[No Redirect] Content script ativo (Camadas 3 & 4) ✓');
})();
