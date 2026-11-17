// 3.2: zyrat. Administratori hap zyrat dhe llogaritë; çdo zyrë ka brokerin e vet, i cili cakton objektivat
// e agjentëve të zyrës dhe mbyll komisionet e tyre. Pronat e reja të një zyre marrin kodin e saj (BLK-1001…).
const { db } = require('./db');
const notify = require('./notify');
const match = require('./match');

const COMMISSION_COUNTS = "(o.commission_status IS NULL OR o.commission_status = 'closed')"; // komisionet në pritje nuk llogariten
const officeOfAgent = id => id ? db.prepare('SELECT o.* FROM offices o JOIN agents a ON a.office_id = o.id WHERE a.id = ?').get(id) || null : null;
const brokerOffice = u => u && u.agent_id ? db.prepare('SELECT * FROM offices WHERE broker_agent_id = ?').get(u.agent_id) || null : null;

// Kodi i pronës së re: me shkurtimin e zyrës, ose DLX si më parë
function codeFor(propertyId, officeId) {
  const o = officeId ? db.prepare('SELECT * FROM offices WHERE id = ?').get(officeId) : null;
  if (!o) return `DLX-${1000 + propertyId}`;
  for (;;) {
    const seq = o.next_seq || 1;
    db.prepare('UPDATE offices SET next_seq = ? WHERE id = ?').run(seq + 1, o.id);
    const code = `${o.code}-${1000 + seq}`;
    if (!db.prepare('SELECT 1 FROM properties WHERE code = ?').get(code)) return code;
    o.next_seq = seq + 1;
  }
}
// Kush e mbyll komisionin e kësaj opportunity-je: brokeri i zyrës së agjentit; komisionin e vetë brokerit (ose pa zyrë) e mbyll administratori
function commissionCloser(opp) {
  const off = officeOfAgent(opp.agent_id);
  return off && off.broker_agent_id && off.broker_agent_id !== opp.agent_id ? off.broker_agent_id : null;
}
function canClose(u, opp) {
  if (u.role === 'admin') return true;
  const b = commissionCloser(opp);
  return !!b && b === u.agent_id;
}
// Thirret kur opportunity-ja kalon te “Fituar”: komisioni pret mbylljen
function onWon(oppId) {
  const o = db.prepare('SELECT o.*, l.name AS lead_name, a.name AS agent_name FROM opportunities o JOIN leads l ON l.id = o.lead_id LEFT JOIN agents a ON a.id = o.agent_id WHERE o.id = ?').get(oppId);
  if (!o || o.stage !== 'won' || o.commission_status) return;
  db.prepare("UPDATE opportunities SET commission_status = 'pending' WHERE id = ?").run(o.id);
  notify.create(commissionCloser(o), 'commission_pending', `Komision për t’u mbyllur: ${o.agent_name || 'pa agjent'}`, `${o.title} · ${o.lead_name}${o.commission ? ' · ' + match.eur(o.commission) : ''}`, { view: commissionCloser(o) ? 'zyra' : 'paneli' });
}
function onReopened(oppId) { db.prepare("UPDATE opportunities SET commission_status = NULL, commission_closed_by = NULL, commission_closed_at = NULL WHERE id = ? AND stage != 'won'").run(oppId); }

