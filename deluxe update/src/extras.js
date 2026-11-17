// 3.0: njoftimet, “Match”, kalendari i vizitave, dokumentet private të pronës dhe “Më njofto” në faqe
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db } = require('./db');
const match = require('./match');
const notify = require('./notify');

const DOCS_DIR = process.env.DOCS_DIR || path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'docs'); // jashtë /uploads: nuk shërbehen publikisht
fs.mkdirSync(DOCS_DIR, { recursive: true });
const DOC_KINDS = { certifikata: 'Certifikatë pronësie (ASHK)', planimetria: 'Planimetria', leja: 'Leje ndërtimi / përdorimi', kontrata: 'Kontratë ndërmjetësimi', kontrate_tjeter: 'Kontratë tjetër', pronari: 'Dokument i pronarit', fature: 'Faturë / detyrime', tjeter: 'Tjetër' };
const DOC_EXPECTED = ['certifikata', 'planimetria', 'kontrata']; // vetëm si shënim “çfarë mungon” – asgjë nuk është e detyrueshme
const TYPES = ['Apartament', 'Vilë', 'Zyrë', 'Dyqan', 'Tokë'];
const normPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '355' + d.slice(1); return d.length >= 8 ? d : ''; };

// Objektivat dhe arritjet e muajit për disa agjentë (përdoret edhe nga dashboard-i i zyrës)
function targetsFor(month, agentIds) {
  const out = {};
  for (const id of agentIds) {
    let t = db.prepare('SELECT * FROM agent_targets WHERE agent_id = ? AND month = ?').get(id, month), inherited = false;
    if (!t) { t = db.prepare('SELECT * FROM agent_targets WHERE agent_id = ? AND month < ? ORDER BY month DESC LIMIT 1').get(id, month); inherited = !!t; } // vazhdon objektivi i muajit të fundit
    // Arritjet e muajit: vizitat e kryera, marrëveshjet e fituara (edhe të përbashkëtat) dhe pjesa e komisionit
    const visits = db.prepare("SELECT COUNT(*) AS n FROM visits WHERE agent_id = ? AND status = 'done' AND substr(starts_at, 1, 7) = ?").get(id, month).n;
    const leads = db.prepare('SELECT COUNT(*) AS n FROM leads WHERE agent_id = ? AND substr(created_at, 1, 7) = ?').get(id, month).n;
    const opps = db.prepare('SELECT COUNT(*) AS n FROM opportunities WHERE agent_id = ? AND substr(created_at, 1, 7) = ?').get(id, month).n;
    const listings = db.prepare("SELECT COUNT(*) AS n FROM properties WHERE agent_id = ? AND approval = 'approved' AND substr(COALESCE(published_at, created_at), 1, 7) = ?").get(id, month).n;
    const won = db.prepare("SELECT agent_id, split_agent_id, split_pct, commission, commission_status FROM opportunities WHERE stage = 'won' AND substr(closed_at, 1, 7) = ? AND (agent_id = ? OR split_agent_id = ?)").all(month, id, id);
    const shareOf = o => { const c = o.commission || 0, pct = o.split_agent_id ? (o.split_pct ?? 50) : 100, mine = Math.round(c * pct / 100); return o.agent_id === id ? mine : c - mine; };
    const pending = won.filter(o => o.commission_status === 'pending').reduce((s, o) => s + shareOf(o), 0);
    const commission = won.filter(o => o.commission_status !== 'pending').reduce((s, o) => { const c = o.commission || 0, pct = o.split_agent_id ? (o.split_pct ?? 50) : 100, mine = Math.round(c * pct / 100); return s + (o.agent_id === id ? mine : c - mine); }, 0);
    out[id] = { target: t ? { leads: t.leads || 0, opps: t.opps || 0, listings: t.listings || 0, visits: t.visits, deals: t.deals, commission: t.commission } : null, inherited, actual: { leads, opps, listings, visits, deals: won.length, commission, pending } };
  }
  return out;
}

