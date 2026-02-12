// ============================================================
// No Redirect (Detect Automatic) — Background Service Worker
// Camada 2: webNavigation API + Gerenciamento de Estado
// ============================================================

// Estado da extensão
let isEnabled = true;
let sessionBlocked = 0;
const tabOriginalUrls = new Map();
const recentBlocks = [];
const MAX_RECENT_BLOCKS = 50;

// ---- Inicialização ----
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    enabled: true,
    totalBlocked: 0,
    sessionBlocked: 0,
    recentBlocks: []
  });

  // Registrar content_main.js no MAIN world para interceptar JS da página
  try {
    // Remover registro anterior se existir (para atualizações)
    await chrome.scripting.unregisterContentScripts({ ids: ['no-redirect-main-world'] }).catch(() => { });
    await chrome.scripting.registerContentScripts([{
      id: 'no-redirect-main-world',
      matches: ['<all_urls>'],
      js: ['content_main.js'],
      runAt: 'document_start',
      allFrames: true,
      world: 'MAIN'
    }]);
    console.log('[No Redirect] Main world script registrado ✓');
  } catch (e) {
    console.log('[No Redirect] Erro ao registrar main world script:', e.message);
  }

  updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(['enabled']);
  isEnabled = data.enabled !== false;
  sessionBlocked = 0;
  await chrome.storage.local.set({ sessionBlocked: 0 });
  updateBadge();
});

// ---- Badge do ícone ----
function updateBadge() {
  if (isEnabled) {
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
    chrome.action.setBadgeText({ text: sessionBlocked > 0 ? String(sessionBlocked) : 'ON' });
    chrome.action.setTitle({ title: `No Redirect — ATIVO (${sessionBlocked} bloqueados)` });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setTitle({ title: 'No Redirect — DESATIVADO' });
  }
}

// ---- Registro de bloqueios ----
async function recordBlock(tabId, from, to, type) {
  sessionBlocked++;

  const data = await chrome.storage.local.get(['totalBlocked', 'recentBlocks']);
  const totalBlocked = (data.totalBlocked || 0) + 1;

  const blockEntry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    from: truncateUrl(from),
    to: truncateUrl(to),
    type: type,
    tabId: tabId
  };

  const storedRecent = data.recentBlocks || [];
  storedRecent.unshift(blockEntry);
  if (storedRecent.length > MAX_RECENT_BLOCKS) {
    storedRecent.length = MAX_RECENT_BLOCKS;
  }

  await chrome.storage.local.set({
    totalBlocked,
    sessionBlocked,
    recentBlocks: storedRecent
  });

  updateBadge();

  // Notificar popup se estiver aberto
  try {
    chrome.runtime.sendMessage({
      action: 'blockRecorded',
      data: { sessionBlocked, totalBlocked, entry: blockEntry }
    }).catch(() => { });
  } catch (e) { /* popup não está aberto */ }
}

function truncateUrl(url) {
  if (!url) return '(desconhecido)';
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.substring(0, 30) + '...' : u.pathname;
    return u.hostname + path;
  } catch {
    return url.length > 60 ? url.substring(0, 60) + '...' : url;
  }
}

// ---- Camada 2: webNavigation ----

// Guarda a URL original de cada aba quando uma navegação começa
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!isEnabled) return;
  if (details.frameId !== 0) return; // só frame principal

  // Se não temos URL original para esta aba, guardar a atual
  if (!tabOriginalUrls.has(details.tabId)) {
    tabOriginalUrls.set(details.tabId, {
      url: details.url,
      time: Date.now()
    });
  }
});