function register({ route, HttpError, readBody, requireStaff, isAdmin, str, int, num }) {
  const requireAdmin = req => { const u = requireStaff(req); if (!isAdmin(u)) throw new HttpError(403, 'Kjo pjesë është vetëm për administratorin.'); return u; };
  const officeRow = id => db.prepare(`SELECT o.*, a.name AS broker_name,
      (SELECT COUNT(*) FROM agents x WHERE x.office_id = o.id) AS agents_count,
      (SELECT COUNT(*) FROM properties p WHERE p.office_id = o.id AND p.status = 'active' AND p.approval = 'approved') AS live_count
    FROM offices o LEFT JOIN agents a ON a.id = o.broker_agent_id WHERE o.id = ?`).get(id);

  route('GET', '/api/admin/offices', ({ req }) => {
    requireStaff(req);
    return db.prepare('SELECT id FROM offices ORDER BY name').all().map(r => officeRow(r.id));
  });
  function officeInput(b, id = 0) {
    const o = {
      name: str(b.name, 100), code: str(b.code, 5).toUpperCase(), city: str(b.city, 60), zone: str(b.zone, 80), address: str(b.address, 200),
      phone: str(b.phone, 40), whatsapp: str(b.whatsapp, 20).replace(/\D/g, ''), email: str(b.email, 120), hours: str(b.hours, 120),
      lat: num(b.lat), lng: num(b.lng), broker_agent_id: b.broker_agent_id ? int(b.broker_agent_id, null) : null,
      active: b.active === false || b.active === 'false' || b.active === 0 ? 0 : 1
    };
    if (!o.name) throw new HttpError(400, 'Shkruani emrin e zyrës.');
    if (!/^[A-Z]{2,5}$/.test(o.code)) throw new HttpError(400, 'Kodi i zyrës duhet të ketë 2–5 shkronja latine, p.sh. BLK.');
    if (o.code === 'DLX') throw new HttpError(400, 'Kodi DLX është i pronave ekzistuese. Zgjidhni një tjetër.');
    if (db.prepare('SELECT 1 FROM offices WHERE code = ? AND id != ?').get(o.code, id)) throw new HttpError(400, `Kodi ${o.code} përdoret nga një zyrë tjetër.`);
    if (o.broker_agent_id && !db.prepare('SELECT 1 FROM agents WHERE id = ?').get(o.broker_agent_id)) throw new HttpError(400, 'Brokeri i zgjedhur nuk ekziston.');
    if (o.lat == null || o.lng == null) { o.lat = null; o.lng = null; }
    return o;
  }
  function saveBroker(officeId, brokerId) {
    if (!brokerId) return;
    db.prepare('UPDATE offices SET broker_agent_id = NULL WHERE broker_agent_id = ? AND id != ?').run(brokerId, officeId); // një broker për një zyrë
    db.prepare('UPDATE agents SET office_id = ? WHERE id = ?').run(officeId, brokerId);
  }
  route('POST', '/api/admin/offices', async ({ req }) => {
    requireAdmin(req); const o = officeInput(await readBody(req));
    const keys = Object.keys(o);
    const id = Number(db.prepare(`INSERT INTO offices (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(o)).lastInsertRowid);
    saveBroker(id, o.broker_agent_id);
    return officeRow(id);
  });
  route('PUT', '/api/admin/offices/:id', async ({ req, params }) => {
    requireAdmin(req); const id = int(params.id);
    if (!db.prepare('SELECT 1 FROM offices WHERE id = ?').get(id)) throw new HttpError(404, 'Zyra nuk u gjet.');
    const o = officeInput(await readBody(req), id);
    db.prepare(`UPDATE offices SET ${Object.keys(o).map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(o), id);
    saveBroker(id, o.broker_agent_id);
    return officeRow(id);
  });
  route('DELETE', '/api/admin/offices/:id', ({ req, params }) => {
    requireAdmin(req); const id = int(params.id);
    db.prepare('UPDATE agents SET office_id = NULL WHERE office_id = ?').run(id);
    db.prepare('UPDATE properties SET office_id = NULL WHERE office_id = ?').run(id); // kodet e pronave mbeten siç janë
    db.prepare('DELETE FROM offices WHERE id = ?').run(id);
    return { ok: true };
  });

  // Dashboard-i i zyrës: brokeri sheh zyrën e vet, administratori çdo zyrë
  route('GET', '/api/admin/offices/:id/dashboard', ({ req, params, query }) => {
    const u = requireStaff(req), id = int(params.id);
    const office = officeRow(id);
    if (!office) throw new HttpError(404, 'Zyra nuk u gjet.');
    if (!isAdmin(u) && office.broker_agent_id !== u.agent_id) throw new HttpError(403, 'Ky dashboard është vetëm për brokerin e zyrës.');
    const month = /^\d{4}-\d{2}$/.test(query.get('month') || '') ? query.get('month') : notify.localNow().slice(0, 7);
    const agents = db.prepare('SELECT id, name, photo FROM agents WHERE office_id = ? ORDER BY name').all(id);
    const t = require('./extras').targetsFor(month, agents.map(a => a.id));
    const rows = agents.map(a => ({ agent_id: a.id, name: a.name, is_broker: a.id === office.broker_agent_id, ...t[a.id] }));
    const sum = k => rows.reduce((s, r) => s + (r.actual[k] || 0), 0), tsum = k => rows.reduce((s, r) => s + (r.target?.[k] || 0), 0);
    const ids = agents.map(a => a.id);
    const pending = ids.length ? db.prepare(`SELECT o.id, o.title, o.value, o.commission, o.closed_at, o.agent_id, o.split_agent_id, o.split_pct, a.name AS agent_name, sa.name AS split_agent_name, l.name AS lead_name, p.code AS property_code
      FROM opportunities o JOIN leads l ON l.id = o.lead_id LEFT JOIN agents a ON a.id = o.agent_id LEFT JOIN agents sa ON sa.id = o.split_agent_id LEFT JOIN properties p ON p.id = o.property_id
      WHERE o.stage = 'won' AND o.commission_status = 'pending' AND o.agent_id IN (${ids.map(() => '?').join(',')}) ORDER BY o.closed_at`).all(...ids)
      .map(o => ({ ...o, can_close: canClose(u, o) })) : [];
    const keys = ['leads', 'opps', 'listings', 'visits', 'deals', 'commission'];
    return {
      office, month, agents: rows.sort((a, b) => b.actual.commission - a.actual.commission || b.actual.deals - a.actual.deals),
      totals: Object.fromEntries(keys.map(k => [k, sum(k)])), targets: Object.fromEntries(keys.map(k => [k, tsum(k)])),
      pending, pending_total: pending.reduce((s, o) => s + (o.commission || 0), 0), can_edit_targets: isAdmin(u) || office.broker_agent_id === u.agent_id
    };
  });

  /* ---------- Komisionet: performanca e agjentit, e zyrës dhe e agjencisë ---------- */
  route('GET', '/api/admin/commissions', ({ req, query }) => {
    const u = requireStaff(req), admin = isAdmin(u), bo = brokerOffice(u);
    // Fusha: 'me' (të miat) · 'office' (zyra, për brokerin; administratori zgjedh zyrën) · 'all' (vetëm administratori)
    let scope = query.get('scope') || (admin ? 'all' : 'me');
    if (scope === 'all' && !admin) scope = 'me';
    if (scope === 'office' && !admin && !bo) scope = 'me';
    const officeId = scope === 'office' ? (admin ? int(query.get('office'), 0) || null : bo.id) : (admin ? int(query.get('office'), 0) || null : null);
    const agentFilter = admin || scope === 'office' ? int(query.get('agent'), 0) || null : null;
    const month = /^\d{4}-\d{2}$/.test(query.get('month') || '') ? query.get('month') : query.get('month') === 'all' ? null : notify.localNow().slice(0, 7);
    const status = ['pending', 'closed'].includes(query.get('status')) ? query.get('status') : 'all';

    let ids = null; // agjentët që përfshihen
    if (scope === 'me') ids = [u.agent_id ?? -1];
    else if (officeId) ids = db.prepare('SELECT id FROM agents WHERE office_id = ?').all(officeId).map(r => r.id);
    if (agentFilter) ids = ids ? ids.filter(i => i === agentFilter) : [agentFilter];
    const inIds = ids ? (ids.length ? `(${ids.join(',')})` : '(-1)') : null;
    const rows = db.prepare(`SELECT o.id, o.title, o.lead_id, o.agent_id, o.split_agent_id, o.split_pct, o.commission, o.value, o.closed_at, o.commission_status, o.commission_closed_by, o.commission_closed_at,
        l.name AS lead_name, a.name AS agent_name, a.office_id, ao.code AS office_code, sa.name AS split_agent_name, sa.office_id AS split_office_id, p.code AS property_code
      FROM opportunities o JOIN leads l ON l.id = o.lead_id LEFT JOIN agents a ON a.id = o.agent_id LEFT JOIN offices ao ON ao.id = a.office_id
      LEFT JOIN agents sa ON sa.id = o.split_agent_id LEFT JOIN properties p ON p.id = o.property_id
      WHERE o.stage = 'won' ${inIds ? `AND (o.agent_id IN ${inIds} OR o.split_agent_id IN ${inIds})` : ''} ORDER BY o.closed_at DESC`).all();
    const inScope = id => !ids || ids.includes(id);
    const pctOf = o => o.split_agent_id ? (o.split_pct ?? 50) : 100;
    // Pjesa që i takon fushës (agjenti ose zyra): e agjentit kryesor dhe/ose e kolegut me të cilin ndahet
    const shareIn = o => { const c = o.commission || 0, mine = Math.round(c * pctOf(o) / 100); return (inScope(o.agent_id) ? mine : 0) + (o.split_agent_id && inScope(o.split_agent_id) ? c - mine : 0); };
    const st = o => o.commission_status === 'pending' ? 'pending' : 'closed';
    const all = rows.map(o => {
      const seeClient = admin || o.agent_id === u.agent_id || (scope === 'office' && bo && o.office_id === bo.id);
      return { ...o, status: st(o), share: shareIn(o), can_close: st(o) === 'pending' && canClose(u, o), can_reopen: admin && st(o) === 'closed' && !!o.commission_status,
        lead_name: seeClient ? o.lead_name : null, lead_id: seeClient ? o.lead_id : null };
    });
    const inMonth = o => !month || String(o.closed_at || '').slice(0, 7) === month;
    const items = all.filter(o => inMonth(o) && (status === 'all' || o.status === status));
    const sum = (list, f) => list.reduce((s, o) => s + f(o), 0);
    const monthRows = all.filter(inMonth);
    // Sipas agjentit (dhe sipas zyrës për administratorin)
    const per = {};
    const addTo = (id, name, office, amount, status) => { if (!id || !inScope(id)) return; const x = per[id] || (per[id] = { agent_id: id, name, office_code: office, closed: 0, pending: 0, deals: 0 }); x[status] += amount; };
    for (const o of monthRows) {
      const c = o.commission || 0, mine = Math.round(c * pctOf(o) / 100);
      addTo(o.agent_id, o.agent_name, o.office_code, mine, o.status);
      if (o.agent_id && per[o.agent_id] && inScope(o.agent_id)) per[o.agent_id].deals++;
      if (o.split_agent_id) addTo(o.split_agent_id, o.split_agent_name, db.prepare('SELECT code FROM offices WHERE id = ?').get(o.split_office_id ?? -1)?.code || null, c - mine, o.status);
    }
    const byAgent = Object.values(per).sort((a, b) => b.closed - a.closed || b.pending - a.pending);
    let byOffice = null;
    if (admin && scope === 'all' && !officeId && !agentFilter) {
      const offs = {};
      for (const a of byAgent) { const k = a.office_code || '—'; const x = offs[k] || (offs[k] = { office_code: a.office_code, closed: 0, pending: 0, deals: 0, agents: 0 }); x.closed += a.closed; x.pending += a.pending; x.deals += a.deals; x.agents++; }
      byOffice = Object.values(offs).sort((a, b) => b.closed - a.closed);
      const names = Object.fromEntries(db.prepare('SELECT code, name FROM offices').all().map(r => [r.code, r.name]));
      byOffice.forEach(o => { o.name = o.office_code ? names[o.office_code] || o.office_code : 'Pa zyrë'; });
    }
    // Ecuria e 12 muajve të fundit (komisioni i mbyllur i fushës)
    const now = notify.localNow().slice(0, 7), trend = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - i);
      const m = d.toISOString().slice(0, 7);
      trend.push({ month: m, closed: sum(all.filter(o => o.status === 'closed' && String(o.closed_at || '').slice(0, 7) === m), shareIn) });
    }
    // Objektivi i komisionit për muajin (për një agjent)
    let target = null;
    const tAgent = scope === 'me' ? u.agent_id : agentFilter;
    if (month && tAgent) { const t = db.prepare('SELECT commission FROM agent_targets WHERE agent_id = ? AND month <= ? ORDER BY month DESC LIMIT 1').get(tAgent, month); target = t?.commission || null; }
    return {
      scope, month, status, office_id: officeId, agent_id: agentFilter, is_broker: !!bo, broker_office: bo && { id: bo.id, name: bo.name, code: bo.code },
      summary: { closed: sum(monthRows.filter(o => o.status === 'closed'), shareIn), pending: sum(monthRows.filter(o => o.status === 'pending'), shareIn),
        pending_count: monthRows.filter(o => o.status === 'pending').length, deals: monthRows.length, target },
      items, by_agent: scope === 'me' ? [] : byAgent, by_office: byOffice, trend
    };
  });

  // Mbyllja e komisionit (brokeri i zyrës ose administratori)
  route('POST', '/api/admin/opportunities/:id/commission', async ({ req, params }) => {
    const u = requireStaff(req), b = await readBody(req);
    const o = db.prepare('SELECT o.*, l.name AS lead_name FROM opportunities o JOIN leads l ON l.id = o.lead_id WHERE o.id = ?').get(int(params.id));
    if (!o) throw new HttpError(404, 'Opportunity nuk u gjet.');
    if (o.stage !== 'won') throw new HttpError(400, 'Komisioni mbyllet vetëm për marrëveshjet e fituara.');
    if (!canClose(u, o)) throw new HttpError(403, 'Këtë komision e mbyll brokeri i zyrës ose administratori.');
    const who = u.agent_id ? db.prepare('SELECT name FROM agents WHERE id = ?').get(u.agent_id)?.name || u.username : u.username;
    if (b.action === 'reopen') {
      db.prepare("UPDATE opportunities SET commission_status = 'pending', commission_closed_by = NULL, commission_closed_at = NULL WHERE id = ?").run(o.id);
      return { ok: true };
    }
    const commission = num(b.commission);
    if (commission == null || commission < 0) throw new HttpError(400, 'Shkruani shumën e komisionit.');
    db.prepare("UPDATE opportunities SET commission = ?, commission_status = 'closed', commission_closed_by = ?, commission_closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(Math.round(commission), who, o.id);
    db.prepare("INSERT INTO activities (lead_id, opp_id, user_id, author, type, text) VALUES (?,?,?,?, 'system', ?)").run(o.lead_id, o.id, u.id, who, `Komisioni u mbyll: ${match.eur(commission)}.`);
    const share = o.split_agent_id ? (o.split_pct ?? 50) : 100;
    notify.create(o.agent_id, 'commission_closed', `Komisioni u mbyll: ${match.eur(Math.round(commission * share / 100))}`, `${o.title} · ${o.lead_name}${o.split_agent_id ? ` · pjesa juaj ${share}%` : ''} · nga ${who}`, { opp: o.id });
    if (o.split_agent_id) notify.create(o.split_agent_id, 'commission_closed', `Komisioni u mbyll: ${match.eur(commission - Math.round(commission * share / 100))}`, `${o.title} · pjesa juaj ${100 - share}% · nga ${who}`, { view: 'paneli' });
    return { ok: true };
  });
}

module.exports = { register, codeFor, officeOfAgent, brokerOffice, onWon, onReopened, canClose, COMMISSION_COUNTS };
