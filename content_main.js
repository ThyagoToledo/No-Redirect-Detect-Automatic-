// ============================================================
// No Redirect (Detect Automatic) — Main World Content Script
// Camada 3 & 4: Interceptação JavaScript (Architecture V2 - Total Shield)
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
                /track/i, /out\./i, /leave/i, /exit/i, /away/i,
                /ad\./i, /ads\./i, /banner/i
            ];
            return suspiciousPatterns.some(p => p.test(target.href));
        } catch {
            return false;
        }
    }

    // ---- 1. Interceptação Robusta via Navigation API (Chrome 102+) ----
    // Substitui e supera os hacks antigos de location.assign/replace
    if (window.navigation) {
        window.navigation.addEventListener('navigate', (event) => {
            // Ignorar navegações initiate por download ou same-document (âncoras)
            if (event.downloadRequest || event.hashChange || event.formData) return;

            const url = event.destination.url;

            // Verificação de segurança
            if (isSuspiciousRedirect(url)) {
                event.preventDefault(); // O "Cancel" oficial da navegação
                notifyBlocked(url, 'navigationAPI');
                console.log('[No Redirect] Bloqueado via Navigation API:', url);
            }
        });
        console.log('[No Redirect] Navigation API Interceptor ativo ✓');
    } else {
        console.log('[No Redirect] Navigation API não suportada. Fallback para legacy hooks.');
        // Fallback legado (apenas se necessário, mas Chrome moderno tem Navigation API)
    }

    // ---- 2. "Zombie Window" Pattern para window.open ----
    // Corrige o crash de scripts que tentam acessar a janela retornada

    const originalWindowOpen = window.open;

    function createZombieWindow() {
        // Criar um Proxy que aceita tudo mas não faz nada
        // Isso engana o script malicioso achando que a janela abriu
        const zombieHandler = {
            get: function (target, prop) {
                if (prop === 'closed') return false; // "Ainda aberta"
                if (prop === 'location') {
                    // Retorna um objeto location falso que ignora atribuições
                    return new Proxy({}, {
                        set: function () { return true; }, // Aceita atribuição silenciosamente
                        get: function () { return 'about:blank'; }
                    });
                }
                if (typeof target[prop] === 'function') {
                    return () => { }; // Função vazia para focus(), blur(), close()
                }
                return target[prop] || null;
            },
            set: function () { return true; } // Aceita qualquer atribuição
        };

        return new Proxy({
            closed: false,
            focus: () => { },
            blur: () => { },
            close: () => { },
            postMessage: () => { },
            document: { write: () => { }, close: () => { } }
        }, zombieHandler);
    }

    window.open = function (url, target, features) {
        const urlString = (url || '').toString();
        const isBlank = !urlString || urlString === 'about:blank';

        // Bloqueio Principal
        if (!isBlank && (isSuspiciousRedirect(urlString) || isCrossOrigin(urlString))) {
            notifyBlocked(urlString, 'window.open');
            console.log('[No Redirect] Bloqueado window.open() suspeito:', urlString);
            return createZombieWindow(); // Retorna o zumbi
        }

        // Bloqueio de about:blank
        if (isBlank) {
            // Se tiver features (popup), bloqueamos e retornamos zumbi
            if (features) {
                console.log('[No Redirect] Bloqueado window.open(blank) com features:', features);
                notifyBlocked('about:blank (popup)', 'window.open_blank');
                return createZombieWindow();
            }
            // Se for blank simples (sem features), pode ser legítimo, mas perigoso.
            // Vamos deixar passar mas tentar envolver o retorno num proxy de proteção?
            // Não, se deixarmos passar, o Navigation API deve pegar o redirect subsequente.
            // Mas se for nova janela, o Navigation API daqui não pega. 
            // O webNavigation (background) pegará.
        }

        return originalWindowOpen.call(window, url, target, features);
    };

    // ---- 3. Interceptar History API (Proteção contra manipulação de url) ----
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function (state, title, url) {
        if (url && isCrossOrigin(url.toString())) {
            notifyBlocked(url.toString(), 'history.pushState');
            return;
        }
        return originalPushState(state, title, url);
    };

    history.replaceState = function (state, title, url) {
        if (url && isCrossOrigin(url.toString())) {
            notifyBlocked(url.toString(), 'history.replaceState');
            return;
        }
        return originalReplaceState(state, title, url);
    };

    // ---- 4. Anti-Eval Redirect (setTimeout) ----
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function (callback, delay, ...args) {
        if (typeof callback === 'string' && /location\s*[.=]|window\.open|navigate/i.test(callback)) {
            console.log('[No Redirect] Bloqueado setTimeout eval:', callback.substring(0, 50));
            notifyBlocked('(setTimeout eval)', 'setTimeout_redirect');
            return 0;
        }
        return originalSetTimeout.call(window, callback, delay, ...args);
    };

    console.log('[No Redirect] Main world shield V2 ativo ✓');
})();
