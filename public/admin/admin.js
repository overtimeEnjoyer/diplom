const TOKEN_KEY = 'rok_admin_jwt';
const API = '/api';

const $ = (sel, root = document) => root.querySelector(sel);

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(jwt) {
  if (jwt) localStorage.setItem(TOKEN_KEY, jwt);
  else localStorage.removeItem(TOKEN_KEY);
}

function showMsg(el, text, type = 'error') {
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${type}`;
  el.classList.remove('hidden');
}

function hideMsg(el) {
  el?.classList.add('hidden');
}

async function api(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!res.ok) {
    const err = new Error(payload?.message || payload?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

let currentUser = null;
let activePanel = 'feedbacks';

async function fetchMe() {
  const data = await api('GET', '/auth/me');
  currentUser = data.user || data;
  return currentUser;
}

function isAdmin() {
  return currentUser?.role?.type === 'admin';
}

function isContentStaff() {
  const t = currentUser?.role?.type;
  return t === 'admin' || t === 'specialist';
}

function applyRoleNav() {
  document.querySelectorAll('[data-admin-only]').forEach((el) => {
    el.classList.toggle('hidden', !isAdmin());
  });
  document.querySelectorAll('[data-content-only]').forEach((el) => {
    el.classList.toggle('hidden', !isContentStaff());
  });
}

function showLogin() {
  $('#login-screen').classList.remove('hidden');
  $('#app-shell').classList.add('hidden');
}

function showApp() {
  $('#login-screen').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  $('#user-label').textContent = currentUser?.email || '';
  applyRoleNav();
}

async function login(email, password) {
  const data = await api('POST', '/auth/local', { identifier: email, password });
  if (data.status === 'mfa_required') {
    throw new Error('Увімкнено MFA — увійдіть через основний клієнт або вимкніть MFA для адміна.');
  }
  setToken(data.jwt);
  await fetchMe();
  if (!isContentStaff()) {
    setToken(null);
    throw new Error('Немає прав адміністратора або фахівця.');
  }
  showApp();
  await loadPanel(activePanel);
}

function logout() {
  setToken(null);
  currentUser = null;
  showLogin();
}

async function loadPanel(name) {
  activePanel = name;
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.panel === name);
  });

  const host = $('#panel');
  host.innerHTML = '<p>Завантаження…</p>';

  try {
    if (name === 'feedbacks') host.innerHTML = await renderFeedbacks();
    else if (name === 'users') host.innerHTML = await renderUsers();
    else if (name === 'pricing') host.innerHTML = await renderPricing();
    else if (name === 'payments') host.innerHTML = renderPayments();
    else if (name === 'sections') host.innerHTML = await renderSections();
    else if (name === 'methods') host.innerHTML = await renderMethods();
    bindPanelEvents(name, host);
  } catch (err) {
    host.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('uk-UA');
}

async function renderFeedbacks() {
  const filter = $('#feedback-filter')?.value || '';
  const q = filter ? `?processed=${filter}` : '';
  const { data } = await api('GET', `/admin/feedbacks${q}`);
  const rows = Array.isArray(data) ? data : [];

  const body = rows.length
    ? rows
        .map(
          (f) => `
      <tr>
        <td>${f.id}</td>
        <td>${escapeHtml(f.name)}<br><small>${escapeHtml(f.email)}</small></td>
        <td>${escapeHtml(f.message || '').slice(0, 120)}${(f.message || '').length > 120 ? '…' : ''}</td>
        <td>${escapeHtml(f.tariff || '—')}</td>
        <td>${f.isProcessed ? '<span class="badge ok">оброблено</span>' : '<span class="badge pending">нове</span>'}</td>
        <td>${!f.isProcessed ? `<button class="small" data-mark-feedback="${f.id}">Готово</button>` : ''}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="6">Немає звернень</td></tr>';

  return `
    <h1>Звернення</h1>
    <div class="toolbar">
      <select id="feedback-filter">
        <option value="">Усі</option>
        <option value="false" ${filter === 'false' ? 'selected' : ''}>Нові</option>
        <option value="true" ${filter === 'true' ? 'selected' : ''}>Оброблені</option>
      </select>
      <button type="button" class="secondary" id="reload-feedbacks">Оновити</button>
    </div>
    <div class="card"><table>
      <thead><tr><th>ID</th><th>Контакт</th><th>Повідомлення</th><th>Тариф</th><th>Статус</th><th></th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

async function renderUsers() {
  const search = $('#user-search')?.value?.trim() || '';
  const q = search ? `?search=${encodeURIComponent(search)}&limit=80` : '?limit=80';
  const { data } = await api('GET', `/admin/users${q}`);
  const rows = Array.isArray(data) ? data : [];

  const body = rows.length
    ? rows
        .map(
          (u) => `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}<br><small>${escapeHtml(u.email)}</small></td>
        <td>${escapeHtml(u.role?.type || '')}</td>
        <td>
          <label><input type="checkbox" data-user="${u.id}" data-field="isMedium" ${u.isMedium ? 'checked' : ''}> Medium</label><br>
          <label><input type="checkbox" data-user="${u.id}" data-field="isPremium" ${u.isPremium ? 'checked' : ''}> Premium</label><br>
          <label><input type="checkbox" data-user="${u.id}" data-field="makCardsAccess" ${u.makCardsAccess ? 'checked' : ''}> МАК</label>
        </td>
        <td><button class="small" data-save-tariff="${u.id}">Зберегти</button></td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="5">Користувачів не знайдено</td></tr>';

  return `
    <h1>Користувачі</h1>
    <div class="toolbar">
      <input type="search" id="user-search" placeholder="email або username" value="${escapeHtml(search)}">
      <button type="button" id="search-users">Пошук</button>
    </div>
    <div class="card"><table>
      <thead><tr><th>ID</th><th>Користувач</th><th>Роль</th><th>Доступи</th><th></th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <div id="users-msg" class="msg hidden"></div>`;
}

