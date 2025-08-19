// ==UserScript==
// @name         Wordle Auto-Sync to MCP
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Reads Wordle board and posts guesses/feedback to local MCP bridge
// @author       you
// @match        https://*.nytimes.com/games/wordle/*
// @match        https://wordleunlimited.org/*
// @match        https://www.wordleunlimited.org/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BRIDGE_URL = 'http://127.0.0.1:8787/state';
  const SUGGEST_URL = 'http://127.0.0.1:8787/suggest?limit=10';
  console.log('[wordle-sync] userscript loaded');

  function mapStateToChar(state) {
    // correct|present|absent
    if (state === 'correct') return 'g';
    if (state === 'present') return 'y';
    return 'b';
  }

  function readWordleState() {
    // Try NYTimes shadow DOM first
    const app = document.querySelector('game-app');
    const appRoot = app && app.shadowRoot;
    const guesses = [];
    const feedback = [];

    function readFromRows(getRows, getTiles) {
      const rows = getRows() || [];
      for (const row of rows) {
        const tiles = getTiles(row);
        if (!tiles || tiles.length !== 5) continue;
        const letters = tiles.map(t => t.getAttribute('letter') || t.getAttribute('data-letter') || t.textContent?.trim()?.[0] || '').join('');
        const states = tiles.map(t => t.getAttribute('evaluation') || t.getAttribute('data-state') || t.getAttribute('data-status') || '');
        if (letters.length === 5 && states.every(s => ['correct', 'present', 'absent'].includes(s))) {
          guesses.push(letters.toLowerCase());
          feedback.push(states.map(mapStateToChar).join(''));
        }
      }
    }

    if (appRoot) {
      readFromRows(
        () => appRoot.querySelector('#board')?.querySelectorAll('game-row'),
        (row) => row.shadowRoot ? Array.from(row.shadowRoot.querySelectorAll('game-tile')) : Array.from(row.querySelectorAll('game-tile'))
      );
    } else {
      // Fallback for Wordle Unlimited and other clones (no shadow root)
      readFromRows(
        () => document.querySelectorAll('game-row, .row, [data-row]'),
        (row) => Array.from(row.querySelectorAll('game-tile, .tile, [data-state]'))
      );
    }

    return { guesses, feedback };
  }

  function postState() {
    const state = readWordleState();
    try {
      GM_xmlhttpRequest({
        method: 'POST',
        url: BRIDGE_URL,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(state),
        onload: function () { console.log('[wordle-sync] posted state', state); refreshSuggestions(); },
        onerror: function (e) { console.warn('[wordle-sync] post failed', e); },
      });
    } catch (e) {}
  }

  // Suggestions panel
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'style') Object.assign(el.style, v); else el[k] = v;
      }
    }
    for (const c of children) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  }

  function ensurePanel() {
    let panel = document.getElementById('wordle-suggest-panel');
    if (panel) return panel;
    panel = h('div', { id: 'wordle-suggest-panel', style: {
      position: 'fixed', right: '12px', bottom: '56px', zIndex: 2147483647,
      background: '#111', color: '#eee', borderRadius: '10px', border: '1px solid #333',
      boxShadow: '0 6px 16px rgba(0,0,0,0.35)', padding: '10px', width: '260px',
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial'
    }});
    const header = h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '6px' } },
      h('div', { style: { fontWeight: 700, fontSize: '13px' } }, 'Wordle suggestions'),
      h('div', { style: { flex: 1 } }),
      h('button', { id: 'wordle-suggest-refresh', style: {
        background: '#2a8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
        padding: '4px 8px', fontWeight: 600, fontSize: '12px'
      } }, '↻')
    );
    const list = h('div', { id: 'wordle-suggest-list', style: { display: 'grid', gap: '6px' } });
    panel.append(header, list);
    document.body.appendChild(panel);
    document.getElementById('wordle-suggest-refresh').addEventListener('click', refreshSuggestions);
    return panel;
  }

  function refreshSuggestions() {
    ensurePanel();
    const list = document.getElementById('wordle-suggest-list');
    list.textContent = 'Loading...';
    GM_xmlhttpRequest({
      method: 'GET', url: SUGGEST_URL + '&_=' + Date.now(),
      onload: function (res) {
        try {
          const data = JSON.parse(res.responseText || '{}');
          const items = data.suggestions || [];
          list.innerHTML = '';
          if (!items.length) {
            list.textContent = 'No suggestions yet. Make a guess, sync, then refresh.';
            return;
          }
          for (const item of items) {
            const row = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
              h('div', { style: { fontWeight: 700, fontSize: '14px', letterSpacing: '1px' } }, String(item.word).toUpperCase()),
              h('div', { style: { marginLeft: 'auto', fontSize: '12px', opacity: 0.7 } }, String(Math.round((item.score||0)*10)/10))
            );
            list.appendChild(row);
          }
        } catch (e) {
          list.textContent = 'Parse error';
        }
      },
      onerror: function () {
        list.textContent = 'Cannot reach local solver at 127.0.0.1:8787';
      }
    });
  }

  // Observe changes on the game app to post updates
  const observer = new MutationObserver(() => {
    postState();
  });

  function tryStart() {
    const app = document.querySelector('game-app');
    const appRoot = app && app.shadowRoot;
    if (!appRoot) return false;
    const board = appRoot.querySelector('#board');
    if (!board) return false;
    observer.observe(board, { subtree: true, childList: true, attributes: true });
    // Initial send and fetch suggestions
    postState();
    setTimeout(refreshSuggestions, 300);
    // Add visible button to trigger sync manually
    try {
      if (!document.getElementById('wordle-sync-btn')) {
        const btn = document.createElement('button');
        btn.id = 'wordle-sync-btn';
        btn.textContent = 'Sync Wordle';
        btn.style.position = 'fixed';
        btn.style.bottom = '12px';
        btn.style.right = '12px';
        btn.style.zIndex = '2147483647';
        btn.style.background = '#0a7';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '6px';
        btn.style.padding = '8px 12px';
        btn.style.fontSize = '12px';
        btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
        btn.addEventListener('click', () => {
          postState();
          btn.textContent = 'Synced!';
          setTimeout(() => (btn.textContent = 'Sync Wordle'), 1200);
        });
        document.body.appendChild(btn);
      }
    } catch (e) {}
    return true;
  }

  const readyInterval = setInterval(() => {
    if (tryStart()) clearInterval(readyInterval);
  }, 800);

  // Expose manual trigger for debugging
  window.__wordleSyncPost = postState;
  window.wordleSyncPost = postState;
  try { unsafeWindow.wordleSyncPost = postState; } catch (e) {}
  try { GM_registerMenuCommand('Post Wordle state now', postState); } catch (e) {}
})();