function register({ route, HttpError, readBody, requireStaff, isAdmin, str, int, rateLimit }) {
  const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const authorOf = u => u.agent_id ? (db.prepare('SELECT name FROM agents WHERE id = ?').get(u.agent_id)?.name || u.username) : u.username;
  const log = (u, leadId, type, text, oppId = null) => db.prepare('INSERT INTO activities (lead_id, opp_id, user_id, author, type, text) VALUES (?,?,?,?,?,?)').run(leadId, oppId, u ? u.id : null, u ? authorOf(u) : 'Faqja', type, text);
  const listing = (u, id) => { // vetëm agjenti listues i pronës dhe administratori
    const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
    if (!p) throw new HttpError(404, 'Prona nuk u gjet.');
    if (!isAdmin(u) && p.agent_id !== u.agent_id) throw new HttpError(403, 'Vetëm agjenti që e listoi pronën i sheh këto.');
    return p;
  };
  const visible = (u, p) => p && (isAdmin(u) || p.agent_id === u.agent_id || (p.approval === 'approved' && p.status === 'active'));
  const dayFmt = s => `${s.slice(8, 10)}.${s.slice(5, 7)} në ${s.slice(11, 16)}`;

  /* ---------- njoftimet ---------- */
  const mineWhere = u => isAdmin(u) ? ['agent_id IS NULL', []] : ['agent_id = ?', [u.agent_id]];
  route('GET', '/api/admin/notifications', ({ req, query }) => {
    const u = requireStaff(req), [w, p] = mineWhere(u);
    const unreadOnly = query.get('unread') === '1', limit = Math.min(60, Math.max(1, int(query.get('limit'), 30)));
    const items = db.prepare(`SELECT * FROM notifications WHERE ${w}${unreadOnly ? ' AND read_at IS NULL' : ''} ORDER BY id DESC LIMIT ?`).all(...p, limit)
      .map(n => ({ ...n, link: (() => { try { return JSON.parse(n.link || '{}'); } catch { return {}; } })() }));
    const unread = db.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE ${w} AND read_at IS NULL`).get(...p).n;
    return { items, unread };
  });
  route('POST', '/api/admin/notifications/read', async ({ req }) => {
    const u = requireStaff(req), b = await readBody(req), [w, p] = mineWhere(u);
    if (b.all) db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE ${w} AND read_at IS NULL`).run(...p);
    else { const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Boolean).slice(0, 100); if (ids.length) db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE ${w} AND id IN (${ids.map(() => '?').join(',')})`).run(...p, ...ids); }
    return { ok: true };
  });
  route('GET', '/api/admin/push/key', ({ req }) => { requireStaff(req); return { key: notify.publicKey() }; });
  route('POST', '/api/admin/push/subscribe', async ({ req }) => {
    const u = requireStaff(req), b = await readBody(req, 5000);
    const endpoint = str(b.endpoint, 1000);
    if (!/^https:\/\//.test(endpoint)) throw new HttpError(400, 'Pajisja nuk dha adresë të vlefshme për njoftimet.');
    db.prepare('INSERT INTO push_subs (user_id, endpoint) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id').run(u.id, endpoint);
    return { ok: true };
  });
  route('POST', '/api/admin/push/unsubscribe', async ({ req }) => {
    const u = requireStaff(req), b = await readBody(req, 5000);
    db.prepare('DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?').run(u.id, str(b.endpoint, 1000));
    return { ok: true };
  });

  /* ---------- Match: gjithçka që ju takon, në dy drejtimet ---------- */
  route('GET', '/api/admin/match/overview', ({ req, query }) => {
    const u = requireStaff(req), admin = isAdmin(u);
    const min = query.get('all') === '1' ? match.MIN_SCORE : notify.NOTIFY_SCORE;
    // 1) Klientët e mi → prona nga gjithë agjencia
    const opps = db.prepare(`SELECT o.*, l.name AS lead_name, l.phone AS lead_phone, a.name AS agent_name FROM opportunities o JOIN leads l ON l.id = o.lead_id LEFT JOIN agents a ON a.id = o.agent_id
      WHERE o.stage NOT IN ('won','lost') AND o.side = 'demand' AND l.status != 'closed' ${admin ? '' : 'AND o.agent_id = ?'}`).all(...(admin ? [] : [u.agent_id]));
    const clients = [];
    for (const o of opps) {
      if (!match.hasCriteria(match.criteriaOf(o))) continue;
      for (const m of match.matchesForOpp(o)) {
        if (m.linked || m.state === 'dismissed' || m.score < min) continue;
        clients.push({ opp_id: o.id, opp_title: o.title, stage: o.stage, lead_id: o.lead_id, lead_name: o.lead_name, lead_phone: o.lead_phone, opp_agent: o.agent_name, opp_agent_id: o.agent_id, ...m });
      }
    }
    clients.sort((a, b) => (b.is_new - a.is_new) || (b.score - a.score));
    // 2) Pronat e mia → klientë nga gjithë agjencia (klientët e kolegëve pa emër e kontakt)
    const props = db.prepare(`SELECT p.*, COALESCE(p.published_at, p.created_at) AS live_at FROM properties p WHERE p.status = 'active' AND p.approval = 'approved' ${admin ? '' : 'AND p.agent_id = ?'}`).all(...(admin ? [] : [u.agent_id]));
    const buyers = [];
    for (const p of props) {
      let image = null; try { image = JSON.parse(p.images || '[]')[0] || null; } catch {}
      for (const d of match.demandsForProperty(p)) {
        if (d.score < min || d.state === 'dismissed') continue;
        const mine = admin || d.agent_id === u.agent_id;
        buyers.push({ property: { id: p.id, code: p.code, title: p.title, price: p.price, deal: p.deal, zone: p.zone, city: p.city, image }, ...d, mine,
          ...(mine ? {} : { lead_id: null, lead_name: null, lead_phone: null, title: null, opp_id: null }) });
      }
    }
    buyers.sort((a, b) => b.score - a.score);
    return { clients: clients.slice(0, 200), props: buyers.slice(0, 200), min };
  });

  /* ---------- kalendari i vizitave ---------- */
  const visitSelect = `SELECT v.*, l.name AS lead_name, l.phone AS lead_phone, a.name AS agent_name, a.phone AS agent_phone, p.code AS property_code, p.title AS property_title, p.zone, p.city, p.address, p.agent_id AS p_agent, pa.name AS p_agent_name
    FROM visits v LEFT JOIN leads l ON l.id = v.lead_id LEFT JOIN agents a ON a.id = v.agent_id LEFT JOIN properties p ON p.id = v.property_id LEFT JOIN agents pa ON pa.id = p.agent_id`;
  const visitOut = (u, v) => {
    const mine = isAdmin(u) || v.agent_id === u.agent_id;
    return mine ? { ...v, mine: true } : { ...v, mine: false, lead_id: null, lead_name: null, lead_phone: null, note: '', feedback: '', opp_id: null }; // vizitë e një kolegu te prona ime
  };
  const ownVisit = (u, id) => {
    const v = db.prepare('SELECT * FROM visits WHERE id = ?').get(id);
    if (!v) throw new HttpError(404, 'Vizita nuk u gjet.');
    if (!isAdmin(u) && v.agent_id !== u.agent_id) throw new HttpError(403, 'Kjo vizitë nuk është e juaja.');
    return v;
  };
  function conflicts(v, ignoreId = 0) {
    const end = s => { const d = new Date(s.replace(' ', 'T') + ':00Z'); d.setUTCMinutes(d.getUTCMinutes() + (v.duration || 45)); return d.toISOString().slice(0, 16).replace('T', ' '); };
    const day = v.starts_at.slice(0, 10);
    const rows = db.prepare(`${visitSelect} WHERE v.status = 'planned' AND v.id != ? AND substr(v.starts_at, 1, 10) = ? AND (v.agent_id = ? OR (v.property_id IS NOT NULL AND v.property_id = ?))`).all(ignoreId, day, v.agent_id ?? -1, v.property_id ?? -1);
    const vEnd = end(v.starts_at);
    return rows.filter(x => { const xEnd = (() => { const d = new Date(x.starts_at.replace(' ', 'T') + ':00Z'); d.setUTCMinutes(d.getUTCMinutes() + (x.duration || 45)); return d.toISOString().slice(0, 16).replace('T', ' '); })(); return x.starts_at < vEnd && v.starts_at < xEnd; })
      .map(x => x.agent_id === v.agent_id ? `ju keni vizitë tjetër në ${x.starts_at.slice(11)}${x.property_code ? ' te ' + x.property_code : ''}` : `${x.agent_name || 'një agjent'} ka vizitë te kjo pronë në ${x.starts_at.slice(11)}`);
  }
  function visitInput(u, b, old = null) {
    const starts = str(b.starts_at, 20).replace('T', ' ').slice(0, 16);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(starts)) throw new HttpError(400, 'Zgjidhni datën dhe orën e vizitës.');
    const v = { starts_at: starts, duration: Math.min(240, Math.max(15, int(b.duration, 45))), note: str(b.note, 500), property_id: b.property_id ? int(b.property_id, null) : null, opp_id: b.opp_id ? int(b.opp_id, null) : null };
    const leadId = old ? old.lead_id : int(b.lead_id);
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    if (!lead) throw new HttpError(400, 'Zgjidhni klientin.');
    if (!isAdmin(u) && lead.agent_id !== u.agent_id) throw new HttpError(403, 'Ky klient nuk është në portofolin tuaj.');
    v.lead_id = lead.id;
    if (v.property_id) { const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(v.property_id); if (!visible(u, p)) throw new HttpError(400, 'Prona nuk është në faqe.'); }
    if (v.opp_id) { const o = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(v.opp_id); if (!o || o.lead_id !== lead.id) v.opp_id = null; }
    v.agent_id = old ? old.agent_id : (isAdmin(u) ? (lead.agent_id ?? null) : u.agent_id);
    return { v, lead };
  }
  route('GET', '/api/admin/visits', ({ req, query }) => {
    const u = requireStaff(req), where = ['1=1'], params = [];
    if (!isAdmin(u)) { where.push('(v.agent_id = ? OR p.agent_id = ?)'); params.push(u.agent_id, u.agent_id); }
    const from = str(query.get('from'), 10), to = str(query.get('to'), 10);
    if (isDate(from)) { where.push('v.starts_at >= ?'); params.push(from); }
    if (isDate(to)) { where.push('v.starts_at < ?'); params.push(to + ' 99'); }
    if (query.get('lead')) { where.push('v.lead_id = ?'); params.push(int(query.get('lead'))); }
    return db.prepare(`${visitSelect} WHERE ${where.join(' AND ')} ORDER BY v.starts_at LIMIT 500`).all(...params).map(v => visitOut(u, v));
  });
  route('POST', '/api/admin/visits', async ({ req }) => {
    const u = requireStaff(req), b = await readBody(req);
    const { v, lead } = visitInput(u, b);
    const c = conflicts(v);
    if (c.length && !b.force) throw new HttpError(409, `Përplasje: ${c.join('; ')}.`);
    v.created_by = u.id;
    const keys = Object.keys(v);
    const id = Number(db.prepare(`INSERT INTO visits (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(v)).lastInsertRowid);
    const row = db.prepare(`${visitSelect} WHERE v.id = ?`).get(id);
    log(u, lead.id, 'visit', `Vizitë e caktuar: ${dayFmt(v.starts_at)}${row.property_code ? ` te ${row.property_code} – ${row.property_title}` : ''}.${v.note ? ' ' + v.note : ''}`, v.opp_id);
    if (row.p_agent && row.p_agent !== v.agent_id) notify.create(row.p_agent, 'visit_new', `Vizitë te prona jote ${row.property_code}`, `${row.agent_name || 'Një agjent'} vjen me një klient më ${dayFmt(v.starts_at)}.`, { visit: id });
    return visitOut(u, row);
  });
  route('PUT', '/api/admin/visits/:id', async ({ req, params }) => {
    const u = requireStaff(req), old = ownVisit(u, int(params.id)), b = await readBody(req);
    const { v } = visitInput(u, b, old);
    const c = conflicts(v, old.id);
    if (c.length && !b.force) throw new HttpError(409, `Përplasje: ${c.join('; ')}.`);
    db.prepare('UPDATE visits SET starts_at = ?, duration = ?, note = ?, property_id = ?, opp_id = ?, reminded = CASE WHEN starts_at = ? THEN reminded ELSE 0 END WHERE id = ?').run(v.starts_at, v.duration, v.note, v.property_id, v.opp_id, v.starts_at, old.id);
    const row = db.prepare(`${visitSelect} WHERE v.id = ?`).get(old.id);
    if (old.starts_at !== v.starts_at) {
      log(u, old.lead_id, 'visit', `Vizita u zhvendos: ${dayFmt(old.starts_at)} → ${dayFmt(v.starts_at)}.`, row.opp_id);
      if (row.p_agent && row.p_agent !== row.agent_id) notify.create(row.p_agent, 'visit_new', `Vizita te ${row.property_code} u zhvendos`, `${row.agent_name || 'Agjenti'}: ${dayFmt(v.starts_at)}.`, { visit: old.id });
    }
    return visitOut(u, row);
  });
  // Si shkoi vizita: statusi, reagimi i klientit dhe shënimi
  route('PATCH', '/api/admin/visits/:id', async ({ req, params }) => {
    const u = requireStaff(req), old = ownVisit(u, int(params.id)), b = await readBody(req);
    const status = ['planned', 'done', 'cancelled', 'noshow'].includes(b.status) ? b.status : old.status;
    const reaction = ['liked', 'dismissed', ''].includes(b.reaction) ? b.reaction : old.reaction;
    const feedback = 'feedback' in b ? str(b.feedback, 1000) : old.feedback;
    db.prepare('UPDATE visits SET status = ?, reaction = ?, feedback = ? WHERE id = ?').run(status, reaction, feedback, old.id);
    const row = db.prepare(`${visitSelect} WHERE v.id = ?`).get(old.id);
    if (status !== old.status || reaction !== old.reaction || feedback !== old.feedback) {
      const st = { done: 'u krye', cancelled: 'u anulua', noshow: 'klienti nuk erdhi', planned: 'u rikthye në plan' }[status];
      const re = reaction === 'liked' ? ' I pëlqeu.' : reaction === 'dismissed' ? ' Nuk i pëlqeu.' : '';
      log(u, old.lead_id, 'visit', `Vizita${row.property_code ? ' te ' + row.property_code : ''} ${st}.${re}${feedback ? ' ' + feedback : ''}`, row.opp_id);
      if (row.opp_id && row.property_id && reaction) db.prepare(`INSERT INTO opp_matches (opp_id, property_id, status, note, user_id) VALUES (?,?,?,?,?) ON CONFLICT(opp_id, property_id) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = datetime('now')`).run(row.opp_id, row.property_id, reaction, feedback.slice(0, 300), u.id);
      if (status === 'done' && row.p_agent && row.p_agent !== row.agent_id) notify.create(row.p_agent, 'visit_done', `Vizita te ${row.property_code} u krye`, `${row.agent_name || 'Agjenti'}: ${reaction === 'liked' ? 'klientit i pëlqeu' : reaction === 'dismissed' ? 'klientit nuk i pëlqeu' : 'pa përgjigje ende'}.`, { visit: old.id });
      if (status === 'cancelled' && old.status === 'planned' && row.p_agent && row.p_agent !== row.agent_id) notify.create(row.p_agent, 'visit_new', `Vizita te ${row.property_code} u anulua`, `${row.agent_name || 'Agjenti'} · ${dayFmt(row.starts_at)}`, { visit: old.id });
    }
    return visitOut(u, row);
  });
  route('DELETE', '/api/admin/visits/:id', ({ req, params }) => {
    const u = requireStaff(req), v = ownVisit(u, int(params.id));
    db.prepare('DELETE FROM visits WHERE id = ?').run(v.id);
    return { ok: true };
  });

  /* ---------- dokumentet private të pronës ---------- */
  const docOut = d => ({ ...d, file: undefined, kind_label: DOC_KINDS[d.kind] || d.kind });
  const missingOf = pid => { const have = new Set(db.prepare('SELECT kind FROM property_docs WHERE property_id = ?').all(pid).map(r => r.kind)); return DOC_EXPECTED.filter(k => !have.has(k)).map(k => DOC_KINDS[k]); };
  route('GET', '/api/admin/properties/:id/docs', ({ req, params }) => {
    const u = requireStaff(req), p = listing(u, int(params.id));
    return { items: db.prepare('SELECT * FROM property_docs WHERE property_id = ? ORDER BY created_at DESC, id DESC').all(p.id).map(docOut), missing: missingOf(p.id), kinds: DOC_KINDS };
  });
  route('POST', '/api/admin/properties/:id/docs', async ({ req, params }) => {
    const u = requireStaff(req), p = listing(u, int(params.id));
    const b = await readBody(req, 16 * 1024 * 1024);
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(b.data || ''));
    if (!m) throw new HttpError(400, 'Zgjidhni një skedar PDF, JPG, PNG ose WEBP.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 10 * 1024 * 1024) throw new HttpError(413, 'Dokumenti duhet të jetë më i vogël se 10 MB.');
    const head = buf.subarray(0, 12).toString('latin1');
    const type = head.startsWith('%PDF') ? ['pdf', 'application/pdf'] : head.startsWith('\xFF\xD8\xFF') ? ['jpg', 'image/jpeg'] : head.startsWith('\x89PNG') ? ['png', 'image/png'] : (head.startsWith('RIFF') && head.slice(8) === 'WEBP') ? ['webp', 'image/webp'] : null;
    if (!type) throw new HttpError(400, 'Lejohen vetëm PDF, JPG, PNG ose WEBP.');
    const file = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${type[0]}`;
    fs.writeFileSync(path.join(DOCS_DIR, file), buf);
    const kind = DOC_KINDS[b.kind] ? b.kind : 'tjeter';
    const name = str(b.name, 140) || DOC_KINDS[kind];
    const id = Number(db.prepare('INSERT INTO property_docs (property_id, kind, name, note, expires_at, file, mime, size, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(p.id, kind, name, str(b.note, 500), isDate(b.expires_at) ? b.expires_at : '', file, type[1], buf.length, u.id).lastInsertRowid);
    return docOut(db.prepare('SELECT * FROM property_docs WHERE id = ?').get(id));
  });
  const ownDoc = (u, id) => { const d = db.prepare('SELECT * FROM property_docs WHERE id = ?').get(id); if (!d) throw new HttpError(404, 'Dokumenti nuk u gjet.'); listing(u, d.property_id); return d; };
  route('GET', '/api/admin/docs/:id/file', ({ req, res, params }) => {
    const d = ownDoc(requireStaff(req), int(params.id));
    let buf; try { buf = fs.readFileSync(path.join(DOCS_DIR, path.basename(d.file))); } catch { throw new HttpError(404, 'Skedari nuk u gjet.'); }
    res.writeHead(200, { 'Content-Type': d.mime, 'Content-Length': buf.length, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `inline; filename="dokument-${d.id}.${path.extname(d.file).slice(1)}"` });
    res.end(buf);
  });
  route('PUT', '/api/admin/docs/:id', async ({ req, params }) => {
    const u = requireStaff(req), d = ownDoc(u, int(params.id)), b = await readBody(req);
    const kind = DOC_KINDS[b.kind] ? b.kind : d.kind, exp = isDate(b.expires_at) ? b.expires_at : '';
    db.prepare('UPDATE property_docs SET kind = ?, name = ?, note = ?, expires_at = ?, expiry_notified = CASE WHEN expires_at = ? THEN expiry_notified ELSE 0 END WHERE id = ?').run(kind, str(b.name, 140) || d.name, str(b.note, 500), exp, exp, d.id);
    return docOut(db.prepare('SELECT * FROM property_docs WHERE id = ?').get(d.id));
  });
  route('DELETE', '/api/admin/docs/:id', ({ req, params }) => {
    const d = ownDoc(requireStaff(req), int(params.id));
    db.prepare('DELETE FROM property_docs WHERE id = ?').run(d.id);
    fs.rm(path.join(DOCS_DIR, path.basename(d.file)), () => {});
    return { ok: true };
  });

  /* ---------- objektivat mujore të agjentëve ---------- */
  const isMonth = m => /^\d{4}-\d{2}$/.test(m);
  route('GET', '/api/admin/targets', ({ req, query }) => {
    const u = requireStaff(req);
    const month = isMonth(query.get('month')) ? query.get('month') : notify.localNow().slice(0, 7);
    // Administratori: të gjithë (ose një zyrë) · brokeri: agjentët e zyrës së vet · agjenti: vetëm veten
    const bo = !isAdmin(u) && u.agent_id ? db.prepare('SELECT * FROM offices WHERE broker_agent_id = ?').get(u.agent_id) : null;
    const officeId = isAdmin(u) ? int(query.get('office'), 0) : bo ? bo.id : 0;
    const agents = officeId ? db.prepare('SELECT id, name FROM agents WHERE office_id = ? ORDER BY level DESC, id').all(officeId)
      : isAdmin(u) ? db.prepare('SELECT id, name FROM agents ORDER BY level DESC, id').all() : db.prepare('SELECT id, name FROM agents WHERE id = ?').all(u.agent_id);
    const t = targetsFor(month, agents.map(a => a.id));
    return { month, office_id: officeId || null, can_edit: isAdmin(u) || !!bo, followup_days: notify.followupDays(), items: agents.map(a => ({ agent_id: a.id, name: a.name, ...t[a.id] })) };
  });
  route('PUT', '/api/admin/targets', async ({ req }) => {
    const u = requireStaff(req);
    const bo = !isAdmin(u) && u.agent_id ? db.prepare('SELECT * FROM offices WHERE broker_agent_id = ?').get(u.agent_id) : null;
    if (!isAdmin(u) && !bo) throw new HttpError(403, 'Objektivat i cakton brokeri i zyrës ose administratori.');
    const b = await readBody(req);
    const month = isMonth(b.month) ? b.month : notify.localNow().slice(0, 7);
    const up = db.prepare('INSERT INTO agent_targets (agent_id, month, leads, opps, listings, visits, deals, commission) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(agent_id, month) DO UPDATE SET leads = excluded.leads, opps = excluded.opps, listings = excluded.listings, visits = excluded.visits, deals = excluded.deals, commission = excluded.commission');
    for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 200)) {
      const id = int(it.agent_id);
      if (!db.prepare('SELECT 1 FROM agents WHERE id = ?' + (bo ? ' AND office_id = ?' : '')).get(...(bo ? [id, bo.id] : [id]))) continue; // brokeri vetëm për zyrën e vet
      up.run(id, month, ...['leads', 'opps', 'listings', 'visits', 'deals', 'commission'].map(k => Math.max(0, int(it[k]))));
    }
    if (b.followup_days != null && isAdmin(u)) db.prepare("INSERT INTO settings (key, value) VALUES ('followup_days', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(Math.min(60, Math.max(1, int(b.followup_days, 7)))));
    return { ok: true };
  });

  /* ---------- “Më njofto për prona si kjo” (faqja publike) ---------- */
  route('POST', '/api/alerts', async ({ req }) => {
    rateLimit(req, 'alert', 5);
    const b = await readBody(req);
    if (b.website) return { ok: true }; // kurth për spam
    const name = str(b.name, 100), phone = str(b.phone, 40), email = str(b.email, 120);
    if (!name) throw new HttpError(400, 'Shkruani emrin tuaj.');
    if (!phone && !email) throw new HttpError(400, 'Lini telefonin (WhatsApp) ose email-in që t’ju njoftojmë.');
    if (phone && phone.replace(/\D/g, '').length < 7) throw new HttpError(400, 'Numri i telefonit duket i paplotë.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Adresa e email-it nuk duket e saktë.');
    const f = b.filters && typeof b.filters === 'object' ? b.filters : {};
    const deal = f.deal === 'qira' ? 'qira' : 'shitje';
    const c = {
      c_type: TYPES.includes(f.type) ? f.type : '', c_city: str(f.city, 60), c_zones: JSON.stringify(f.zone ? [str(f.zone, 80)] : []),
      c_price_min: int(f.min, 0) || null, c_price_max: int(f.max, 0) || null, c_rooms: Math.min(10, int(f.rooms, 0)) || null, c_area_min: int(f.minArea, 0) || null,
      c_furnished: f.furnished === '1' || f.furnished === true ? 1 : 0, c_parking: f.parking === '1' || f.parking === true ? 1 : 0
    };
    if (!c.c_type && !c.c_city && !c.c_price_max && !c.c_rooms && c.c_zones === '[]') throw new HttpError(400, 'Zgjidhni fillimisht çfarë kërkoni (qytetin, llojin ose buxhetin).');
    const pn = normPhone(phone);
    let lead = pn ? db.prepare('SELECT * FROM leads WHERE phone_norm = ?').get(pn) : null;
    if (!lead && email) lead = db.prepare('SELECT * FROM leads WHERE email = ? COLLATE NOCASE').get(email);
    if (!lead) {
      const id = Number(db.prepare('INSERT INTO leads (name, phone, phone_norm, email, client_type, source, budget_min, budget_max, city, ptype) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(name, phone, pn, email, deal === 'qira' ? 'qiramarres' : 'bleres', 'website', c.c_price_min, c.c_price_max, c.c_city, c.c_type).lastInsertRowid);
      lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      log(null, lead.id, 'system', 'Lead-i erdhi nga faqja (“Më njofto”).');
    }
    const what = [(c.c_type || 'pronë').toLowerCase(), c.c_rooms ? `${c.c_rooms}+1` : ''].filter(Boolean).join(' ');
    const where = JSON.parse(c.c_zones)[0] || c.c_city;
    const title = `${deal === 'qira' ? 'Qira' : 'Blerje'} ${what}${where ? ' – ' + where : ''}`;
    const r = db.prepare("INSERT INTO opportunities (lead_id, agent_id, title, deal, stage, next_action, next_date, side, c_type, c_city, c_zones, c_price_min, c_price_max, c_rooms, c_area_min, c_furnished, c_parking) VALUES (?,?,?,?,'new','Kontakto klientin',?, 'demand',?,?,?,?,?,?,?,?,?)")
      .run(lead.id, lead.agent_id ?? null, title, deal, notify.localNow().slice(0, 10), c.c_type, c.c_city, c.c_zones, c.c_price_min, c.c_price_max, c.c_rooms, c.c_area_min, c.c_furnished, c.c_parking);
    const oppId = Number(r.lastInsertRowid);
    log(null, lead.id, 'system', `Kërkoi njoftim për: ${title}${c.c_price_max ? ', deri ' + match.eur(c.c_price_max) : ''}.`, oppId);
    db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(lead.id);
    const now = match.matchesForOpp(db.prepare('SELECT * FROM opportunities WHERE id = ?').get(oppId)).filter(m => m.score >= notify.NOTIFY_SCORE).length;
    notify.create(lead.agent_id ?? null, 'alert', `Kërkesë për njoftim: ${lead.name}`, `${title}${c.c_price_max ? ' · deri ' + match.eur(c.c_price_max) : ''}${now ? ` · ${now} prona përputhen tani` : ''}`, { opp: oppId });
    notify.oppChanged(oppId);
    return { ok: true, message: 'Faleminderit! Sapo të dalë një pronë e tillë, një agjent ju shkruan.' };
  });
}

module.exports = { register, targetsFor, DOC_KINDS, DOCS_DIR };
