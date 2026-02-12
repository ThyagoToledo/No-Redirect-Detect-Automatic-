// ============================================================
// No Redirect (Detect Automatic) — Main World Content Script
// Camada 3: Interceptação JavaScript no contexto da página
// Este script roda no MAIN world para poder sobrescrever
// window.location, window.open, etc. da própria página.
// ============================================================

(function () {
    'use strict';

    const currentOrigin = window.location.origin;

    // Comunicar bloqueios para o content script (isolated world)
    function notifyBlocked(to, type) {
        window.postMessage({
            source: 'no-redirect-extension',
            action: 'blocked',
            from: window.location.href,
            to: to,
            type: type
        }, '*');
    }

    function isCrossOrigin(url) {
        try {
            const target = new URL(url, window.location.href);
            return target.origin !== currentOrigin;
        } catch {
            return false;
        }
    }

    function isSuspiciousRedirect(url) {
        if (!url) return false;
        try {
            const target = new URL(url, window.location.href);
            // Cross-origin é suspeito
            if (target.origin !== currentOrigin) return true;
            // URLs com padrões de redirect
            const suspiciousPatterns = [
                /redirect/i, /redir/i, /clicktrack/i, /go\.php/i,
                /track/i, /out\./i, /leave/i, /exit/i, /away/i
            ];
            return suspiciousPatterns.some(p => p.test(target.href));
        } catch {
            return false;
        }
    }

    // ---- 1. Interceptar location.assign() e location.replace() ----
    const originalAssign = window.location.assign.bind(window.location);
    const originalReplace = window.location.replace.bind(window.location);

    try {
        Object.defineProperty(window.location, 'assign', {
            value: function (url) {
                if (isSuspiciousRedirect(url)) {
                    notifyBlocked(url, 'location.assign');
                    console.log('[No Redirect] Bloqueado location.assign():', url);
                    return;
                }
                return originalAssign(url);
            },
            configurable: true,
            writable: true
        });
    } catch (e) {
        console.log('[No Redirect] Não foi possível interceptar location.assign (read-only)');
    }

    try {
        Object.defineProperty(window.location, 'replace', {
            value: function (url) {
                if (isSuspiciousRedirect(url)) {
                    notifyBlocked(url, 'location.replace');
                    console.log('[No Redirect] Bloqueado location.replace():', url);
                    return;
                }
                return originalReplace(url);
            },
            configurable: true,
            writable: true
        });
    } catch (e) {
        console.log('[No Redirect] Não foi possível interceptar location.replace (read-only)');
    }

    // ---- 2. Interceptar window.open() ----
    const originalWindowOpen = window.open;

    window.open = function (url, target, features) {
        // Permitir about:blank e URLs sem valor
        if (!url || url === 'about:blank') {
            return originalWindowOpen.call(window, url, target, features);
        }

        if (isCrossOrigin(url)) {
            notifyBlocked(url, 'window.open');
            console.log('[No Redirect] Bloqueado window.open():', url);
            // Retornar um objeto window-like falso para não quebrar scripts
            return {
                closed: true,
                close: function () { },
                focus: function () { },
                blur: function () { },
                postMessage: function () { },
                document: { write: function () { }, close: function () { } }
            };
        }

        return originalWindowOpen.call(window, url, target, features);
    };

    // ---- 3. Interceptar History API (pushState/replaceState) ----
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function (state, title, url) {
        if (!url) {
            return originalPushState(state, title, url);
        }
        if (isCrossOrigin(url.toString())) {
            notifyBlocked(url.toString(), 'history.pushState');
            console.log('[No Redirect] Bloqueado history.pushState cross-origin:', url);
            return;
        }
        return originalPushState(state, title, url);
    };

    history.replaceState = function (state, title, url) {
        if (!url) {
            return originalReplaceState(state, title, url);
        }
        if (isCrossOrigin(url.toString())) {
            notifyBlocked(url.toString(), 'history.replaceState');
            console.log('[No Redirect] Bloqueado history.replaceState cross-origin:', url);
            return;
        }
        return originalReplaceState(state, title, url);
    };

    // ---- 4. Interceptar setTimeout com strings de eval contendo redirects ----
    const originalSetTimeout = window.setTimeout;

    window.setTimeout = function (callback, delay, ...args) {
        if (typeof callback === 'string' && /location\s*[.=]|window\.open|navigate/i.test(callback)) {
            console.log('[No Redirect] Bloqueado setTimeout com redirect:', callback.substring(0, 100));
            notifyBlocked('(setTimeout eval)', 'setTimeout_redirect');
            return 0;
        }
        return originalSetTimeout.call(window, callback, delay, ...args);
    };

    // ---- 5. Ouvir mensagens de controle do isolated world ----
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data && event.data.source === 'no-redirect-extension-control') {
            // Futuro: receber estado ativo/desativado
        }
    });

    console.log('[No Redirect] Main world script ativo ✓');
})();