async function renderPricing() {
  const { data } = await api('GET', '/admin/pricing');
  return `
    <h1>Ціни</h1>
    <form id="pricing-form" class="card">
      <div class="grid-2">
        <div class="field"><label>МАК-картки</label><input name="makCardsPrice" type="number" value="${data.makCardsPrice}"></div>
        <div class="field"><label>Medium</label><input name="mediumPrice" type="number" value="${data.mediumPrice}"></div>
        <div class="field"><label>Premium</label><input name="premiumPrice" type="number" value="${data.premiumPrice}"></div>
        <div class="field"><label>Розділ</label><input name="sectionPrice" type="number" value="${data.sectionPrice}"></div>
        <div class="field"><label>Валюта</label><input name="currency" value="${escapeHtml(data.currency)}"></div>
      </div>
      <button type="submit">Зберегти ціни</button>
    </form>
    <div id="pricing-msg" class="msg hidden"></div>`;
}

function renderPayments() {
  return `
    <h1>Підтвердження оплати</h1>
    <div class="card">
      <p style="color:var(--muted);margin-top:0">Ручне підтвердження замовлення (production / manual).</p>
      <label>orderReference</label>
      <input id="order-ref" placeholder="RKM|medium|123|...">
      <button type="button" id="confirm-payment">Підтвердити</button>
    </div>
    <div id="payment-msg" class="msg hidden"></div>`;
}

