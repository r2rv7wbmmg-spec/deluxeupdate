/* Paneli i administrimit – De Luxe Real Estate (administrator + agjentë) */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('de-DE');
  const date = d => d ? new Date(d.replace(' ', 'T') + 'Z').toLocaleString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const FALLBACK = '/img/placeholder.svg';
  const TYPES = ['Apartament', 'Vilë', 'Zyrë', 'Dyqan', 'Tokë'];
  const STATUS = { active: 'Aktive', sold: 'E shitur', rented: 'E dhënë me qira', hidden: 'E fshehur' };
  const APPROVAL = { pending: 'Në pritje', approved: 'E miratuar', rejected: 'E refuzuar' };
  const ISTATUS = { new: 'E re', contacted: 'Kontaktuar', closed: 'Mbyllur' };
  const LEVELS = { 10: 'Themelues & CEO', 9: 'Broker / Drejtor Agjencie', 8: 'Partner Menaxhues', 7: 'Agjent Partner', 6: 'Udhëheqës Ekipi', 5: 'Agjent Kryesor', 4: 'Agjent i Lartë', 3: 'Agjent i Licencuar', 2: 'Agjent', 1: 'Agjent Praktikant' };
  const STAGES = ['new', 'contacted', 'visit', 'offer', 'negotiation', 'won', 'lost'];
  const STAGE = { new: 'E re', contacted: 'Kontaktuar', visit: 'Vizitë', offer: 'Ofertë', negotiation: 'Negocim', won: 'Fituar', lost: 'Humbur' };
  const CTYPE = { bleres: 'Blerës', qiramarres: 'Qiramarrës', shites: 'Shitës', qiradhenes: 'Qiradhënës', investitor: 'Investitor' };
  const SOURCE = { website: 'Faqja', instagram: 'Instagram', facebook: 'Facebook', telefon: 'Telefon', whatsapp: 'WhatsApp', rekomandim: 'Rekomandim', zyra: 'Zyra', tjeter: 'Tjetër' };
  const LSTATUS = { active: 'Aktiv', cold: 'I ftohtë', closed: 'Mbyllur' };
  const ACT = { note: ['Shënim', 'note'], call: ['Telefonatë', 'phone'], whatsapp: ['WhatsApp', 'wa'], email: ['Email', 'mail'], visit: ['Vizitë', 'home'], meeting: ['Takim', 'users'], stage: ['Faza', 'arrow'], system: ['Sistemi', 'info'] };
  const SVG = {
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    wa: '<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7l9 6 9-6"/>',
    note: '<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>',
    home: '<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>',
    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 10h16M9 3v4M15 3v4"/>'
  };
  const ti = n => `<svg class="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[n] || SVG.note}</svg>`;
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const day = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('sq-AL', { day: '2-digit', month: 'short' }) : '';
  const opts = (map, sel, blank) => (blank ? `<option value="">${blank}</option>` : '') + Object.entries(map).map(([k, v]) => `<option value="${k}" ${String(sel) === k ? 'selected' : ''}>${v}</option>`).join('');
  const stageTag = st => `<span class="sg sg-${st}">${STAGE[st]}</span>`;
  const dueTag = d => !d ? '' : d < todayStr() ? `<span class="due late">${day(d)} · vonesë</span>` : d === todayStr() ? `<span class="due now">Sot</span>` : `<span class="due">${day(d)}</span>`;
  const telOf = p => (p || '').replace(/[^\d+]/g, '');
  const waOf = p => { let d = (p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '355' + d.slice(1); return d; };
  const KIND = { contact: 'Kontakt', property: 'Info për pronë', visit: 'Vizitë', valuation: 'Vlerësim' };
  const ic = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5 9-10"/></svg>',
    no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  let USER = null, agentsCache = [];
  const admin = () => USER?.role === 'admin';

  async function api(url, opts = {}) {
    const o = { ...opts, headers: { 'Content-Type': 'application/json' } };
    if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
    let r; try { r = await fetch(url, o); } catch { throw new Error('Nuk ka lidhje me serverin.'); }
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.endsWith('/login') && !url.endsWith('/password')) { USER = null; renderLogin('Sesioni mbaroi. Hyni sërish.'); throw new Error(d.error || 'Jo i autorizuar'); }
    if (!r.ok) throw new Error(d.error || 'Ndodhi një gabim.');
    return d;
  }
  function toast(msg, type) {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.append(box); }
    const t = document.createElement('div'); t.className = 'toast' + (type === 'err' ? ' err' : ''); t.textContent = msg; box.append(t);
    setTimeout(() => t.remove(), 3600);
  }
  const fileToData = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Skedari nuk u lexua.')); r.readAsDataURL(f); });
  async function upload(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: lejohen vetëm JPG, PNG, WEBP.`);
    if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: më i madh se 8 MB.`);
    return (await api('/api/admin/upload', { method: 'POST', body: { data: await fileToData(file) } })).url;
  }
  const approvalTag = p => `<span class="ap ap-${p.approval}">${APPROVAL[p.approval] || ''}</span>`;

  /* ---------- hyrja ---------- */
  function renderLogin(note = '') {
    $('#app').innerHTML = `<div class="login"><form id="login" novalidate>
      <a href="/" style="justify-self:center"><img class="logo-full" src="/img/logo-full.png" alt="De Luxe Real Estate" style="width:200px;margin:0 auto"></a>
      <h1>Hyrje</h1>
      <p class="muted" style="margin:0;font-size:.92rem">Për administratorin dhe agjentët. Kodin e hyrjes jua jep administratori.</p>
      <div class="field"><label for="l-u">Përdoruesi</label><input class="input" id="l-u" name="username" autocomplete="username" autocapitalize="none" required></div>
      <div class="field"><label for="l-p">Fjalëkalimi</label><input class="input" id="l-p" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn block" type="submit">Hyr në panel</button>
      <p class="form-msg err" id="l-msg">${esc(note)}</p>
      <a href="/" class="text-link" style="justify-self:start;font-size:.9rem">Kthehu te faqja</a>
    </form></div>`;
    $('#l-u').focus();
    $('#login').addEventListener('submit', async e => {
      e.preventDefault(); const b = $('#login button'); b.classList.add('loading');
      try { USER = await api('/api/admin/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); start(); }
      catch (err) { $('#l-msg').textContent = err.message; }
      finally { b.classList.remove('loading'); }
    });
  }

  /* ---------- skeleti ---------- */
  const ADMIN_VIEWS = { paneli: 'Paneli', leads: 'Leads', opportunitete: 'Opportunitete', match: 'Match', kalendari: 'Kalendari', komisionet: 'Komisionet', raporti: 'Raporti', zyrat: 'Zyrat', miratime: 'Miratime', pronat: 'Pronat', kerkesat: 'Kërkesat', agjentet: 'Agjentët', abonentet: 'Abonentët', faqja: 'Faqja', llogaria: 'Llogaria' };
  const AGENT_VIEWS = { paneli: 'Paneli', leads: 'Leads', opportunitete: 'Opportunitete', match: 'Match', kalendari: 'Kalendari', komisionet: 'Komisionet', pronat: 'Pronat e mia', kerkesat: 'Kërkesat', llogaria: 'Llogaria' };
  let VIEWS = ADMIN_VIEWS;
  function renderShell() {
    // Brokeri ka edhe “Zyra ime” (dashboard-i i zyrës)
    VIEWS = admin() ? ADMIN_VIEWS : USER.broker_of ? Object.fromEntries(Object.entries(AGENT_VIEWS).flatMap(e => e[0] === 'paneli' ? [e, ['zyra', 'Zyra ime']] : [e])) : AGENT_VIEWS;
    const who = admin() ? `<b style="color:var(--text)">${esc(USER.username)}</b> · administrator` : `<b style="color:var(--text)">${esc(USER.agent?.name || USER.username)}</b> · ${USER.broker_of ? 'broker · ' + esc(USER.broker_of.code) : 'agjent'}`;
    $('#app').innerHTML = `<div class="mob-top"><a href="/admin/" class="logo"><img class="logo-img" src="/img/logo-mark.png" alt="De Luxe" style="height:36px"></a><span style="display:flex;gap:.5rem"><button class="icon-btn bell-btn" data-bell aria-label="Njoftimet">${ti('bell')}<i class="bell-n" hidden></i></button><button class="icon-btn" id="mob-menu" aria-label="Menuja">☰</button></span></div>
    <div class="shell">
      <aside class="side-nav" id="sidenav">
        <a href="/" class="logo"><img class="logo-img" src="/img/logo-mark.png" alt="" width="60" height="46"><span class="logo-text"><img class="logo-word" src="/img/logo-word.png" alt="De Luxe Real Estate" width="140" height="34"><small>Paneli i stafit</small></span></a>
        <button class="bell-row" type="button" data-bell>${ti('bell')}<span>Njoftimet</span><i class="bell-n" hidden></i></button>
        <nav>${Object.entries(VIEWS).map(([k, v]) => `<a href="#${k}" data-v="${k}">${v}${k === 'kerkesat' ? '<span class="pill" id="new-count" hidden></span>' : ''}${k === 'miratime' ? '<span class="pill" id="pend-count" hidden></span>' : ''}${k === 'opportunitete' ? '<span class="pill" id="due-count" hidden></span>' : ''}</a>`).join('')}</nav>
        <div class="bottom"><span class="muted">${who}</span><a class="text-link" href="/" target="_blank" style="justify-self:start">Shiko faqen</a><button class="btn ghost sm" id="logout">Dil</button></div>
      </aside>
      <main class="main" id="view"></main>
    </div>`;
    $('#logout').addEventListener('click', async () => { clearInterval(nTimer); await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); USER = null; location.hash = ''; renderLogin(); });
    $('#mob-menu').addEventListener('click', () => $('#sidenav').classList.toggle('open'));
    $('#sidenav nav').addEventListener('click', () => $('#sidenav').classList.remove('open'));
    $$('[data-bell]').forEach(b => b.addEventListener('click', () => { $('#sidenav').classList.remove('open'); openBell(); }));
    route(); refreshCounts(); startBell();
  }
  function pill(id, n) { const p = $(id); if (p) { p.hidden = !n; p.textContent = n || ''; } }
  async function refreshCounts() { try { const s = await api('/api/admin/stats'); pill('#new-count', s.inquiries.new || 0); pill('#pend-count', s.properties.pending || 0); api('/api/admin/crm').then(c => pill('#due-count', c.todayList.length)).catch(() => {}); return s; } catch { return null; } }
  async function route() {
    if (!USER) return;
    let v = location.hash.slice(1) || 'paneli';
    if (v === 'njoftime') { v = 'paneli'; history.replaceState(null, '', '#paneli'); setTimeout(openBell, 300); }
    const view = VIEWS[v] ? v : 'paneli';
    $$('#sidenav nav a').forEach(a => a.classList.toggle('on', a.dataset.v === view));
    $('#view').innerHTML = '<div class="skeleton" style="height:60vh"></div>';
    try { await ({ paneli, leads, opportunitete, match, kalendari, komisionet, raporti, zyrat, zyra, miratime, pronat, kerkesat, agjentet, abonentet, faqja, llogaria })[view](); }
    catch (e) { if (USER) $('#view').innerHTML = `<div class="empty"><h3>Gabim</h3>${esc(e.message)}</div>`; }
  }
  window.addEventListener('hashchange', route);
  const go = v => { if (location.hash === '#' + v) route(); else location.hash = v; };

  /* ---------- paneli ---------- */
  async function paneli() {
    const [s0, c] = await Promise.all([refreshCounts(), api('/api/admin/crm')]);
    const s = s0 || await api('/api/admin/stats');
    const P = s.properties;
    const pipe = Object.fromEntries(c.pipeline.map(x => [x.stage, x]));
    const openN = STAGES.slice(0, 5).reduce((t, k) => t + (pipe[k]?.n || 0), 0), openV = STAGES.slice(0, 5).reduce((t, k) => t + (pipe[k]?.value || 0), 0);
    const cards = admin()
      ? [[P.active, 'Prona në faqe'], [P.pending, 'Në pritje miratimi', 'miratime'], [P.sold, 'Të shitura'], [P.rented, 'Të dhëna me qira'], [fmt(P.views), 'Shikime gjithsej'], [s.inquiries.new, 'Kërkesa të reja', 'kerkesat'], [s.subscribers, 'Abonentë']]
      : [[P.active, 'Në faqe'], [P.pending, 'Në pritje miratimi'], [P.rejected, 'Të refuzuara'], [fmt(P.views), 'Shikime'], [s.inquiries.new, 'Kërkesa të reja', 'kerkesat']];
    $('#view').innerHTML = `<div class="top"><h1>${admin() ? 'Mirë se erdhët' : 'Përshëndetje, ' + esc((USER.agent?.name || '').split(' ')[0])}</h1><button class="btn" id="add-p">Shto pronë</button></div>
      ${!admin() ? '<p class="note-box">Pronat që shtoni ose ndryshoni dalin në faqe pasi t’i miratojë administratori. Statusin e secilës e shihni te <a href="#pronat">Pronat e mia</a>.</p>' : ''}
      ${admin() && P.pending ? `<a class="note-box gold-box" href="#miratime"><b>${P.pending}</b> ${P.pending === 1 ? 'pronë pret' : 'prona presin'} miratimin tuaj – shikojini tani</a>` : ''}
      <div class="crm-top">
        <div class="panel"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2>Për sot</h2><a class="text-link" href="#opportunitete">Opportunitete</a></div>
          <ul class="list-mini" id="today">${(c.stale || []).map(l => `<li data-lead="${l.id}" class="clickable"><span><b style="font-weight:500">Pa kontakt</b> · ${esc(l.name)}<br><small class="muted">Kontakti i fundit ${l.days} ditë më parë${admin() ? ' · ' + esc(l.agent_name || 'Pa agjent') : ''}</small></span><span style="text-align:right"><span class="due late">${l.days} ditë</span>${l.phone ? `<br><a href="tel:${telOf(l.phone)}" class="gold" style="font-size:.85rem" data-call="${l.id}">Telefono</a>` : ''}</span></li>`).join('')}${(c.visitsToday || []).map(v => `<li data-visit="${v.id}" class="clickable"><span><b style="font-weight:500">Vizitë ${v.starts_at.slice(11)}</b> · ${v.lead_name ? esc(v.lead_name) : `klient i ${esc(v.agent_name || 'kolegut')}`}<br><small class="muted">${v.property_code ? esc(v.property_code) + ' – ' + esc(v.property_title) : 'Pa pronë'}${admin() && v.agent_name ? ' · ' + esc(v.agent_name) : ''}</small></span><span class="due now">Sot</span></li>`).join('')}${c.todayList.map(o => `<li data-opp="${o.id}" class="clickable"><span><b style="font-weight:500">${esc(o.next_action || 'Kontakto')}</b> · ${esc(o.lead_name)}<br><small class="muted">${esc(o.title)}${admin() && o.agent_name ? ' · ' + esc(o.agent_name) : ''}</small></span><span style="text-align:right">${dueTag(o.next_date)}${o.lead_phone ? `<br><a href="tel:${telOf(o.lead_phone)}" class="gold" style="font-size:.85rem">Telefono</a>` : ''}</span></li>`).join('') || (c.visitsToday || []).length || (c.stale || []).length ? '' : '<li class="muted">Asgjë për sot. Vendosni “kontaktin e radhës” te opportunitetet që të mos humbisni asnjë klient.</li>'}</ul></div>
        <div class="crm-cards">
          ${!admin() ? '<div class="panel" id="my-targets" style="grid-column:1/-1" hidden></div>' : ''}
          ${(c.pendingCommissions || []).length ? `<div class="panel" style="grid-column:1/-1;border-color:var(--gold)" id="pc-panel"><div class="tg-head"><h2 style="margin:0">Komisione për t’u mbyllur</h2><a class="gold" href="#komisionet">Te Komisionet →</a></div>${commissionList(c.pendingCommissions)}</div>` : ''}
          ${!admin() && c.myPending ? `<div class="panel" style="grid-column:1/-1"><p style="margin:0">Komision në pritje të mbylljes nga brokeri: <b class="gold">${fmt(c.myPending)} €</b></p></div>` : ''}
          ${c.newMatches.length ? `<div class="panel" style="grid-column:1/-1;border-color:var(--gold)"><h2 style="margin-top:0">Prona të reja për klientët</h2><ul class="list-mini" id="newm">${c.newMatches.map(m => `<li data-opp="${m.id}" class="clickable"><span><b style="font-weight:500">${esc(m.lead_name)}</b>${admin() && m.agent_name ? ` <small class="muted">· ${esc(m.agent_name)}</small>` : ''}<br><small class="muted">${esc(m.top.code)} – ${esc(m.top.title)}</small></span><span style="text-align:right;white-space:nowrap"><span class="gold">${m.top.score}%</span><br><small class="muted">${m.fresh} ${m.fresh === 1 ? 'e re' : 'të reja'}</small></span></li>`).join('')}</ul></div>` : ''}
          <a href="#leads" class="stat"><b>${c.leads.total || 0}</b><span>Leads${c.leads.week ? ` · ${c.leads.week} të reja këtë javë` : ''}</span></a>
          <a href="#opportunitete" class="stat"><b>${openN}</b><span>Opportunitete të hapura · ${fmt(openV)} €</span></a>
          <div class="stat"><b>${c.month.won || 0}</b><span>Fituar këtë muaj</span></div>
          <div class="stat"><b>${fmt(c.month.commission)} €</b><span>Komision këtë muaj</span></div>
          ${admin() && c.leads.unassigned ? `<a href="#leads" data-unassigned class="stat warn"><b>${c.leads.unassigned}</b><span>Leads pa agjent – caktojini</span></a>` : ''}
        </div>
      </div>
      <div class="stats-grid">${cards.map(([n, l, link]) => `<${link ? `a href="#${link}"` : 'div'} class="stat"><b>${n || 0}</b><span>${l}</span></${link ? 'a' : 'div'}>`).join('')}</div>
      <div class="two">
        <div class="panel"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2>Kërkesat e fundit</h2><a class="text-link" href="#kerkesat">Të gjitha</a></div>
          <ul class="list-mini">${s.recent.map(i => `<li><span><b style="font-weight:500">${esc(i.name)}</b> <small class="muted">· ${KIND[i.kind]}${i.property_code ? ' · ' + esc(i.property_code) : ''}</small><br><small class="muted">${esc((i.message || '').slice(0, 90))}</small></span><span style="text-align:right;white-space:nowrap"><small class="${i.status === 'new' ? 'gold' : 'muted'}">${ISTATUS[i.status]}</small><br><small class="muted">${date(i.created_at)}</small></span></li>`).join('') || '<li class="muted">Asnjë kërkesë ende.</li>'}</ul></div>
        <div class="panel"><h2>Më të shikuarat</h2><ul class="list-mini">${s.top.map(p => `<li><a href="/property.html?id=${p.id}" target="_blank">${esc(p.title)}</a><span class="gold">${fmt(p.views)}</span></li>`).join('') || '<li class="muted">Ende asnjë pronë.</li>'}</ul></div>
      </div>`;
    $('#add-p').addEventListener('click', () => openProperty());
    $('#today').addEventListener('click', e => {
      const cl = e.target.closest('[data-call]'); if (cl) { api(`/api/admin/leads/${cl.dataset.call}/activities`, { method: 'POST', body: { type: 'call', text: 'Telefonatë me klientin' } }).catch(() => {}); return; }
      if (e.target.closest('a')) return; const ld = e.target.closest('[data-lead]'); if (ld) return openLead(Number(ld.dataset.lead));
      const vv = e.target.closest('[data-visit]'); if (vv) { calFocus = Number(vv.dataset.visit); return go('kalendari'); } const li = e.target.closest('[data-opp]'); if (li) openOpp(Number(li.dataset.opp)); });
    if (!admin()) api('/api/admin/targets').then(t => { const box = $('#my-targets'), me = t.items[0]; if (!box || !me?.target) return; box.hidden = false; box.innerHTML = `<h2 style="margin-top:0">Objektivat e ${esc(monthName(t.month))}</h2>${targetBars(me)}`; }).catch(() => {});
    $('#pc-panel')?.addEventListener('click', commissionClick);
    $('#newm')?.addEventListener('click', e => { const li = e.target.closest('[data-opp]'); if (li) openOpp(Number(li.dataset.opp)); });
    $('[data-unassigned]')?.addEventListener('click', () => { lFilter.agent = 'none'; });
  }

  /* ---------- miratime (vetëm administratori) ---------- */
  async function miratime() {
    const rows = await api('/api/admin/properties?approval=pending');
    $('#view').innerHTML = `<div id="mv"><div class="top"><h1>Miratime</h1></div>
      <p class="muted" style="margin:-1rem 0 1.5rem">Pronat e shtuara ose të ndryshuara nga agjentët. Dalin në faqe vetëm pasi t’i miratoni.</p>
      ${rows.length ? rows.map(p => `<article class="appr">
        <img src="${esc(p.images[0] || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'">
        <div class="appr-b"><h3>${esc(p.title)}</h3>
          <div class="meta"><span>${esc(p.code)}</span><span>${esc(p.type)} · ${p.deal === 'qira' ? 'Qira' : 'Shitje'}</span><span>${esc([p.zone, p.city].filter(Boolean).join(', '))}</span><span class="gold">${fmt(p.price)} €${p.deal === 'qira' ? ' / muaj' : ''}</span></div>
          <div class="meta"><span>Agjenti: <b style="color:var(--text);font-weight:500">${esc(p.agent_name || '–')}</b></span><span>${p.images.length} foto</span><span>Përditësuar: ${date(p.updated_at)}</span></div>
          ${p.dupes?.length ? `<div class="dup-alert" role="alert"><b>⚠ Kujdes: mund të jetë pronë e dyfishtë</b>${p.dupes.map(d => `<span>${esc(d.code)} – ${esc(d.title)}${d.agent_name ? ' · ' + esc(d.agent_name) : ''}</span>`).join('')}</div>` : ''}
          <div class="appr-acts">
            <button class="btn sm" data-approve="${p.id}" data-dupes="${p.dupes?.length ? esc(p.dupes.map(d => d.code).join(', ')) : ''}">${ic.ok}Mirato</button>
            <button class="btn ghost sm" data-reject="${p.id}" data-code="${esc(p.code)}">${ic.no}Refuzo</button>
            <a class="btn ghost sm" href="/property.html?id=${p.id}" target="_blank">${ic.eye}Parapamje</a>
            <button class="btn ghost sm" data-edit="${p.id}">${ic.edit}Ndrysho</button>
          </div></div></article>`).join('') : '<div class="empty"><h3>Asgjë për të miratuar</h3>Kur një agjent shton ose ndryshon një pronë, ajo shfaqet këtu.</div>'}</div>`;
    $('#mv').addEventListener('click', approvalClick);
  }
  async function approvalClick(e) {
    const a = e.target.closest('[data-approve]'), r = e.target.closest('[data-reject]'), ed = e.target.closest('[data-edit]');
    if (ed) return openProperty(Number(ed.dataset.edit));
    if (a) {
      if (a.dataset.dupes && !confirm(`Kjo pronë mund të jetë e njëjtë me ${a.dataset.dupes}. Ta miratoj gjithsesi?`)) return;
      try {
        const p = await api('/api/admin/properties/' + a.dataset.approve, { method: 'PATCH', body: { approval: 'approved' } });
        propsCache = null; refreshCounts(); await route();
        if (p.buyers) { toast(`Prona u miratua. ${p.buyers} ${p.buyers === 1 ? 'klient pret' : 'klientë presin'} një pronë si kjo.`); openBuyers(p.id); } else toast('Prona u miratua dhe tani duket në faqe.');
      } catch (err) { toast(err.message, 'err'); }
    }
    if (r) {
      const note = await askReason(r.dataset.code); if (note === null) return;
      try { await api('/api/admin/properties/' + r.dataset.reject, { method: 'PATCH', body: { approval: 'rejected', review_note: note } }); toast('Prona u refuzua. Agjenti e sheh arsyen te pronat e tij.'); refreshCounts(); route(); } catch (err) { toast(err.message, 'err'); }
    }
  }
  function askReason(code) {
    return new Promise(res => {
      const d = $('#rmodal'); $('#r-code').textContent = code; $('#r-note').value = '';
      const done = v => { d.close(); res(v); };
      $('#r-ok').onclick = () => done($('#r-note').value.trim());
      $$('[data-rclose]', d).forEach(b => b.onclick = () => done(null));
      d.oncancel = e => { e.preventDefault(); done(null); };
      d.showModal(); $('#r-note').focus();
    });
  }

  /* ---------- pronat ---------- */
  let pFilter = { q: '', status: '', approval: '' };
  async function pronat() {
    $('#view').innerHTML = `<div class="top"><h1>${admin() ? 'Pronat' : 'Pronat e mia'}</h1><div class="toolbar">
      <input class="input" id="pq" placeholder="Kërko titull, kod, qytet" value="${esc(pFilter.q)}">
      <select class="select" id="pa"><option value="">Çdo miratim</option>${Object.entries(APPROVAL).map(([k, v]) => `<option value="${k}" ${pFilter.approval === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select class="select" id="ps"><option value="">Të gjitha statuset</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${pFilter.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <button class="btn" id="add-p">Shto pronë</button></div></div>
      <div class="table-wrap"><table><thead><tr><th></th><th>Prona</th><th>Qyteti</th><th>Çmimi</th><th>Miratimi</th><th>Statusi</th>${admin() ? '<th title="E përzgjedhur">★</th>' : ''}<th>Shikime</th><th>Veprime</th></tr></thead><tbody id="ptb"></tbody></table></div>`;
    let t;
    $('#pq').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { pFilter.q = e.target.value; loadP(); }, 300); });
    $('#ps').addEventListener('change', e => { pFilter.status = e.target.value; loadP(); });
    $('#pa').addEventListener('change', e => { pFilter.approval = e.target.value; loadP(); });
    $('#add-p').addEventListener('click', () => openProperty());
    $('#ptb').addEventListener('change', async e => {
      const s = e.target.closest('[data-status]'); if (!s) return;
      try { await api('/api/admin/properties/' + s.dataset.status, { method: 'PATCH', body: { status: s.value } }); toast('Statusi u ndryshua.'); } catch (err) { toast(err.message, 'err'); loadP(); }
    });
    $('#ptb').addEventListener('click', async e => {
      const st = e.target.closest('[data-star]'), ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
      if (e.target.closest('[data-approve],[data-reject]')) { await approvalClick(e); return; }
      if (st) { const on = st.getAttribute('aria-pressed') !== 'true'; try { await api('/api/admin/properties/' + st.dataset.star, { method: 'PATCH', body: { featured: on } }); st.setAttribute('aria-pressed', on); toast(on ? 'U shtua te të përzgjedhurat.' : 'U hoq nga të përzgjedhurat.'); } catch (err) { toast(err.message, 'err'); } }
      if (ed) openProperty(Number(ed.dataset.edit));
      const by = e.target.closest('[data-buyers]'); if (by) openBuyers(Number(by.dataset.buyers));
      if (dl && confirm(`Të fshihet përgjithmonë prona ${dl.dataset.code}? Kjo nuk kthehet mbrapsht.`)) {
        try { await api('/api/admin/properties/' + dl.dataset.del, { method: 'DELETE' }); toast('Prona u fshi.'); loadP(); refreshCounts(); } catch (err) { toast(err.message, 'err'); }
      }
    });
    loadP();
  }
  async function loadP() {
    const rows = await api('/api/admin/properties?' + new URLSearchParams(pFilter));
    const cols = admin() ? 9 : 8;
    $('#ptb').innerHTML = rows.length ? rows.map(p => {
      const canDel = admin() || p.approval !== 'approved';
      return `<tr>
      <td><img class="thumb" src="${esc(p.images[0] || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'"></td>
      <td><span class="t">${esc(p.title)}</span><small>${esc(p.code)} · ${esc(p.type)} · ${p.deal === 'qira' ? 'Qira' : 'Shitje'}${admin() && p.agent_name ? ' · ' + esc(p.agent_name) : ''}</small>
        <small class="${p.docs_missing ? 'muted' : 'ok-t'}" title="Dokumentet private">${ti('note')} ${p.docs} dok.${p.docs_missing ? ` · mungojnë ${p.docs_missing}` : ' · plot'}</small>${p.dupes?.length ? `<small class="dup-t">Mund të jetë e dyfishtë me ${p.dupes.map(d => esc(d.code)).join(', ')}</small>` : ''}</td>
      <td>${esc(p.city)}<br><small>${esc(p.zone)}</small></td>
      <td style="white-space:nowrap">${fmt(p.price)} €${p.deal === 'qira' ? '<small>/muaj</small>' : ''}</td>
      <td>${approvalTag(p)}${p.approval === 'rejected' && p.review_note ? `<small class="reason">${esc(p.review_note)}</small>` : ''}
        ${admin() && p.approval === 'pending' ? `<div class="row-acts" style="margin-top:.4rem"><button class="icon-btn ok" data-approve="${p.id}" aria-label="Mirato" title="Mirato">${ic.ok}</button><button class="icon-btn danger" data-reject="${p.id}" data-code="${esc(p.code)}" aria-label="Refuzo" title="Refuzo">${ic.no}</button></div>` : ''}</td>
      <td><select class="select" data-status="${p.id}" aria-label="Statusi">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      ${admin() ? `<td><button class="star" data-star="${p.id}" aria-pressed="${p.featured}" aria-label="E përzgjedhur">★</button></td>` : ''}
      <td>${fmt(p.views)}</td>
      <td><div class="row-acts">${p.buyers ? `<button class="icon-btn buy-btn" data-buyers="${p.id}" aria-label="${p.buyers} klientë presin" title="Klientë që presin një pronë si kjo">${ti('users')}<i>${p.buyers}</i></button>` : ''}<button class="icon-btn" data-edit="${p.id}" aria-label="Ndrysho" title="Ndrysho">${ic.edit}</button><a class="icon-btn" href="/property.html?id=${p.id}" target="_blank" aria-label="Shiko" title="${p.approval === 'approved' ? 'Shiko në faqe' : 'Parapamje'}">${ic.eye}</a>${canDel ? `<button class="icon-btn danger" data-del="${p.id}" data-code="${esc(p.code)}" aria-label="Fshi" title="Fshi">${ic.del}</button>` : ''}</div></td>
    </tr>`; }).join('') : `<tr><td colspan="${cols}" class="muted" style="padding:2rem;text-align:center">${admin() ? 'Asnjë pronë nuk përputhet.' : 'Nuk keni ende prona. Shtypni “Shto pronë” për të filluar.'}</td></tr>`;
  }

  /* forma e pronës */
  const pm = $('#pmodal'), pf = $('#pform');
  let editing = null, editingApproval = null, images = [];
  $('#p-type').innerHTML = TYPES.map(t => `<option>${t}</option>`).join('');
  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  function drawImgs() {
    $('#imgs').innerHTML = images.map((src, i) => `<figure>${i === 0 ? '<span class="cover">Kryesore</span>' : ''}<img src="${esc(src)}" alt="" onerror="this.src='${FALLBACK}'"><figcaption>
      <button type="button" data-mv="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Lëviz majtas">‹</button>
      ${i ? `<button type="button" data-cover="${i}">Bëje kryesore</button>` : '<span></span>'}
      <button type="button" data-mv="${i}" data-d="1" ${i === images.length - 1 ? 'disabled' : ''} aria-label="Lëviz djathtas">›</button>
      <button type="button" data-rm="${i}" aria-label="Hiq">✕</button></figcaption></figure>`).join('') || '<p class="muted" style="grid-column:1/-1;margin:0">Nuk ka foto ende. Prona me foto shikohet shumë më shpesh.</p>';
  }
  $('#imgs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.rm) images.splice(+b.dataset.rm, 1);
    if (b.dataset.cover) images.unshift(images.splice(+b.dataset.cover, 1)[0]);
    if (b.dataset.mv) { const i = +b.dataset.mv, j = i + +b.dataset.d; [images[i], images[j]] = [images[j], images[i]]; }
    drawImgs();
  });
  async function addFiles(files) {
    const msg = $('#pm-msg');
    for (const f of files) {
      msg.className = 'form-msg'; msg.textContent = `Po ngarkohet ${f.name}…`;
      try { images.push(await upload(f)); drawImgs(); } catch (e) { toast(e.message, 'err'); }
    }
    msg.textContent = '';
  }
  $('#p-files').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles([...e.dataTransfer.files]));
  $('#p-url-add').addEventListener('click', () => { const u = $('#p-url').value.trim(); if (!/^https?:\/\//.test(u)) return toast('Lidhja duhet të fillojë me https://', 'err'); images.push(u); $('#p-url').value = ''; drawImgs(); });

  async function openProperty(id = null, focus = '') {
    editing = id; editingApproval = null; pf.reset(); images = []; $('#pm-msg').textContent = '';
    fillOwner(null); $('#pm-dupes').hidden = true; $('#map-res').hidden = true; $('#map-q').value = '';
    $$('.admin-only', pm).forEach(el => el.hidden = !admin());
    if (admin()) {
      if (!agentsCache.length) agentsCache = await api('/api/admin/agents').catch(() => []);
      $('#p-agent').innerHTML = '<option value="">Pa agjent</option>' + agentsCache.map(a => `<option value="${a.id}">${esc(a.name)}${a.office_code ? ' · ' + esc(a.office_code) : ''}</option>`).join('');
      officesCache = await api('/api/admin/offices').catch(() => officesCache);
      $('#p-office').innerHTML = '<option value="">Pa zyrë (kodi DLX)</option>' + officesCache.map(o => `<option value="${o.id}">${esc(o.name)} · ${esc(o.code)}</option>`).join('');
    }
    $('#pm-title').textContent = id ? 'Ndrysho pronën' : 'Pronë e re';
    setTimeout(() => fillZoneList(pf.elements.city.value), 0);
    if (id) {
      try {
        const p = await api('/api/admin/properties/' + id);
        $('#pm-title').textContent = `Ndrysho ${p.code}`; editingApproval = p.approval;
        for (const [k, v] of Object.entries(p)) {
          const el = pf.elements[k]; if (!el || k === 'features') continue;
          if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
        }
        pf.elements.features.value = p.features.join(', ');
        images = [...p.images];
        fillOwner(p.owner);
        $('#pm-dupes').hidden = !(admin() && p.dupes?.length);
        if (admin() && p.dupes?.length) $('#pm-dupes').textContent = `Kujdes: mund të jetë e njëjtë me ${p.dupes.map(d => `${d.code} – ${d.title}${d.agent_name ? ' (' + d.agent_name + ')' : ''}`).join('; ')}.`;
      } catch (e) { return toast(e.message, 'err'); }
    }
    const note = $('#pm-note');
    note.hidden = admin();
    note.textContent = !id ? 'Pas ruajtjes, prona dërgohet për miratim te administratori dhe del në faqe pasi të miratohet.'
      : editingApproval === 'approved' ? 'Kujdes: pas ruajtjes, prona hiqet përkohësisht nga faqja derisa administratori të miratojë ndryshimet. Për të ndryshuar vetëm statusin (p.sh. E shitur), përdorni listën te tabela.'
      : 'Pas ruajtjes, prona dërgohet sërish për miratim.';
    $('#owner-save-row').hidden = !id;
    drawImgs(); pm.showModal(); if (!focus) $('#p-title').focus();
    loadDocs(focus); initMap();
  }
  pf.addEventListener('submit', async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(pf));
    f.furnished = pf.elements.furnished.checked; f.featured = pf.elements.featured.checked; f.images = images;
    f.features = String(f.features || '').split(',').map(s => s.trim()).filter(Boolean);
    f.owner = readOwner();
    const msg = $('#pm-msg'), btn = $('#pm-save'); btn.classList.add('loading');
    try {
      const p = await api('/api/admin/properties' + (editing ? '/' + editing : ''), { method: editing ? 'PUT' : 'POST', body: f });
      pm.close(); propsCache = null;
      toast(admin() ? (editing ? 'Ndryshimet u ruajtën.' : `Prona ${p.code} u shtua dhe duket në faqe.`) : (editing ? 'Ndryshimet u dërguan për miratim.' : `Prona ${p.code} u dërgua për miratim.`));
      if (p.dupes?.length) setTimeout(() => toast(`Kujdes: ngjan me ${p.dupes.map(d => d.code).join(', ')}. Administratori u njoftua.`, 'err'), 300);
      if (p.buyers && p.status === 'active') setTimeout(() => { toast(`${p.buyers} ${p.buyers === 1 ? 'klient pret' : 'klientë presin'} një pronë si kjo.`); openBuyers(p.id); }, 400);
      refreshCounts();
      if (location.hash === '#pronat') loadP(); else if (location.hash === '#miratime') route(); else go('pronat');
    } catch (err) { msg.className = 'form-msg err'; msg.textContent = err.message; }
    finally { btn.classList.remove('loading'); }
  });

  /* ---------- leads (portofoli) ---------- */
  let lFilter = { q: '', client_type: '', source: '', status: 'active', agent: '' };
  async function leads() {
    if (admin() && !agentsCache.length) agentsCache = await api('/api/admin/agents').catch(() => []);
    $('#view').innerHTML = `<div id="lv"><div class="top"><h1>${admin() ? 'Leads' : 'Portofoli im'}</h1><button class="btn" id="add-l">Shto lead</button></div>
      <div class="toolbar" style="margin:-1rem 0 1.4rem">
        <input class="input" id="lq" placeholder="Kërko emër, telefon, qytet" value="${esc(lFilter.q)}">
        <select class="select" id="lt">${opts(CTYPE, lFilter.client_type, 'Çdo lloj klienti')}</select>
        <select class="select" id="ls">${opts(SOURCE, lFilter.source, 'Çdo burim')}</select>
        <select class="select" id="lst">${opts(LSTATUS, lFilter.status, 'Çdo status')}</select>
        ${admin() ? `<select class="select" id="la"><option value="">Të gjithë agjentët</option><option value="none" ${lFilter.agent === 'none' ? 'selected' : ''}>Pa agjent</option>${agentsCache.map(a => `<option value="${a.id}" ${String(lFilter.agent) === String(a.id) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>` : ''}
      </div><div id="llist"></div></div>`;
    let t;
    $('#lq').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { lFilter.q = e.target.value; loadL(); }, 300); });
    [['#lt', 'client_type'], ['#ls', 'source'], ['#lst', 'status'], ['#la', 'agent']].forEach(([sel, k]) => $(sel)?.addEventListener('change', e => { lFilter[k] = e.target.value; loadL(); }));
    $('#add-l').addEventListener('click', () => openLead());
    $('#llist').addEventListener('click', e => { if (e.target.closest('a')) return; const c = e.target.closest('[data-lead]'); if (c) openLead(Number(c.dataset.lead)); });
    loadL();
  }
  async function loadL() {
    const rows = await api('/api/admin/leads?' + new URLSearchParams(lFilter));
    $('#llist').innerHTML = rows.length ? `<div class="lgrid">${rows.map(l => `<article class="lcard ${l.status !== 'active' ? 'dim' : ''}" data-lead="${l.id}">
      <div class="lc-h"><span class="av">${esc(l.name.split(' ').map(x => x[0]).join('').slice(0, 2))}</span><div><b>${esc(l.name)}</b><small>${esc(CTYPE[l.client_type])} · ${esc(SOURCE[l.source])}${l.status !== 'active' ? ' · ' + LSTATUS[l.status] : ''}</small></div></div>
      <div class="lc-m">${l.city || l.ptype ? `<span>${esc([l.ptype, l.city].filter(Boolean).join(', '))}</span>` : ''}${l.budget_max ? `<span>deri ${fmt(l.budget_max)} €</span>` : ''}${admin() ? `<span class="${l.agent_name ? '' : 'gold'}">${esc(l.agent_name || 'Pa agjent')}</span>` : ''}</div>
      <div class="lc-f"><span>${l.open_opps ? `${l.open_opps} opportunitet${l.open_opps > 1 ? 'e' : ''}` : '<span class="muted">Pa opportunitet</span>'} ${dueTag(l.next_date)}${l.stale ? ` <span class="due late" title="Pa telefonatë, mesazh, vizitë ose shënim">${l.stale} ditë pa kontakt</span>` : ''}</span>
        <span class="lc-a">${l.phone ? `<a class="icon-btn" href="tel:${telOf(l.phone)}" aria-label="Telefono">${ti('phone')}</a><a class="icon-btn wa" href="https://wa.me/${waOf(l.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ti('wa')}</a>` : ''}</span></div>
    </article>`).join('')}</div>` : `<div class="empty"><h3>${lFilter.q || lFilter.client_type || lFilter.source ? 'Asnjë lead nuk përputhet' : 'Portofoli është bosh'}</h3>Kërkesat nga faqja shtohen këtu vetë. Klientët nga telefoni, Instagrami ose zyra i shtoni me “Shto lead”.</div>`;
  }

  const lm = $('#lmodal'), lf = $('#lform'); let curLead = null;
  async function openLead(id = null) {
    curLead = null; lf.reset(); $('#lm-msg').textContent = '';
    if (admin()) {
      if (!agentsCache.length) agentsCache = await api('/api/admin/agents').catch(() => []);
      $('#l-agent').innerHTML = '<option value="">Pa agjent</option>' + agentsCache.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
    }
    $$('.admin-only', lm).forEach(el => el.hidden = !admin());
    $('#l-type').innerHTML = opts(CTYPE); $('#l-source').innerHTML = opts(SOURCE); $('#l-status').innerHTML = opts(LSTATUS);
    if (id) {
      try { curLead = await api('/api/admin/leads/' + id); } catch (e) { return toast(e.message, 'err'); }
      for (const k of ['name', 'phone', 'email', 'client_type', 'source', 'status', 'budget_min', 'budget_max', 'city', 'ptype', 'notes', 'agent_id']) if (lf.elements[k]) lf.elements[k].value = curLead[k] ?? '';
    }
    drawLead();
    if (!lm.open) lm.showModal();
    if (!id) $('#l-name').focus();
  }
  function drawLead() {
    const l = curLead;
    $('#lm-title').textContent = l ? l.name : 'Lead i ri';
    $('#lm-sub').innerHTML = l ? `${esc(CTYPE[l.client_type])} · ${esc(SOURCE[l.source])} · ${esc(LSTATUS[l.status])}${l.agent_name ? ' · ' + esc(l.agent_name) : ''}` : 'Klient nga telefoni, Instagrami, zyra ose rekomandimi';
    $('#lm-quick').innerHTML = l && l.phone ? `<a class="btn ghost sm" href="tel:${telOf(l.phone)}" data-log="call">${ti('phone')}Telefono</a><a class="btn ghost sm wa" href="https://wa.me/${waOf(l.phone)}" target="_blank" rel="noopener" data-log="whatsapp">${ti('wa')}WhatsApp</a>${l.email ? `<a class="btn ghost sm" href="mailto:${esc(l.email)}" data-log="email">${ti('mail')}Email</a>` : ''}` : '';
    $('#lm-details').open = !l;
    $('#lm-crm').hidden = !l;
    $('#lm-del').hidden = !(l && admin());
    if (!l) return;
    $('#lm-opps').innerHTML = l.opportunities.length ? l.opportunities.map(o => `<li data-opp="${o.id}" class="clickable"><span><b style="font-weight:500">${esc(o.title)}</b><br><small class="muted">${[o.value ? fmt(o.value) + ' €' : '', o.commission ? 'komision ' + fmt(o.commission) + ' €' : '', o.next_action ? esc(o.next_action) : ''].filter(Boolean).join(' · ')}</small>${matchBadge(o) ? '<br>' + matchBadge(o) : ''}</span><span style="text-align:right">${stageTag(o.stage)}<br>${['won', 'lost'].includes(o.stage) ? '' : dueTag(o.next_date)}</span></li>`).join('') : '<li class="muted">Asnjë ende. Krijoni një kur klienti interesohet për një pronë ose shërbim.</li>';
    $('#la-opp').innerHTML = '<option value="">Pa lidhje me opportunity</option>' + l.opportunities.filter(o => !['won', 'lost'].includes(o.stage)).map(o => `<option value="${o.id}">${esc(o.title)}</option>`).join('');
    $('#lm-acts').innerHTML = l.activities.map(a => `<li class="act act-${a.type}">${ti(ACT[a.type]?.[1] || 'note')}<div><div class="act-h"><b>${esc(ACT[a.type]?.[0] || a.type)}</b><small class="muted">${esc(a.author || '')} · ${date(a.created_at)}</small></div>${a.text ? `<p>${esc(a.text)}</p>` : ''}</div></li>`).join('') || '<li class="muted">Ende pa histori.</li>';
  }
  lf.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(lf));
    const btn = $('#lm-save'); btn.classList.add('loading');
    try {
      const r = await api('/api/admin/leads' + (curLead ? '/' + curLead.id : ''), { method: curLead ? 'PUT' : 'POST', body });
      toast(curLead ? 'Të dhënat u ruajtën.' : 'Lead-i u shtua në portofol.');
      await openLead(r.id); if (ADMIN_VIEW_NOW() === 'leads') loadL();
    } catch (err) { $('#lm-msg').className = 'form-msg err'; $('#lm-msg').textContent = err.message; }
    finally { btn.classList.remove('loading'); }
  });
  $('#lm-quick').addEventListener('click', e => {
    const a = e.target.closest('[data-log]'); if (!a || !curLead) return;
    const text = { call: 'Telefonatë me klientin', whatsapp: 'Mesazh në WhatsApp', email: 'Email për klientin' }[a.dataset.log];
    api(`/api/admin/leads/${curLead.id}/activities`, { method: 'POST', body: { type: a.dataset.log, text } }).then(() => setTimeout(() => openLead(curLead.id), 300)).catch(() => {});
  });
  $('#la-form').addEventListener('submit', async e => {
    e.preventDefault(); if (!curLead) return;
    const f = Object.fromEntries(new FormData(e.target));
    try { await api(`/api/admin/leads/${curLead.id}/activities`, { method: 'POST', body: f }); e.target.reset(); toast('U shtua në historik.'); openLead(curLead.id); }
    catch (err) { toast(err.message, 'err'); }
  });
  $('#lm-opps').addEventListener('click', e => { const li = e.target.closest('[data-opp]'); if (li) openOpp(Number(li.dataset.opp)); });
  $('#lm-addopp').addEventListener('click', () => curLead && openOpp(null, curLead.id));
  $('#lm-del').addEventListener('click', async () => {
    if (!curLead || !confirm(`Të fshihet ${curLead.name} me gjithë opportunitetet dhe historikun?`)) return;
    try { await api('/api/admin/leads/' + curLead.id, { method: 'DELETE' }); lm.close(); toast('Lead-i u fshi.'); route(); } catch (err) { toast(err.message, 'err'); }
  });
  const ADMIN_VIEW_NOW = () => (location.hash.slice(1) || 'paneli');

  /* ---------- opportunitete (kanban) ---------- */
  let oFilter = { q: '', agent: '' }, propsCache = null;
  async function opportunitete() {
    if (admin() && !agentsCache.length) agentsCache = await api('/api/admin/agents').catch(() => []);
    $('#view').innerHTML = `<div id="ov"><div class="top"><h1>Opportunitete</h1><button class="btn" id="add-o">Shto opportunity</button></div>
      <div class="toolbar" style="margin:-1rem 0 1rem"><input class="input" id="oq" placeholder="Kërko klient, pronë, kod" value="${esc(oFilter.q)}">
      ${admin() ? `<select class="select" id="oa"><option value="">Të gjithë agjentët</option><option value="none">Pa agjent</option>${agentsCache.map(a => `<option value="${a.id}" ${String(oFilter.agent) === String(a.id) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>` : ''}</div>
      <p class="muted hint-k">Tërhiqni kartat nga një fazë te tjetra, ose përdorni shigjetat ‹ › në kartë.</p>
      <div class="kanban" id="kb"></div></div>`;
    let t;
    $('#oq').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { oFilter.q = e.target.value; loadO(); }, 300); });
    $('#oa')?.addEventListener('change', e => { oFilter.agent = e.target.value; loadO(); });
    $('#add-o').addEventListener('click', () => openOpp());
    const kb = $('#kb');
    kb.addEventListener('click', async e => {
      const mv = e.target.closest('[data-mv]');
      if (mv) { e.stopPropagation(); const i = STAGES.indexOf(mv.dataset.from) + Number(mv.dataset.mv); if (i >= 0 && i < STAGES.length) await moveStage(Number(mv.dataset.id), STAGES[i]); return; }
      if (e.target.closest('a')) return;
      const c = e.target.closest('[data-card]'); if (c) openOpp(Number(c.dataset.card));
    });
    kb.addEventListener('dragstart', e => { const c = e.target.closest('[data-card]'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.card); c.classList.add('drag'); } });
    kb.addEventListener('dragend', e => e.target.closest('[data-card]')?.classList.remove('drag'));
    kb.addEventListener('dragover', e => { const col = e.target.closest('[data-col]'); if (col) { e.preventDefault(); $$('.kcol.over', kb).forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); } });
    kb.addEventListener('dragleave', e => { const col = e.target.closest('[data-col]'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
    kb.addEventListener('drop', async e => { const col = e.target.closest('[data-col]'); if (!col) return; e.preventDefault(); col.classList.remove('over'); const id = Number(e.dataTransfer.getData('text/plain')); if (id) await moveStage(id, col.dataset.col); });
    loadO();
  }
  async function moveStage(id, stage) {
    let lost_reason = '';
    if (stage === 'lost') { lost_reason = await askText('Pse u humb?', 'Arsyeja (p.sh. bleu diku tjetër, buxheti, ndryshoi mendje)', 'Shëno si të humbur'); if (lost_reason === null) return; }
    try { await api('/api/admin/opportunities/' + id, { method: 'PATCH', body: { stage, lost_reason } }); toast(stage === 'won' ? 'Urime! Opportunity-ja u fitua.' : `U kalua te “${STAGE[stage]}”.`); if ($('#kb')) loadO(); refreshCounts(); }
    catch (err) { toast(err.message, 'err'); }
  }
  const matchBadge = o => ['won', 'lost'].includes(o.stage) || o.side === 'supply' || !o.match_count ? '' : `<span class="mb ${o.match_new ? 'fresh' : ''}">${o.match_count} ${o.match_count === 1 ? 'pronë përputhet' : 'prona përputhen'}${o.match_new ? ` · ${o.match_new} ${o.match_new === 1 ? 'e re' : 'të reja'}` : ''}</span>`;
  async function loadO() {
    const rows = await api('/api/admin/opportunities?' + new URLSearchParams(oFilter));
    $('#kb').innerHTML = STAGES.map(st => {
      const list = rows.filter(o => o.stage === st), sum = list.reduce((t, o) => t + (o.value || 0), 0);
      return `<section class="kcol kc-${st}" data-col="${st}"><header><span>${STAGE[st]} <b>${list.length}</b></span><small>${sum ? fmt(sum) + ' €' : ''}</small></header>
        <div class="kcards">${list.map(o => `<article class="kcard" draggable="true" data-card="${o.id}">
          <b>${esc(o.title)}</b><span class="kc-l">${esc(o.lead_name)}${admin() ? ` · <span class="${o.agent_name ? '' : 'gold'}">${esc(o.agent_name || 'Pa agjent')}</span>` : ''}</span>
          <span class="kc-v">${o.value ? fmt(o.value) + ' €' : ''}${o.commission ? ` <small>· kom. ${fmt(o.commission)} €</small>` : ''}</span>
          ${matchBadge(o)}
          ${['won', 'lost'].includes(o.stage) ? (o.stage === 'lost' && o.lost_reason ? `<small class="muted">${esc(o.lost_reason)}</small>` : '') : `<span class="kc-n">${o.next_action ? esc(o.next_action) + ' ' : ''}${dueTag(o.next_date)}</span>`}
          <div class="kc-a"><button type="button" data-mv="-1" data-from="${st}" data-id="${o.id}" ${st === 'new' ? 'disabled' : ''} aria-label="Faza e mëparshme">‹</button>
            ${o.lead_phone ? `<a href="tel:${telOf(o.lead_phone)}" aria-label="Telefono">${ti('phone')}</a><a href="https://wa.me/${waOf(o.lead_phone)}" target="_blank" rel="noopener" aria-label="WhatsApp" class="wa">${ti('wa')}</a>` : ''}
            <button type="button" data-mv="1" data-from="${st}" data-id="${o.id}" ${st === 'lost' ? 'disabled' : ''} aria-label="Faza tjetër">›</button></div>
        </article>`).join('') || '<p class="kempty">—</p>'}</div></section>`;
    }).join('');
  }

  const om = $('#omodal'), of = $('#oform');
  let curOpp = null, oZones = [], oTouched = false, oSeq = 0, oItems = [], oLeadPhone = '', oLeadName = '';
  $('#o-ctype').innerHTML = '<option value="">Çdo lloj</option>' + TYPES.map(t => `<option>${t}</option>`).join('');
  const whoAmI = () => USER.agent?.name || 'De Luxe Real Estate';
  const propLine = p => [p.code, [p.zone, p.city].filter(Boolean).join(', '), p.area ? fmt(p.area) + ' m²' : '', p.rooms ? p.rooms + '+1' : ''].filter(Boolean).join(' · ');
  const priceOf = p => `${fmt(p.price)} €${p.deal === 'qira' ? ' / muaj' : ''}`;
  const scoreTag = n => `<span class="m-score ${n >= 80 ? 'hi' : n >= 60 ? 'mid' : 'lo'}" title="Sa i përshtatet kërkesave">${n}%</span>`;
  const whyTags = r => `<div class="m-why">${(r || []).map(x => `<span class="why ${x.s}">${x.s === 'ok' ? '✓' : x.s === 'part' ? '≈' : '✕'} ${esc(x.t)}</span>`).join('')}</div>`;
  const MSTATE = { proposed: 'Propozuar', liked: 'I pëlqeu', dismissed: 'Nuk i pëlqeu' };
  // Mesazhi që i shkon klientit në WhatsApp me një ose disa prona
  function waText(name, props) {
    const first = (name || '').split(' ')[0];
    const body = props.map(p => `${p.title}\n${[p.zone, p.city].filter(Boolean).join(', ')} · ${priceOf(p)}\n${location.origin}/property.html?id=${p.id}`).join('\n\n');
    return `Përshëndetje${first ? ' ' + first : ''}, ${props.length > 1 ? 'këto prona mendoj se ju përshtaten' : 'kjo pronë mendoj se ju përshtatet'}:\n\n${body}\n\n${whoAmI()} – De Luxe Real Estate`;
  }
  const waUrl = (phone, text) => `https://wa.me/${waOf(phone)}?text=${encodeURIComponent(text)}`;

  /* kërkesat e klientit */
  function drawZones() {
    $$('#o-zones .chip').forEach(c => c.remove());
    $('#o-zone-in').insertAdjacentHTML('beforebegin', oZones.map((z, i) => `<span class="chip">${esc(z)}<button type="button" data-zrm="${i}" aria-label="Hiq ${esc(z)}">×</button></span>`).join(''));
  }
  function addZone(v) {
    v = String(v || '').trim().replace(/,$/, ''); if (!v) return;
    if (!oZones.some(z => z.toLowerCase() === v.toLowerCase())) oZones.push(v);
    $('#o-zone-in').value = ''; drawZones(); oTouched = true; queueMatches();
  }
  $('#o-zone-in').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addZone(e.target.value); } else if (e.key === 'Backspace' && !e.target.value && oZones.length) { oZones.pop(); drawZones(); queueMatches(); } });
  $('#o-zone-in').addEventListener('change', e => addZone(e.target.value));
  $('#o-zone-in').addEventListener('input', e => { if ($$('#zone-list option').some(o => o.value === e.target.value)) addZone(e.target.value); });
  $('#o-zones').addEventListener('click', e => { const b = e.target.closest('[data-zrm]'); if (b) { oZones.splice(+b.dataset.zrm, 1); drawZones(); oTouched = true; queueMatches(); } else $('#o-zone-in').focus(); });
  $('#o-ccity').addEventListener('input', e => fillZoneList(e.target.value.trim()));
  function setCrit(c) {
    for (const k of ['deal', 'c_type', 'c_city', 'c_price_min', 'c_price_max', 'c_rooms', 'c_area_min']) if (k in c) of.elements[k].value = c[k] ?? '';
    of.elements.c_furnished.checked = !!c.c_furnished; of.elements.c_parking.checked = !!c.c_parking;
    let z = c.c_zones; if (typeof z === 'string') { try { z = JSON.parse(z); } catch { z = []; } }
    oZones = Array.isArray(z) ? [...z] : []; drawZones(); fillZoneList(of.elements.c_city.value);
  }
  function critBody() {
    const f = Object.fromEntries(new FormData(of));
    return { ...f, c_zones: oZones, c_furnished: of.elements.c_furnished.checked, c_parking: of.elements.c_parking.checked };
  }
  function setSide(side) {
    of.elements.side.value = side;
    $$('#o-side button').forEach(b => b.classList.toggle('on', b.dataset.side === side));
    $$('.crit', om).forEach(el => el.hidden = side === 'supply');
    $('#o-prop-l').textContent = side === 'supply' ? 'Prona e klientit' : 'Prona e zgjedhur';
    $('#o-prop-h').textContent = side === 'supply' ? 'Zgjidhni pronën që klienti shet ose jep me qira. Nëse nuk është ende në sistem, shtojeni te “Pronat”.' : 'Plotësohet kur klienti vendos për një pronë – ose shtypni “Lidhe” te një pronë në listë.';
  }
  $('#o-side').addEventListener('click', e => { const b = e.target.closest('[data-side]'); if (b) { setSide(b.dataset.side); queueMatches(); } });

  async function openOpp(id = null, leadId = null) {
    curOpp = null; of.reset(); oZones = []; oTouched = false; oItems = []; $('#om-msg').textContent = ''; $('#o-matches').innerHTML = '';
    $$('.admin-only', om).forEach(el => el.hidden = !admin());
    if (!propsCache) {
      propsCache = [];
      for (let pg = 1; pg <= 10; pg++) { const r = await api(`/api/properties?limit=48&page=${pg}&sort=newest`).catch(() => null); if (!r) break; propsCache.push(...r.items); if (pg >= r.pages) break; }
      const own = await api('/api/admin/properties').catch(() => []); // edhe pronat në pritje ose të fshehura (të vetat; për administratorin të gjitha)
      own.forEach(p => { if (!propsCache.some(x => x.id === p.id)) propsCache.push(p); });
    }
    $('#o-prop').innerHTML = '<option value="">Pa pronë të caktuar</option>' + propsCache.map(p => `<option value="${p.id}">${esc(p.code)} – ${esc(p.title)} (${fmt(p.price)} €)</option>`).join('');
    $('#o-stage').innerHTML = opts(STAGE);
    if (admin()) { if (!agentsCache.length) agentsCache = await api('/api/admin/agents').catch(() => []); $('#o-agent').innerHTML = '<option value="">Si lead-i</option>' + agentsCache.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join(''); }
    let side = 'demand';
    if (id) {
      try { curOpp = await api('/api/admin/opportunities/' + id); } catch (e) { return toast(e.message, 'err'); }
      leadId = curOpp.lead_id; side = curOpp.side || 'demand';
      if (curOpp.property_id && !propsCache.some(p => p.id === curOpp.property_id)) $('#o-prop').insertAdjacentHTML('beforeend', `<option value="${curOpp.property_id}">${esc(curOpp.property_code || '')} – ${esc(curOpp.property_title || '')}</option>`);
      for (const k of ['title', 'stage', 'value', 'commission', 'next_action', 'next_date', 'lost_reason', 'property_id', 'agent_id']) if (of.elements[k]) of.elements[k].value = curOpp[k] || '';
      setCrit(curOpp); oLeadPhone = curOpp.lead_phone || ''; oLeadName = curOpp.lead_name || '';
    } else {
      of.elements.next_date.value = todayStr(); of.elements.stage.value = 'new'; oLeadPhone = ''; oLeadName = '';
      setCrit({});
      // Kërkesat nisen nga ato që dihen për klientin (lloji, qyteti, buxheti)
      if (leadId && curLead?.id === leadId) { if (curLead.suggest) setCrit(curLead.suggest); side = ['shites', 'qiradhenes'].includes(curLead.client_type) ? 'supply' : 'demand'; oLeadPhone = curLead.phone || ''; oLeadName = curLead.name; }
    }
    const leadSel = $('#o-lead');
    if (leadId) { leadSel.innerHTML = `<option value="${leadId}">${esc(curOpp?.lead_name || curLead?.name || 'Lead-i')}</option>`; leadSel.disabled = true; }
    else { const ls = await api('/api/admin/leads?status=active').catch(() => []); leadSel.disabled = false; leadSel.innerHTML = ls.length ? '<option value="">Zgjidhni klientin…</option>' + ls.map(l => `<option value="${l.id}">${esc(l.name)} · ${esc(l.phone || l.email)}</option>`).join('') : '<option value="">Shtoni fillimisht një lead</option>'; }
    $('#om-title').textContent = curOpp ? curOpp.title : 'Opportunity e re';
    $('#om-sub').textContent = curOpp ? `${curOpp.lead_name}${admin() && curOpp.agent_name ? ' · ' + curOpp.agent_name : ''}` : 'Plotësoni çfarë kërkon klienti – pronat që përputhen dalin menjëherë';
    $('#om-del').hidden = !curOpp; $('#om-lead').hidden = !curOpp; $('#om-visit').hidden = !curOpp;
    drawSplit();
    $('#o-more').open = !matchMedia('(max-width:900px)').matches; // në telefon pronat që përputhen dalin menjëherë pas kërkesave
    setSide(side); toggleLost();
    if (!om.open) om.showModal();
    loadMatches(true);
  }
  // Klienti i zgjedhur te një opportunity e re: merren kërkesat e tij të njohura
  $('#o-lead').addEventListener('change', async e => {
    if (curOpp || !e.target.value) return;
    try {
      const l = await api('/api/admin/leads/' + e.target.value);
      oLeadPhone = l.phone || ''; oLeadName = l.name;
      if (!oTouched) { setCrit(l.suggest || {}); setSide(['shites', 'qiradhenes'].includes(l.client_type) ? 'supply' : 'demand'); loadMatches(); }
    } catch {}
  });
  const toggleLost = () => { $('#o-lostf').hidden = of.elements.stage.value !== 'lost'; };
  of.elements.stage.addEventListener('change', toggleLost);
  $('#o-prop').addEventListener('change', e => {
    const p = propsCache.find(x => x.id === Number(e.target.value));
    if (p) { if (!of.elements.value.value) of.elements.value.value = p.price; of.elements.deal.value = p.deal; }
    loadMatches();
  });
  let oTimer;
  const queueMatches = () => { clearTimeout(oTimer); oTimer = setTimeout(() => loadMatches(), 350); };
  $$('.crit input:not(#o-zone-in), .crit select, #o-deal', om).forEach(el => el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => { oTouched = true; queueMatches(); }));

  /* lista e match-eve në anën e djathtë */
  async function loadMatches(seen = false) {
    const box = $('#o-matches'), seq = ++oSeq, side = of.elements.side.value;
    try {
      if (side === 'supply') {
        const pid = Number(of.elements.property_id.value);
        if (!pid) { box.innerHTML = `<div class="m-head"><h4>Klientë që presin</h4></div><p class="m-hint">Zgjidhni pronën e klientit majtas. Sistemi kërkon te të gjithë agjentët blerësit ose qiramarrësit që presin një pronë të tillë.</p>`; return; }
        const d = await api(`/api/admin/properties/${pid}/buyers`); if (seq !== oSeq) return;
        box.innerHTML = buyersHtml(d);
        return;
      }
      const d = await api('/api/admin/match/preview', { method: 'POST', body: { ...critBody(), opp_id: curOpp?.id || null, seen } }); if (seq !== oSeq) return;
      oItems = d.items;
      const live = d.items.filter(m => m.state !== 'dismissed'), gone = d.items.filter(m => m.state === 'dismissed');
      const fresh = live.filter(m => !m.state && !m.linked).slice(0, 3);
      const list = d.has_criteria ? live : live.filter(m => m.linked || m.state);
      box.innerHTML = `<div class="m-head"><h4>Prona që përputhen <b>${d.has_criteria ? live.length : 0}</b></h4>
          ${curOpp && oLeadPhone && d.has_criteria && fresh.length > 1 ? `<button class="btn ghost sm wa" type="button" data-mall>${ti('wa')}Dërgo ${fresh.length} më të mirat</button>` : ''}</div>
        ${!d.has_criteria ? '<p class="m-hint">Plotësoni të paktën llojin, qytetin ose buxhetin. Pronat e gjithë agjencisë që i përshtaten klientit shfaqen këtu, me përqindjen e përputhjes.</p>'
          : !live.length ? '<p class="m-hint">Asnjë pronë nuk përputhet tani. Provoni të zgjeroni buxhetin ose lagjet. Sapo të hyjë një pronë e përshtatshme, do ta shihni te “Për sot”.</p>' : ''}
        ${!curOpp && list.length ? '<p class="muted" style="margin:0;font-size:.88rem">Ruajeni opportunity-në për t’ia propozuar pronat klientit.</p>' : ''}
        <div class="mlist">${list.map(matchCard).join('')}</div>
        ${gone.length ? `<details class="m-more"><summary>Nuk i pëlqyen (${gone.length})</summary><div class="mlist">${gone.map(matchCard).join('')}</div></details>` : ''}`;
    } catch (e) { if (seq === oSeq) box.innerHTML = `<p class="m-hint">${esc(e.message)}</p>`; }
  }
  function matchCard(m) {
    const other = m.agent_name && (admin() || m.agent_id !== USER.agent?.id);
    const tags = [m.linked ? '<span class="ap ap-pending">Prona e zgjedhur</span>' : '', m.state ? `<span class="ap ${m.state === 'liked' ? 'ap-approved' : m.state === 'dismissed' ? 'ap-rejected' : ''}">${MSTATE[m.state]}</span>` : '', m.is_new ? '<span class="ap ap-pending">E re</span>' : ''].join('');
    const acts = !curOpp ? '' : m.state === 'dismissed' ? `<button class="btn ghost" type="button" data-mact="clear">Ktheje në listë</button>` : `
      ${oLeadPhone ? `<button class="btn wa-b" type="button" data-mact="wa">${ti('wa')}${m.state ? 'Dërgo sërish' : 'Dërgoja klientit'}</button>` : !m.state ? `<button class="btn" type="button" data-mact="proposed">Shëno si të propozuar</button>` : ''}
      ${m.state !== 'liked' ? `<button class="btn ghost" type="button" data-mact="liked">I pëlqeu</button>` : ''}
      <button class="btn ghost" type="button" data-mact="dismissed">Nuk i pëlqeu</button>
      ${!m.linked ? `<button class="btn ghost" type="button" data-mact="link" title="Bëje pronën e kësaj opportunity-je">Lidhe</button>` : ''}
      <button class="btn ghost" type="button" data-mact="visit">Vizitë</button>`;
    return `<article class="mcard ${m.state || ''} ${m.linked ? 'linked' : ''} ${m.is_new ? 'is-new' : ''}" data-pid="${m.id}">
      <a class="m-img" href="/property.html?id=${m.id}" target="_blank" rel="noopener" tabindex="-1"><img src="${esc(m.image || FALLBACK)}" alt="" loading="lazy" onerror="this.src='${FALLBACK}'"></a>
      <div class="m-b">
        <div class="m-top">${scoreTag(m.score)}<a class="m-t" href="/property.html?id=${m.id}" target="_blank" rel="noopener">${esc(m.title)}</a></div>
        <span class="m-meta">${esc(propLine(m))}</span>
        <span class="m-price">${priceOf(m)}</span>
        ${whyTags(m.reasons)}
        ${tags ? `<div class="m-tags">${tags}</div>` : ''}
        ${other ? `<span class="m-meta">Agjenti i pronës: <b style="color:var(--text);font-weight:500">${esc(m.agent_name)}</b>${m.agent_phone ? ` · <a class="gold" href="tel:${telOf(m.agent_phone)}">${esc(m.agent_phone)}</a>` : ''}</span>` : ''}
        ${acts ? `<div class="m-acts">${acts}</div>` : ''}
      </div></article>`;
  }
  const setMatch = (pid, body) => api(`/api/admin/opportunities/${curOpp.id}/matches/${pid}`, { method: 'POST', body });
  $('#o-matches').addEventListener('click', async e => {
    const all = e.target.closest('[data-mall]'), b = e.target.closest('[data-mact]'), bo = e.target.closest('[data-bopen]'), bw = e.target.closest('[data-bwa]');
    if (bo) return openOpp(Number(bo.dataset.bopen));
    if (bw) return buyerWa(bw);
    if (!curOpp) return;
    try {
      if (all) {
        const top = oItems.filter(m => !m.state && !m.linked).slice(0, 3); if (!top.length) return;
        window.open(waUrl(oLeadPhone, waText(oLeadName, top)), '_blank', 'noopener');
        for (const m of top) await setMatch(m.id, { status: 'proposed', via: 'whatsapp' });
        toast(`${top.length} prona iu dërguan klientit dhe u shënuan në historik.`);
      } else if (b) {
        const pid = Number(b.closest('[data-pid]').dataset.pid), m = oItems.find(x => x.id === pid), act = b.dataset.mact;
        if (act === 'wa') { window.open(waUrl(oLeadPhone, waText(oLeadName, [m])), '_blank', 'noopener'); await setMatch(pid, { status: m.state === 'liked' ? 'liked' : 'proposed', via: 'whatsapp' }); toast('U shënua si e propozuar.'); }
        else if (act === 'dismissed') { const note = await askText('Pse nuk i pëlqeu?', 'Arsyeja (opsionale) – p.sh. kati, çmimi, zhurma', 'Hiqe nga lista'); if (note === null) return; await setMatch(pid, { status: 'dismissed', note }); toast('U hoq nga lista e këtij klienti.'); }
        else if (act === 'clear') await setMatch(pid, { status: null });
        else if (act === 'visit') { return openVisit({ lead_id: curOpp.lead_id, opp_id: curOpp.id, property_id: pid }); }
        else if (act === 'link') { await setMatch(pid, { link: true }); of.elements.property_id.value = pid; if (!of.elements.value.value || of.elements.value.value === '0') of.elements.value.value = m.price; curOpp.property_id = pid; toast('Prona u lidh me opportunity-në.'); }
        else { await setMatch(pid, { status: act }); toast(act === 'liked' ? 'U shënua: i pëlqeu.' : 'U shënua si e propozuar.'); }
      } else return;
      await loadMatches(); if ($('#kb')) loadO(); if (lm.open && curLead) openLead(curLead.id);
    } catch (err) { toast(err.message, 'err'); }
  });

  /* pronë → klientë që presin (nga gjithë agjencia) */
  let bProp = null;
  function critLine(c) {
    return [[c.type || 'Pronë', c.rooms ? c.rooms + '+1' : ''].filter(Boolean).join(' '), c.zones.length ? c.zones.join(', ') : c.city, c.price_max ? 'deri ' + fmt(c.price_max) + ' €' : c.price_min ? 'nga ' + fmt(c.price_min) + ' €' : '', c.area_min ? 'nga ' + c.area_min + ' m²' : ''].filter(Boolean).join(' · ');
  }
  function buyersHtml(d) {
    bProp = d.property;
    const p = d.property, word = p.deal === 'qira' ? 'qiramarrës' : 'blerës';
    return `<div class="m-head"><h4>Klientë që presin <b>${d.items.length}</b></h4></div>
      <p class="muted" style="margin:0;font-size:.88rem">${esc(p.code)} – ${esc(p.title)} · ${priceOf(p)}${p.live ? '' : ' · <span class="gold">ende jo në faqe</span>'}</p>
      ${d.items.length ? '' : `<p class="m-hint">Asnjë ${word} i hapur nuk kërkon një pronë të tillë tani. Kur një agjent hedh një kërkesë që përputhet, klienti shfaqet këtu.</p>`}
      <div class="mlist">${d.items.map(b => `<article class="mcard bcard ${b.state || ''}">
        <div class="m-b">
          <div class="m-top">${scoreTag(b.score)}<span class="m-t">${b.mine ? esc(b.lead_name) : `Klient i ${esc(b.agent_name || 'një agjenti tjetër')}`}</span></div>
          <span class="m-meta">Kërkon: ${esc(critLine(b.criteria))}</span>
          ${whyTags(b.reasons)}
          <div class="m-tags">${stageTag(b.stage)}${b.state ? `<span class="ap ${b.state === 'liked' ? 'ap-approved' : ''}">${MSTATE[b.state]}</span>` : ''}${b.linked ? '<span class="ap ap-pending">Po e shqyrton këtë pronë</span>' : ''}${b.mine && admin() && b.agent_name ? `<span class="m-meta">${esc(b.agent_name)}</span>` : ''}</div>
          <div class="m-acts">${b.mine
            ? `${b.lead_phone && p.live ? `<button class="btn wa-b" type="button" data-bwa="${b.opp_id}" data-phone="${esc(b.lead_phone)}" data-name="${esc(b.lead_name)}">${ti('wa')}Dërgoja klientit</button>` : ''}<button class="btn ghost" type="button" data-bopen="${b.opp_id}">Hap opportunity-në</button>`
            : b.agent_phone ? `<a class="btn wa-b" target="_blank" rel="noopener" href="${esc(waUrl(b.agent_phone, `Përshëndetje ${(b.agent_name || '').split(' ')[0]}, kam pronën ${p.code} – ${p.title} (${priceOf(p)}) që i përshtatet një klienti tënd: ${critLine(b.criteria)}.\n${location.origin}/property.html?id=${p.id}\n\n${whoAmI()}`))}">${ti('wa')}Shkruaji agjentit</a><a class="btn ghost" href="tel:${telOf(b.agent_phone)}">${ti('phone')}Telefono</a>` : '<span class="m-meta">Kontaktoni administratorin për këtë klient.</span>'}</div>
        </div></article>`).join('')}</div>`;
  }
  async function buyerWa(btn) {
    if (!bProp) return;
    const full = propsCache?.find(x => x.id === bProp.id) || bProp;
    window.open(waUrl(btn.dataset.phone, waText(btn.dataset.name, [{ ...full, id: bProp.id }])), '_blank', 'noopener');
    try { await api(`/api/admin/opportunities/${btn.dataset.bwa}/matches/${bProp.id}`, { method: 'POST', body: { status: 'proposed', via: 'whatsapp' } }); toast('U shënua si e propozuar te klienti.'); btn.textContent = 'U dërgua'; } catch (err) { toast(err.message, 'err'); }
  }
  async function openBuyers(pid) {
    try {
      const d = await api(`/api/admin/properties/${pid}/buyers`);
      $('#b-sub').textContent = 'Kërkesat e hapura nga të gjithë agjentët që i përshtaten kësaj prone';
      $('#b-list').innerHTML = buyersHtml(d); $('#bmodal').showModal();
    } catch (e) { toast(e.message, 'err'); }
  }
  $('#b-list').addEventListener('click', e => {
    const bo = e.target.closest('[data-bopen]'), bw = e.target.closest('[data-bwa]');
    if (bo) { $('#bmodal').close(); openOpp(Number(bo.dataset.bopen)); }
    if (bw) buyerWa(bw);
  });

  of.addEventListener('submit', async e => {
    e.preventDefault();
    const body = critBody(); body.lead_id = $('#o-lead').value;
    if (admin() && $('#o-split-agent')) { body.split_agent_id = $('#o-split-agent').value; body.split_pct = $('#o-split-pct').value; }
    if (!body.lead_id) { $('#om-msg').className = 'form-msg err'; $('#om-msg').textContent = 'Zgjidhni klientin (lead-in).'; return; }
    const btn = $('#om-save'); btn.classList.add('loading');
    try {
      const isNew = !curOpp;
      const o = await api('/api/admin/opportunities' + (curOpp ? '/' + curOpp.id : ''), { method: curOpp ? 'PUT' : 'POST', body });
      refreshCounts();
      if (lm.open && curLead) openLead(curLead.id);
      if ($('#kb')) loadO(); else if ($('#today')) route();
      if (isNew) {
        // Opportunity e re mbetet hapur, që agjenti t’i shohë e t’i propozojë menjëherë pronat që përputhen
        await openOpp(o.id);
        const n = $$('#o-matches .mlist .mcard:not(.dismissed)').length;
        toast(o.side === 'supply' ? (n ? `U ruajt. ${n} ${n === 1 ? 'klient pret' : 'klientë presin'} këtë pronë.` : 'Opportunity-ja u ruajt.') : (n ? `U ruajt. ${n} ${n === 1 ? 'pronë përputhet' : 'prona përputhen'} – shikojini djathtas.` : 'U ruajt. Asnjë pronë nuk përputhet ende.'));
      } else { om.close(); toast('Ndryshimet u ruajtën.'); }
    } catch (err) { $('#om-msg').className = 'form-msg err'; $('#om-msg').textContent = err.message; }
    finally { btn.classList.remove('loading'); }
  });
  $('#om-del').addEventListener('click', async () => {
    if (!curOpp || !confirm('Të fshihet kjo opportunity?')) return;
    try { await api('/api/admin/opportunities/' + curOpp.id, { method: 'DELETE' }); om.close(); toast('U fshi.'); if (lm.open && curLead) openLead(curLead.id); if ($('#kb')) loadO(); } catch (err) { toast(err.message, 'err'); }
  });
  $('#om-lead').addEventListener('click', () => { if (curOpp) { om.close(); openLead(curOpp.lead_id); } });
  $('#om-visit').addEventListener('click', () => { if (curOpp) openVisit({ lead_id: curOpp.lead_id, opp_id: curOpp.id, property_id: Number(of.elements.property_id.value) || null }); });
  // Ndarja e komisionit me agjentin e pronës (e cakton administratori; agjenti e sheh)
  function drawSplit() {
    const box = $('#o-split'), o = curOpp;
    box.innerHTML = '';
    if (!o) return;
    if (admin()) {
      box.innerHTML = `<div class="row"><div class="field"><label for="o-split-agent">Komisioni ndahet me</label><select class="select" id="o-split-agent"><option value="">Askënd</option>${agentsCache.map(a => `<option value="${a.id}" ${o.split_agent_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="o-split-pct">Pjesa e agjentit të klientit (%)</label><input class="input" id="o-split-pct" inputmode="numeric" value="${o.split_pct ?? 50}"></div></div>
        <small class="muted">Kur fitohet një marrëveshje me pronën e një kolegu, ndarja vendoset vetë 50/50. Këtu mund ta ndryshoni.</small>`;
    }
    if (o.stage === 'won' && o.commission_status) box.insertAdjacentHTML('afterbegin', `<p class="note-box ${o.commission_status === 'pending' ? 'gold-box' : ''}" style="margin:0">${o.commission_status === 'pending' ? 'Komisioni pret mbylljen nga brokeri i zyrës (ose administratori). Deri atëherë nuk hyn te raportet.' : `Komisioni u mbyll${o.commission_closed_by ? ' nga ' + esc(o.commission_closed_by) : ''}: ${fmt(o.commission)} €.`}</p>`);
    if (admin()) return;
    box.innerHTML += o.split_agent_id ? `<p class="note-box" style="margin:0">Komisioni ndahet: ${esc(o.agent_name || '')} ${o.split_pct ?? 50}% · ${esc(o.split_agent_name || '')} ${100 - (o.split_pct ?? 50)}%</p>`
      : o.property_agent_id && o.property_agent_id !== USER.agent?.id ? '<small class="muted">Prona është e një kolegu: kur fitohet, komisioni ndahet 50/50 (ose si e cakton administratori).</small>' : '';
  }
  function askText(title, label, okText) {
    return new Promise(res => {
      const d = $('#qmodal'); $('#q-title').textContent = title; $('#q-label').textContent = label; $('#q-ok').textContent = okText; $('#q-text').value = '';
      const done = v => { d.close(); res(v); };
      $('#q-ok').onclick = () => done($('#q-text').value.trim());
      $$('[data-qclose]', d).forEach(b => b.onclick = () => done(null));
      d.oncancel = e => { e.preventDefault(); done(null); };
      d.showModal(); $('#q-text').focus();
    });
  }

  /* ---------- raporti (administratori) ---------- */
  async function raporti() {
    const c = await api('/api/admin/crm');
    const tot = c.agents.reduce((t, a) => ({ leads: t.leads + a.leads, open: t.open + a.open, value: t.value + a.open_value, wm: t.wm + a.won_month, cm: t.cm + a.commission_month, ct: t.ct + a.commission_total }), { leads: 0, open: 0, value: 0, wm: 0, cm: 0, ct: 0 });
    const now = new Date(), month = `${MUAJT[now.getMonth()]} ${now.getFullYear()}`;
    $('#view').innerHTML = `<div class="top"><h1>Raporti</h1><span class="muted">${esc(month)}</span></div>
      <div class="stats-grid">
        <div class="stat"><b>${c.leads.total || 0}</b><span>Leads gjithsej</span></div>
        <div class="stat"><b>${tot.open}</b><span>Opportunitete të hapura</span></div>
        <div class="stat"><b>${fmt(tot.value)} €</b><span>Vlera në proces</span></div>
        <div class="stat"><b>${c.month.won || 0}</b><span>Fituar këtë muaj</span></div>
        <div class="stat"><b>${fmt(c.month.commission)} €</b><span>Komision këtë muaj</span></div>
        <div class="stat"><b>${fmt(c.commission_total ?? tot.ct)} €</b><span>Komision gjithsej</span></div>
      </div>
      <div class="panel" style="margin-bottom:1.5rem"><h2>Sipas agjentit</h2><div class="table-wrap" style="border:0"><table style="min-width:760px"><thead><tr><th>Agjenti</th><th>Leads</th><th>Të hapura</th><th>Vlera në proces</th><th>Fituar (muaji)</th><th>Komision (muaji)</th><th>Fituar / Humbur</th><th>Komision gjithsej</th></tr></thead><tbody>
        ${c.agents.map(a => `<tr><td><b style="font-weight:500">${esc(a.name)}</b></td><td>${a.leads}</td><td>${a.open}</td><td>${fmt(a.open_value)} €</td><td>${a.won_month}</td><td class="gold">${fmt(a.commission_month)} €</td><td>${a.won_total} / ${a.lost_total}${a.won_total + a.lost_total ? ` <small class="muted">(${Math.round(a.won_total / (a.won_total + a.lost_total) * 100)}%)</small>` : ''}</td><td>${fmt(a.commission_total)} €</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="panel" id="targets" style="margin-bottom:1.5rem"></div>
      <div class="panel"><h2>Nga vijnë klientët</h2><ul class="list-mini">${c.sources.map(s => `<li><span>${esc(SOURCE[s.source] || s.source)}</span><span><b style="font-weight:500">${s.leads}</b> leads${s.won ? ` · <span class="gold">${s.won} fituar</span>` : ''}</span></li>`).join('') || '<li class="muted">Ende pa të dhëna.</li>'}</ul></div>`;
    tMonth = null; tOffice = null; loadTargets().catch(e => { $('#targets').innerHTML = `<p class="muted">${esc(e.message)}</p>`; });
  }

  /* ---------- objektivat mujore ---------- */
  let tMonth = null, tQuery = '', tOffice = null;
  const TKEYS = [['leads', 'Leads të reja'], ['opps', 'Opportunitete të reja'], ['listings', 'Prona të listuara'], ['visits', 'Vizita të kryera'], ['deals', 'Marrëveshje të fituara'], ['commission', 'Komisioni', true]];
  const monthName = m => `${MUAJT[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  function targetBars(x, commissionLabel = 'Komisioni (pjesa juaj)') {
    const t = x.target || {}, a = x.actual;
    const bar = (label, got, want, money) => {
      const pct = want ? Math.min(100, Math.round(got / want * 100)) : 0;
      return `<div class="tbar"><div class="tbar-h"><span>${label}</span><span><b>${money ? fmt(got) + ' €' : got}</b>${want ? ` / ${money ? fmt(want) + ' €' : want}` : ' <small class="muted">· pa objektiv</small>'}</span></div>
        <div class="tbar-t"><i style="width:${pct}%" class="${pct >= 100 ? 'done' : ''}"></i></div></div>`;
    };
    // Shfaqen vetëm objektivat e caktuara; pa asnjë objektiv shfaqen të gjitha arritjet
    const rows = TKEYS.map(([k, label, money]) => [k === 'commission' ? commissionLabel : label, a[k], t[k] || 0, money]);
    const set = rows.filter(r => r[2]);
    return `<div class="tbars">${(set.length ? set : rows).map(r => bar(...r)).join('')}</div>`;
  }
  async function loadTargets() {
    const box = $('#targets'); if (!box) return;
    const qs = new URLSearchParams(); if (tMonth) qs.set('month', tMonth); if (tOffice) qs.set('office', tOffice);
    const t = await api('/api/admin/targets?' + qs); tMonth = t.month;
    const shift = n => { const d = new Date(tMonth + '-15T12:00'); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    box.innerHTML = `<div class="tg-head"><h2 style="margin:0">Objektivat · ${esc(monthName(t.month))}</h2>
        <span class="toolbar"><button class="btn ghost sm" type="button" data-tm="-1" aria-label="Muaji i mëparshëm">‹</button><button class="btn ghost sm" type="button" data-tm="1" aria-label="Muaji tjetër">›</button>${t.can_edit ? '<button class="btn sm" type="button" id="tg-edit">Cakto objektivat</button>' : ''}</span></div>
      <div class="tg-search"><input class="input" id="tg-q" type="search" placeholder="Kërko agjentin…" aria-label="Kërko agjentin" value="${esc(tQuery)}" autocomplete="off"><small class="muted" id="tg-count"></small></div>
      <div class="tg-grid">${t.items.map(x => `<div class="tg-card" data-name="${esc(x.name)}"><b>${esc(x.name)}</b>${x.inherited ? '<small class="muted">Objektivi i muajit të kaluar</small>' : ''}${targetBars(x, 'Komisioni')}</div>`).join('')}</div>
      <form id="tg-form" hidden><div class="table-wrap" style="border:0"><table style="min-width:760px"><thead><tr><th>Agjenti</th>${TKEYS.map(([k, l]) => `<th>${k === 'commission' ? 'Komision (€)' : l.replace(' të reja', '').replace(' të listuara', '').replace(' të kryera', '').replace(' të fituara', '')}</th>`).join('')}</tr></thead><tbody>
        ${t.items.map(x => `<tr data-a="${x.agent_id}" data-name="${esc(x.name)}"><td>${esc(x.name)}</td>${TKEYS.map(([k, l]) => `<td><input class="input" inputmode="numeric" name="${k}" aria-label="${esc(x.name)}: ${l}" value="${x.target?.[k] ?? 0}"></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div class="field" style="max-width:360px;margin-top:1rem" ${admin() && !tOffice ? '' : 'hidden'}><label for="tg-fu">Kujtuesi “pa kontakt” pas sa ditësh</label><input class="input" id="tg-fu" inputmode="numeric" value="${t.followup_days}"><small class="muted">Klientët aktivë pa telefonatë, mesazh, vizitë ose shënim dalin te “Për sot” dhe agjenti merr njoftim.</small></div>
      <div style="display:flex;gap:.6rem;margin-top:1rem"><button class="btn" type="submit">Ruaj për ${esc(monthName(t.month))}</button><button class="btn ghost" type="button" id="tg-cancel">Anulo</button></div></form>`;
    box.querySelectorAll('[data-tm]').forEach(b => b.addEventListener('click', () => { tMonth = shift(Number(b.dataset.tm)); loadTargets(); }));
    // Kërkimi: filtron njëkohësisht kartat dhe rreshtat e formës (pa humbur numrat e shkruar)
    const norm = v => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filterT = () => {
      const q = norm(tQuery.trim()); let n = 0;
      $$('#targets [data-name]').forEach(el => { const on = !q || norm(el.dataset.name).includes(q); el.hidden = !on; if (on && el.classList.contains('tg-card')) n++; });
      $('#tg-count').textContent = q ? `${n} nga ${t.items.length} agjentë` : '';
    };
    $('#tg-q').addEventListener('input', e => { tQuery = e.target.value; filterT(); });
    filterT();
    $('#tg-edit')?.addEventListener('click', () => { $('#tg-form').hidden = false; $('#tg-edit').hidden = true; $('#tg-q').focus(); });
    $('#tg-cancel').addEventListener('click', () => { $('#tg-form').hidden = true; $('#tg-edit').hidden = false; });
    $('#tg-form').addEventListener('submit', async e => {
      e.preventDefault();
      const items = $$('#tg-form tr[data-a]').map(r => ({ agent_id: Number(r.dataset.a), ...Object.fromEntries(TKEYS.map(([k]) => [k, String(r.querySelector(`[name=${k}]`).value).replace(/\D/g, '')])) }));
      try { await api('/api/admin/targets', { method: 'PUT', body: { month: tMonth, items, ...(admin() && !tOffice ? { followup_days: $('#tg-fu').value } : {}) } }); toast('Objektivat u ruajtën.'); if (tOffice) officeDash(tOffice); else loadTargets(); } catch (err) { toast(err.message, 'err'); }
    });
  }

  /* ---------- kërkesat ---------- */
  let iStatus = '';
  async function kerkesat() {
    $('#view').innerHTML = `<div class="top"><h1>Kërkesat</h1><div class="tabs" id="itabs">${[['', 'Të gjitha'], ...Object.entries(ISTATUS)].map(([k, v]) => `<button data-s="${k}" class="${iStatus === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      ${!admin() ? '<p class="muted" style="margin:-1rem 0 1.5rem">Këtu shfaqen kërkesat e klientëve për pronat tuaja.</p>' : ''}<div id="ilist"></div>`;
    $('#itabs').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; iStatus = b.dataset.s; $$('#itabs button').forEach(x => x.classList.toggle('on', x === b)); loadI(); });
    $('#ilist').addEventListener('change', async e => {
      const s = e.target.closest('[data-istatus]'); if (!s) return;
      try { await api('/api/admin/inquiries/' + s.dataset.istatus, { method: 'PATCH', body: { status: s.value } }); toast('Statusi u përditësua.'); s.closest('.inq').classList.toggle('new', s.value === 'new'); refreshCounts(); } catch (err) { toast(err.message, 'err'); }
    });
    $('#ilist').addEventListener('click', async e => {
      const lb = e.target.closest('[data-ilead]'), cv = e.target.closest('[data-iconv]');
      if (lb) return openLead(Number(lb.dataset.ilead));
      if (cv) { try { const r = await api(`/api/admin/inquiries/${cv.dataset.iconv}/lead`, { method: 'POST' }); toast('Lead-i u krijua.'); loadI(); openLead(r.lead_id); } catch (err) { toast(err.message, 'err'); } return; }
      const d = e.target.closest('[data-idel]');
      if (d && confirm('Të fshihet kjo kërkesë?')) { try { await api('/api/admin/inquiries/' + d.dataset.idel, { method: 'DELETE' }); toast('Kërkesa u fshi.'); loadI(); refreshCounts(); } catch (err) { toast(err.message, 'err'); } }
    });
    loadI();
  }
  async function loadI() {
    const rows = await api('/api/admin/inquiries' + (iStatus ? '?status=' + iStatus : ''));
    $('#ilist').innerHTML = rows.length ? rows.map(i => {
      const tel = (i.phone || '').replace(/[^\d+]/g, '');
      return `<article class="inq ${i.status === 'new' ? 'new' : ''}">
        <div><div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap"><h3>${esc(i.name)}</h3><span class="kind-tag">${KIND[i.kind]}</span></div>
          <div class="meta">${tel ? `<a href="tel:${tel}">${esc(i.phone)}</a><a href="https://wa.me/${tel.replace('+', '')}" target="_blank" rel="noopener">WhatsApp</a>` : ''}${i.email ? `<a href="mailto:${esc(i.email)}">${esc(i.email)}</a>` : ''}${i.property_id ? `<a href="/property.html?id=${i.property_id}" target="_blank">${esc(i.property_code || 'Prona')} – ${esc(i.property_title || '')}</a>` : ''}<span>${date(i.created_at)}</span></div>
          ${i.message ? `<p>${esc(i.message)}</p>` : ''}</div>
        <div class="side"><select class="select" data-istatus="${i.id}" aria-label="Statusi">${Object.entries(ISTATUS).map(([k, v]) => `<option value="${k}" ${i.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          ${i.lead_id ? `<button class="btn ghost sm" data-ilead="${i.lead_id}">Hap lead-in</button>` : `<button class="btn ghost sm" data-iconv="${i.id}">Krijo lead</button>`}
          ${admin() ? `<button class="icon-btn danger" data-idel="${i.id}" aria-label="Fshi kërkesën">${ic.del}</button>` : ''}</div>
      </article>`;
    }).join('') : `<div class="empty"><h3>Asnjë kërkesë këtu</h3>${admin() ? 'Kërkesat nga formularët e faqes shfaqen në këtë listë.' : 'Kur një klient pyet për një nga pronat tuaja, kërkesa shfaqet këtu.'}</div>`;
  }

  /* ---------- agjentët (vetëm administratori) ---------- */
  const am = $('#amodal'), af = $('#aform'); let aEditing = null;
  async function agjentet() {
    agentsCache = await api('/api/admin/agents');
    $('#view').innerHTML = `<div id="agv"><div class="top"><h1>Agjentët</h1><button class="btn" id="add-a">Shto agjent</button></div>
      <p class="muted" style="margin:-1rem 0 1.5rem">Jepini agjentit përdorues dhe fjalëkalim që të hyjë vetë te <b style="color:var(--text)">/admin/</b> dhe të postojë pronat e veta. Pronat e tij dalin në faqe pasi t’i miratoni.</p>
      <div class="table-wrap"><table style="min-width:820px"><thead><tr><th></th><th>Emri</th><th>Niveli</th><th>Kontakti</th><th>Hyrja në panel</th><th>Prona</th><th>Veprime</th></tr></thead><tbody>${agentsCache.map(a => `<tr>
        <td><img class="thumb" style="width:48px;height:48px" src="${esc(a.photo || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'"></td>
        <td><span class="t">${esc(a.name)}</span><small>${esc(a.role)}</small>${a.office_name ? `<small>${esc(a.office_name)}${a.broker_of ? ' · <span class="gold">Broker</span>' : ''}</small>` : '<small class="muted">Pa zyrë</small>'}</td>
        <td><span class="lvl">${a.level || 2}</span> <small class="muted">${esc(LEVELS[a.level || 2])}</small></td>
        <td>${esc(a.phone)}<br><small>${esc(a.email)}</small></td>
        <td>${a.username ? `<b style="font-weight:500">${esc(a.username)}</b><br><span class="ap ${a.login_active ? 'ap-approved' : 'ap-rejected'}">${a.login_active ? 'Aktive' : 'E çaktivizuar'}</span>` : '<span class="muted">Pa hyrje</span>'}</td>
        <td>${a.listings}</td>
        <td><div class="row-acts"><button class="icon-btn" data-aedit="${a.id}" aria-label="Ndrysho">${ic.edit}</button><button class="icon-btn danger" data-adel="${a.id}" aria-label="Fshi">${ic.del}</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="muted" style="padding:2rem;text-align:center">Shtoni agjentin e parë.</td></tr>'}</tbody></table></div></div>`;
    $('#add-a').addEventListener('click', () => openAgent());
    $('#agv').addEventListener('click', async e => {
      const ed = e.target.closest('[data-aedit]'), dl = e.target.closest('[data-adel]');
      if (ed) openAgent(agentsCache.find(a => a.id === +ed.dataset.aedit));
      if (dl && confirm('Të fshihet agjenti dhe llogaria e tij e hyrjes? Pronat e tij do të mbeten pa agjent.')) { try { await api('/api/admin/agents/' + dl.dataset.adel, { method: 'DELETE' }); toast('Agjenti u fshi.'); agjentet(); } catch (err) { toast(err.message, 'err'); } }
    });
  }
  async function openAgent(a = null) {
    aEditing = a?.id || null; af.reset(); $('#am-msg').textContent = '';
    officesCache = await api('/api/admin/offices').catch(() => officesCache);
    $('#a-office').innerHTML = '<option value="">Pa zyrë</option>' + officesCache.map(o => `<option value="${o.id}">${esc(o.name)} · ${esc(o.code)}</option>`).join('');
    af.elements.office_id.value = String(a?.office_id || '');
    $('#am-title').textContent = a ? 'Ndrysho agjentin' : 'Agjent i ri';
    ['name', 'role', 'phone', 'email', 'bio', 'photo', 'username'].forEach(k => af.elements[k].value = a?.[k] || '');
    af.elements.level.value = String(a?.level || 2);
    af.elements.role.dataset.auto = a && a.role !== LEVELS[a.level || 2] ? '0' : '1';
    if (!a) af.elements.role.value = LEVELS[2];
    af.elements.login_active.checked = a ? (a.username ? !!a.login_active : true) : true;
    $('#a-pass-hint').textContent = a?.username ? 'Lëreni bosh për të mbajtur fjalëkalimin aktual. Shkruani një të ri për ta ndryshuar.' : 'Të paktën 8 karaktere. Lëreni bosh përdoruesin dhe fjalëkalimin nëse agjenti nuk do të hyjë në panel.';
    $('#a-prev').src = a?.photo || FALLBACK;
    am.showModal();
  }
  $('#a-level').innerHTML = Object.entries(LEVELS).sort((x, y) => y[0] - x[0]).map(([k, v]) => `<option value="${k}">${k} · ${v}</option>`).join('');
  $('#a-level').addEventListener('change', e => { const r = af.elements.role; if (!r.value || r.dataset.auto === '1') { r.value = LEVELS[e.target.value]; r.dataset.auto = '1'; } });
  af.elements.role.addEventListener('input', e => { e.target.dataset.auto = '0'; });
  $('#a-gen').addEventListener('click', () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const pw = Array.from(crypto.getRandomValues(new Uint32Array(10)), n => chars[n % chars.length]).join('');
    af.elements.password.value = pw; af.elements.password.type = 'text';
    if (!af.elements.username.value && af.elements.name.value) af.elements.username.value = af.elements.name.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
  });
  $('#a-photo-f').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const url = await upload(f); $('#a-photo').value = url; $('#a-prev').src = url; } catch (err) { toast(err.message, 'err'); }
  });
  af.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(af)); body.login_active = af.elements.login_active.checked;
    try {
      await api('/api/admin/agents' + (aEditing ? '/' + aEditing : ''), { method: aEditing ? 'PUT' : 'POST', body });
      am.close(); af.elements.password.type = 'password'; agentsCache = []; agjentet();
      if (body.username && body.password) showCredentials(body); else toast('Agjenti u ruajt.');
    } catch (err) { $('#am-msg').className = 'form-msg err'; $('#am-msg').textContent = err.message; }
  });

  function showCredentials(a) {
    const text = `Përshëndetje ${a.name.split(' ')[0]}, kjo është hyrja jote në panelin e De Luxe Real Estate:\n\n${location.origin}/admin/\nPërdoruesi: ${a.username.toLowerCase()}\nFjalëkalimi: ${a.password}\n\nPronat që shton dalin në faqe pasi t’i miratojmë. Fjalëkalimin mund ta ndryshosh te “Llogaria”.`;
    $('#c-text').textContent = text;
    const tel = (a.phone || '').replace(/\D/g, '');
    $('#c-wa').href = `https://wa.me/${tel}?text=${encodeURIComponent(text)}`;
    $('#c-copy').onclick = () => navigator.clipboard.writeText(text).then(() => toast('U kopjua.'), () => toast('Kopjoni tekstin me dorë.', 'err'));
    $('#cmodal').showModal();
  }

  /* ---------- abonentët ---------- */
  async function abonentet() {
    const rows = await api('/api/admin/subscribers');
    $('#view').innerHTML = `<div id="sbv"><div class="top"><h1>Abonentët</h1><button class="btn outline" id="csv" ${rows.length ? '' : 'disabled'}>Shkarko CSV</button></div>
      <div class="table-wrap"><table style="min-width:480px"><thead><tr><th>Email</th><th>Data</th><th></th></tr></thead><tbody>${rows.map(s => `<tr><td>${esc(s.email)}</td><td>${date(s.created_at)}</td><td><button class="icon-btn danger" data-sdel="${s.id}" aria-label="Fshi">${ic.del}</button></td></tr>`).join('') || '<tr><td colspan="3" class="muted" style="padding:2rem;text-align:center">Askush nuk është regjistruar ende.</td></tr>'}</tbody></table></div></div>`;
    $('#csv').addEventListener('click', () => {
      const csv = 'email,data\n' + rows.map(r => `${r.email},${r.created_at}`).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'abonentet.csv'; a.click(); URL.revokeObjectURL(a.href);
    });
    $('#sbv').addEventListener('click', async e => {
      const d = e.target.closest('[data-sdel]');
      if (d && confirm('Të hiqet ky abonent?')) { try { await api('/api/admin/subscribers/' + d.dataset.sdel, { method: 'DELETE' }); toast('U hoq.'); abonentet(); } catch (err) { toast(err.message, 'err'); } }
    });
  }

  /* ---------- faqja: foto kryesore dhe tekstet e hyrjes ---------- */
  async function faqja() {
    const [s, props] = await Promise.all([api('/api/admin/settings'), api('/api/admin/properties?approval=approved&status=active')]);
    $('#view').innerHTML = `<div class="top"><h1>Faqja kryesore</h1><a class="btn ghost" href="/" target="_blank">Shiko faqen</a></div>
      <form class="panel" id="hs" style="max-width:760px;display:grid;gap:1.2rem" novalidate>
        <h2>Fotoja e madhe në hyrje</h2>
        <div class="hero-pick"><div class="hero-prev" id="hs-prev"></div>
          <div style="display:grid;gap:.6rem;align-content:start">
            <label class="btn ghost sm" for="hs-file" style="justify-self:start">Ngarko foto</label><input type="file" id="hs-file" accept="image/jpeg,image/png,image/webp" hidden>
            <button class="btn ghost sm" type="button" id="hs-clear" style="justify-self:start">Hiq foton</button>
            <small class="muted">Foto vertikale ose katrore, mundësisht e ndriçuar mirë. Pa foto, faqja tregon foton e një prone të përzgjedhur, ose logon nëse nuk ka asnjë.</small>
          </div></div>
        <input type="hidden" name="hero_image" id="hs-img">
        <div class="field"><label for="hs-prop">Prona që shfaqet poshtë fotos (opsionale)</label>
          <select class="select" id="hs-prop" name="hero_property_id"><option value="">Asnjë – vetëm fotoja</option>${props.map(p => `<option value="${p.id}">${esc(p.code)} – ${esc(p.title)}</option>`).join('')}</select>
          <small class="muted">Klienti e shtyp dhe hap direkt pronën. Nëse nuk ngarkoni foto, përdoret fotoja e kësaj prone.</small></div>
        <h2 style="margin-top:.6rem">Tekstet</h2>
        <div class="field"><label for="hs-title">Titulli i madh</label><input class="input" id="hs-title" name="hero_title" maxlength="140" placeholder="Prona elitare të tipologjive të ndryshme nga çdo cep i *Shqipërisë*, të përzgjedhura për klientët tanë">
          <small class="muted">Fjalën që doni me ngjyrë ari vendoseni mes yjeve, p.sh. <b style="color:var(--text)">*bregdet*</b>. Lëreni bosh për tekstin e parazgjedhur.</small></div>
        <div class="field"><label for="hs-text">Teksti poshtë titullit</label><textarea class="textarea" id="hs-text" name="hero_text" maxlength="300" style="min-height:80px" placeholder="Vila, apartamente dhe hapësira biznesi që i kemi parë vetë…"></textarea></div>
        <div style="display:flex;gap:.8rem;align-items:center;flex-wrap:wrap"><button class="btn" type="submit">Ruaj ndryshimet</button><p class="form-msg" id="hs-msg" style="margin:0"></p></div>
      </form>`;
    const f = $('#hs');
    f.elements.hero_image.value = s.hero_image || ''; f.elements.hero_property_id.value = s.hero_property_id || '';
    f.elements.hero_title.value = s.hero_title || ''; f.elements.hero_text.value = s.hero_text || '';
    const prev = () => {
      const p = props.find(x => String(x.id) === f.elements.hero_property_id.value);
      const src = f.elements.hero_image.value || p?.images?.[0] || '';
      $('#hs-prev').innerHTML = src ? `<img src="${esc(src)}" alt="" onerror="this.src='${FALLBACK}'">` : `<img src="/img/logo-full.png" alt="" style="object-fit:contain;padding:1.5rem;background:var(--black)">`;
      $('#hs-clear').hidden = !f.elements.hero_image.value;
    };
    prev();
    f.elements.hero_property_id.addEventListener('change', prev);
    $('#hs-file').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      $('#hs-msg').className = 'form-msg'; $('#hs-msg').textContent = 'Po ngarkohet…';
      try { f.elements.hero_image.value = await upload(file); prev(); $('#hs-msg').textContent = 'Fotoja u ngarkua – shtypni “Ruaj ndryshimet”.'; }
      catch (err) { $('#hs-msg').className = 'form-msg err'; $('#hs-msg').textContent = err.message; }
      e.target.value = '';
    });
    $('#hs-clear').addEventListener('click', () => { f.elements.hero_image.value = ''; prev(); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      try { await api('/api/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(f)) }); $('#hs-msg').className = 'form-msg ok'; $('#hs-msg').textContent = 'U ruajt. Ndryshimet duken menjëherë në faqe.'; toast('Faqja kryesore u përditësua.'); }
      catch (err) { $('#hs-msg').className = 'form-msg err'; $('#hs-msg').textContent = err.message; }
    });
  }

  /* ---------- llogaria ---------- */
  async function llogaria() {
    $('#view').innerHTML = `<div class="top"><h1>Llogaria</h1></div>
      <form class="panel" id="pw" style="max-width:440px;display:grid;gap:1rem" novalidate><h2>Ndrysho fjalëkalimin</h2>
        <p class="muted" style="margin:0;font-size:.92rem">Përdoruesi: <b style="color:var(--text)">${esc(USER.username)}</b></p>
        <div class="field"><label for="pw-c">Fjalëkalimi aktual</label><input class="input" id="pw-c" name="current" type="password" autocomplete="current-password"></div>
        <div class="field"><label for="pw-n">Fjalëkalimi i ri (min. 8 karaktere)</label><input class="input" id="pw-n" name="next" type="password" autocomplete="new-password"></div>
        <div class="field"><label for="pw-r">Përsërit fjalëkalimin e ri</label><input class="input" id="pw-r" name="repeat" type="password" autocomplete="new-password"></div>
        <button class="btn" type="submit" style="justify-self:start">Ruaj fjalëkalimin</button><p class="form-msg" id="pw-msg"></p></form>
      <div class="panel" id="push-box" style="max-width:440px;display:grid;gap:1rem;margin-top:1.5rem"></div>`;
    drawPush();
    $('#pw').addEventListener('submit', async e => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), m = $('#pw-msg');
      if (f.next !== f.repeat) { m.className = 'form-msg err'; m.textContent = 'Fjalëkalimet e reja nuk përputhen.'; return; }
      try { const r = await api('/api/admin/password', { method: 'POST', body: f }); m.className = 'form-msg ok'; m.textContent = r.message; e.target.reset(); } catch (err) { m.className = 'form-msg err'; m.textContent = err.message; }
    });
  }


  /* =====================================================================
     3.0 – njoftimet, Match, kalendari, harta, pronari dhe dokumentet
     ===================================================================== */
  const PIN_CITY = { 'Tiranë': [41.3275, 19.8187], 'Durrës': [41.3231, 19.4414], 'Vlorë': [40.4667, 19.4897], 'Sarandë': [39.8756, 20.0053], 'Shkodër': [42.0683, 19.5126], 'Pogradec': [40.9025, 20.6525], 'Korçë': [40.6186, 20.7808], 'Elbasan': [41.1125, 20.0822], 'Fier': [40.7239, 19.5561], 'Berat': [40.7058, 19.9522], 'Himarë': [40.1014, 19.7447], 'Ksamil': [39.7689, 20.0011] };
  const IS_DEMO = !!window.__demoBackend;

  /* ---------- zilja e njoftimeve ---------- */
  let nUnread = 0, nTimer = null;
  const NICON = { followup: 'phone', match_property: 'home', match_client: 'users', match_buyers: 'users', price_drop: 'arrow', visit_new: 'home', visit_soon: 'info', visit_done: 'home', doc_expiry: 'note', duplicate: 'info', alert: 'mail', won_split: 'arrow' };
  function bellCount(n) {
    nUnread = n;
    $$('.bell-n').forEach(b => { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
  }
  async function pollBell() { try { const d = await api('/api/admin/notifications?limit=1'); bellCount(d.unread); } catch {} }
  function startBell() { clearInterval(nTimer); pollBell(); nTimer = setInterval(pollBell, 60000); }
  const ago = d => {
    const s = (Date.now() - new Date(d.replace(' ', 'T') + 'Z').getTime()) / 1000;
    return s < 60 ? 'tani' : s < 3600 ? `${Math.floor(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} orë` : s < 172800 ? 'dje' : date(d).slice(0, 10);
  };
  async function openBell() {
    const nm = $('#nmodal');
    $('#n-list').innerHTML = '<li class="muted" style="padding:1rem 1.2rem">Po ngarkohen…</li>';
    if (!nm.open) nm.showModal();
    try {
      const d = await api('/api/admin/notifications?limit=40'); bellCount(d.unread);
      $('#n-list').innerHTML = d.items.length ? d.items.map(n => `<li class="${n.read_at ? '' : 'unread'}" data-n="${n.id}" data-link="${esc(JSON.stringify(n.link))}">
        ${ti(NICON[n.kind] || 'info')}<div><div class="n-h"><b>${esc(n.title)}</b><small>${ago(n.created_at)}</small></div>${n.body ? `<p>${esc(n.body)}</p>` : ''}</div></li>`).join('')
        : '<li class="muted" style="padding:1.2rem">Nuk keni njoftime. Kur del një match, një vizitë ose një pronë e re për klientët tuaj, do ta shihni këtu.</li>';
    } catch (e) { $('#n-list').innerHTML = `<li class="muted" style="padding:1.2rem">${esc(e.message)}</li>`; }
  }
  $('#n-list').addEventListener('click', async e => {
    const li = e.target.closest('[data-n]'); if (!li) return;
    let link = {}; try { link = JSON.parse(li.dataset.link); } catch {}
    api('/api/admin/notifications/read', { method: 'POST', body: { ids: [Number(li.dataset.n)] } }).then(pollBell).catch(() => {});
    $('#nmodal').close();
    followLink(link);
  });
  $('#n-all').addEventListener('click', async () => { try { await api('/api/admin/notifications/read', { method: 'POST', body: { all: true } }); bellCount(0); $$('#n-list .unread').forEach(x => x.classList.remove('unread')); } catch (err) { toast(err.message, 'err'); } });
  $('#n-push').addEventListener('click', () => $('#nmodal').close());
  function followLink(link) {
    if (link.opp) return openOpp(Number(link.opp));
    if (link.lead) return openLead(Number(link.lead));
    if (link.prop) return openProperty(Number(link.prop), link.tab);
    if (link.visit) { calFocus = Number(link.visit); return go('kalendari'); }
    if (link.view === 'match') { mTab = link.tab === 'props' ? 'props' : 'clients'; return go('match'); }
    if (link.view && VIEWS[link.view]) return go(link.view);
  }

  /* ---------- Match: klientët e mi ↔ pronat e të tjerëve, pronat e mia ↔ klientët e të tjerëve ---------- */
  let mTab = 'clients', mAll = false, mData = null;
  async function match() {
    $('#view').innerHTML = `<div id="mv2"><div class="top"><h1>Match</h1><label class="check" style="font-size:.9rem"><input type="checkbox" id="m-all" ${mAll ? 'checked' : ''}>Shfaq edhe përputhjet e dobëta (45–59%)</label></div>
      <p class="muted" style="margin:-1rem 0 1.2rem">Përputhjet mes klientëve dhe pronave të gjithë agjencisë. Klientët e kolegëve shfaqen pa emër e kontakt: bashkëpunimi kalon përmes agjentit të tyre.</p>
      <div class="tabs m-tabs" id="m-tabs"><button data-t="clients">${admin() ? 'Klientët' : 'Klientët e mi'} <b id="m-n1"></b></button><button data-t="props">${admin() ? 'Pronat' : 'Pronat e mia'} <b id="m-n2"></b></button></div>
      <div id="m-list" class="mlist m-grid"><div class="skeleton" style="height:200px"></div></div></div>`;
    $('#m-all').addEventListener('change', e => { mAll = e.target.checked; loadM(); });
    $('#m-tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; mTab = b.dataset.t; drawM(); });
    $('#m-list').addEventListener('click', matchPageClick);
    loadM();
  }
  async function loadM() {
    try { mData = await api('/api/admin/match/overview' + (mAll ? '?all=1' : '')); drawM(); }
    catch (e) { $('#m-list').innerHTML = `<div class="empty"><h3>Gabim</h3>${esc(e.message)}</div>`; }
  }
  function drawM() {
    if (!mData || !$('#m-list')) return;
    $$('#m-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === mTab));
    $('#m-n1').textContent = mData.clients.length; $('#m-n2').textContent = mData.props.length;
    const list = mTab === 'clients' ? mData.clients : mData.props;
    $('#m-list').innerHTML = list.length ? list.map((x, i) => mTab === 'clients' ? mClientCard(x, i) : mPropCard(x, i)).join('')
      : `<div class="empty"><h3>${mTab === 'clients' ? 'Asnjë pronë për klientët tuaj tani' : 'Askush nuk po kërkon si pronat tuaja tani'}</h3>${mTab === 'clients' ? 'Plotësoni kërkesat (lloji, qyteti, buxheti) te opportunitetet. Sapo të dalë një pronë që u përshtatet, do të njoftoheni.' : 'Kur një koleg hedh një kërkesë klienti që përputhet me një pronë tuajën, do ta shihni këtu dhe do të njoftoheni.'}</div>`;
  }
  const propImg = (src, id) => `<a class="m-img" href="/property.html?id=${id}" target="_blank" rel="noopener" tabindex="-1"><img src="${esc(src || FALLBACK)}" alt="" loading="lazy" onerror="this.src='${FALLBACK}'"></a>`;
  function mClientCard(m, i) {
    const other = m.agent_id && m.agent_id !== USER.agent?.id;
    return `<article class="mcard ${m.state || ''} ${m.is_new ? 'is-new' : ''}" data-i="${i}">${propImg(m.image, m.id)}<div class="m-b">
      <div class="m-top">${scoreTag(m.score)}<span class="t2"><b>${esc(m.lead_name)}</b> ↔ <a class="m-t" href="/property.html?id=${m.id}" target="_blank" rel="noopener">${esc(m.code)}</a></span>${m.is_new ? '<span class="ap ap-pending" style="margin-left:auto">E re</span>' : ''}</div>
      <span class="m-meta">${esc(m.title)} · ${esc([m.zone, m.city].filter(Boolean).join(', '))}</span>
      <span class="m-price">${priceOf(m)}</span>${whyTags(m.reasons)}
      <span class="m-meta">Për: ${esc(m.opp_title)}${admin() && m.opp_agent ? ` · ${esc(m.opp_agent)}` : ''}${m.state ? ` · <span class="gold">${MSTATE[m.state]}</span>` : ''}</span>
      ${other ? `<span class="m-meta">Prona e: <b style="color:var(--text);font-weight:500">${esc(m.agent_name || '–')}</b>${m.agent_phone ? ` · <a class="gold" href="tel:${telOf(m.agent_phone)}">${esc(m.agent_phone)}</a>` : ''}</span>` : '<span class="m-meta">Prona juaj</span>'}
      <div class="m-acts">${m.lead_phone ? `<button class="btn wa-b" type="button" data-ma="wa">${ti('wa')}Dërgoja klientit</button>` : ''}
        <button class="btn ghost" type="button" data-ma="visit">Cakto vizitë</button>
        ${m.state !== 'liked' ? '<button class="btn ghost" type="button" data-ma="liked">I pëlqeu</button>' : ''}
        <button class="btn ghost" type="button" data-ma="dismissed">Nuk i pëlqeu</button>
        ${other && m.agent_phone ? `<button class="btn ghost" type="button" data-ma="agent">${ti('wa')}Shkruaji ${esc((m.agent_name || '').split(' ')[0])}</button>` : ''}
        <button class="btn ghost" type="button" data-ma="opp">Hap</button></div>
    </div></article>`;
  }
  function mPropCard(b, i) {
    const p = b.property;
    return `<article class="mcard ${b.state || ''}" data-i="${i}">${propImg(p.image, p.id)}<div class="m-b">
      <div class="m-top">${scoreTag(b.score)}<span class="t2"><a class="m-t" href="/property.html?id=${p.id}" target="_blank" rel="noopener">${esc(p.code)}</a> ↔ <b>${b.mine ? esc(b.lead_name) : `Klient i ${esc(b.agent_name || 'një agjenti')}`}</b></span></div>
      <span class="m-meta">${esc(p.title)} · ${priceOf(p)}</span>
      <span class="m-meta">Kërkon: ${esc(critLine(b.criteria))}</span>${whyTags(b.reasons)}
      <div class="m-tags">${stageTag(b.stage)}${b.state ? `<span class="ap ${b.state === 'liked' ? 'ap-approved' : ''}">${MSTATE[b.state]}</span>` : ''}${b.linked ? '<span class="ap ap-pending">Po e shqyrton këtë pronë</span>' : ''}${admin() && b.agent_name ? `<span class="m-meta">${esc(b.agent_name)}</span>` : ''}</div>
      <div class="m-acts">${b.mine
        ? `${b.lead_phone ? `<button class="btn wa-b" type="button" data-ma="wa">${ti('wa')}Dërgoja klientit</button>` : ''}<button class="btn ghost" type="button" data-ma="opp">Hap opportunity-në</button>`
        : b.agent_phone ? `<button class="btn wa-b" type="button" data-ma="agent">${ti('wa')}Shkruaji ${esc((b.agent_name || '').split(' ')[0])}</button><a class="btn ghost" href="tel:${telOf(b.agent_phone)}">${ti('phone')}Telefono</a>` : '<span class="m-meta">Kontaktoni administratorin.</span>'}</div>
    </div></article>`;
  }
  async function matchPageClick(e) {
    const b = e.target.closest('[data-ma]'); if (!b) return;
    const i = Number(b.closest('[data-i]').dataset.i), act = b.dataset.ma;
    const x = mTab === 'clients' ? mData.clients[i] : mData.props[i];
    const prop = mTab === 'clients' ? x : { ...x.property, ...(propsCache?.find(p => p.id === x.property.id) || {}) };
    const oppId = x.opp_id, pid = prop.id;
    const mark = (status, extra = {}) => api(`/api/admin/opportunities/${oppId}/matches/${pid}`, { method: 'POST', body: { status, ...extra } });
    try {
      if (act === 'opp') return openOpp(oppId);
      if (act === 'visit') return openVisit({ lead_id: x.lead_id, opp_id: oppId, property_id: pid });
      if (act === 'agent') {
        const ag = mTab === 'clients' ? { name: x.agent_name, phone: x.agent_phone } : { name: x.agent_name, phone: x.agent_phone };
        const txt = mTab === 'clients'
          ? `Përshëndetje ${(ag.name || '').split(' ')[0]}, kam një klient për pronën tënde ${prop.code} – ${prop.title} (${priceOf(prop)}). A mund të caktojmë një vizitë?\n\n${whoAmI()}`
          : `Përshëndetje ${(ag.name || '').split(' ')[0]}, kam pronën ${prop.code} – ${prop.title} (${priceOf(prop)}) që i përshtatet një klienti tënd: ${critLine(x.criteria)}.\n${location.origin}/property.html?id=${pid}\n\n${whoAmI()}`;
        return open(waUrl(ag.phone, txt), '_blank', 'noopener');
      }
      if (act === 'wa') { open(waUrl(x.lead_phone, waText(x.lead_name, [prop])), '_blank', 'noopener'); await mark(x.state === 'liked' ? 'liked' : 'proposed', { via: 'whatsapp' }); toast('U shënua si e propozuar te historiku i klientit.'); }
      else if (act === 'dismissed') { const note = await askText('Pse nuk i pëlqeu?', 'Arsyeja (opsionale)', 'Hiqe nga lista'); if (note === null) return; await mark('dismissed', { note }); toast('U hoq nga lista e këtij klienti.'); }
      else if (act === 'liked') { await mark('liked'); toast('U shënua: i pëlqeu.'); }
      loadM();
    } catch (err) { toast(err.message, 'err'); }
  }

  /* ---------- kalendari i vizitave ---------- */
  let calStart = null, calFocus = null, visitsCache = [];
  const VSTATUS = { planned: 'E planifikuar', done: 'U krye', cancelled: 'U anulua', noshow: 'Nuk erdhi' };
  const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const nowLocal = () => { const d = new Date(); return `${isoDay(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const DITET = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];
  const MUAJT = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
  const dayLong = d => `${DITET[d.getDay()]}, ${d.getDate()} ${MUAJT[d.getMonth()]}`;
  const dayShort = d => `${d.getDate()} ${MUAJT[d.getMonth()].slice(0, 3)}`;
  function monday(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  async function kalendari() {
    if (!calStart) calStart = monday(new Date());
    $('#view').innerHTML = `<div id="cv"><div class="top"><h1>Kalendari</h1><button class="btn" id="add-v">Cakto vizitë</button></div>
      <div class="toolbar cal-nav"><button class="btn ghost sm" id="c-prev" aria-label="Java e mëparshme">‹</button><button class="btn ghost sm" id="c-today">Sot</button><button class="btn ghost sm" id="c-next" aria-label="Java tjetër">›</button><b id="c-range" style="font-weight:500"></b></div>
      <div id="c-days" class="cal-days"></div></div>`;
    $('#add-v').addEventListener('click', () => openVisit());
    $('#c-prev').addEventListener('click', () => { calStart.setDate(calStart.getDate() - 7); loadCal(); });
    $('#c-next').addEventListener('click', () => { calStart.setDate(calStart.getDate() + 7); loadCal(); });
    $('#c-today').addEventListener('click', () => { calStart = monday(new Date()); loadCal(); });
    $('#c-days').addEventListener('click', calClick);
    await loadCal();
  }
  async function loadCal() {
    const end = new Date(calStart); end.setDate(end.getDate() + 6);
    $('#c-range').textContent = `${dayShort(calStart)} – ${dayShort(end)} ${end.getFullYear()}`;
    try { visitsCache = await api(`/api/admin/visits?from=${isoDay(calStart)}&to=${isoDay(end)}`); }
    catch (e) { $('#c-days').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (calFocus) { const v = visitsCache.find(x => x.id === calFocus) || (await api('/api/admin/visits').catch(() => [])).find(x => x.id === calFocus); if (v && !visitsCache.includes(v)) { calStart = monday(new Date(v.starts_at.slice(0, 10) + 'T12:00')); return loadCal(); } }
    const today = isoDay(new Date()), now = nowLocal();
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(calStart); d.setDate(d.getDate() + i); return d; });
    $('#c-days').innerHTML = days.map(d => {
      const key = isoDay(d), list = visitsCache.filter(v => v.starts_at.slice(0, 10) === key);
      return `<section class="cal-day ${key === today ? 'today' : ''}"><header>${dayLong(d)}${key === today ? ' <span class="gold">· sot</span>' : ''}</header>
        ${list.length ? list.map(v => {
          const past = v.starts_at < now && v.status === 'planned';
          return `<article class="vcard st-${v.status} ${calFocus === v.id ? 'focus' : ''} ${v.mine ? '' : 'theirs'}" data-v="${v.id}">
            <span class="v-time">${v.starts_at.slice(11)}<small>${v.duration} min</small></span>
            <div class="v-b"><b>${v.mine ? esc(v.lead_name || 'Klient') : `Klient i ${esc(v.agent_name || 'një agjenti')}`}</b>
              <span class="m-meta">${v.property_code ? `${esc(v.property_code)} – ${esc(v.property_title)}` : 'Pa pronë'}${v.zone || v.city ? ` · ${esc([v.zone, v.city].filter(Boolean).join(', '))}` : ''}</span>
              ${!v.mine ? `<span class="m-meta">Vizitë te prona juaj nga ${esc(v.agent_name || 'një koleg')}</span>` : admin() && v.agent_name ? `<span class="m-meta">${esc(v.agent_name)}</span>` : ''}
              ${v.note ? `<span class="m-meta">${esc(v.note)}</span>` : ''}
              <div class="m-tags"><span class="ap vs-${v.status}">${VSTATUS[v.status]}</span>${v.reaction === 'liked' ? '<span class="ap ap-approved">I pëlqeu</span>' : v.reaction === 'dismissed' ? '<span class="ap ap-rejected">Nuk i pëlqeu</span>' : ''}${past ? '<span class="ap ap-pending">Si shkoi?</span>' : ''}</div>
              ${v.feedback ? `<span class="m-meta">“${esc(v.feedback)}”</span>` : ''}
              ${v.mine ? `<div class="m-acts">${v.status === 'planned' ? `<button class="btn ${past ? '' : 'ghost'}" type="button" data-va="feedback">Si shkoi?</button><button class="btn ghost" type="button" data-va="edit">Ndrysho</button>` : `<button class="btn ghost" type="button" data-va="feedback">Ndrysho përgjigjen</button>`}
                ${v.lead_phone ? `<a class="btn ghost" href="https://wa.me/${waOf(v.lead_phone)}?text=${encodeURIComponent(`Përshëndetje ${(v.lead_name || '').split(' ')[0]}, ju kujtoj vizitën më ${v.starts_at.slice(8, 10)}.${v.starts_at.slice(5, 7)} në ${v.starts_at.slice(11)}${v.property_code ? ` te prona ${v.property_code}${v.address ? ', ' + v.address : ''}` : ''}. ${whoAmI()} – De Luxe`)}" target="_blank" rel="noopener">${ti('wa')}Kujtoji</a>` : ''}</div>` : ''}
            </div></article>`;
        }).join('') : '<p class="muted cal-empty">—</p>'}</section>`;
    }).join('');
    if (calFocus) { setTimeout(() => $('.vcard.focus')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); calFocus = null; }
  }
  function calClick(e) {
    const b = e.target.closest('[data-va]'); if (!b) return;
    const v = visitsCache.find(x => x.id === Number(b.closest('[data-v]').dataset.v)); if (!v) return;
    if (b.dataset.va === 'edit') openVisit(v);
    if (b.dataset.va === 'feedback') openFeedback(v);
  }
  // Forma e vizitës (e re ose ndryshim). Nga Match/opportunity vjen e plotësuar.
  const vm = $('#vmodal'), vf = $('#vform'); let curVisit = null;
  async function openVisit(pre = {}) {
    curVisit = pre.id ? pre : null; vf.reset(); $('#vm-msg').textContent = '';
    await ensureProps();
    const leads = curVisit ? [] : await api('/api/admin/leads?status=active').catch(() => []);
    const leadSel = $('#v-lead');
    if (curVisit) { leadSel.innerHTML = `<option value="${curVisit.lead_id}">${esc(curVisit.lead_name || 'Klienti')}</option>`; leadSel.disabled = true; }
    else { leadSel.disabled = false; leadSel.innerHTML = '<option value="">Zgjidhni klientin…</option>' + leads.map(l => `<option value="${l.id}">${esc(l.name)}${l.phone ? ' · ' + esc(l.phone) : ''}</option>`).join(''); if (pre.lead_id && !leads.some(l => l.id === pre.lead_id)) leadSel.insertAdjacentHTML('beforeend', `<option value="${pre.lead_id}">Klienti</option>`); }
    $('#v-prop').innerHTML = '<option value="">Pa pronë</option>' + propsCache.map(p => `<option value="${p.id}">${esc(p.code)} – ${esc(p.title)}${p.agent_name && admin() ? ' · ' + esc(p.agent_name) : ''}</option>`).join('');
    leadSel.value = String(pre.lead_id || '');
    await fillVisitOpps(pre.lead_id, pre.opp_id);
    vf.elements.property_id.value = String(pre.property_id || '');
    if (pre.property_id && vf.elements.property_id.value !== String(pre.property_id)) $('#v-prop').insertAdjacentHTML('beforeend', `<option value="${pre.property_id}" selected>${esc(pre.property_code || 'Prona')}</option>`);
    const def = new Date(Date.now() + 24 * 3600e3); def.setMinutes(0);
    vf.elements.starts_at.value = (pre.starts_at || `${isoDay(def)} ${String(Math.min(18, Math.max(10, def.getHours()))).padStart(2, '0')}:00`).replace(' ', 'T');
    vf.elements.duration.value = String(pre.duration || 45); vf.elements.note.value = pre.note || '';
    $('#vm-title').textContent = curVisit ? 'Ndrysho vizitën' : 'Vizitë e re';
    $('#vm-del').hidden = !curVisit;
    if (om.open) om.close();
    vm.showModal();
  }
  async function fillVisitOpps(leadId, sel) {
    const box = $('#v-opp');
    if (!leadId) { box.innerHTML = '<option value="">—</option>'; return; }
    const l = await api('/api/admin/leads/' + leadId).catch(() => null);
    const opps = (l?.opportunities || []).filter(o => !['won', 'lost'].includes(o.stage));
    box.innerHTML = '<option value="">Pa lidhje</option>' + opps.map(o => `<option value="${o.id}">${esc(o.title)}</option>`).join('');
    box.value = String(sel || (opps.length === 1 ? opps[0].id : ''));
  }
  $('#v-lead').addEventListener('change', e => fillVisitOpps(Number(e.target.value)));
  async function ensureProps() {
    if (propsCache) return;
    propsCache = [];
    for (let pg = 1; pg <= 10; pg++) { const r = await api(`/api/properties?limit=48&page=${pg}&sort=newest`).catch(() => null); if (!r) break; propsCache.push(...r.items); if (pg >= r.pages) break; }
    const own = await api('/api/admin/properties').catch(() => []);
    own.forEach(p => { const i = propsCache.findIndex(x => x.id === p.id); if (i < 0) propsCache.push(p); else propsCache[i] = { ...propsCache[i], agent_name: p.agent_name }; });
  }
  vf.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(vf)); body.lead_id = $('#v-lead').value;
    if (!body.lead_id) { $('#vm-msg').className = 'form-msg err'; $('#vm-msg').textContent = 'Zgjidhni klientin.'; return; }
    const btn = $('#vm-save'); btn.classList.add('loading');
    const save = async force => api('/api/admin/visits' + (curVisit ? '/' + curVisit.id : ''), { method: curVisit ? 'PUT' : 'POST', body: { ...body, force } });
    try {
      let v;
      try { v = await save(false); }
      catch (err) { if (!/^Përplasje/.test(err.message)) throw err; if (!confirm(err.message + '\n\nTa caktoj gjithsesi?')) return; v = await save(true); }
      vm.close(); toast(curVisit ? 'Vizita u ndryshua.' : `Vizita u caktua: ${v.starts_at.slice(8, 10)}.${v.starts_at.slice(5, 7)} në ${v.starts_at.slice(11)}.`);
      calFocus = v.id; calStart = monday(new Date(v.starts_at.slice(0, 10) + 'T12:00'));
      if (location.hash === '#kalendari') loadCal(); else go('kalendari');
    } catch (err) { $('#vm-msg').className = 'form-msg err'; $('#vm-msg').textContent = err.message; }
    finally { btn.classList.remove('loading'); }
  });
  $('#vm-del').addEventListener('click', async () => {
    if (!curVisit || !confirm('Të fshihet kjo vizitë?')) return;
    try { await api('/api/admin/visits/' + curVisit.id, { method: 'DELETE' }); vm.close(); toast('Vizita u fshi.'); if ($('#c-days')) loadCal(); } catch (err) { toast(err.message, 'err'); }
  });
  // Si shkoi vizita
  const fm = $('#fmodal'); let fVisit = null, fStatus = 'done', fReact = '';
  const pick = (box, v) => $$(`${box} [data-v]`).forEach(b => b.classList.toggle('on', b.dataset.v === v));
  function openFeedback(v) {
    fVisit = v; fStatus = v.status === 'planned' ? 'done' : v.status; fReact = v.reaction || '';
    $('#fm-sub').textContent = `${v.lead_name || ''} · ${v.property_code || 'pa pronë'} · ${v.starts_at.slice(8, 10)}.${v.starts_at.slice(5, 7)} ${v.starts_at.slice(11)}`;
    $('#f-text').value = v.feedback || ''; pick('#f-status', fStatus); pick('#f-react', fReact);
    $('#f-react-f').hidden = fStatus !== 'done';
    fm.showModal();
  }
  $('#f-status').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; fStatus = b.dataset.v; pick('#f-status', fStatus); $('#f-react-f').hidden = fStatus !== 'done'; });
  $('#f-react').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; fReact = b.dataset.v; pick('#f-react', fReact); });
  $('#fform').addEventListener('submit', async e => {
    e.preventDefault(); if (!fVisit) return;
    try { await api('/api/admin/visits/' + fVisit.id, { method: 'PATCH', body: { status: fStatus, reaction: fStatus === 'done' ? fReact : '', feedback: $('#f-text').value } }); fm.close(); toast('U ruajt te historiku i klientit.'); if ($('#c-days')) loadCal(); else route(); }
    catch (err) { toast(err.message, 'err'); }
  });

  /* ---------- harta: pini i pronës ---------- */
  let lmap = null, lpin = null, leafletP = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise((res, rej) => {
      // Stilet e nevojshme të Leaflet janë te admin.css (pa CSS nga jashtë)
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      s.onload = () => res(window.L); s.onerror = () => { leafletP = null; rej(new Error('Harta nuk u ngarkua. Kontrolloni internetin.')); };
      document.head.append(s);
    });
    return leafletP;
  }
  const pinIcon = () => window.L.divIcon({ className: 'pin-ic', html: '<span></span>', iconSize: [26, 36], iconAnchor: [13, 34] });
  function setPin(lat, lng, pan = true) {
    lat = Math.round(lat * 1e6) / 1e6; lng = Math.round(lng * 1e6) / 1e6;
    pf.elements.lat.value = lat; pf.elements.lng.value = lng;
    if (!lmap) return;
    if (!lpin) { lpin = window.L.marker([lat, lng], { draggable: true, icon: pinIcon() }).addTo(lmap); lpin.on('dragend', () => { const p = lpin.getLatLng(); setPin(p.lat, p.lng, false); }); }
    else lpin.setLatLng([lat, lng]);
    if (pan) lmap.setView([lat, lng], Math.max(lmap.getZoom(), 16));
  }
  async function initMap() {
    const box = $('#pin-map');
    try { await loadLeaflet(); } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)} Koordinatat mund t’i shkruani më poshtë.</p>`; return; }
    if (lmap) { lmap.remove(); lmap = null; lpin = null; }
    box.innerHTML = '';
    const lat = parseFloat(pf.elements.lat.value), lng = parseFloat(pf.elements.lng.value);
    const c = PIN_CITY[pf.elements.city.value.trim()];
    lmap = window.L.map(box, { zoomControl: true, attributionControl: true }).setView(Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : c || [41.15, 20.0], Number.isFinite(lat) ? 16 : c ? 13 : 7);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(lmap);
    if (Number.isFinite(lat) && Number.isFinite(lng)) setPin(lat, lng, false);
    lmap.on('click', e => setPin(e.latlng.lat, e.latlng.lng, false));
    setTimeout(() => lmap && lmap.invalidateSize(), 250);
    if (IS_DEMO) $('#map-hint').textContent = 'Në demo sfondi i hartës nuk ngarkohet (pa internet), por pini dhe koordinatat punojnë. Në faqen e publikuar harta shfaqet e plotë.';
  }
  async function geocode() {
    const q = $('#map-q').value.trim() || [pf.elements.address.value, pf.elements.zone.value, pf.elements.city.value].filter(Boolean).join(', ');
    if (!q) return toast('Shkruani adresën ose lagjen.', 'err');
    const res = $('#map-res'); res.hidden = false; res.innerHTML = '<li class="muted">Po kërkohet…</li>';
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=al&accept-language=sq&q=${encodeURIComponent(q)}`);
      const d = await r.json();
      res.innerHTML = d.length ? d.map(x => `<li><button type="button" data-ll="${x.lat},${x.lon}">${esc(x.display_name)}</button></li>`).join('') : '<li class="muted">Nuk u gjet. Provoni vetëm lagjen dhe qytetin, ose vendoseni pinin me dorë.</li>';
    } catch { res.innerHTML = '<li class="muted">Kërkimi i adresës nuk punoi. Vendoseni pinin me dorë në hartë.</li>'; }
  }
  $('#map-go').addEventListener('click', geocode);
  $('#map-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); geocode(); } });
  $('#map-res').addEventListener('click', e => { const b = e.target.closest('[data-ll]'); if (!b) return; const [la, ln] = b.dataset.ll.split(',').map(Number); setPin(la, ln); $('#map-res').hidden = true; });
  $('#map-me').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Ky shfletues nuk e jep vendndodhjen.', 'err');
    navigator.geolocation.getCurrentPosition(p => { setPin(p.coords.latitude, p.coords.longitude); toast('Pini u vendos aty ku jeni.'); }, () => toast('Vendndodhja nuk u lejua. Vendoseni pinin me dorë.', 'err'), { enableHighAccuracy: true, timeout: 10000 });
  });
  $('#map-clear').addEventListener('click', () => { pf.elements.lat.value = ''; pf.elements.lng.value = ''; if (lpin) { lpin.remove(); lpin = null; } });
  ['lat', 'lng'].forEach(k => pf.elements[k].addEventListener('change', () => { const la = parseFloat(pf.elements.lat.value), ln = parseFloat(pf.elements.lng.value); if (Number.isFinite(la) && Number.isFinite(ln)) setPin(la, ln); }));
  $('#p-city').addEventListener('change', e => { const c = PIN_CITY[e.target.value.trim()]; if (c && lmap && !lpin) lmap.setView(c, 13); });

  /* ---------- pronari dhe dokumentet (private) ---------- */
  const ownerFields = () => $$('[data-owner]', pm);
  function fillOwner(o) { ownerFields().forEach(el => { const v = o?.[el.dataset.owner]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? ''; }); }
  const readOwner = () => Object.fromEntries(ownerFields().map(el => [el.dataset.owner, el.type === 'checkbox' ? el.checked : el.value]));
  $('#owner-save').addEventListener('click', async () => {
    if (!editing) return;
    try { await api(`/api/admin/properties/${editing}/owner`, { method: 'PUT', body: readOwner() }); toast('Të dhënat e pronarit u ruajtën.'); } catch (err) { toast(err.message, 'err'); }
  });
  let docKinds = {};
  async function loadDocs(focus) {
    const box = $('#docs');
    if (!editing) { box.innerHTML = '<p class="muted" style="margin:0">Ruani fillimisht pronën; pastaj hapeni sërish për të shtuar dokumentet (certifikata, planimetria, kontrata…). Asnjë dokument nuk është i detyrueshëm.</p>'; return; }
    box.innerHTML = '<p class="muted" style="margin:0">Po ngarkohen…</p>';
    try {
      const d = await api(`/api/admin/properties/${editing}/docs`); docKinds = d.kinds;
      const today = todayStr();
      box.innerHTML = `${d.missing.length ? `<p class="doc-miss">Mungon: ${d.missing.map(esc).join(', ')} <small class="muted">· vetëm për dijeni, nuk e bllokon pronën</small></p>` : '<p class="doc-ok">✓ Dokumentet kryesore janë të plota</p>'}
        <ul class="doc-list">${d.items.map(x => `<li data-doc="${x.id}" data-mime="${esc(x.mime)}" data-name="${esc(x.name)}">
          <span class="doc-ic">${x.mime === 'application/pdf' ? 'PDF' : 'IMG'}</span>
          <div><b>${esc(x.name)}</b><small class="muted">${esc(x.kind_label)} · ${Math.max(1, Math.round(x.size / 1024))} KB${x.expires_at ? ` · <span class="${x.expires_at < today ? 'err-t' : ''}">${x.expires_at < today ? 'skadoi' : 'skadon'} ${x.expires_at.split('-').reverse().join('.')}</span>` : ''}${x.note ? ' · ' + esc(x.note) : ''}</small></div>
          <span class="row-acts"><button class="icon-btn" type="button" data-dview aria-label="Shiko">${ic.eye}</button><button class="icon-btn danger" type="button" data-ddel aria-label="Fshi">${ic.del}</button></span></li>`).join('')}</ul>
        <div class="doc-add">
          <select class="select" id="d-kind" aria-label="Lloji i dokumentit">${Object.entries(d.kinds).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
          <input class="input" id="d-exp" type="date" aria-label="Skadon më (opsionale)" title="Skadon më (opsionale)">
          <input class="input" id="d-note" placeholder="Shënim (opsional)">
          <label class="btn ghost sm" for="d-file">Ngarko dokument</label><input type="file" id="d-file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden>
        </div><small class="muted">PDF, JPG, PNG ose WEBP deri në 10 MB. E shohin vetëm agjenti listues dhe administratori.</small>`;
      if (focus === 'docs') setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    } catch (e) { box.innerHTML = `<p class="muted" style="margin:0">${esc(e.message)}</p>`; }
  }
  $('#docs').addEventListener('change', async e => {
    if (e.target.id !== 'd-file') return;
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type)) return toast('Lejohen vetëm PDF, JPG, PNG ose WEBP.', 'err');
    if (f.size > 10 * 1024 * 1024) return toast('Dokumenti duhet të jetë më i vogël se 10 MB.', 'err');
    const kind = $('#d-kind').value;
    toast(`Po ngarkohet ${f.name}…`);
    try {
      await api(`/api/admin/properties/${editing}/docs`, { method: 'POST', body: { kind, name: kind === 'tjeter' ? f.name.replace(/\.[^.]+$/, '') : docKinds[kind], expires_at: $('#d-exp').value, note: $('#d-note').value, data: await fileToData(f) } });
      toast('Dokumenti u ruajt.'); loadDocs();
    } catch (err) { toast(err.message, 'err'); }
  });
  $('#docs').addEventListener('click', async e => {
    const li = e.target.closest('[data-doc]'); if (!li) return;
    const id = li.dataset.doc;
    if (e.target.closest('[data-ddel]')) {
      if (!confirm(`Të fshihet dokumenti “${li.dataset.name}”?`)) return;
      try { await api('/api/admin/docs/' + id, { method: 'DELETE' }); toast('Dokumenti u fshi.'); loadDocs(); } catch (err) { toast(err.message, 'err'); }
    }
    if (e.target.closest('[data-dview]')) {
      try {
        const r = await fetch('/api/admin/docs/' + id + '/file');
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Dokumenti nuk u hap.');
        const url = URL.createObjectURL(await r.blob()), pdf = li.dataset.mime === 'application/pdf';
        $('#dv-title').textContent = li.dataset.name;
        $('#dv-body').innerHTML = pdf ? `<iframe src="${url}" title="${esc(li.dataset.name)}" class="doc-frame"></iframe>` : `<img src="${url}" alt="" class="doc-img">`;
        $('#dv-dl').href = url; $('#dv-dl').download = `${li.dataset.name}.${pdf ? 'pdf' : (li.dataset.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`;
        $('#dvmodal').showModal();
        $('#dvmodal').addEventListener('close', () => setTimeout(() => URL.revokeObjectURL(url), 1000), { once: true });
      } catch (err) { toast(err.message, 'err'); }
    }
  });

  /* ---------- njoftimet në telefon (Web Push, falas) ---------- */
  const b64ToBytes = s => { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  async function pushState() {
    if (!pushSupported()) return 'unsupported';
    try { const reg = await navigator.serviceWorker.getRegistration('/'); const sub = reg && await reg.pushManager.getSubscription(); return sub ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off'; } catch { return 'unsupported'; }
  }
  async function pushOn() {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    if (await Notification.requestPermission() !== 'granted') throw new Error('Njoftimet nuk u lejuan. Lejojini te cilësimet e shfletuesit.');
    const { key } = await api('/api/admin/push/key');
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    await api('/api/admin/push/subscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
  }
  async function pushOff() {
    const reg = await navigator.serviceWorker.getRegistration('/'); const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { await api('/api/admin/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
  }
  async function drawPush() {
    const box = $('#push-box'); if (!box) return;
    const st = await pushState();
    const ios = /iPhone|iPad/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches;
    box.innerHTML = `<h2>Njoftime në telefon</h2>
      <p class="muted" style="margin:0;font-size:.92rem">Njoftimet për match-e, vizita dhe prona të reja dalin në ekranin e telefonit, edhe kur paneli është i mbyllur. Falas.</p>
      ${st === 'on' ? '<p class="doc-ok" style="margin:0">✓ Aktive në këtë pajisje</p><button class="btn ghost" type="button" id="push-off" style="justify-self:start">Çaktivizo në këtë pajisje</button>'
        : st === 'denied' ? '<p class="doc-miss" style="margin:0">Njoftimet janë bllokuar për këtë faqe. Lejojini te cilësimet e shfletuesit dhe provoni sërish.</p>'
        : st === 'unsupported' ? `<p class="doc-miss" style="margin:0">${ios ? 'Në iPhone: shtypni “Share” → “Add to Home Screen”, hapeni panelin nga ikona e re dhe aktivizojini këtu.' : IS_DEMO ? 'Në demo njoftimet në telefon nuk punojnë. Në faqen e publikuar (me HTTPS) aktivizohen këtu.' : 'Ky shfletues nuk i mbështet njoftimet. Provoni Chrome, Edge ose Safari të përditësuar.'}</p>`
        : '<button class="btn" type="button" id="push-on" style="justify-self:start">Aktivizo njoftimet</button>'}`;
    $('#push-on')?.addEventListener('click', async e => { e.target.classList.add('loading'); try { await pushOn(); toast('Njoftimet u aktivizuan në këtë pajisje.'); } catch (err) { toast(err.message || 'Njoftimet nuk u aktivizuan.', 'err'); } drawPush(); });
    $('#push-off')?.addEventListener('click', async () => { await pushOff().catch(() => {}); toast('Njoftimet u çaktivizuan.'); drawPush(); });
  }

  /* =====================================================================
     3.2 – zyrat, brokeri dhe mbyllja e komisioneve
     ===================================================================== */
  let officesCache = [], ofEditing = null, dashOffice = null;
  function commissionList(list) {
    return `<ul class="list-mini comm-list">${list.map(o => `<li data-copp="${o.id}"><span><b style="font-weight:500">${esc(o.agent_name || 'Pa agjent')}</b> · ${esc(o.lead_name || '')}<br><small class="muted">${esc(o.title)}${o.property_code ? ' · ' + esc(o.property_code) : ''}${o.split_agent_name ? ` · ndahet me ${esc(o.split_agent_name)} (${o.split_pct ?? 50}/${100 - (o.split_pct ?? 50)})` : ''}</small></span>
      <span class="comm-act">${o.can_close === false ? `<span class="muted" style="font-size:.85rem">${fmt(o.commission || 0)} € · e mbyll administratori</span>` : `<input class="input" inputmode="numeric" value="${o.commission || ''}" aria-label="Komisioni (€)" placeholder="€"><button class="btn sm" type="button" data-close-comm>Mbyll</button>`}${admin() || o.agent_id === USER.agent?.id ? `<button class="icon-btn" type="button" data-open-opp aria-label="Hap opportunity-në" title="Hap">${ti('arrow')}</button>` : ''}</span></li>`).join('')}</ul>`;
  }
  async function commissionClick(e) {
    const li = e.target.closest('[data-copp]'); if (!li) return;
    if (e.target.closest('[data-open-opp]')) return openOpp(Number(li.dataset.copp));
    if (!e.target.closest('[data-close-comm]')) return;
    const amount = String(li.querySelector('input').value).replace(/\D/g, '');
    if (!amount) return toast('Shkruani shumën e komisionit.', 'err');
    if (!confirm(`Të mbyllet komisioni ${fmt(amount)} €? Pas mbylljes hyn te raportet dhe objektivat.`)) return;
    try { await api(`/api/admin/opportunities/${li.dataset.copp}/commission`, { method: 'POST', body: { commission: amount } }); toast('Komisioni u mbyll. Agjenti u njoftua.'); route(); }
    catch (err) { toast(err.message, 'err'); }
  }
  // Administratori: lista e zyrave
  async function zyrat() {
    if (dashOffice) return officeDash(dashOffice);
    officesCache = await api('/api/admin/offices');
    $('#view').innerHTML = `<div id="zv"><div class="top"><h1>Zyrat</h1><button class="btn" id="add-of">Hap zyrë</button></div>
      <p class="muted" style="margin:-1rem 0 1.5rem">Çdo zyrë ka brokerin e vet, i cili cakton objektivat dhe mbyll komisionet e agjentëve të zyrës. Pronat e reja të zyrës marrin kodin e saj.</p>
      ${officesCache.length ? `<div class="of-grid">${officesCache.map(o => `<article class="of-card ${o.active ? '' : 'off'}" data-of="${o.id}">
        <div class="of-h"><span class="of-code">${esc(o.code)}</span><div><h3>${esc(o.name)}</h3><small class="muted">${esc([o.zone, o.city].filter(Boolean).join(', ') || '–')}</small></div></div>
        <dl class="of-dl"><div><dt>Brokeri</dt><dd>${esc(o.broker_name || '— pa broker')}</dd></div><div><dt>Agjentë</dt><dd>${o.agents_count}</dd></div><div><dt>Prona në faqe</dt><dd>${o.live_count}</dd></div><div><dt>Kodi i pronës së radhës</dt><dd>${esc(o.code)}-${1000 + (o.next_seq || 1)}</dd></div></dl>
        <div class="m-acts"><button class="btn sm" type="button" data-odash>Dashboard</button><button class="btn ghost sm" type="button" data-oedit>Ndrysho</button></div></article>`).join('')}</div>`
        : '<div class="empty"><h3>Nuk keni hapur ende zyra</h3>Hapni zyrën e parë, caktoni brokerin dhe pastaj agjentët te “Agjentët”.</div>'}</div>`;
    $('#add-of').addEventListener('click', () => openOffice());
    $('#zv').addEventListener('click', e => {
      const card = e.target.closest('[data-of]'); if (!card) return;
      const o = officesCache.find(x => x.id === Number(card.dataset.of));
      if (e.target.closest('[data-oedit]')) openOffice(o);
      else if (e.target.closest('[data-odash]')) { dashOffice = o.id; officeDash(o.id); }
    });
  }
  // Brokeri: zyra e vet
  async function zyra() { return USER.broker_of ? officeDash(USER.broker_of.id) : go('paneli'); }
  async function officeDash(id) {
    const qs = tMonth && tOffice === id ? '?month=' + tMonth : '';
    let d; try { d = await api(`/api/admin/offices/${id}/dashboard${qs}`); } catch (e) { $('#view').innerHTML = `<div class="empty"><h3>Gabim</h3>${esc(e.message)}</div>`; return; }
    tOffice = id; tMonth = d.month;
    const T = d.totals, G = d.targets;
    const tile = (label, got, want, money) => `<div class="stat"><b>${money ? fmt(got) + ' €' : got}</b><span>${label}${want ? ` · objektivi ${money ? fmt(want) + ' €' : want}` : ''}</span>${want ? `<div class="tbar-t" style="margin-top:.5rem"><i style="width:${Math.min(100, Math.round(got / want * 100))}%" class="${got >= want ? 'done' : ''}"></i></div>` : ''}</div>`;
    $('#view').innerHTML = `<div id="odv"><div class="top"><div>${admin() ? '<button class="btn ghost sm" type="button" id="od-back" style="margin-bottom:.6rem">‹ Të gjitha zyrat</button>' : ''}<h1 style="margin:0">${esc(d.office.name)}</h1>
        <small class="muted">${esc(d.office.code)} · ${esc([d.office.zone, d.office.city].filter(Boolean).join(', '))} · Brokeri: ${esc(d.office.broker_name || '—')} · ${d.office.agents_count} agjentë</small></div></div>
      <div class="cards od-cards">${tile('Komision i mbyllur', T.commission, G.commission, true)}<div class="stat"><b>${fmt(d.pending_total)} €</b><span>Në pritje të mbylljes (${d.pending.length})</span></div>${tile('Marrëveshje', T.deals, G.deals)}${tile('Leads të reja', T.leads, G.leads)}${tile('Vizita të kryera', T.visits, G.visits)}${tile('Prona të listuara', T.listings, G.listings)}</div>
      <div class="panel" id="od-pending" style="margin-bottom:1.5rem"><div class="tg-head"><h2 style="margin:0">Komisione për t’u mbyllur</h2><a class="gold" href="#komisionet">Të gjitha komisionet →</a></div>${d.pending.length ? commissionList(d.pending) : '<p class="muted" style="margin:0">Asnjë komision në pritje. Kur një agjent i zyrës shënon një marrëveshje të fituar, del këtu.</p>'}</div>
      <div class="panel" style="margin-bottom:1.5rem"><h2 style="margin-top:0">Agjentët e zyrës · ${esc(monthName(d.month))}</h2>
        <div class="table-wrap" style="border:0"><table style="min-width:640px"><thead><tr><th>#</th><th>Agjenti</th><th>Komision</th><th>Në pritje</th><th>Marrëveshje</th><th>Leads</th><th>Vizita</th><th>Prona</th></tr></thead><tbody>
        ${d.agents.map((a, i) => `<tr><td>${i + 1}</td><td><span class="t">${esc(a.name)}</span>${a.is_broker ? '<small class="gold">Broker</small>' : ''}</td><td>${fmt(a.actual.commission)} €${a.target?.commission ? `<small class="muted">nga ${fmt(a.target.commission)} €</small>` : ''}</td><td>${a.actual.pending ? fmt(a.actual.pending) + ' €' : '–'}</td><td>${a.actual.deals}${a.target?.deals ? ` / ${a.target.deals}` : ''}</td><td>${a.actual.leads}${a.target?.leads ? ` / ${a.target.leads}` : ''}</td><td>${a.actual.visits}${a.target?.visits ? ` / ${a.target.visits}` : ''}</td><td>${a.actual.listings}${a.target?.listings ? ` / ${a.target.listings}` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Zyra nuk ka ende agjentë. I caktoni te “Agjentët”.</td></tr>'}
        </tbody></table></div></div>
      <div class="panel" id="targets"></div></div>`;
    $('#od-back')?.addEventListener('click', () => { dashOffice = null; tOffice = null; tMonth = null; zyrat(); });
    $('#od-pending').addEventListener('click', commissionClick);
    await loadTargets();
    // Muaji i objektivave ndryshon edhe dashboard-in
    $$('#targets [data-tm]').forEach(b => b.addEventListener('click', () => setTimeout(() => officeDash(id), 0), { once: true }));
  }
  // Hapja / ndryshimi i zyrës
  const ofm = $('#ofmodal'), off = $('#ofform');
  async function openOffice(o = null) {
    ofEditing = o?.id || null; off.reset(); $('#of-msg').textContent = '';
    if (!agentsCache.length) agentsCache = await api('/api/admin/agents').catch(() => []);
    $('#of-broker').innerHTML = '<option value="">— pa broker</option>' + agentsCache.map(a => `<option value="${a.id}">${esc(a.name)}${a.office_code ? ' · ' + esc(a.office_code) : ''}</option>`).join('');
    for (const k of ['name', 'code', 'city', 'zone', 'address', 'phone', 'whatsapp', 'email', 'hours']) off.elements[k].value = o?.[k] || '';
    off.elements.broker_agent_id.value = String(o?.broker_agent_id || '');
    off.elements.active.checked = o ? !!o.active : true;
    $('#of-title').textContent = o ? 'Ndrysho zyrën' : 'Zyrë e re';
    $('#of-del').hidden = !o;
    ofm.showModal();
  }
  off.elements.code.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); });
  off.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(off)); body.active = off.elements.active.checked;
    try { await api('/api/admin/offices' + (ofEditing ? '/' + ofEditing : ''), { method: ofEditing ? 'PUT' : 'POST', body }); ofm.close(); toast(ofEditing ? 'Zyra u ruajt.' : `Zyra u hap. Pronat e reja të saj marrin kodin ${body.code}-1001, ${body.code}-1002…`); agentsCache = []; zyrat(); }
    catch (err) { $('#of-msg').className = 'form-msg err'; $('#of-msg').textContent = err.message; }
  });
  $('#of-del').addEventListener('click', async () => {
    if (!ofEditing || !confirm('Të mbyllet kjo zyrë? Agjentët dhe pronat e saj mbeten, pa zyrë; kodet e pronave nuk ndryshojnë.')) return;
    try { await api('/api/admin/offices/' + ofEditing, { method: 'DELETE' }); ofm.close(); toast('Zyra u mbyll.'); agentsCache = []; zyrat(); } catch (err) { toast(err.message, 'err'); }
  });
  // Kur administratori ndryshon agjentin e pronës, zyra e pronës ndjek zyrën e agjentit
  $('#p-agent').addEventListener('change', e => { const a = agentsCache.find(x => x.id === Number(e.target.value)); if (a && !editing) $('#p-office').value = String(a.office_id || ''); });

  /* ---------- Komisionet: performanca dhe mbyllja ---------- */
  const dmy = v => v ? String(v).slice(0, 10).split('-').reverse().join('.') : '';
  const kState = { scope: null, month: null, status: 'all', office: '', agent: '' };
  async function komisionet() {
    if (!kState.scope) kState.scope = admin() ? 'all' : USER.broker_of ? 'office' : 'me';
    if (!kState.month) { const d = new Date(); kState.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
    if (admin() && !officesCache.length) officesCache = await api('/api/admin/offices').catch(() => []);
    if ((admin() || USER.broker_of) && !agentsCache.length) agentsCache = await api('/api/admin/agents').catch(() => []);
    $('#view').innerHTML = `<div id="kv"><div class="top"><h1>Komisionet</h1>${admin() || USER.broker_of ? '<button class="btn ghost sm" type="button" id="k-csv">Shkarko në Excel (CSV)</button>' : ''}</div>
      ${USER.broker_of ? `<div class="tabs m-tabs" id="k-scope"><button data-s="office">Zyra ${esc(USER.broker_of.code)}</button><button data-s="me">Të miat</button></div>` : ''}
      <div class="toolbar k-filters">
        <span class="toolbar"><button class="btn ghost sm" type="button" data-km="-1" aria-label="Muaji i mëparshëm">‹</button><b id="k-month" style="font-weight:500;min-width:130px;text-align:center"></b><button class="btn ghost sm" type="button" data-km="1" aria-label="Muaji tjetër">›</button><button class="btn ghost sm" type="button" data-km="all">Të gjithë muajt</button></span>
        <div class="tabs" id="k-status"><button data-st="all">Të gjitha</button><button data-st="pending">Në pritje</button><button data-st="closed">Të mbyllura</button></div>
        ${admin() ? `<select class="select" id="k-office" aria-label="Zyra"><option value="">Të gjitha zyrat</option>${officesCache.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select>` : ''}
        ${admin() || USER.broker_of ? `<select class="select" id="k-agent" aria-label="Agjenti"><option value="">Të gjithë agjentët</option></select>` : ''}
      </div>
      <div id="k-body"><div class="skeleton" style="height:220px"></div></div></div>`;
    $('#kv').addEventListener('click', kClick);
    $('#k-office')?.addEventListener('change', e => { kState.office = e.target.value; kState.agent = ''; loadK(); });
    $('#k-agent')?.addEventListener('change', e => { kState.agent = e.target.value; loadK(); });
    $('#k-csv')?.addEventListener('click', kCsv);
    loadK();
  }
  let kData = null;
  async function loadK() {
    const q = new URLSearchParams({ scope: kState.scope, month: kState.month, status: kState.status });
    if (kState.office) q.set('office', kState.office); if (kState.agent) q.set('agent', kState.agent);
    try { kData = await api('/api/admin/commissions?' + q); } catch (e) { $('#k-body').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const d = kData;
    $$('#k-scope [data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === d.scope));
    $$('#k-status [data-st]').forEach(b => b.classList.toggle('on', b.dataset.st === kState.status));
    $('#k-month').textContent = d.month ? monthName(d.month) : 'Të gjithë muajt';
    const agentSel = $('#k-agent');
    if (agentSel) {
      const pool = admin() ? agentsCache.filter(a => !kState.office || String(a.office_id) === kState.office) : agentsCache.filter(a => a.office_id === USER.broker_of?.id);
      agentSel.innerHTML = '<option value="">Të gjithë agjentët</option>' + pool.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
      agentSel.value = kState.agent; agentSel.hidden = !admin() && d.scope !== 'office';
    }
    const S = d.summary, maxT = Math.max(1, ...d.trend.map(t => t.closed));
    const who = d.scope === 'me' ? 'Juaj' : d.scope === 'office' ? 'E zyrës' : 'E agjencisë';
    $('#k-body').innerHTML = `
      <div class="od-cards" style="margin-bottom:1.5rem">
        <div class="stat"><b>${fmt(S.closed)} €</b><span>${who} · e mbyllur${d.month ? '' : ' (gjithsej)'}</span>${S.target ? `<div class="tbar-t" style="margin-top:.5rem"><i style="width:${Math.min(100, Math.round(S.closed / S.target * 100))}%" class="${S.closed >= S.target ? 'done' : ''}"></i></div><small class="muted">Objektivi ${fmt(S.target)} €</small>` : ''}</div>
        <div class="stat"><b>${fmt(S.pending)} €</b><span>Në pritje të mbylljes (${S.pending_count})</span></div>
        <div class="stat"><b>${S.deals}</b><span>Marrëveshje të fituara</span></div>
        <div class="stat"><b>${S.deals ? fmt(Math.round((S.closed + S.pending) / S.deals)) + ' €' : '–'}</b><span>Mesatarja për marrëveshje</span></div>
      </div>
      <div class="panel" style="margin-bottom:1.5rem"><h2 style="margin-top:0">Ecuria · 12 muajt e fundit</h2>
        <div class="k-trend">${d.trend.map(t => `<div class="k-bar ${t.month === d.month ? 'on' : ''}" title="${esc(monthName(t.month))}: ${fmt(t.closed)} €"><span style="height:${Math.round(t.closed / maxT * 100)}%"></span><small>${MUAJT[Number(t.month.slice(5)) - 1].slice(0, 3)}</small></div>`).join('')}</div></div>
      ${d.by_office?.length ? `<div class="panel" style="margin-bottom:1.5rem"><h2 style="margin-top:0">Zyrat</h2><div class="table-wrap" style="border:0"><table style="min-width:520px"><thead><tr><th>Zyra</th><th>E mbyllur</th><th>Në pritje</th><th>Marrëveshje</th><th>Agjentë me komision</th></tr></thead><tbody>
        ${d.by_office.map(o => `<tr><td><span class="t">${esc(o.name)}</span></td><td>${fmt(o.closed)} €</td><td>${o.pending ? fmt(o.pending) + ' €' : '–'}</td><td>${o.deals}</td><td>${o.agents}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${d.by_agent.length ? `<div class="panel" style="margin-bottom:1.5rem"><h2 style="margin-top:0">Renditja e agjentëve</h2><div class="table-wrap" style="border:0"><table style="min-width:520px"><thead><tr><th>#</th><th>Agjenti</th><th>E mbyllur</th><th>Në pritje</th><th>Marrëveshje</th></tr></thead><tbody>
        ${d.by_agent.map((a, i) => `<tr><td>${i + 1}</td><td><span class="t">${esc(a.name)}</span>${a.office_code ? `<small>${esc(a.office_code)}</small>` : ''}</td><td>${fmt(a.closed)} €</td><td>${a.pending ? fmt(a.pending) + ' €' : '–'}</td><td>${a.deals}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      <div class="panel"><h2 style="margin-top:0">Marrëveshjet</h2>
        ${d.items.length ? `<div class="table-wrap" style="border:0"><table class="k-table" style="min-width:860px"><thead><tr><th>Data</th><th>Marrëveshja</th><th>Agjenti</th><th>Komisioni</th><th>${d.scope === 'me' ? 'Pjesa juaj' : 'Pjesa'}</th><th>Statusi</th><th></th></tr></thead><tbody>
          ${d.items.map(o => `<tr data-k="${o.id}">
            <td>${dmy(o.closed_at)}</td>
            <td><span class="t">${esc(o.title)}</span><small>${[o.property_code, o.lead_name].filter(Boolean).map(esc).join(' · ')}</small></td>
            <td>${esc(o.agent_name || '–')}${o.office_code ? `<small>${esc(o.office_code)}</small>` : ''}${o.split_agent_name ? `<small>ndahet me ${esc(o.split_agent_name)} (${o.split_pct ?? 50}/${100 - (o.split_pct ?? 50)})</small>` : ''}</td>
            <td>${o.can_close ? `<input class="input k-amt" inputmode="numeric" value="${o.commission || ''}" aria-label="Komisioni (€)" placeholder="€">` : `${fmt(o.commission || 0)} €`}</td>
            <td>${fmt(o.share)} €</td>
            <td>${o.status === 'pending' ? '<span class="ap ap-pending">Në pritje</span>' : `<span class="ap ap-approved">E mbyllur</span>${o.commission_closed_by ? `<small class="muted">${esc(o.commission_closed_by)} · ${dmy(o.commission_closed_at)}</small>` : ''}`}</td>
            <td><div class="row-acts">${o.can_close ? '<button class="btn sm" type="button" data-kclose>Mbyll</button>' : ''}${o.can_reopen ? '<button class="btn ghost sm" type="button" data-kreopen>Rihap</button>' : ''}${o.lead_id ? `<button class="icon-btn" type="button" data-kopen aria-label="Hap" title="Hap">${ti('arrow')}</button>` : ''}</div>
              ${o.status === 'pending' && !o.can_close ? '<small class="muted">E mbyll ' + (admin() ? 'administratori' : 'brokeri ose administratori') + '</small>' : ''}</td></tr>`).join('')}
          </tbody></table></div>` : `<p class="muted" style="margin:0">Asnjë marrëveshje e fituar ${d.month ? 'këtë muaj' : ''}${kState.status === 'pending' ? ' në pritje' : kState.status === 'closed' ? ' e mbyllur' : ''}.</p>`}
      </div>`;
  }
  async function kClick(e) {
    const sc = e.target.closest('[data-s]'); if (sc && sc.closest('#k-scope')) { kState.scope = sc.dataset.s; kState.agent = ''; return loadK(); }
    const stb = e.target.closest('[data-st]'); if (stb) { kState.status = stb.dataset.st; return loadK(); }
    const mb = e.target.closest('[data-km]');
    if (mb) {
      if (mb.dataset.km === 'all') kState.month = 'all';
      else { const base = kState.month === 'all' ? new Date() : new Date(kState.month + '-15T12:00'); base.setMonth(base.getMonth() + Number(mb.dataset.km)); kState.month = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`; }
      return loadK();
    }
    const tr = e.target.closest('[data-k]'); if (!tr) return;
    const id = Number(tr.dataset.k);
    if (e.target.closest('[data-kopen]')) return openOpp(id);
    if (e.target.closest('[data-kclose]')) {
      const amount = String(tr.querySelector('.k-amt')?.value || '').replace(/\D/g, '');
      if (!amount) return toast('Shkruani shumën e komisionit.', 'err');
      if (!confirm(`Të mbyllet komisioni ${fmt(amount)} €? Pas mbylljes hyn te raportet dhe objektivat, dhe agjenti njoftohet.`)) return;
      try { await api(`/api/admin/opportunities/${id}/commission`, { method: 'POST', body: { commission: amount } }); toast('Komisioni u mbyll.'); loadK(); refreshCounts(); } catch (err) { toast(err.message, 'err'); }
    }
    if (e.target.closest('[data-kreopen]')) {
      if (!confirm('Të rihapet ky komision? Del sërish “në pritje” dhe hiqet nga raportet derisa të mbyllet.')) return;
      try { await api(`/api/admin/opportunities/${id}/commission`, { method: 'POST', body: { action: 'reopen' } }); toast('Komisioni u rihap.'); loadK(); } catch (err) { toast(err.message, 'err'); }
    }
  }
  function kCsv() {
    if (!kData) return;
    const rows = [['Data', 'Marrëveshja', 'Prona', 'Klienti', 'Agjenti', 'Zyra', 'Ndahet me', 'Pjesa e agjentit %', 'Komisioni €', 'Pjesa €', 'Statusi', 'Mbyllur nga', 'Mbyllur më']]
      .concat(kData.items.map(o => [dmy(o.closed_at), o.title, o.property_code || '', o.lead_name || '', o.agent_name || '', o.office_code || '', o.split_agent_name || '', o.split_agent_id ? (o.split_pct ?? 50) : 100, o.commission || 0, o.share, o.status === 'pending' ? 'Në pritje' : 'E mbyllur', o.commission_closed_by || '', o.commission_closed_at ? dmy(o.commission_closed_at) : '']));
    const csv = '\ufeff' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `komisionet-${kData.month || 'te-gjitha'}.csv`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- lagjet si sugjerime në formularë ---------- */
  let ZONES = {};
  fetch('/api/meta').then(r => r.json()).then(m => { ZONES = m.zones || {}; fillZoneList(); $('#zone-city-list').innerHTML = [...$$('#city-list option').map(o => o.value), ...Object.entries(ZONES).flatMap(([c, l]) => l.map(z => `${z}, ${c}`))].map(v => `<option value="${esc(v)}">`).join(''); }).catch(() => {});
  function fillZoneList(city) {
    const list = city && ZONES[city] ? ZONES[city] : Object.values(ZONES).flat();
    $('#zone-list').innerHTML = list.map(z => `<option value="${esc(z)}">`).join('');
  }
  $('#p-city').addEventListener('input', e => fillZoneList(e.target.value.trim()));
  $('#l-city').setAttribute('list', 'zone-city-list');

  /* ---------- nisja ---------- */
  // Me fjalëkalimin fillestar paneli hapet vetëm pasi të vendoset një i ri
  function renderFirstPassword() {
    $('#app').innerHTML = `<div class="login"><form id="fp" novalidate>
      <img class="logo-full" src="/img/logo-full.png" alt="De Luxe Real Estate" style="width:200px;margin:0 auto">
      <h1>Vendosni fjalëkalimin tuaj</h1>
      <p class="muted" style="margin:0;font-size:.92rem">Jeni futur me fjalëkalimin fillestar, të cilin e di kushdo. Për sigurinë e të dhënave të klientëve, zgjidhni një të ri para se të vazhdoni.</p>
      <div class="field"><label for="fp-c">Fjalëkalimi aktual</label><input class="input" id="fp-c" name="current" type="password" autocomplete="current-password"></div>
      <div class="field"><label for="fp-n">Fjalëkalimi i ri (min. 8 karaktere)</label><input class="input" id="fp-n" name="next" type="password" autocomplete="new-password"></div>
      <div class="field"><label for="fp-r">Përsërit fjalëkalimin e ri</label><input class="input" id="fp-r" name="repeat" type="password" autocomplete="new-password"></div>
      <button class="btn block" type="submit">Ruaj dhe hyr në panel</button>
      <p class="form-msg err" id="fp-msg"></p>
    </form></div>`;
    $('#fp').addEventListener('submit', async e => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), m = $('#fp-msg');
      if (f.next !== f.repeat) { m.textContent = 'Fjalëkalimet e reja nuk përputhen.'; return; }
      try { await api('/api/admin/password', { method: 'POST', body: f }); USER.must_change = false; renderShell(); toast('Fjalëkalimi u ruajt.'); } catch (err) { m.textContent = err.message; }
    });
  }
  function start() { if (USER.must_change) renderFirstPassword(); else renderShell(); }
  api('/api/admin/me').then(u => { USER = u; start(); }).catch(() => { if (!USER) renderLogin(); });
})();
