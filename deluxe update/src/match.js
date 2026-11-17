// Match-i: lidh kërkesat e klientëve (opportunitetet) me pronat e gjithë agjencisë – në të dy drejtimet.
//   klient → prona:  matchesForOpp()     “këto prona i përshtaten këtij klienti”
//   pronë → klientë: demandsForProperty() “këta klientë presin një pronë të tillë”
const { db } = require('./db');

const OPEN = "o.stage NOT IN ('won','lost')";
const MIN_SCORE = 45;   // nën këtë përqindje prona nuk shfaqet fare
const NEW_SCORE = 60;   // mbi këtë përqindje një pronë e re njoftohet te “Për sot”
const WEIGHTS = { price: 35, zone: 25, rooms: 20, area: 10, furnished: 5, parking: 5 };

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// “Bllok” dhe “Blloku” janë e njëjta lagje
const sameZone = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)))); };
const eur = n => Number(n || 0).toLocaleString('de-DE') + ' €';
const zonesOf = v => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };

// Kërkesat e klientit nga rreshti i opportunity-së
function criteriaOf(o) {
  return {
    deal: o.deal === 'qira' ? 'qira' : 'shitje', type: o.c_type || '', city: o.c_city || '', zones: zonesOf(o.c_zones),
    price_min: o.c_price_min || 0, price_max: o.c_price_max || 0, rooms: o.c_rooms || 0, area_min: o.c_area_min || 0,
    furnished: !!o.c_furnished, parking: !!o.c_parking
  };
}
// Kur klienti pyet për një pronë konkrete, kërkesat nisen nga ajo pronë (që t’i dalin edhe të ngjashmet)
function criteriaFromProperty(p) {
  return { deal: p.deal, c_type: p.type, c_city: p.city, c_zones: JSON.stringify(p.zone ? [p.zone] : []), c_price_min: null, c_price_max: Math.round(p.price * 1.1), c_rooms: p.rooms || null, c_area_min: null, c_furnished: 0, c_parking: 0 };
}
const hasCriteria = c => !!(c.type || c.city || c.zones.length || c.price_max || c.price_min || c.rooms || c.area_min || c.furnished || c.parking);

// Sa i përshtatet prona p kërkesave c: null = nuk përputhet fare, përndryshe { score 0–100, reasons }
function score(c, p) {
  if (p.deal !== c.deal) return null;
  if (c.type && p.type !== c.type) return null;
  if (c.city && norm(p.city) !== norm(c.city)) return null;
  const parts = [];
  const add = (key, f, t) => parts.push({ w: WEIGHTS[key], f, t });

  if (c.price_max) {
    if (p.price <= c.price_max) {
      if (c.price_min && p.price < c.price_min * 0.7) add('price', 0.5, 'Shumë nën buxhet');
      else add('price', 1, 'Brenda buxhetit');
    } else {
      const over = (p.price - c.price_max) / c.price_max;
      if (over > 0.10) return null;                       // më shumë se 10% mbi buxhet: nuk propozohet
      add('price', 0.7 - over * 4, `${Math.max(1, Math.round(over * 100))}% mbi buxhet`);
    }
  } else if (c.price_min) add('price', p.price >= c.price_min * 0.7 ? 1 : 0.5, p.price >= c.price_min * 0.7 ? 'Brenda buxhetit' : 'Shumë nën buxhet');

  if (c.zones.length) {
    const hit = c.zones.find(z => sameZone(z, p.zone));
    add('zone', hit ? 1 : 0, hit ? `Lagjja: ${p.zone}` : `Lagje tjetër${p.zone ? ': ' + p.zone : ''}`);
  }
  if (c.rooms) {
    const d = (p.rooms || 0) - c.rooms;
    if (!p.rooms) add('rooms', 0.4, 'Dhomat nuk dihen');
    else if (d === 0) add('rooms', 1, `${p.rooms}+1 siç kërkohet`);
    else if (d > 0) add('rooms', 0.75, `${d} dhomë më shumë`);
    else if (d === -1) add('rooms', 0.35, '1 dhomë më pak');
    else return null;
  }
  if (c.area_min) {
    if (!p.area) add('area', 0.4, 'Sipërfaqja nuk dihet');
    else if (p.area >= c.area_min) add('area', 1, `${p.area} m²`);
    else if (p.area >= c.area_min * 0.9) add('area', 0.5, `${p.area} m² – pak më e vogël`);
    else add('area', 0, `${p.area} m² – më e vogël`);
  }
  if (c.furnished) add('furnished', p.furnished ? 1 : 0, p.furnished ? 'E mobiluar' : 'Pa mobilim');
  if (c.parking) add('parking', p.parking > 0 ? 1 : 0, p.parking > 0 ? 'Me parkim' : 'Pa parkim');

  const total = parts.reduce((t, x) => t + x.w, 0);
  const pct = total ? Math.round(parts.reduce((t, x) => t + x.w * x.f, 0) / total * 100) : 100;
  return { score: pct, reasons: parts.map(x => ({ s: x.f >= 0.99 ? 'ok' : x.f > 0 ? 'part' : 'no', t: x.t })) };
}

const PROP_COLS = `p.id, p.code, p.title, p.deal, p.type, p.city, p.zone, p.price, p.area, p.rooms, p.furnished, p.parking, p.images, p.status, p.approval, p.agent_id,
  COALESCE(p.published_at, p.created_at) AS live_at, a.name AS agent_name, a.phone AS agent_phone`;