async function renderSections() {
  const { data } = await api('GET', '/admin/method-sections?limit=50');
  const rows = Array.isArray(data) ? data : [];
  const body = rows.length
    ? rows
        .map(
          (s) => `
      <tr>
        <td>${s.id}</td>
        <td>${escapeHtml(s.slug)}</td>
        <td>${escapeHtml(s.title || '')}</td>
        <td>${s.publishedAt ? '<span class="badge ok">так</span>' : '<span class="badge pending">ні</span>'}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="4">Немає розділів</td></tr>';

  return `
    <h1>Розділи методик</h1>
    <div class="card"><table>
      <thead><tr><th>ID</th><th>Slug</th><th>Назва</th><th>Опубліковано</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <p style="color:var(--muted)">Редагування через API або Swagger. Тут — перегляд.</p>`;
}

async function renderMethods() {
  const sectionId = $('#method-section-filter')?.value || '';
  const q = sectionId ? `?sectionId=${sectionId}&limit=80` : '?limit=80';
  const { data: sections } = await api('GET', '/admin/method-sections?limit=50');
  const { data: methods } = await api('GET', `/admin/methods${q}`);
  const sectionOpts = (sections || [])
    .map((s) => `<option value="${s.id}" ${String(s.id) === sectionId ? 'selected' : ''}>${escapeHtml(s.slug)}</option>`)
    .join('');

  const rows = Array.isArray(methods) ? methods : [];
  const body = rows.length
    ? rows
        .map(
          (m) => `
      <tr>
        <td>${m.id}</td>
        <td>${escapeHtml(m.slug)}</td>
        <td>${escapeHtml((m.title || '').slice(0, 60))}</td>
        <td>${m.publishedAt ? '<span class="badge ok">так</span>' : '<span class="badge pending">ні</span>'}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="4">Немає методик</td></tr>';

  return `
    <h1>Методики</h1>
    <div class="toolbar">
      <select id="method-section-filter">
        <option value="">Усі розділи</option>
        ${sectionOpts}
      </select>
      <button type="button" class="secondary" id="reload-methods">Оновити</button>
    </div>
    <div class="card"><table>
      <thead><tr><th>ID</th><th>Slug</th><th>Назва</th><th>Опубліковано</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <p style="color:var(--muted)">Показано до 80 записів. Повний CRUD — у <a href="/api-docs" target="_blank">Swagger</a>.</p>`;
}

function bindPanelEvents(name, host) {
  if (name === 'feedbacks') {
    $('#feedback-filter', host)?.addEventListener('change', () => loadPanel('feedbacks'));
    $('#reload-feedbacks', host)?.addEventListener('click', () => loadPanel('feedbacks'));
    host.querySelectorAll('[data-mark-feedback]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api('PATCH', `/admin/feedbacks/${btn.dataset.markFeedback}/processed`);
        await loadPanel('feedbacks');
      });
    });
  }

  if (name === 'users') {
    $('#search-users', host)?.addEventListener('click', () => loadPanel('users'));
    host.querySelectorAll('[data-save-tariff]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.saveTariff;
        const body = {};
        host.querySelectorAll(`[data-user="${id}"]`).forEach((input) => {
          body[input.dataset.field] = input.checked;
        });
        try {
          await api('PATCH', `/admin/users/${id}/tariff`, body);
          showMsg($('#users-msg', host), 'Збережено', 'success');
        } catch (e) {
          showMsg($('#users-msg', host), e.message, 'error');
        }
      });
    });
  }

  if (name === 'pricing') {
    $('#pricing-form', host)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      for (const k of ['makCardsPrice', 'mediumPrice', 'premiumPrice', 'sectionPrice']) {
        body[k] = Number(body[k]);
      }
      try {
        await api('PUT', '/admin/pricing', body);
        showMsg($('#pricing-msg', host), 'Ціни оновлено', 'success');
      } catch (err) {
        showMsg($('#pricing-msg', host), err.message, 'error');
      }
    });
  }

  if (name === 'payments') {
    $('#confirm-payment', host)?.addEventListener('click', async () => {
      const orderReference = $('#order-ref', host)?.value?.trim();
      if (!orderReference) {
        showMsg($('#payment-msg', host), 'Вкажіть orderReference', 'error');
        return;
      }
      try {
        const result = await api('POST', '/admin/payments/confirm', { orderReference });
        showMsg($('#payment-msg', host), JSON.stringify(result, null, 2), 'success');
      } catch (err) {
        showMsg($('#payment-msg', host), err.message, 'error');
      }
    });
  }

  if (name === 'methods') {
    $('#method-section-filter', host)?.addEventListener('change', () => loadPanel('methods'));
    $('#reload-methods', host)?.addEventListener('click', () => loadPanel('methods'));
  }
}

async function init() {
  $('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#login-msg');
    hideMsg(msg);
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    try {
      await login(email, password);
    } catch (err) {
      showMsg(msg, err.message, 'error');
    }
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!btn.classList.contains('hidden')) loadPanel(btn.dataset.panel);
    });
  });

  $('#logout-btn')?.addEventListener('click', logout);

  const token = getToken();
  if (!token) {
    showLogin();
    return;
  }

  try {
    await fetchMe();
    if (!isContentStaff()) throw new Error('Немає доступу');
    showApp();
    activePanel = isAdmin() ? 'feedbacks' : 'sections';
    await loadPanel(activePanel);
  } catch {
    setToken(null);
    showLogin();
  }
}

init();
