// CRM për agjentët: leads (portofoli), opportunitete (fazat e marrëveshjes) dhe historiku
const { db } = require('./db');
const match = require('./match');
const notify = require('./notify');
const offices = require('./offices');
const { ZONES } = require('./zones');

const STAGES = ['new', 'contacted', 'visit', 'offer', 'negotiation', 'won', 'lost'];
const STAGE_LABEL = { new: 'E re', contacted: 'Kontaktuar', visit: 'Vizitë', offer: 'Ofertë', negotiation: 'Negocim', won: 'Fituar', lost: 'Humbur' };
const CLIENT_TYPES = ['bleres', 'qiramarres', 'shites', 'qiradhenes', 'investitor'];
const SOURCES = ['website', 'instagram', 'facebook', 'telefon', 'whatsapp', 'rekomandim', 'zyra', 'tjeter'];
const LEAD_STATUS = ['active', 'cold', 'closed'];
const ACT_TYPES = ['note', 'call', 'whatsapp', 'email', 'visit', 'meeting', 'stage', 'system'];
const OPEN = "stage NOT IN ('won','lost')";

const normPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '355' + d.slice(1); return d.length >= 8 ? d : ''; };
// Data e sotme sipas orës së Shqipërisë (jo UTC), që “Për sot” të mos ngatërrohet pas mesnate
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TZ_NAME || 'Europe/Tirane' }).format(new Date());
const TYPES = ['Apartament', 'Vilë', 'Zyrë', 'Dyqan', 'Tokë'];
const SUPPLY_TYPES = ['shites', 'qiradhenes'];
const sideOf = clientType => SUPPLY_TYPES.includes(clientType) ? 'supply' : 'demand';
const oppOut = o => o && ({ ...o, c_zones: match.criteriaOf(o).zones, c_furnished: !!o.c_furnished, c_parking: !!o.c_parking });

// Kërkesat fillestare nga të dhënat e lead-it: “Apartament 2+1”, “Blloku, Tiranë”, buxheti
function criteriaFromLead(l) {
  const out = { deal: ['qiramarres', 'qiradhenes'].includes(l.client_type) ? 'qira' : 'shitje', c_type: '', c_city: '', c_zones: '[]', c_price_min: l.budget_min || null, c_price_max: l.budget_max || null, c_rooms: null, c_area_min: null, c_furnished: 0, c_parking: 0 };
  const t = match.norm(l.ptype);
  out.c_type = TYPES.find(x => t.includes(match.norm(x).slice(0, 4))) || (/garsonier|studio|banes|penthouse/.test(t) ? 'Apartament' : /shtepi/.test(t) ? 'Vilë' : '');
  const r = String(l.ptype || '').match(/(\d)\s*\+\s*1/); if (r) out.c_rooms = Number(r[1]);
  const parts = String(l.city || '').split(',').map(x => x.trim()).filter(Boolean);
  for (const part of parts) {
    const city = Object.keys(ZONES).find(c => match.norm(c) === match.norm(part));
    const zone = !city && Object.entries(ZONES).map(([c, list]) => [c, list.find(z => match.norm(z) === match.norm(part))]).find(x => x[1]);
    if (city) out.c_city = city;
    else if (zone) { out.c_zones = JSON.stringify([zone[1]]); if (!out.c_city) out.c_city = zone[0]; }
    else if (!out.c_city) out.c_city = part;
  }
  return out;
}
// Opportunitetet e krijuara para se të ekzistonte match-i marrin kërkesat nga prona ose nga lead-i (vetëm një herë)
(function backfill() {
  if (db.prepare("SELECT 1 FROM settings WHERE key = 'match_backfill'").get()) return;
  const rows = db.prepare('SELECT o.id, o.property_id, o.deal, l.client_type, l.budget_min, l.budget_max, l.city, l.ptype FROM opportunities o JOIN leads l ON l.id = o.lead_id').all();
  const up = db.prepare('UPDATE opportunities SET side = ?, c_type = ?, c_city = ?, c_zones = ?, c_price_min = ?, c_price_max = ?, c_rooms = ? WHERE id = ?');
  for (const o of rows) {
    const side = sideOf(o.client_type);
    const p = o.property_id ? db.prepare('SELECT * FROM properties WHERE id = ?').get(o.property_id) : null;
    const c = side === 'demand' && p ? match.criteriaFromProperty(p) : criteriaFromLead(o);
    up.run(side, c.c_type, c.c_city, c.c_zones, c.c_price_min, c.c_price_max, c.c_rooms, o.id);
  }
  db.prepare("INSERT INTO settings (key, value) VALUES ('match_backfill', '1')").run();
})();

