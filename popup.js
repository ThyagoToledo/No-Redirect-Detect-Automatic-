// ============================================================
// No Redirect (Detect Automatic) — Popup Script
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const statusBar = document.getElementById('statusBar');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const shieldIcon = document.getElementById('shieldIcon');
    const subtitle = document.querySelector('.subtitle');
    const sessionCount = document.getElementById('sessionCount');
    const totalCount = document.getElementById('totalCount');
    const recentList = document.getElementById('recentList');
    const clearBtn = document.getElementById('clearBtn');

    // ---- Carregar estado atual ----
    function loadStatus() {
        chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
            if (!response) return;

            toggleSwitch.checked = response.enabled;
            updateUI(response.enabled);

            animateNumber(sessionCount, response.sessionBlocked);
            animateNumber(totalCount, response.totalBlocked);

            renderRecentBlocks(response.recentBlocks || []);
        });
    }

    // ---- Toggle ----
    toggleSwitch.addEventListener('change', () => {
        chrome.runtime.sendMessage({ action: 'toggle' }, (response) => {
            if (response) {
                updateUI(response.enabled);
            }
        });
    });

    // ---- Limpar histórico ----
    clearBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'clearHistory' }, () => {
            recentList.innerHTML = `
        <div class="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <p>Histórico limpo</p>
        </div>
      `;
        });
    });

    // ---- Atualizar visual ----
    function updateUI(enabled) {
        if (enabled) {
            statusBar.classList.remove('disabled');
            shieldIcon.classList.remove('disabled');
            subtitle.classList.remove('disabled');
            statusText.textContent = 'Proteção ativa';
            subtitle.textContent = 'Detect Automatic';
        } else {
            statusBar.classList.add('disabled');
            shieldIcon.classList.add('disabled');
            subtitle.classList.add('disabled');
            statusText.textContent = 'Proteção desativada';
            subtitle.textContent = 'Desativado';
        }
    }

    // ---- Animação de números ----
    function animateNumber(element, target) {
        const current = parseInt(element.textContent) || 0;
        if (current === target) return;

        const duration = 600;
        const start = performance.now();

        function step(timestamp) {
            const progress = Math.min((timestamp - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const value = Math.round(current + (target - current) * eased);
            element.textContent = value;

            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }

        requestAnimationFrame(step);
    }

    // ---- Renderizar bloqueios recentes ----
    function renderRecentBlocks(blocks) {
        if (!blocks || blocks.length === 0) {
            recentList.innerHTML = `
        <div class="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <p>Nenhum redirect bloqueado ainda</p>
        </div>
      `;
            return;
        }

        recentList.innerHTML = '';

        // Mostrar apenas os 15 mais recentes
        const recent = blocks.slice(0, 15);

        recent.forEach((block) => {
            const item = document.createElement('div');
            item.className = 'block-item';

            const typeInfo = getTypeInfo(block.type);
            const timeAgo = getTimeAgo(block.timestamp);

            item.innerHTML = `
        <div class="block-type-icon ${typeInfo.class}">${typeInfo.icon}</div>
        <div class="block-details">
          <div class="block-url" title="${escapeHtml(block.to || block.from)}">${escapeHtml(block.to || block.from)}</div>
          <div class="block-meta">
            <span class="block-type-label">${typeInfo.label}</span>
            <span>${timeAgo}</span>
          </div>
        </div>
      `;

            recentList.appendChild(item);
        });
    }

    function getTypeInfo(type) {
        const types = {
            'network_rule': { icon: '🌐', class: 'network', label: 'Rede' },
            'server_redirect': { icon: '↩️', class: 'redirect', label: 'Servidor' },
            'client_redirect': { icon: '↩️', class: 'redirect', label: 'Cliente' },
            'popup_redirect': { icon: '🚫', class: 'popup', label: 'Popup' },
            'location.assign': { icon: '🛡️', class: 'script', label: 'JS Location' },
            'location.replace': { icon: '🛡️', class: 'script', label: 'JS Replace' },
            'window.open': { icon: '🚫', class: 'popup', label: 'Window.open' },
            'meta_refresh': { icon: '🔄', class: 'redirect', label: 'Meta Refresh' },
            'history.pushState': { icon: '📜', class: 'script', label: 'History API' },
            'history.replaceState': { icon: '📜', class: 'script', label: 'History API' },
            'link_redirect': { icon: '🔗', class: 'redirect', label: 'Link' },
            'setTimeout_redirect': { icon: '⏱️', class: 'script', label: 'Timer' },
            'js_redirect': { icon: '🛡️', class: 'script', label: 'JavaScript' },
        };
        return types[type] || { icon: '❓', class: 'network', label: type || '?' };
    }

    function getTimeAgo(timestamp) {
        if (!timestamp) return '';
        const diff = Date.now() - new Date(timestamp).getTime();
        const seconds = Math.floor(diff / 1000);

        if (seconds < 5) return 'agora';
        if (seconds < 60) return `${seconds}s atrás`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}min atrás`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h atrás`;
        return `${Math.floor(hours / 24)}d atrás`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- Receber atualizações em tempo real ----
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'blockRecorded' && message.data) {
            animateNumber(sessionCount, message.data.sessionBlocked);
            animateNumber(totalCount, message.data.totalBlocked);

            // Adicionar novo item ao topo da lista
            if (message.data.entry) {
                // Remover empty state se existir
                const emptyState = recentList.querySelector('.empty-state');
                if (emptyState) emptyState.remove();

                const typeInfo = getTypeInfo(message.data.entry.type);
                const item = document.createElement('div');
                item.className = 'block-item';
                item.innerHTML = `
          <div class="block-type-icon ${typeInfo.class}">${typeInfo.icon}</div>
          <div class="block-details">
            <div class="block-url" title="${escapeHtml(message.data.entry.to || message.data.entry.from)}">${escapeHtml(message.data.entry.to || message.data.entry.from)}</div>
            <div class="block-meta">
              <span class="block-type-label">${typeInfo.label}</span>
              <span>agora</span>
            </div>
          </div>
        `;
                recentList.insertBefore(item, recentList.firstChild);

                // Limitar itens visíveis
                while (recentList.children.length > 15) {
                    recentList.removeChild(recentList.lastChild);
                }
            }
        }
    });

    // ---- Iniciar ----
    loadStatus();
});
