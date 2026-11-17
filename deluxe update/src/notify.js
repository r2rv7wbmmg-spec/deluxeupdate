// Njoftimet: zilja në panel + njoftime “push” falas në telefon (Web Push, pa shërbime me pagesë).
// Këtu janë edhe rregullat se kur lind një njoftim: match në dy drejtimet, ulja e çmimit,
// prona e dyfishtë, kujtuesi i vizitave dhe dokumentet që skadojnë.
const crypto = require('node:crypto');
const { db } = require('./db');
const match = require('./match');
const config = require('./config');

const NOTIFY_SCORE = 60; // nën këtë përqindje nuk dërgohet njoftim (match-i shihet gjithsesi te “Match”)
const OPEN = "o.stage NOT IN ('won','lost')";

// Ora e Shqipërisë si tekst 'YYYY-MM-DD HH:MM' (vizitat ruhen kështu)
function localNow(addMinutes = 0) {
  const d = new Date(Date.now() + addMinutes * 60000);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: process.env.TZ_NAME || 'Europe/Tirane', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
const agentName = id => id ? db.prepare('SELECT name FROM agents WHERE id = ?').get(id)?.name || 'një agjent' : 'agjencia';
const first = n => String(n || '').split(' ')[0];
const label = p => `${p.code} – ${p.title}`;

/* ---------- krijimi ---------- */
// agentId = null → njoftim për administratorët
function create(agentId, kind, title, body = '', link = {}) {
  const r = db.prepare('INSERT INTO notifications (agent_id, kind, title, body, link) VALUES (?,?,?,?,?)').run(agentId ?? null, kind, String(title).slice(0, 200), String(body).slice(0, 400), JSON.stringify(link));
  try { pushTo(agentId); } catch (e) { console.error('Push:', e.message); }
  return Number(r.lastInsertRowid);
}

/* ---------- Web Push (VAPID): vetëm “zgjimi”, teksti merret nga paneli – pa enkriptim, pa varësi ---------- */
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function vapid() {
  const get = k => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value;
  let jwk = get('vapid_private'), pub = get('vapid_public');
  if (!jwk || !pub) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const j = publicKey.export({ format: 'jwk' });
    pub = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url')]));
    jwk = JSON.stringify(privateKey.export({ format: 'jwk' }));
    const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    up.run('vapid_private', jwk); up.run('vapid_public', pub);
  }
  return { key: crypto.createPrivateKey({ key: JSON.parse(jwk), format: 'jwk' }), pub };
}
function sendPush(sub) {
  const { key, pub } = vapid();
  const url = new URL(sub.endpoint);
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: url.origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:' + (config.site.email || 'info@example.com') }));
  const sig = b64u(crypto.sign('sha256', Buffer.from(`${head}.${claims}`), { key, dsaEncoding: 'ieee-p1363' }));
  const req = require('node:https').request(url, { method: 'POST', headers: { Authorization: `vapid t=${head}.${claims}.${sig}, k=${pub}`, TTL: '86400', Urgency: 'high', 'Content-Length': '0' }, timeout: 10000 }, res => {
    res.resume();
    if (res.statusCode === 404 || res.statusCode === 410) db.prepare('DELETE FROM push_subs WHERE id = ?').run(sub.id); // telefoni e ka çregjistruar
  });
  req.on('error', () => {}); req.on('timeout', () => req.destroy()); req.end();
}
function pushTo(agentId) {
  const subs = agentId
    ? db.prepare("SELECT ps.* FROM push_subs ps JOIN users u ON u.id = ps.user_id WHERE u.active = 1 AND u.role = 'agent' AND u.agent_id = ?").all(agentId)
    : db.prepare("SELECT ps.* FROM push_subs ps JOIN users u ON u.id = ps.user_id WHERE u.active = 1 AND u.role = 'admin'").all();
  subs.forEach(sendPush);
}
const publicKey = () => vapid().pub;

/* ---------- match në dy drejtimet ---------- */
const liveProp = id => db.prepare("SELECT p.*, COALESCE(p.published_at, p.created_at) AS live_at FROM properties p WHERE p.id = ? AND p.status = 'active' AND p.approval = 'approved'").get(id);
const notified = db.prepare('INSERT OR IGNORE INTO match_notified (opp_id, property_id) VALUES (?, ?)');
const wasNotified = (o, p) => !!db.prepare('SELECT 1 FROM match_notified WHERE opp_id = ? AND property_id = ?').get(o, p);
const dismissed = (o, p) => db.prepare("SELECT 1 FROM opp_matches WHERE opp_id = ? AND property_id = ? AND status = 'dismissed'").get(o, p);

