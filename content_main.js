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
    // Nota: Em browsers modernos, location muitas vezes não é configurável.
    // Tentamos fazer o override apenas se possível.
    const originalAssign = window.location.assign.bind(window.location);
    const originalReplace = window.location.replace.bind(window.location);

    try {
        if (Object.getOwnPropertyDescriptor(window.location, 'assign').configurable) {
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
        }
    } catch (e) {
        // Silenciar erro em sites que bloqueiam override
    }

    try {
        if (Object.getOwnPropertyDescriptor(window.location, 'replace').configurable) {
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
        }
    } catch (e) {
        // Silenciar erro
    }

    // ---- 2. Interceptar window.open() (Bloqueio Total de Popups de Terceiros) ----
    const originalWindowOpen = window.open;

    window.open = function (url, target, features) {
        // Normalizar URL (muitas vezes é vazia ou about:blank)
        const urlString = (url || '').toString();
        const isBlank = !urlString || urlString === 'about:blank';

        // Se for Cross-Origin ou Suspeito, bloquear imediatamente
        if (!isBlank && (isSuspiciousRedirect(urlString) || isCrossOrigin(urlString))) {
            notifyBlocked(urlString, 'window.open');
            console.log('[No Redirect] Bloqueado window.open() explícito:', urlString);
            return null; // Retorna null para quebrar scripts que esperam a janela
        }

        // Se for about:blank, é PERIGOSO.
        // Sites usam window.open('') e depois fazem win.location = 'ad.com'
        // Só permitimos se tiver certeza que é usuário (difícil saber 100%)
        // Estrategia: Retornar um Proxy que bloqueia navegação futura da nova janela

        if (isBlank) {
            console.log('[No Redirect] window.open(blank) detectado. Monitorando...');

            // Se tiver features de popup (width, height), 99% chance de ser ad
            if (features) {
                console.log('[No Redirect] Bloqueado window.open(blank) com features de popup');
                notifyBlocked('about:blank (popup)', 'window.open_blank');
                return null;
            }

            // Se não tem features, pode ser um clique legítimo target=_blank
            // Vamos deixar abrir, mas vamos tentar controlar a referência retornada
            const newWin = originalWindowOpen.call(window, url, target, features);

            if (!newWin) return null;

            // Tentar proteger a nova janela de redirecionamento via script da janela pai
            try {
                // Monitor simples: se o script tentar mudar location da nova janela
                // Isso não funciona 100% pq cross-origin bloqueia acesso, mas same-origin (blank) permite
                // Vamos tentar interceptar a atribuição de location nesse objeto window retornado?
                // Infelizmente o objeto retornado é um WindowProxy, difícil de alterar.

                // Melhor abordagem: Verificar quem chamou.
                // Mas não temos acesso ao stack trace confiável aqui.

                // FALLBACK: Deixar abrir. O WebNavigation (Camada 2) vai pegar se
                // essa nova aba (que nasceu em blank) tentar navegar para outro domínio.

            } catch (e) { }

            return newWin;
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