const liveProps = () => db.prepare(`SELECT ${PROP_COLS} FROM properties p LEFT JOIN agents a ON a.id = p.agent_id WHERE p.status = 'active' AND p.approval = 'approved'`).all();
function propView(p) {
  let image = null; try { image = JSON.parse(p.images || '[]')[0] || null; } catch {}
  const { images, ...rest } = p;
  return { ...rest, image, furnished: !!p.furnished };
}

// Pronat që i përshtaten një kërkese. states = { property_id: 'proposed' | 'liked' | 'dismissed' }
function matchesFor(c, { states = {}, linkedId = null, seenAt = null, limit = 30 } = {}) {
  const out = [];
  for (const p of liveProps()) {
    const m = score(c, p);
    const state = states[p.id] || null;
    if (!m || (m.score < MIN_SCORE && !state && p.id !== linkedId)) continue;
    out.push({ ...propView(p), ...m, state, linked: p.id === linkedId, is_new: !!seenAt && !state && p.live_at > seenAt && m.score >= NEW_SCORE });
  }
  out.sort((a, b) => (b.linked - a.linked) || (b.score - a.score) || (a.live_at < b.live_at ? 1 : -1));
  return out.slice(0, limit);
}
const statesOf = oppId => Object.fromEntries(db.prepare('SELECT property_id, status FROM opp_matches WHERE opp_id = ?').all(oppId).map(r => [r.property_id, r.status]));
const matchesForOpp = o => matchesFor(criteriaOf(o), { states: statesOf(o.id), linkedId: o.property_id, seenAt: o.matches_seen_at || o.created_at });

// Numrat për kartat e kanban-it dhe për “Për sot”: sa prona përputhen dhe sa janë të reja
function countsForOpps(opps) {
  const demand = opps.filter(o => o.side !== 'supply' && !['won', 'lost'].includes(o.stage));
  if (!demand.length) return {};
  const props = liveProps(), out = {};
  const st = db.prepare(`SELECT opp_id, property_id FROM opp_matches WHERE opp_id IN (${demand.map(() => '?').join(',')})`).all(...demand.map(o => o.id));
  const touched = new Set(st.map(r => r.opp_id + ':' + r.property_id));
  for (const o of demand) {
    const c = criteriaOf(o);
    if (!hasCriteria(c)) { out[o.id] = { n: 0, fresh: 0, top: null }; continue; }
    const seen = o.matches_seen_at || o.created_at;
    let n = 0, fresh = 0, top = null;
    for (const p of props) {
      if (p.id === o.property_id || touched.has(o.id + ':' + p.id)) continue;
      const m = score(c, p);
      if (!m || m.score < MIN_SCORE) continue;
      n++;
      if (m.score >= NEW_SCORE && p.live_at > seen) { fresh++; if (!top || m.score > top.score) top = { id: p.id, code: p.code, title: p.title, score: m.score }; }
    }
    out[o.id] = { n, fresh, top };
  }
  return out;
}

// Klientët (kërkesat e hapura) që presin një pronë si kjo – nga gjithë agjencia
function demandsForProperty(p) {
  const rows = db.prepare(`SELECT o.*, l.name AS lead_name, l.phone AS lead_phone, l.client_type, a.name AS agent_name, a.phone AS agent_phone,
      (SELECT status FROM opp_matches m WHERE m.opp_id = o.id AND m.property_id = ?) AS state
    FROM opportunities o JOIN leads l ON l.id = o.lead_id LEFT JOIN agents a ON a.id = o.agent_id
    WHERE ${OPEN} AND o.side = 'demand' AND l.status != 'closed'`).all(p.id);
  const out = [];
  for (const o of rows) {
    if (o.state === 'dismissed') continue;
    const c = criteriaOf(o);
    if (!hasCriteria(c)) continue;
    const m = score(c, p);
    if (!m || m.score < MIN_SCORE) continue;
    out.push({ opp_id: o.id, lead_id: o.lead_id, title: o.title, stage: o.stage, agent_id: o.agent_id, agent_name: o.agent_name, agent_phone: o.agent_phone,
      lead_name: o.lead_name, lead_phone: o.lead_phone, client_type: o.client_type, criteria: c, state: o.state || null, linked: o.property_id === p.id, ...m });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 40);
}
function demandCounts(props) {
  const opps = db.prepare(`SELECT o.* FROM opportunities o JOIN leads l ON l.id = o.lead_id WHERE ${OPEN} AND o.side = 'demand' AND l.status != 'closed'`).all()
    .map(o => ({ id: o.id, c: criteriaOf(o) })).filter(o => hasCriteria(o.c));
  const dismissed = new Set(db.prepare("SELECT opp_id, property_id FROM opp_matches WHERE status = 'dismissed'").all().map(r => r.opp_id + ':' + r.property_id));
  const out = {};
  for (const p of props) {
    if (p.status !== 'active') { out[p.id] = 0; continue; }
    out[p.id] = opps.reduce((n, o) => { if (dismissed.has(o.id + ':' + p.id)) return n; const m = score(o.c, p); return n + (m && m.score >= MIN_SCORE ? 1 : 0); }, 0);
  }
  return out;
}

module.exports = { score, criteriaOf, criteriaFromProperty, hasCriteria, matchesFor, matchesForOpp, statesOf, countsForOpps, demandsForProperty, demandCounts, norm, eur, MIN_SCORE, NEW_SCORE };