// Një pronë doli në faqe: njoftohen agjentët e klientëve që e presin, dhe agjenti i pronës merr përmbledhjen
function propertyLive(propertyId) {
  const p = liveProp(propertyId); if (!p) return;
  const opps = db.prepare(`SELECT o.*, l.name AS lead_name FROM opportunities o JOIN leads l ON l.id = o.lead_id WHERE ${OPEN} AND o.side = 'demand' AND l.status != 'closed'`).all();
  let others = 0, best = 0;
  for (const o of opps) {
    const c = match.criteriaOf(o);
    if (!match.hasCriteria(c) || o.property_id === p.id || dismissed(o.id, p.id) || wasNotified(o.id, p.id)) continue;
    const m = match.score(c, p);
    if (!m || m.score < NOTIFY_SCORE) continue;
    notified.run(o.id, p.id);
    const own = o.agent_id && o.agent_id === p.agent_id;
    create(o.agent_id, 'match_property', `Pronë e re për ${o.lead_name}`, `${label(p)}${own ? ' (prona jote)' : ` · ${agentName(p.agent_id)}`} përputhet ${m.score}%`, { opp: o.id });
    if (!own) { others++; best = Math.max(best, m.score); }
  }
  if (others) create(p.agent_id, 'match_buyers', `${others} ${others === 1 ? 'klient pret' : 'klientë presin'} pronën tënde`, `${label(p)} · deri në ${best}% përputhje. Shikoji te “Match”.`, { view: 'match', tab: 'props' });
}
// U hodh ose u ndryshua një kërkesë klienti: njoftohen agjentët e pronave që i përshtaten (pa emrin e klientit)
function oppChanged(oppId) {
  const o = db.prepare(`SELECT o.* FROM opportunities o JOIN leads l ON l.id = o.lead_id WHERE o.id = ? AND ${OPEN} AND o.side = 'demand' AND l.status != 'closed'`).get(oppId);
  if (!o) return;
  const c = match.criteriaOf(o); if (!match.hasCriteria(c)) return;
  const props = db.prepare("SELECT p.*, COALESCE(p.published_at, p.created_at) AS live_at FROM properties p WHERE p.status = 'active' AND p.approval = 'approved'").all();
  for (const p of props) {
    if (p.id === o.property_id || dismissed(o.id, p.id) || wasNotified(o.id, p.id)) continue;
    const m = match.score(c, p);
    if (!m || m.score < NOTIFY_SCORE) continue;
    notified.run(o.id, p.id);
    if (p.agent_id && p.agent_id === o.agent_id) continue; // prona e vet: agjenti i sheh menjëherë te opportunity-ja
    create(p.agent_id, 'match_client', `Klient i ri për ${p.code}`, `${agentName(o.agent_id)} ka një klient që kërkon si “${p.title}” · ${m.score}%`, { view: 'match', tab: 'props' });
  }
}
// Çmimi u ul: njoftohen agjentët e klientëve që e panë ose e pëlqyen pronën
function priceCheck(propertyId) {
  const p = liveProp(propertyId); if (!p) return;
  const before = p.last_public_price;
  if (before && p.price < before) {
    const rows = db.prepare(`SELECT DISTINCT o.id, o.agent_id, l.name AS lead_name FROM opp_matches m JOIN opportunities o ON o.id = m.opp_id JOIN leads l ON l.id = o.lead_id
      WHERE m.property_id = ? AND m.status IN ('proposed','liked') AND ${OPEN}`).all(p.id);
    const linked = db.prepare(`SELECT o.id, o.agent_id, l.name AS lead_name FROM opportunities o JOIN leads l ON l.id = o.lead_id WHERE o.property_id = ? AND ${OPEN}`).all(p.id);
    const seen = new Set();
    for (const o of [...rows, ...linked]) {
      if (seen.has(o.id)) continue; seen.add(o.id);
      create(o.agent_id, 'price_drop', `Çmimi u ul: ${p.code}`, `${p.title}: ${match.eur(before)} → ${match.eur(p.price)}. ${o.lead_name} e kishte parë.`, { opp: o.id });
    }
  }
  if (before !== p.price) db.prepare('UPDATE properties SET last_public_price = ? WHERE id = ?').run(p.price, p.id);
}

/* ---------- prona e dyfishtë ---------- */
const normAddr = a => match.norm(a).replace(/\b(rruga|rr|nr|pallati|pall|shkalla|sh|ap|kati)\b/g, '').replace(/\s+/g, ' ').trim();
function distanceM(a, b) {
  const R = 6371000, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2));
}
function dupesFor(p) {
  const near = (x, y) => (!x || !y) || Math.abs(x - y) / Math.max(x, y) <= 0.10;
  const rows = db.prepare("SELECT p.id, p.code, p.title, p.address, p.lat, p.lng, p.area, p.rooms, p.agent_id, a.name AS agent_name FROM properties p LEFT JOIN agents a ON a.id = p.agent_id WHERE p.id != ? AND p.city = ? AND p.deal = ? AND p.type = ? AND p.status != 'sold' AND p.status != 'rented'").all(p.id || 0, p.city, p.deal, p.type);
  const addr = normAddr(p.address);
  return rows.filter(x => {
    if (!near(x.area, p.area) || (x.rooms && p.rooms && x.rooms !== p.rooms)) return false;
    if (addr.length >= 6 && normAddr(x.address) === addr) return true;
    return p.lat != null && p.lng != null && x.lat != null && x.lng != null && distanceM(p, x) <= 40;
  }).map(x => ({ id: x.id, code: x.code, title: x.title, agent_name: x.agent_name }));
}
function checkDuplicate(propertyId) {
  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId); if (!p) return [];
  const d = dupesFor(p);
  if (d.length) create(null, 'duplicate', `Mund të jetë pronë e dyfishtë: ${p.code}`, `${p.title} (${agentName(p.agent_id)}) ngjan me ${d.map(x => `${x.code}${x.agent_name ? ' të ' + x.agent_name : ''}`).join(', ')}.`, { prop: p.id });
  return d;
}