function register({ route, HttpError, readBody, requireStaff, isAdmin, str, int }) {
  const num = v => (v === '' || v == null) ? null : Math.max(0, int(v, 0));
  const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const authorOf = u => u.agent_id ? (db.prepare('SELECT name FROM agents WHERE id = ?').get(u.agent_id)?.name || u.username) : u.username;
  const log = (u, leadId, type, text, oppId = null) => db.prepare('INSERT INTO activities (lead_id, opp_id, user_id, author, type, text) VALUES (?,?,?,?,?,?)').run(leadId, oppId, u ? u.id : null, u ? authorOf(u) : 'Faqja', type, text);

  function ownLead(u, id) {
    const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    if (!l) throw new HttpError(404, 'Lead-i nuk u gjet.');
    if (!isAdmin(u) && l.agent_id !== u.agent_id) throw new HttpError(403, 'Ky lead nuk është në portofolin tuaj.');
    return l;
  }
  function ownOpp(u, id) {
    const o = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(id);
    if (!o) throw new HttpError(404, 'Opportunity-ja nuk u gjet.');
    if (!isAdmin(u) && o.agent_id !== u.agent_id) throw new HttpError(403, 'Kjo opportunity nuk është e juaja.');
    return o;
  }
  function leadInput(b, u) {
    const l = {
      name: str(b.name, 100), phone: str(b.phone, 40), email: str(b.email, 120),
      client_type: CLIENT_TYPES.includes(b.client_type) ? b.client_type : 'bleres',
      source: SOURCES.includes(b.source) ? b.source : 'tjeter',
      status: LEAD_STATUS.includes(b.status) ? b.status : 'active',
      budget_min: num(b.budget_min), budget_max: num(b.budget_max),
      city: str(b.city, 60), ptype: str(b.ptype, 30), notes: str(b.notes, 3000)
    };
    if (!l.name) throw new HttpError(400, 'Shkruani emrin e klientit.');
    if (!l.phone && !l.email) throw new HttpError(400, 'Vendosni të paktën telefonin ose email-in.');
    l.phone_norm = normPhone(l.phone);
    if (isAdmin(u)) {
      l.agent_id = b.agent_id ? int(b.agent_id, null) : null;
      if (l.agent_id && !db.prepare('SELECT 1 FROM agents WHERE id = ?').get(l.agent_id)) throw new HttpError(400, 'Agjenti i zgjedhur nuk ekziston.');
    }
    return l;
  }
  function oppInput(b, u, lead) {
    const zones = (Array.isArray(b.c_zones) ? b.c_zones : String(b.c_zones || '').split(',')).map(z => str(z, 80)).filter(Boolean).slice(0, 12);
    const o = {
      title: str(b.title, 160), deal: b.deal === 'qira' ? 'qira' : 'shitje',
      stage: STAGES.includes(b.stage) ? b.stage : 'new',
      value: num(b.value) || 0, commission: num(b.commission) || 0,
      next_action: str(b.next_action, 200), next_date: isDate(b.next_date) ? b.next_date : '',
      lost_reason: str(b.lost_reason, 300),
      property_id: b.property_id ? int(b.property_id, null) : null,
      side: ['demand', 'supply'].includes(b.side) ? b.side : sideOf(lead.client_type),
      c_type: TYPES.includes(b.c_type) ? b.c_type : '', c_city: str(b.c_city, 60), c_zones: JSON.stringify([...new Set(zones)]),
      c_price_min: num(b.c_price_min) || null, c_price_max: num(b.c_price_max) || null,
      c_rooms: Math.min(10, num(b.c_rooms) || 0) || null, c_area_min: num(b.c_area_min) || null,
      c_furnished: b.c_furnished && b.c_furnished !== 'false' && b.c_furnished !== '0' ? 1 : 0,
      c_parking: b.c_parking && b.c_parking !== 'false' && b.c_parking !== '0' ? 1 : 0
    };
    if (o.c_price_min && o.c_price_max && o.c_price_min > o.c_price_max) [o.c_price_min, o.c_price_max] = [o.c_price_max, o.c_price_min];
    if (o.property_id) {
      const p = db.prepare('SELECT id, code, title, price, deal, agent_id, status, approval FROM properties WHERE id = ?').get(o.property_id);
      if (!p) throw new HttpError(400, 'Prona e zgjedhur nuk ekziston.');
      // Agjenti lidh çdo pronë që është në faqe (bashkëpunim), ose pronat e veta edhe kur janë në pritje
      if (!isAdmin(u) && p.agent_id !== u.agent_id && !(p.approval === 'approved' && p.status !== 'hidden')) throw new HttpError(403, 'Kjo pronë nuk është ende në faqe.');
      if (!o.title) o.title = `${p.code} – ${p.title}`;
      if (!o.value) o.value = p.price;
    }
    if (!o.title) {
      // Titulli plotësohet vetë nga kërkesat: “Blerje apartament 2+1 – Blloku”
      const what = [(o.c_type || 'pronë').toLowerCase(), o.c_rooms ? `${o.c_rooms}+1` : ''].filter(Boolean).join(' ');
      const where = match.criteriaOf(o).zones[0] || o.c_city;
      const verb = o.side === 'supply' ? (o.deal === 'qira' ? 'Dhënie me qira' : 'Shitje') : (o.deal === 'qira' ? 'Qira' : 'Blerje');
      o.title = `${verb} ${what}${where ? ' – ' + where : ''}`;
    }
    o.agent_id = isAdmin(u) ? (b.agent_id ? int(b.agent_id, null) : lead.agent_id) : u.agent_id;
    // Ndarja e komisionit: e cakton administratori (agjenti e sheh, nuk e ndryshon)
    if (isAdmin(u) && 'split_agent_id' in b) {
      o.split_agent_id = b.split_agent_id ? int(b.split_agent_id, null) : null;
      o.split_pct = o.split_agent_id ? Math.min(100, Math.max(0, int(b.split_pct, 50))) : null;
      if (o.split_agent_id && o.split_agent_id === o.agent_id) { o.split_agent_id = null; o.split_pct = null; }
    }
    if (o.agent_id && !db.prepare('SELECT 1 FROM agents WHERE id = ?').get(o.agent_id)) throw new HttpError(400, 'Agjenti i zgjedhur nuk ekziston.');
    return o;
  }
  // Kur fitohet një marrëveshje me pronën e një kolegu: ndarja 50/50 (nëse s’është caktuar ndryshe) dhe njoftim për të
  function onWon(oppId, u) {
    const o = db.prepare('SELECT o.*, p.agent_id AS p_agent, p.code AS p_code FROM opportunities o LEFT JOIN properties p ON p.id = o.property_id WHERE o.id = ?').get(oppId);
    if (!o || o.stage !== 'won') return;
    offices.onWon(o.id); // komisioni pret mbylljen nga brokeri ose administratori
    if (!o.split_agent_id && o.p_agent && o.p_agent !== o.agent_id) { db.prepare('UPDATE opportunities SET split_agent_id = ?, split_pct = 50 WHERE id = ?').run(o.p_agent, o.id); o.split_agent_id = o.p_agent; o.split_pct = 50; }
    if (o.split_agent_id) {
      const who = o.agent_id ? db.prepare('SELECT name FROM agents WHERE id = ?').get(o.agent_id)?.name : 'Agjencia';
      notify.create(o.split_agent_id, 'won_split', `Marrëveshje e fituar${o.p_code ? ' me ' + o.p_code : ''}`, `${who} e mbylli. Pjesa jote: ${100 - (o.split_pct ?? 50)}% e komisionit${o.commission ? ` (${match.eur(Math.round(o.commission * (100 - (o.split_pct ?? 50)) / 100))})` : ''}.`, { view: 'raporti' });
    }
  }
  const withCounts = rows => { const c = match.countsForOpps(rows); return rows.map(o => ({ ...oppOut(o), match_count: c[o.id]?.n || 0, match_new: c[o.id]?.fresh || 0 })); };
  const propLabel = p => `${p.code} – ${p.title}`;
  const oppSelect = `SELECT o.*, l.name AS lead_name, l.phone AS lead_phone, a.name AS agent_name, p.code AS property_code, p.title AS property_title, p.agent_id AS property_agent_id, sa.name AS split_agent_name
    FROM opportunities o JOIN leads l ON l.id = o.lead_id LEFT JOIN agents a ON a.id = o.agent_id LEFT JOIN properties p ON p.id = o.property_id LEFT JOIN agents sa ON sa.id = o.split_agent_id`;

  /* ---------- leads ---------- */
  route('GET', '/api/admin/leads', ({ req, query }) => {
    const u = requireStaff(req), where = ['1=1'], params = [];
    if (!isAdmin(u)) { where.push('l.agent_id = ?'); params.push(u.agent_id); }
    else if (query.get('agent') === 'none') where.push('l.agent_id IS NULL');
    else if (query.get('agent')) { where.push('l.agent_id = ?'); params.push(int(query.get('agent'))); }
    const q = str(query.get('q'), 80);
    if (q) { where.push('(l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR l.city LIKE ?)'); params.push(...Array(4).fill(`%${q}%`)); }
    for (const [k, list] of [['client_type', CLIENT_TYPES], ['source', SOURCES], ['status', LEAD_STATUS]]) if (list.includes(query.get(k))) { where.push(`l.${k} = ?`); params.push(query.get(k)); }
    const fd = notify.followupDays();
    return db.prepare(`SELECT l.*, a.name AS agent_name,
        (SELECT COUNT(*) FROM opportunities o WHERE o.lead_id = l.id AND o.${OPEN}) AS open_opps,
        (SELECT MIN(o.next_date) FROM opportunities o WHERE o.lead_id = l.id AND o.${OPEN} AND o.next_date != '') AS next_date,
        (SELECT MAX(created_at) FROM activities ac WHERE ac.lead_id = l.id) AS last_activity,
        CAST(julianday('now') - julianday(COALESCE((SELECT MAX(ac.created_at) FROM activities ac WHERE ac.lead_id = l.id AND ac.user_id IS NOT NULL AND ac.type IN ${notify.CONTACT_TYPES}), l.created_at)) AS INTEGER) AS days_quiet
      FROM leads l LEFT JOIN agents a ON a.id = l.agent_id WHERE ${where.join(' AND ')} ORDER BY COALESCE(last_activity, l.created_at) DESC, l.id DESC`).all(...params)
      .map(l => ({ ...l, stale: l.status === 'active' && l.days_quiet >= fd ? l.days_quiet : 0 }));
  });
  route('GET', '/api/admin/leads/:id', ({ req, params }) => {
    const u = requireStaff(req), l = ownLead(u, int(params.id));
    return {
      ...l, agent_name: l.agent_id ? db.prepare('SELECT name FROM agents WHERE id = ?').get(l.agent_id)?.name : null,
      opportunities: withCounts(db.prepare(`${oppSelect} WHERE o.lead_id = ? ORDER BY ${OPEN.replace('stage', 'o.stage')} DESC, o.updated_at DESC`).all(l.id)),
      suggest: criteriaFromLead(l),
      activities: db.prepare('SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC, id DESC LIMIT 200').all(l.id)
    };
  });
  route('POST', '/api/admin/leads', async ({ req }) => {
    const u = requireStaff(req), l = leadInput(await readBody(req), u);
    if (!isAdmin(u)) l.agent_id = u.agent_id;
    if (l.phone_norm) {
      const dup = db.prepare('SELECT l.id, l.name, l.agent_id, a.name AS agent_name FROM leads l LEFT JOIN agents a ON a.id = l.agent_id WHERE phone_norm = ?').get(l.phone_norm);
      if (dup) throw new HttpError(409, dup.agent_id === l.agent_id || isAdmin(u) ? `Ky numër ekziston: ${dup.name}${dup.agent_name ? ' (' + dup.agent_name + ')' : ''}. Hapeni lead-in ekzistues.` : 'Ky klient është tashmë në portofolin e një agjenti tjetër. Kontaktoni administratorin.');
    }
    l.created_by = u.id;
    const keys = Object.keys(l);
    const id = Number(db.prepare(`INSERT INTO leads (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(l)).lastInsertRowid);
    log(u, id, 'system', 'Lead-i u krijua.');
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  });
  route('PUT', '/api/admin/leads/:id', async ({ req, params }) => {
    const u = requireStaff(req), old = ownLead(u, int(params.id)), l = leadInput(await readBody(req), u);
    if (!isAdmin(u)) l.agent_id = old.agent_id;
    db.prepare(`UPDATE leads SET ${Object.keys(l).map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(l), old.id);
    if (isAdmin(u) && l.agent_id !== old.agent_id) {
      db.prepare(`UPDATE opportunities SET agent_id = ?, updated_at = datetime('now') WHERE lead_id = ? AND ${OPEN}`).run(l.agent_id, old.id);
      const name = l.agent_id ? db.prepare('SELECT name FROM agents WHERE id = ?').get(l.agent_id)?.name : 'askujt';
      log(u, old.id, 'system', `Lead-i iu caktua ${name}.`);
    }
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(old.id);
  });
  route('DELETE', '/api/admin/leads/:id', ({ req, params }) => {
    const u = requireStaff(req), l = ownLead(u, int(params.id));
    if (!isAdmin(u)) throw new HttpError(403, 'Vetëm administratori fshin leads. Shënojeni “Mbyllur” nëse nuk është më aktiv.');
    db.prepare('UPDATE inquiries SET lead_id = NULL WHERE lead_id = ?').run(l.id);
    db.prepare('DELETE FROM leads WHERE id = ?').run(l.id);
    return { ok: true };
  });
  route('POST', '/api/admin/leads/:id/activities', async ({ req, params }) => {
    const u = requireStaff(req), l = ownLead(u, int(params.id)), b = await readBody(req);
    const type = ACT_TYPES.includes(b.type) && !['stage', 'system'].includes(b.type) ? b.type : 'note';
    const text = str(b.text, 2000);
    if (!text && type === 'note') throw new HttpError(400, 'Shkruani shënimin.');
    const oppId = b.opp_id ? int(b.opp_id, null) : null;
    if (oppId) { const o = ownOpp(u, oppId); if (o.lead_id !== l.id) throw new HttpError(400, 'Opportunity-ja nuk i përket këtij lead-i.'); }
    log(u, l.id, type, text, oppId);
    db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(l.id);
    return { ok: true };
  });

  /* ---------- opportunitete ---------- */
  route('GET', '/api/admin/opportunities', ({ req, query }) => {
    const u = requireStaff(req), where = ['1=1'], params = [];
    if (!isAdmin(u)) { where.push('o.agent_id = ?'); params.push(u.agent_id); }
    else if (query.get('agent') === 'none') where.push('o.agent_id IS NULL');
    else if (query.get('agent')) { where.push('o.agent_id = ?'); params.push(int(query.get('agent'))); }
    const q = str(query.get('q'), 80);
    if (q) { where.push('(o.title LIKE ? OR l.name LIKE ? OR p.code LIKE ?)'); params.push(...Array(3).fill(`%${q}%`)); }
    if (query.get('closed') !== 'all') where.push("(o.stage NOT IN ('won','lost') OR o.closed_at >= datetime('now','-60 days'))");
    return withCounts(db.prepare(`${oppSelect} WHERE ${where.join(' AND ')} ORDER BY CASE WHEN o.next_date = '' THEN 1 ELSE 0 END, o.next_date, o.updated_at DESC`).all(...params));
  });
  route('GET', '/api/admin/opportunities/:id', ({ req, params }) => {
    const o = ownOpp(requireStaff(req), int(params.id));
    return oppOut(db.prepare(`${oppSelect} WHERE o.id = ?`).get(o.id));
  });
  route('POST', '/api/admin/opportunities', async ({ req }) => {
    const u = requireStaff(req), b = await readBody(req);
    const lead = ownLead(u, int(b.lead_id));
    const o = oppInput(b, u, lead);
    o.lead_id = lead.id; if (['won', 'lost'].includes(o.stage)) o.closed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const keys = Object.keys(o);
    const id = Number(db.prepare(`INSERT INTO opportunities (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(o)).lastInsertRowid);
    log(u, lead.id, 'system', `U krijua opportunity: ${o.title} (${STAGE_LABEL[o.stage]}).`, id);
    try { notify.oppChanged(id); if (o.stage === 'won') onWon(id, u); } catch (e) { console.error('Njoftimet:', e); }
    return oppOut(db.prepare(`${oppSelect} WHERE o.id = ?`).get(id));
  });
  route('PUT', '/api/admin/opportunities/:id', async ({ req, params }) => {
    const u = requireStaff(req), old = ownOpp(u, int(params.id)), b = await readBody(req);
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(old.lead_id);
    const o = oppInput(b, u, lead);
    if (!isAdmin(u)) o.agent_id = old.agent_id;
    if (o.stage !== old.stage) {
      o.closed_at = ['won', 'lost'].includes(o.stage) ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
      log(u, old.lead_id, 'stage', `${STAGE_LABEL[old.stage]} → ${STAGE_LABEL[o.stage]}${o.stage === 'lost' && o.lost_reason ? ': ' + o.lost_reason : ''}`, old.id);
    }
    db.prepare(`UPDATE opportunities SET ${Object.keys(o).map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(o), old.id);
    try { notify.oppChanged(old.id); if (o.stage === 'won' && old.stage !== 'won') onWon(old.id, u); if (o.stage !== 'won') offices.onReopened(old.id); } catch (e) { console.error('Njoftimet:', e); }
    return oppOut(db.prepare(`${oppSelect} WHERE o.id = ?`).get(old.id));
  });
  route('PATCH', '/api/admin/opportunities/:id', async ({ req, params }) => {
    const u = requireStaff(req), old = ownOpp(u, int(params.id)), b = await readBody(req);
    if (!STAGES.includes(b.stage)) throw new HttpError(400, 'Fazë e pavlefshme.');
    if (b.stage === old.stage) return db.prepare(`${oppSelect} WHERE o.id = ?`).get(old.id);
    const closed = ['won', 'lost'].includes(b.stage) ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    const reason = b.stage === 'lost' ? str(b.lost_reason, 300) : old.lost_reason;
    db.prepare("UPDATE opportunities SET stage = ?, closed_at = ?, lost_reason = ?, updated_at = datetime('now') WHERE id = ?").run(b.stage, closed, reason, old.id);
    log(u, old.lead_id, 'stage', `${STAGE_LABEL[old.stage]} → ${STAGE_LABEL[b.stage]}${b.stage === 'lost' && reason ? ': ' + reason : ''}`, old.id);
    try { if (b.stage === 'won') onWon(old.id, u); else { offices.onReopened(old.id); if (!['won', 'lost'].includes(b.stage) && ['won', 'lost'].includes(old.stage)) notify.oppChanged(old.id); } } catch (e) { console.error('Njoftimet:', e); }
    return db.prepare(`${oppSelect} WHERE o.id = ?`).get(old.id);
  });
  route('DELETE', '/api/admin/opportunities/:id', ({ req, params }) => {
    const u = requireStaff(req), o = ownOpp(u, int(params.id));
    db.prepare('DELETE FROM opportunities WHERE id = ?').run(o.id);
    log(u, o.lead_id, 'system', `U fshi opportunity: ${o.title}.`);
    return { ok: true };
  });

  /* ---------- match: klient ↔ pronë ---------- */
  // Llogarit match-et për kërkesat e formularit (edhe para ruajtjes); me opp_id shton gjendjen e çdo prone
  route('POST', '/api/admin/match/preview', async ({ req }) => {
    const u = requireStaff(req), b = await readBody(req);
    const old = b.opp_id ? ownOpp(u, int(b.opp_id)) : null;
    const lead = old ? db.prepare('SELECT * FROM leads WHERE id = ?').get(old.lead_id) : { client_type: 'bleres', agent_id: null };
    const o = oppInput({ ...b, title: 'x', agent_id: null, property_id: null }, u, lead);
    const c = match.criteriaOf(o);
    const linkedId = b.property_id ? int(b.property_id, null) : null;
    const items = match.matchesFor(c, { states: old ? match.statesOf(old.id) : {}, linkedId, seenAt: old ? (old.matches_seen_at || old.created_at) : null });
    // Agjenti i opportunity-së i pa: “të rejat” nuk njoftohen më
    if (old && b.seen && (old.agent_id === u.agent_id || (isAdmin(u) && !old.agent_id))) db.prepare("UPDATE opportunities SET matches_seen_at = datetime('now') WHERE id = ?").run(old.id);
    return { items, has_criteria: match.hasCriteria(c) };
  });
  // Veprimet mbi një match: propozuar / i pëlqeu / nuk i pëlqeu / hiq shënimin / lidhe si pronën e opportunity-së
  route('POST', '/api/admin/opportunities/:id/matches/:pid', async ({ req, params }) => {
    const u = requireStaff(req), o = ownOpp(u, int(params.id)), b = await readBody(req);
    const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(int(params.pid));
    if (!p || (!isAdmin(u) && p.agent_id !== u.agent_id && !(p.approval === 'approved' && p.status !== 'hidden'))) throw new HttpError(404, 'Prona nuk u gjet.');
    if (b.link) {
      db.prepare("UPDATE opportunities SET property_id = ?, value = CASE WHEN value > 0 THEN value ELSE ? END, updated_at = datetime('now') WHERE id = ?").run(p.id, p.price, o.id);
      log(u, o.lead_id, 'system', `Prona e opportunity-së: ${propLabel(p)}.`, o.id);
    } else if (b.status === null || b.status === '') {
      db.prepare('DELETE FROM opp_matches WHERE opp_id = ? AND property_id = ?').run(o.id, p.id);
    } else {
      if (!['proposed', 'liked', 'dismissed'].includes(b.status)) throw new HttpError(400, 'Veprim i pavlefshëm.');
      const note = str(b.note, 300);
      const had = db.prepare('SELECT status FROM opp_matches WHERE opp_id = ? AND property_id = ?').get(o.id, p.id);
      db.prepare(`INSERT INTO opp_matches (opp_id, property_id, status, note, user_id) VALUES (?,?,?,?,?)
        ON CONFLICT(opp_id, property_id) DO UPDATE SET status = excluded.status, note = excluded.note, user_id = excluded.user_id, updated_at = datetime('now')`).run(o.id, p.id, b.status, note, u.id);
      if (!had || had.status !== b.status) {
        const text = { proposed: `Iu propozua prona ${propLabel(p)}${b.via === 'whatsapp' ? ' (WhatsApp)' : ''}.`, liked: `I pëlqeu prona ${propLabel(p)}.`, dismissed: `Nuk i pëlqeu prona ${propLabel(p)}${note ? ': ' + note : ''}.` }[b.status];
        log(u, o.lead_id, b.status === 'proposed' && b.via === 'whatsapp' ? 'whatsapp' : 'note', text, o.id);
      }
    }
    db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(o.lead_id);
    return { ok: true };
  });
  // Klientët që presin një pronë si kjo. Klientët e agjentëve të tjerë shfaqen pa emër e telefon – kontaktohet agjenti.
  route('GET', '/api/admin/properties/:id/buyers', ({ req, params }) => {
    const u = requireStaff(req);
    const p = db.prepare('SELECT p.*, COALESCE(p.published_at, p.created_at) AS live_at FROM properties p WHERE p.id = ?').get(int(params.id));
    if (!p) throw new HttpError(404, 'Prona nuk u gjet.');
    const live = p.approval === 'approved' && p.status === 'active';
    if (!isAdmin(u) && p.agent_id !== u.agent_id && !live) throw new HttpError(403, 'Kjo pronë nuk është e juaja.');
    const items = match.demandsForProperty(p).map(d => {
      const mine = isAdmin(u) || d.agent_id === u.agent_id;
      return mine ? { ...d, mine: true } : { ...d, mine: false, lead_id: null, lead_name: null, lead_phone: null, title: null };
    });
    return { property: { id: p.id, code: p.code, title: p.title, price: p.price, deal: p.deal, live }, items };
  });

  function shares() {
    // Vetëm komisionet e mbyllura (ose të vjetrat, para mbylljes nga brokeri) llogariten
    const rows = db.prepare(`SELECT agent_id, split_agent_id, split_pct, commission, closed_at >= strftime('%Y-%m-01','now') AS this_month FROM opportunities o WHERE stage = 'won' AND ${offices.COMMISSION_COUNTS}`).all();
    const byAgent = {}; let total = 0, monthTotal = 0;
    const add = (id, v, m) => { if (!id) return; const x = byAgent[id] || (byAgent[id] = { month: 0, total: 0 }); x.total += v; if (m) x.month += v; };
    for (const r of rows) {
      const c = r.commission || 0, pct = r.split_agent_id ? (r.split_pct ?? 50) : 100;
      const mine = Math.round(c * pct / 100);
      add(r.agent_id, mine, r.this_month); add(r.split_agent_id, c - mine, r.this_month);
      total += c; if (r.this_month) monthTotal += c;
    }
    return { byAgent, total, monthTotal };
  }

  /* ---------- përmbledhja dhe raporti ---------- */
  route('GET', '/api/admin/crm', ({ req }) => {
    const u = requireStaff(req), admin = isAdmin(u);
    const ow = admin ? '1=1' : 'o.agent_id = ?', op = admin ? [] : [u.agent_id];
    const lw = admin ? '1=1' : 'agent_id = ?';
    const todayList = db.prepare(`${oppSelect} WHERE ${ow} AND o.${OPEN} AND o.next_date != '' AND o.next_date <= ? ORDER BY o.next_date LIMIT 30`).all(...op, today());
    const pipeline = db.prepare(`SELECT stage, COUNT(*) AS n, COALESCE(SUM(value),0) AS value, COALESCE(SUM(commission),0) AS commission FROM opportunities o WHERE ${ow} GROUP BY stage`).all(...op);
    const month = db.prepare(`SELECT SUM(stage='won') AS won, SUM(stage='lost') AS lost, COALESCE(SUM(CASE WHEN stage='won' THEN commission END),0) AS commission, COALESCE(SUM(CASE WHEN stage='won' THEN value END),0) AS value FROM opportunities o WHERE ${ow} AND closed_at >= strftime('%Y-%m-01','now')`).get(...op);
    const leads = db.prepare(`SELECT COUNT(*) AS total, SUM(created_at >= datetime('now','-7 days')) AS week, SUM(agent_id IS NULL) AS unassigned FROM leads WHERE ${lw}`).get(...op);
    // Prona të reja në faqe që u përshtaten klientëve të hapur
    const openOpps = db.prepare(`${oppSelect} WHERE ${ow} AND o.${OPEN} AND o.side = 'demand'`).all(...op);
    const counts = match.countsForOpps(openOpps);
    const newMatches = openOpps.filter(o => counts[o.id]?.fresh).map(o => ({ id: o.id, title: o.title, lead_name: o.lead_name, agent_name: o.agent_name, fresh: counts[o.id].fresh, top: counts[o.id].top }))
      .sort((a, b) => b.top.score - a.top.score).slice(0, 12);
    // Komisioni sipas pjesëve: agjenti i opportunity-së merr split_pct, agjenti tjetër pjesën e mbetur
    const share = shares(), mine = admin ? null : u.agent_id;
    month.commission = admin ? share.monthTotal : (share.byAgent[mine]?.month || 0);
    const visitsToday = db.prepare(`SELECT v.id, v.starts_at, v.status, v.agent_id, p.code AS property_code, p.title AS property_title, p.agent_id AS p_agent, l.name AS lead_name, a.name AS agent_name
      FROM visits v LEFT JOIN properties p ON p.id = v.property_id LEFT JOIN leads l ON l.id = v.lead_id LEFT JOIN agents a ON a.id = v.agent_id
      WHERE v.status = 'planned' AND substr(v.starts_at, 1, 10) = ? ${admin ? '' : 'AND (v.agent_id = ? OR p.agent_id = ?)'} ORDER BY v.starts_at`).all(today(), ...(admin ? [] : [mine, mine]))
      .map(v => admin || v.agent_id === mine ? v : { ...v, lead_name: null });
    // Komisionet që pret ky përdorues t’i mbyllë (administratori: ato pa broker ose të vetë brokerëve)
    const pendingCommissions = db.prepare(`SELECT o.id, o.title, o.commission, o.agent_id, a.name AS agent_name, l.name AS lead_name FROM opportunities o JOIN leads l ON l.id = o.lead_id LEFT JOIN agents a ON a.id = o.agent_id WHERE o.stage = 'won' AND o.commission_status = 'pending' ORDER BY o.closed_at`).all().filter(o => offices.canClose(u, o));
    const myPending = admin ? 0 : db.prepare("SELECT COALESCE(SUM(CASE WHEN agent_id = ? THEN commission * COALESCE(CASE WHEN split_agent_id IS NULL THEN 100 ELSE split_pct END, 50) / 100 ELSE commission * (100 - COALESCE(split_pct, 50)) / 100 END), 0) AS n FROM opportunities WHERE stage = 'won' AND commission_status = 'pending' AND (agent_id = ? OR split_agent_id = ?)").get(mine, mine, mine).n;
    const out = { today: today(), todayList, pipeline, month, leads, newMatches, visitsToday, pendingCommissions, myPending: Math.round(myPending), stale: notify.staleLeads(u.agent_id, admin, 15), followup_days: notify.followupDays() };
    if (admin) {
      out.agents = db.prepare(`SELECT a.id, a.name,
          (SELECT COUNT(*) FROM leads l WHERE l.agent_id = a.id) AS leads,
          (SELECT COUNT(*) FROM opportunities o WHERE o.agent_id = a.id AND o.${OPEN.replace('stage', 'stage')}) AS open,
          (SELECT COALESCE(SUM(value),0) FROM opportunities o WHERE o.agent_id = a.id AND o.${OPEN.replace('stage', 'stage')}) AS open_value,
          (SELECT COUNT(*) FROM opportunities o WHERE o.agent_id = a.id AND o.stage = 'won' AND o.closed_at >= strftime('%Y-%m-01','now')) AS won_month,

          (SELECT COUNT(*) FROM opportunities o WHERE o.agent_id = a.id AND o.stage = 'won') AS won_total,
          (SELECT COUNT(*) FROM opportunities o WHERE o.agent_id = a.id AND o.stage = 'lost') AS lost_total,
          (SELECT COUNT(*) FROM opportunities o WHERE o.split_agent_id = a.id AND o.stage = 'won') AS shared_total
        FROM agents a ORDER BY a.level DESC, a.id`).all()
        .map(a => ({ ...a, commission_month: share.byAgent[a.id]?.month || 0, commission_total: share.byAgent[a.id]?.total || 0 }));
      out.commission_total = share.total;
      out.sources = db.prepare(`SELECT l.source, COUNT(DISTINCT l.id) AS leads, COUNT(CASE WHEN o.stage = 'won' THEN 1 END) AS won FROM leads l LEFT JOIN opportunities o ON o.lead_id = l.id GROUP BY l.source ORDER BY leads DESC`).all();
    }
    return out;
  });

  /* ---------- kërkesë nga faqja → lead ---------- */
  route('POST', '/api/admin/inquiries/:id/lead', ({ req, params }) => {
    const u = requireStaff(req);
    const i = db.prepare('SELECT i.*, p.agent_id AS p_agent FROM inquiries i LEFT JOIN properties p ON p.id = i.property_id WHERE i.id = ?').get(int(params.id));
    if (!i) throw new HttpError(404, 'Kërkesa nuk u gjet.');
    if (!isAdmin(u) && i.p_agent !== u.agent_id) throw new HttpError(403, 'Kjo kërkesë nuk është për pronat tuaja.');
    return { lead_id: fromInquiry(i.id, u) };
  });
}

// Çdo kërkesë nga faqja shtohet në portofolin e agjentit të pronës (ose pa agjent, për administratorin)
function fromInquiry(inquiryId, u = null) {
  const i = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(inquiryId);
  if (!i) return null;
  if (i.lead_id && db.prepare('SELECT 1 FROM leads WHERE id = ?').get(i.lead_id)) return i.lead_id;
  const p = i.property_id ? db.prepare('SELECT * FROM properties WHERE id = ?').get(i.property_id) : null;
  const phone_norm = normPhone(i.phone);
  let lead = phone_norm ? db.prepare('SELECT * FROM leads WHERE phone_norm = ?').get(phone_norm) : null;
  if (!lead && i.email) lead = db.prepare('SELECT * FROM leads WHERE email = ? COLLATE NOCASE').get(i.email);
  const client_type = i.kind === 'valuation' ? (/qira/i.test(i.message || '') ? 'qiradhenes' : 'shites') : (p && p.deal === 'qira' ? 'qiramarres' : 'bleres');
  const authorName = u ? (u.agent_id ? db.prepare('SELECT name FROM agents WHERE id = ?').get(u.agent_id)?.name : u.username) : 'Faqja';
  const act = (leadId, type, text, oppId = null) => db.prepare('INSERT INTO activities (lead_id, opp_id, user_id, author, type, text) VALUES (?,?,?,?,?,?)').run(leadId, oppId, u ? u.id : null, authorName, type, text);
  if (!lead) {
    const r = db.prepare('INSERT INTO leads (name, phone, phone_norm, email, client_type, source, city, ptype, agent_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(i.name, i.phone || '', phone_norm, i.email || '', client_type, 'website', p ? p.city : '', p ? p.type : '', p ? p.agent_id : null, '');
    lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(r.lastInsertRowid));
    act(lead.id, 'system', 'Lead-i erdhi nga faqja.');
  }
  const kindText = { property: 'Pyetje për pronën', visit: 'Kërkesë për vizitë', valuation: 'Kërkesë për vlerësim', contact: 'Mesazh nga faqja' }[i.kind] || 'Kërkesë nga faqja';
  act(lead.id, 'note', `${kindText}${p ? ` ${p.code}` : ''}: ${i.message || '(pa mesazh)'}`);
  const needOpp = p ? !db.prepare(`SELECT 1 FROM opportunities WHERE lead_id = ? AND property_id = ? AND ${OPEN}`).get(lead.id, p.id) : i.kind === 'valuation';
  if (needOpp) {
    const title = p ? `${p.code} – ${p.title}` : `Vlerësim prone${lead.city ? ' – ' + lead.city : ''}`;
    // Klienti që pyet për një pronë merr si kërkesa tiparet e saj, që t’i dalin edhe pronat e ngjashme
    const c = p ? match.criteriaFromProperty(p) : { c_type: '', c_city: lead.city || '', c_zones: '[]', c_price_max: null, c_rooms: null };
    const r = db.prepare("INSERT INTO opportunities (lead_id, agent_id, property_id, title, deal, stage, value, next_action, next_date, side, c_type, c_city, c_zones, c_price_max, c_rooms) VALUES (?,?,?,?,?,'new',?,?,?,?,?,?,?,?,?)")
      .run(lead.id, lead.agent_id ?? (p ? p.agent_id : null), p ? p.id : null, title, p ? p.deal : (client_type === 'qiradhenes' ? 'qira' : 'shitje'), p ? p.price : 0, i.kind === 'visit' ? 'Konfirmo vizitën' : 'Kontakto klientin', today(),
        p ? 'demand' : 'supply', c.c_type, c.c_city, c.c_zones, c.c_price_max, c.c_rooms);
    act(lead.id, 'system', `U krijua opportunity: ${title} (E re).`, Number(r.lastInsertRowid));
  }
  db.prepare('UPDATE inquiries SET lead_id = ? WHERE id = ?').run(lead.id, i.id);
  db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(lead.id);
  return lead.id;
}

module.exports = { register, fromInquiry, criteriaFromLead, normPhone, STAGES, STAGE_LABEL };