// Detectar redirects quando a navegação é confirmada
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (!isEnabled) return;
  if (details.frameId !== 0) return;

  const qualifiers = details.transitionQualifiers || [];
  const isRedirect = qualifiers.includes('client_redirect') || qualifiers.includes('server_redirect');

  if (isRedirect) {
    const original = tabOriginalUrls.get(details.tabId);

    if (original && original.url !== details.url) {
      // Verificar se não é uma mesma-origin redirect (navegação interna do site)
      try {
        const origUrl = new URL(original.url);
        const newUrl = new URL(details.url);

        // Se é um redirect cross-origin, bloquear
        if (origUrl.hostname !== newUrl.hostname) {
          const redirectType = qualifiers.includes('server_redirect') ? 'server_redirect' : 'client_redirect';

          // Registrar o bloqueio
          await recordBlock(details.tabId, details.url, original.url, redirectType);

          // Voltar para a URL original
          try {
            await chrome.tabs.update(details.tabId, { url: original.url });
          } catch (e) {
            console.log('[No Redirect] Não conseguiu reverter:', e.message);
          }

          return;
        }
      } catch (e) {
        // URL inválida — ignorar
      }
    }
  }

  // Atualizar URL original após navegação normal
  tabOriginalUrls.set(details.tabId, {
    url: details.url,
    time: Date.now()
  });
});

// Detectar novas abas abertas como redirect (popups)
chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
  if (!isEnabled) return;

  // Se uma nova aba foi aberta a partir de outra, potencialmente é um popup redirect
  const sourceUrl = tabOriginalUrls.get(details.sourceTabId);

  if (sourceUrl) {
    try {
      const source = new URL(sourceUrl.url);
      const target = new URL(details.url);

      // Se a nova aba vai para um domínio diferente — possível redirect popup
      if (source.hostname !== target.hostname && details.url !== 'about:blank') {
        await recordBlock(details.sourceTabId, sourceUrl.url, details.url, 'popup_redirect');

        // Fechar a aba de popup
        try {
          await chrome.tabs.remove(details.tabId);
        } catch (e) {
          console.log('[No Redirect] Não conseguiu fechar popup:', e.message);
        }
      }
    } catch (e) { /* URLs inválidas */ }
  }
});

// Limpar dados quando aba é fechada
chrome.tabs.onRemoved.addListener((tabId) => {
  tabOriginalUrls.delete(tabId);
});

// Limpar URLs antigas periodicamente (a cada 5 min)
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutos
  for (const [tabId, data] of tabOriginalUrls.entries()) {
    if (now - data.time > maxAge) {
      tabOriginalUrls.delete(tabId);
    }
  }
}, 5 * 60 * 1000);

// ---- Mensagens do popup e content script ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle') {
    isEnabled = !isEnabled;
    chrome.storage.local.set({ enabled: isEnabled });
    updateBadge();

    // Habilitar/desabilitar regras declarativeNetRequest
    toggleDeclarativeRules(isEnabled);

    sendResponse({ enabled: isEnabled });
    return true;
  }

  if (message.action === 'getStatus') {
    chrome.storage.local.get(['totalBlocked', 'sessionBlocked', 'recentBlocks'], (data) => {
      sendResponse({
        enabled: isEnabled,
        totalBlocked: data.totalBlocked || 0,
        sessionBlocked: sessionBlocked,
        recentBlocks: data.recentBlocks || []
      });
    });
    return true;
  }

  if (message.action === 'contentScriptBlocked') {
    // Bloqueio reportado pelo content script (Camada 3)
    recordBlock(
      sender.tab ? sender.tab.id : -1,
      message.from || '(página atual)',
      message.to || '(desconhecido)',
      message.type || 'js_redirect'
    );
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'clearHistory') {
    chrome.storage.local.set({ recentBlocks: [] });
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'isEnabled') {
    sendResponse({ enabled: isEnabled });
    return true;
  }
});

// ---- Controle de regras declarativeNetRequest ----
async function toggleDeclarativeRules(enable) {
  try {
    const rulesetIds = ['redirect_blocker_rules'];
    if (enable) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: rulesetIds
      });
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: rulesetIds
      });
    }
  } catch (e) {
    console.log('[No Redirect] Erro ao atualizar rulesets:', e.message);
  }
}

// ---- Feedback declarativeNetRequest (Camada 1 log) ----
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    if (!isEnabled) return;

    const request = info.request;
    recordBlock(
      request.tabId,
      request.initiator || '(rede)',
      request.url,
      'network_rule'
    );
  });
}

console.log('[No Redirect] Service worker iniciado ✓');