/* ---------- kujtuesit (çdo minutë) ---------- */
// Klientët aktivë që nuk janë kontaktuar prej disa ditësh (telefonatë, WhatsApp, email, vizitë, takim ose shënim nga agjenti)
const CONTACT_TYPES = "('call','whatsapp','email','visit','meeting','note')";
const followupDays = () => Math.min(60, Math.max(1, Number(db.prepare("SELECT value FROM settings WHERE key = 'followup_days'").get()?.value) || 7));
const lastContactSql = `COALESCE((SELECT MAX(ac.created_at) FROM activities ac WHERE ac.lead_id = l.id AND ac.user_id IS NOT NULL AND ac.type IN ${CONTACT_TYPES}), l.created_at)`;
function staleLeads(agentId, admin, limit = 30) {
  const days = followupDays();
  return db.prepare(`SELECT l.id, l.name, l.phone, l.agent_id, (SELECT name FROM agents WHERE id = l.agent_id) AS agent_name, ${lastContactSql} AS last_contact,
      CAST(julianday('now') - julianday(${lastContactSql}) AS INTEGER) AS days
    FROM leads l WHERE l.status = 'active' AND ${lastContactSql} < datetime('now', ?) ${admin ? '' : 'AND l.agent_id = ?'}
    ORDER BY last_contact LIMIT ?`).all(`-${days} days`, ...(admin ? [] : [agentId]), limit);
}
let lastFollowupRun = 0;
function followups() {
  if (Date.now() - lastFollowupRun < 30 * 60 * 1000) return; // mjafton dy herë në orë
  lastFollowupRun = Date.now();
  const days = followupDays();
  const rows = db.prepare(`SELECT l.id, l.name, l.agent_id, ${lastContactSql} AS last_contact FROM leads l
    WHERE l.status = 'active' AND ${lastContactSql} < datetime('now', ?) AND (l.followup_notified_at IS NULL OR l.followup_notified_at < ${lastContactSql})`).all(`-${days} days`);
  for (const l of rows) {
    db.prepare("UPDATE leads SET followup_notified_at = datetime('now') WHERE id = ?").run(l.id);
    const d = Math.floor((Date.now() - new Date(l.last_contact.replace(' ', 'T') + 'Z').getTime()) / 864e5);
    create(l.agent_id, 'followup', `${l.name}: pa kontakt prej ${d} ditësh`, 'Një telefonatë ose një mesazh e mban klientin të ngrohtë.', { lead: l.id });
  }
}

function tick() {
  try { followups(); } catch (e) { console.error('Kujtuesi:', e); }
  const now = localNow(), soon = localNow(60);
  const visits = db.prepare("SELECT v.*, p.code, p.title, p.agent_id AS p_agent, l.name AS lead_name FROM visits v LEFT JOIN properties p ON p.id = v.property_id LEFT JOIN leads l ON l.id = v.lead_id WHERE v.status = 'planned' AND v.reminded = 0 AND v.starts_at > ? AND v.starts_at <= ?").all(now, soon);
  for (const v of visits) {
    db.prepare('UPDATE visits SET reminded = 1 WHERE id = ?').run(v.id);
    const at = v.starts_at.slice(11);
    create(v.agent_id, 'visit_soon', `Vizitë në ${at}`, `${v.lead_name || 'Klient'} · ${v.code ? label(v) : 'pa pronë'}`, { visit: v.id });
    if (v.p_agent && v.p_agent !== v.agent_id) create(v.p_agent, 'visit_soon', `Vizitë te prona jote në ${at}`, `${agentName(v.agent_id)} vjen me një klient te ${v.code}.`, { visit: v.id });
  }
  const limit = localNow(14 * 24 * 60).slice(0, 10);
  const docs = db.prepare("SELECT d.*, p.code, p.agent_id FROM property_docs d JOIN properties p ON p.id = d.property_id WHERE d.expires_at != '' AND d.expires_at <= ? AND d.expiry_notified = 0").all(limit);
  for (const d of docs) {
    db.prepare('UPDATE property_docs SET expiry_notified = 1 WHERE id = ?').run(d.id);
    const past = d.expires_at < now.slice(0, 10);
    create(d.agent_id, 'doc_expiry', `${past ? 'Ka skaduar' : 'Skadon së shpejti'}: ${d.name}`, `${d.code} · ${past ? 'skadoi' : 'skadon'} më ${d.expires_at.split('-').reverse().join('.')}`, { prop: d.property_id, tab: 'docs' });
  }
}

module.exports = { staleLeads, followupDays, followups, CONTACT_TYPES, create, publicKey, propertyLive, oppChanged, priceCheck, dupesFor, checkDuplicate, tick, localNow, NOTIFY_SCORE };
