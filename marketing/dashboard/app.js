document.addEventListener('DOMContentLoaded', () => {
  let currentQueue = [];
  let currentOpps = [];
  let currentCatalog = {};

  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.target);
      if (target) target.classList.add('active');
    });
  });

  // Load all initial data
  async function loadData() {
    try {
      const [queueRes, oppsRes, catalogRes, statusRes] = await Promise.all([
        fetch('/api/queue').then(r => r.json()),
        fetch('/api/opportunities').then(r => r.json()),
        fetch('/api/catalog').then(r => r.json()),
        fetch('/api/status').then(r => r.json())
      ]);

      currentQueue = queueRes || [];
      currentOpps = oppsRes || [];
      currentCatalog = catalogRes || {};

      renderStatus(statusRes);
      renderQueue(currentQueue);
      renderOpportunities(currentOpps);
      renderVisuals(currentCatalog);
      renderCatalog(currentCatalog);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  }

  function renderStatus(st) {
    const pills = document.getElementById('statusPills');
    if (!pills || !st.channels) return;
    
    pills.innerHTML = Object.entries(st.channels).map(([ch, active]) => `
      <span class="status-pill ${active ? 'active' : ''}">
        ${active ? '● ' : '○ '}${ch.toUpperCase()}
      </span>
    `).join('');
  }

  function renderQueue(items) {
    const list = document.getElementById('queueList');
    if (!list) return;

    if (!items.length) {
      list.innerHTML = `<p style="grid-column: 1/-1; color: var(--ink-dim); text-align: center; padding: 40px;">No campaigns queued yet. Run "node cli.js plan" in terminal to generate a 7-day calendar.</p>`;
      return;
    }

    list.innerHTML = items.map(item => {
      const headline = item.content?.headline || item.content?.title || item.content?.hookText || item.theme || 'Marketing Draft';
      const textToCopy = formatContentText(item.content);

      return `
        <div class="card">
          <div class="card-top">
            <span class="channel-tag">${item.channel}</span>
            <span class="status-tag ${item.status}">${item.status}</span>
          </div>
          <h3>${escapeHtml(headline)}</h3>
          <div style="font-size: 12px; color: var(--ink-dim);">
            📅 Scheduled: <b>${item.scheduledDate}</b> &nbsp;|&nbsp; 🎮 <b>${item.gameId}</b>
          </div>
          <div class="card-body">${escapeHtml(textToCopy)}</div>
          <div class="card-actions">
            <button class="btn primary copy-btn" data-text="${escapeHtmlAttr(textToCopy)}">📋 Copy Content</button>
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(textToCopy.slice(0, 280))}" target="_blank" class="btn" style="text-decoration:none;">Share to X</a>
          </div>
        </div>
      `;
    }).join('');

    attachCopyHandlers();
  }

  function renderOpportunities(opps) {
    const list = document.getElementById('oppsList');
    if (!list) return;

    if (!opps.length) {
      list.innerHTML = `<p style="grid-column: 1/-1; color: var(--ink-dim); text-align: center; padding: 40px;">No scout leads recorded yet. Run "node cli.js scout" to scan for discussions.</p>`;
      return;
    }

    list.innerHTML = opps.map(lead => `
      <div class="card">
        <div class="card-top">
          <span class="channel-tag">${lead.platform}</span>
          <span class="status-tag approved">Relevance ${lead.relevanceScore}/100</span>
        </div>
        <h3>By ${escapeHtml(lead.author)}</h3>
        <p style="font-size:13px; color:var(--ink-dim); font-style:italic;">"${escapeHtml(lead.queryContent)}"</p>
        <div style="font-size: 12px;"><b>Recommended Game:</b> ${escapeHtml(lead.recommendedGame)}</div>
        <div class="card-body">${escapeHtml(lead.draftReply)}</div>
        <div class="card-actions">
          <button class="btn primary copy-btn" data-text="${escapeHtmlAttr(lead.draftReply)}">📋 Copy Reply</button>
        </div>
      </div>
    `).join('');

    attachCopyHandlers();
  }

  function renderVisuals(catalog) {
    const grid = document.getElementById('visualsGrid');
    if (!grid) return;

    grid.innerHTML = Object.keys(catalog).map(gameId => `
      <div class="visual-item">
        <img src="/artifacts/visual-assets/${gameId}-social-card.svg" alt="${gameId} preview" onerror="this.src='/artifacts/visual-assets/hub-social-card.svg'">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <b>${catalog[gameId].name} (1200x630)</b>
          <a href="/artifacts/visual-assets/${gameId}-social-card.svg" download="${gameId}-card.svg" class="btn">⬇ Download</a>
        </div>
      </div>
    `).join('');
  }

  function renderCatalog(catalog) {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;

    grid.innerHTML = Object.values(catalog).map(g => `
      <div class="card">
        <div class="card-top">
          <span class="channel-tag">${g.genre}</span>
          <span class="status-tag">${g.id}</span>
        </div>
        <h3>${g.name}</h3>
        <p style="color:var(--accent); font-weight:700; font-size:13px;">${g.tagline}</p>
        <p style="font-size:13px; color:var(--ink-dim);">${g.pitch}</p>
        <div class="card-body"><b>Viral Hooks:</b>\n${(g.viralHooks || []).map(h => '• ' + h).join('\n')}</div>
        <div class="card-actions">
          <a href="${g.url}" target="_blank" class="btn primary" style="text-decoration:none;">Play ${g.name} ➔</a>
        </div>
      </div>
    `).join('');
  }

  function formatContentText(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (content.text) return content.text;
    if (content.bodyMarkdown) return content.title ? `# ${content.title}\n\n${content.bodyMarkdown}` : content.bodyMarkdown;
    if (content.contentMarkdown) return content.contentMarkdown;
    if (content.makerComment) return `${content.title}\n\n${content.makerComment}`;
    if (content.thread) return content.thread.map(t => `[${t.tweetNumber}/${content.thread.length}] ${t.text}`).join('\n\n');
    return JSON.stringify(content, null, 2);
  }

  function attachCopyHandlers() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.onclick = () => {
        const text = btn.dataset.text;
        navigator.clipboard.writeText(text).then(() => {
          showToast();
        });
      };
    });
  }

  function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  document.getElementById('refreshBtn').addEventListener('click', loadData);

  document.getElementById('channelFilter').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'all') {
      renderQueue(currentQueue);
    } else {
      renderQueue(currentQueue.filter(i => i.channel === val));
    }
  });

  loadData();
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
