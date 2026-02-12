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

    // MutationObserver para detectar meta tags inseridas dinamicamente
    const observer = new MutationObserver((mutations) => {
        if (!isEnabled) return;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    checkMetaRefresh(node);

                    if (node.querySelectorAll) {
                        const metas = node.querySelectorAll('meta[http-equiv="refresh"]');
                        metas.forEach(checkMetaRefresh);
                    }
                }
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

    // Verificar meta refresh que já existe
    document.addEventListener('DOMContentLoaded', () => {
        if (!isEnabled) return;
        const metas = document.querySelectorAll('meta[http-equiv="refresh"]');
        metas.forEach(checkMetaRefresh);
    });

    // ---- Bloquear click hijacking em links ----
    document.addEventListener('click', (e) => {
        if (!isEnabled) return;

        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

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
                            console.log('[No Redirect] Link redirect interceptado → indo direto para:', value);
                            return;
                        }
                    } catch { /* valor não é URL válida */ }
                }
            }
        } catch { /* href não é URL válida */ }
    }, true);

    console.log('[No Redirect] Content script ativo ✓');
})();
