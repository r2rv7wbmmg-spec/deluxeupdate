// De Luxe Real Estate – serveri HTTP, API dhe skedarët statikë (pa varësi të jashtme)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { db, hashPassword, verifyPassword } = require('./db');
const config = require('./config');
const chat = require('./chat');
const crm = require('./crm');
const match = require('./match');
const notify = require('./notify');
const extras = require('./extras');
const offices = require('./offices');
const { ZONES } = require('./zones');

// Të dhënat shembull ngarkohen vetëm kur kërkohen me SEED_DEMO=1; faqja nis bosh
if (process.env.SEED_DEMO === '1' && db.prepare('SELECT COUNT(*) AS n FROM properties').get().n === 0) require('./seed');

const PUBLIC = path.join(__dirname, '..', 'public');
const UPLOADS = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const MIME = { '.webmanifest': 'application/manifest+json', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const TYPES = ['Apartament', 'Vilë', 'Zyrë', 'Dyqan', 'Tokë'];
const SORTS = { newest: 'created_at DESC', price_asc: 'price ASC', price_desc: 'price DESC', area_desc: 'area DESC', popular: 'views DESC' };

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

/* ---------- ndihmës ---------- */
// Kokat e sigurisë për çdo përgjigje
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
const wantsGzip = req => /\bgzip\b/.test(req?.headers?.['accept-encoding'] || '');
function send(res, status, data, headers = {}, req = null) {
  let body = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
  const h = { 'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', ...SECURITY, ...headers };
  if (typeof data !== 'string') h['Cache-Control'] = h['Cache-Control'] || 'no-store';
  if (body.length > 1024 && wantsGzip(req)) { body = zlib.gzipSync(body); h['Content-Encoding'] = 'gzip'; h.Vary = 'Accept-Encoding'; }
  res.writeHead(status, h);
  res.end(req?.method === 'HEAD' ? undefined : body);
}
function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    // Kërkesat që ndryshojnë të dhëna pranohen vetëm si JSON (mbrojtje nga formularët e faqeve të tjera)
    if (req.headers['content-length'] !== '0' && req.headers['content-type'] && !/^application\/json\b/i.test(req.headers['content-type'])) return reject(new HttpError(415, 'Të dhëna të pavlefshme.'));
    req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Skedari është shumë i madh.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Të dhëna të pavlefshme.')); }
    });
    req.on('error', reject);
  });
}
const safeDecode = v => { try { return decodeURIComponent(v); } catch { return ''; } };
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, safeDecode(v.join('='))]));
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const int = (v, def = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; };
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function hydrate(p) {
  if (!p) return p;
  return { ...p, features: JSON.parse(p.features || '[]'), images: JSON.parse(p.images || '[]'), furnished: !!p.furnished, featured: !!p.featured };
}

// Kufizim i thjeshtë kërkesash për formularët publikë
const hits = new Map();
// Adresa e vizitorit: pas një proxy-je (Render, Railway, Nginx) merret hyrja e fundit e X-Forwarded-For, të cilën e shkruan
// vetë proxy-ja; hyrjet e para i dërgon vizitori dhe mund të jenë të rreme.
function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean);
  return (process.env.TRUST_PROXY === '0' ? '' : xff[xff.length - 1]) || req.socket.remoteAddress || '';
}
function limitKey(id, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(id) || []).filter(t => now - t < windowMs);
  if (list.length >= max) throw new HttpError(429, 'Keni dërguar shumë kërkesa. Provoni sërish pas pak minutash.');
  list.push(now); hits.set(id, list);
}
const rateLimit = (req, key, max = 8, windowMs = 10 * 60 * 1000) => limitKey(key + clientIp(req), max, windowMs);
// Pastrim periodik, që lista të mos rritet pa fund
setInterval(() => { const now = Date.now(); for (const [k, l] of hits) if (!l.some(t => now - t < 15 * 60 * 1000)) hits.delete(k); }, 10 * 60 * 1000).unref();

/* ---------- autentikimi ---------- */
function currentUser(req) {
  const token = cookies(req).sid;
  if (!token) return null;
  const row = db.prepare('SELECT u.id, u.username, u.role, u.agent_id, u.active, u.must_change, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token);
  if (!row || row.expires_at < Date.now() || !row.active) return null;
  if (row.role === 'agent' && !row.agent_id) return null;
  return row;
}
// Çdo përdorues i hyrë (administrator ose agjent)
function requireStaff(req, allowPending = false) {
  const u = currentUser(req);
  if (!u) throw new HttpError(401, 'Ju lutem hyni në panel.');
  // Me fjalëkalimin fillestar lejohet vetëm ndryshimi i fjalëkalimit
  if (u.must_change && !allowPending) throw new HttpError(403, 'Vendosni fillimisht një fjalëkalim të ri te “Llogaria”.');
  return u;
}
// Vetëm administratori
function requireAdmin(req) {
  const u = requireStaff(req);
  if (u.role !== 'admin') throw new HttpError(403, 'Kjo pjesë është vetëm për administratorin.');
  return u;
}
const isAdmin = u => u.role === 'admin';
// Agjenti mund të prekë vetëm pronat e veta
function ownProperty(u, id) {
  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  if (!p) throw new HttpError(404, 'Prona nuk u gjet.');
  if (!isAdmin(u) && p.agent_id !== u.agent_id) throw new HttpError(403, 'Kjo pronë nuk është e juaja.');
  return p;
}

/* ---------- validimi i pronës ---------- */
function propertyInput(b) {
  const p = {
    title: str(b.title, 160), description: str(b.description, 5000), deal: b.deal === 'qira' ? 'qira' : 'shitje',
    type: TYPES.includes(b.type) ? b.type : null, city: str(b.city, 60), zone: str(b.zone, 80), address: str(b.address, 160),
    price: Math.max(0, int(b.price)), area: Math.max(0, int(b.area)), rooms: Math.max(0, int(b.rooms)), bathrooms: Math.max(0, int(b.bathrooms)),
    floor: str(b.floor, 20), year_built: b.year_built ? int(b.year_built, null) : null, furnished: b.furnished ? 1 : 0, parking: Math.max(0, int(b.parking)),
    features: JSON.stringify((Array.isArray(b.features) ? b.features : String(b.features || '').split(',')).map(f => str(f, 60)).filter(Boolean).slice(0, 30)),
    images: JSON.stringify((Array.isArray(b.images) ? b.images : []).map(i => str(i, 600)).filter(i => /^(\/uploads\/|https?:\/\/)/.test(i)).slice(0, 20)),
    lat: num(b.lat), lng: num(b.lng), featured: b.featured ? 1 : 0,
    status: ['active', 'sold', 'rented', 'hidden'].includes(b.status) ? b.status : 'active',
    agent_id: b.agent_id ? int(b.agent_id, null) : null
  };
  if (p.agent_id && !db.prepare('SELECT 1 FROM agents WHERE id = ?').get(p.agent_id)) throw new HttpError(400, 'Agjenti i zgjedhur nuk ekziston.');
  if (!p.title) throw new HttpError(400, 'Titulli është i detyrueshëm.');
  if (!p.type) throw new HttpError(400, 'Zgjidhni llojin e pronës.');
  if (!p.city) throw new HttpError(400, 'Qyteti është i detyrueshëm.');
  if (!p.price) throw new HttpError(400, 'Vendosni çmimin.');
  return p;
}

/* ---------- kartela e pronarit: private (vetëm agjenti listues dhe administratori) ---------- */
function ownerInput(b) {
  if (!b || typeof b !== 'object') return null;
  return {
    owner_name: str(b.owner_name, 120), owner_phone: str(b.owner_phone, 40), owner_email: str(b.owner_email, 120),
    commission_terms: str(b.commission_terms, 200), exclusive: b.exclusive && b.exclusive !== 'false' && b.exclusive !== '0' ? 1 : 0,
    exclusive_until: /^\d{4}-\d{2}-\d{2}$/.test(b.exclusive_until || '') ? b.exclusive_until : '', owner_notes: str(b.owner_notes, 2000)
  };
}
function saveOwner(id, o) {
  if (!o) return;
  db.prepare(`INSERT INTO property_private (property_id, owner_name, owner_phone, owner_email, commission_terms, exclusive, exclusive_until, owner_notes) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(property_id) DO UPDATE SET owner_name = excluded.owner_name, owner_phone = excluded.owner_phone, owner_email = excluded.owner_email, commission_terms = excluded.commission_terms,
    exclusive = excluded.exclusive, exclusive_until = excluded.exclusive_until, owner_notes = excluded.owner_notes`).run(id, o.owner_name, o.owner_phone, o.owner_email, o.commission_terms, o.exclusive, o.exclusive_until, o.owner_notes);
}
// Pas çdo ndryshimi: prona e dalë në faqe njofton klientët që e presin dhe kontrollon uljen e çmimit
function afterLive(id) { try { notify.priceCheck(id); notify.propertyLive(id); } catch (e) { console.error('Njoftimet:', e); } }

/* ---------- cilësimet e faqes (foto kryesore, tekstet e hyrjes) ---------- */
const SETTING_KEYS = ['hero_image', 'hero_property_id', 'hero_title', 'hero_text'];
function getSettings() {
  const out = Object.fromEntries(SETTING_KEYS.map(k => [k, '']));
  for (const r of db.prepare('SELECT key, value FROM settings').all()) if (SETTING_KEYS.includes(r.key)) out[r.key] = r.value;
  if (out.hero_property_id) {
    const p = db.prepare("SELECT id, title, city, zone, price, deal, images FROM properties WHERE id = ? AND status = 'active' AND approval = 'approved'").get(Number(out.hero_property_id));
    out.hero_property = p ? { ...p, images: JSON.parse(p.images || '[]') } : null;
  }
  return out;
}

/* ---------- rrugët e API-t ---------- */
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), handler });

// Publike
route('GET', '/api/meta', () => {
  const LIVE = "status='active' AND approval='approved'";
  const cities = db.prepare(`SELECT city, COUNT(*) AS count FROM properties WHERE ${LIVE} GROUP BY city ORDER BY count DESC`).all();
  const types = db.prepare(`SELECT type, COUNT(*) AS count FROM properties WHERE ${LIVE} GROUP BY type`).all();
  const totals = db.prepare(`SELECT COUNT(*) AS active, SUM(deal='shitje') AS sale, SUM(deal='qira') AS rent FROM properties WHERE ${LIVE}`).get();
  const closed = db.prepare("SELECT COUNT(*) AS n FROM properties WHERE status IN ('sold','rented') AND approval='approved'").get().n;
  return { site: config.site, cities, types, totals: { ...totals, closed }, allTypes: TYPES, zones: ZONES, settings: getSettings() };
});

route('GET', '/api/properties', ({ query }) => {
  const where = ["status = 'active'", "approval = 'approved'"], params = [];
  const q = Object.fromEntries(query);
  if (q.ids) {
    const ids = q.ids.split(',').map(Number).filter(Boolean).slice(0, 100);
    if (!ids.length) return { items: [], total: 0, page: 1, pages: 1 };
    where.push(`id IN (${ids.map(() => '?').join(',')})`); params.push(...ids);
  }
  if (q.deal === 'shitje' || q.deal === 'qira') { where.push('deal = ?'); params.push(q.deal); }
  if (q.city) { where.push('city = ?'); params.push(q.city); }
  if (q.zone) { where.push('zone = ?'); params.push(str(q.zone, 80)); }
  if (q.type && TYPES.includes(q.type)) { where.push('type = ?'); params.push(q.type); }
  if (q.min) { where.push('price >= ?'); params.push(int(q.min)); }
  if (q.max) { where.push('price <= ?'); params.push(int(q.max)); }
  if (q.rooms) { where.push('rooms >= ?'); params.push(int(q.rooms)); }
  if (q.minArea) { where.push('area >= ?'); params.push(int(q.minArea)); }
  if (q.furnished === '1') where.push('furnished = 1');
  if (q.parking === '1') where.push('parking > 0');
  if (q.featured === '1') where.push('featured = 1');
  if (q.exclude) { where.push('id != ?'); params.push(int(q.exclude)); }
  if (q.q) { where.push('(title LIKE ? OR zone LIKE ? OR city LIKE ? OR code LIKE ? OR address LIKE ?)'); const like = `%${str(q.q, 80)}%`; params.push(like, like, like, like, like); }
  const order = SORTS[q.sort] || 'featured DESC, created_at DESC';
  const limit = Math.min(48, Math.max(1, int(q.limit, 12)));
  const total = db.prepare(`SELECT COUNT(*) AS n FROM properties WHERE ${where.join(' AND ')}`).get(...params).n;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pages, Math.max(1, int(q.page, 1)));
  const items = db.prepare(`SELECT * FROM properties WHERE ${where.join(' AND ')} ORDER BY ${order}, id DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit).map(hydrate);
  return { items, total, page, pages };
});

route('GET', '/api/properties/:id', ({ params, req }) => {
  const id = int(params.id);
  const staff = currentUser(req);
  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  // Stafi sheh edhe pronat në pritje (parapamje); vizitorët vetëm ato të miratuara
  const visible = p && (staff ? (isAdmin(staff) || p.agent_id === staff.agent_id || (p.approval === 'approved' && p.status !== 'hidden')) : (p.approval === 'approved' && p.status !== 'hidden'));
  if (!visible) throw new HttpError(404, 'Prona nuk u gjet ose nuk është më në ofertë.');
  if (!staff) db.prepare('UPDATE properties SET views = views + 1 WHERE id = ?').run(id);
  const agent = p.agent_id ? db.prepare('SELECT id, name, role, phone, email, photo FROM agents WHERE id = ?').get(p.agent_id) : null;
  return { ...hydrate(p), agent };
});

route('GET', '/api/agents', () => db.prepare('SELECT a.id, a.name, a.role, a.phone, a.email, a.photo, a.bio, a.level, (SELECT COUNT(*) FROM properties p WHERE p.agent_id = a.id AND p.status = \'active\' AND p.approval = \'approved\') AS listings FROM agents a ORDER BY a.level DESC, a.id').all());

route('POST', '/api/inquiries', async ({ req }) => {
  rateLimit(req, 'inq');
  const b = await readBody(req);
  if (b.website) return { ok: true }; // fushë kurth për spam
  const kind = ['contact', 'property', 'visit', 'valuation'].includes(b.kind) ? b.kind : 'contact';
  const name = str(b.name, 100), phone = str(b.phone, 40), email = str(b.email, 120), message = str(b.message, 2000);
  if (!name) throw new HttpError(400, 'Shkruani emrin tuaj.');
  if (!phone && !email) throw new HttpError(400, 'Lini një numër telefoni ose email që t’ju kontaktojmë.');
  if (email && !isEmail(email)) throw new HttpError(400, 'Adresa e email-it nuk duket e saktë.');
  if (phone && phone.replace(/\D/g, '').length < 7) throw new HttpError(400, 'Numri i telefonit duket i paplotë.');
  const pid = b.property_id ? int(b.property_id, null) : null;
  if (pid && !db.prepare("SELECT 1 FROM properties WHERE id = ? AND approval = 'approved'").get(pid)) throw new HttpError(400, 'Prona nuk ekziston.');
  const r = db.prepare('INSERT INTO inquiries (kind, name, phone, email, message, property_id) VALUES (?,?,?,?,?,?)').run(kind, name, phone, email, message, pid);
  try { crm.fromInquiry(Number(r.lastInsertRowid)); } catch (e) { console.error('CRM:', e); } // kërkesa ruhet edhe nëse CRM dështon
  return { ok: true, message: 'Faleminderit! Një agjent do t’ju kontaktojë së shpejti.' };
});

route('POST', '/api/subscribe', async ({ req }) => {
  rateLimit(req, 'sub', 5);
  const email = str((await readBody(req)).email, 120).toLowerCase();
  if (!isEmail(email)) throw new HttpError(400, 'Shkruani një email të vlefshëm.');
  const exists = db.prepare('SELECT 1 FROM subscribers WHERE email = ?').get(email);
  if (!exists) db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(email);
  return { ok: true, message: exists ? 'Jeni tashmë në listë – faleminderit!' : 'U regjistruat. Do t’ju dërgojmë pronat e reja.' };
});

route('POST', '/api/chat', async ({ req }) => {
  rateLimit(req, 'chat', 60, 5 * 60 * 1000);
  const b = await readBody(req, 5000);
  return chat.answer(str(b.message, 400));
});
route('GET', '/api/chat/quick', () => ({ quick: chat.QUICK }));

// Administrimi
route('POST', '/api/admin/login', async ({ req, res }) => {
  rateLimit(req, 'login', 10, 15 * 60 * 1000);
  const b = await readBody(req);
  limitKey('login-user:' + str(b.username, 60).toLowerCase(), 15, 15 * 60 * 1000); // edhe për çdo përdorues, pavarësisht nga vjen
  const u = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(str(b.username, 60));
  if (!u || !verifyPassword(str(b.password, 200), u.password_hash, u.salt)) throw new HttpError(401, 'Përdoruesi ose fjalëkalimi është i gabuar.');
  if (!u.active || (u.role === 'agent' && !u.agent_id)) throw new HttpError(403, 'Llogaria juaj është çaktivizuar. Kontaktoni administratorin.');
  const token = crypto.randomBytes(32).toString('hex');
  const maxAge = 7 * 24 * 3600;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, u.id, Date.now() + maxAge * 1000);
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  return { ok: true, ...me(u) };
});
function me(u) {
  const agent = u.agent_id ? db.prepare('SELECT id, name FROM agents WHERE id = ?').get(u.agent_id) : null;
  const office = u.agent_id ? offices.officeOfAgent(u.agent_id) : null;
  const broker = offices.brokerOffice(u);
  return { username: u.username, role: u.role, agent, must_change: !!u.must_change, office: office && { id: office.id, name: office.name, code: office.code }, broker_of: broker && { id: broker.id, name: broker.name, code: broker.code } };
}
route('POST', '/api/admin/logout', ({ req, res }) => {
  const t = cookies(req).sid; if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  return { ok: true };
});
route('GET', '/api/admin/me', ({ req }) => me(requireStaff(req, true)));
route('POST', '/api/admin/password', async ({ req }) => {
  const u = requireStaff(req, true), b = await readBody(req);
  limitKey('pw:' + u.id, 10, 15 * 60 * 1000);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  if (!verifyPassword(str(b.current, 200), row.password_hash, row.salt)) throw new HttpError(400, 'Fjalëkalimi aktual është i gabuar.');
  if (str(b.next, 200).length < 8) throw new HttpError(400, 'Fjalëkalimi i ri duhet të ketë të paktën 8 karaktere.');
  if (str(b.next, 200) === str(b.current, 200)) throw new HttpError(400, 'Fjalëkalimi i ri duhet të jetë i ndryshëm nga i vjetri.');
  const { hash, salt } = hashPassword(str(b.next, 200));
  db.prepare('UPDATE users SET password_hash = ?, salt = ?, must_change = 0 WHERE id = ?').run(hash, salt, u.id);
  // Pajisjet e tjera ku ishte hyrë me fjalëkalimin e vjetër nxirren nga paneli
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(u.id, cookies(req).sid || '');
  return { ok: true, message: 'Fjalëkalimi u ndryshua.' };
});

route('GET', '/api/admin/stats', ({ req }) => {
  const u = requireStaff(req), admin = isAdmin(u);
  const pw = admin ? '1=1' : 'agent_id = ?', pp = admin ? [] : [u.agent_id];
  const iw = admin ? '1=1' : 'p.agent_id = ?';
  const s = db.prepare(`SELECT COUNT(*) AS total, SUM(status='active' AND approval='approved') AS active, SUM(status='sold') AS sold, SUM(status='rented') AS rented, SUM(views) AS views, SUM(approval='pending') AS pending, SUM(approval='rejected') AS rejected FROM properties WHERE ${pw}`).get(...pp);
  const inq = db.prepare(`SELECT COUNT(*) AS total, SUM(i.status='new') AS new FROM inquiries i LEFT JOIN properties p ON p.id = i.property_id WHERE ${iw}`).get(...pp);
  const subs = admin ? db.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n : null;
  const top = db.prepare(`SELECT id, code, title, views FROM properties WHERE ${pw} ORDER BY views DESC LIMIT 5`).all(...pp);
  const recent = db.prepare(`SELECT i.*, p.title AS property_title, p.code AS property_code FROM inquiries i LEFT JOIN properties p ON p.id = i.property_id WHERE ${iw} ORDER BY i.created_at DESC, i.id DESC LIMIT 6`).all(...pp);
  return { properties: s, inquiries: inq, subscribers: subs, top, recent };
});

route('GET', '/api/admin/properties', ({ req, query }) => {
  const u = requireStaff(req);
  const q = str(query.get('q'), 80), status = query.get('status'), approval = query.get('approval');
  const where = ['1=1'], params = [];
  if (!isAdmin(u)) { where.push('p.agent_id = ?'); params.push(u.agent_id); }
  if (q) { where.push('(title LIKE ? OR code LIKE ? OR city LIKE ? OR zone LIKE ?)'); params.push(...Array(4).fill(`%${q}%`)); }
  if (['active', 'sold', 'rented', 'hidden'].includes(status)) { where.push('status = ?'); params.push(status); }
  if (['pending', 'approved', 'rejected'].includes(approval)) { where.push('approval = ?'); params.push(approval); }
  const rows = db.prepare(`SELECT p.*, a.name AS agent_name, o.name AS office_name, o.code AS office_code FROM properties p LEFT JOIN agents a ON a.id = p.agent_id LEFT JOIN offices o ON o.id = p.office_id WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC, p.id DESC`).all(...params);
  const buyers = match.demandCounts(rows); // sa klientë presin një pronë si kjo
  const docs = db.prepare('SELECT property_id, GROUP_CONCAT(kind) AS kinds, COUNT(*) AS n FROM property_docs GROUP BY property_id').all();
  const dmap = Object.fromEntries(docs.map(d => [d.property_id, d]));
  return rows.map(p => {
    const d = dmap[p.id], kinds = new Set(String(d?.kinds || '').split(','));
    return { ...hydrate(p), buyers: buyers[p.id] || 0, docs: d?.n || 0, docs_missing: ['certifikata', 'planimetria', 'kontrata'].filter(k => !kinds.has(k)).length,
      dupes: isAdmin(u) && p.status !== 'sold' && p.status !== 'rented' ? notify.dupesFor(p) : [] };
  });
});
const withBuyers = p => ({ ...hydrate(p), buyers: p.approval === 'approved' ? match.demandCounts([p])[p.id] || 0 : 0 });
route('GET', '/api/admin/properties/:id', ({ req, params }) => {
  const u = requireStaff(req), p = ownProperty(u, int(params.id));
  const owner = db.prepare('SELECT * FROM property_private WHERE property_id = ?').get(p.id) || null;
  return { ...hydrate(p), owner, dupes: notify.dupesFor(p) };
});
route('POST', '/api/admin/properties', async ({ req }) => {
  const u = requireStaff(req);
  const body = await readBody(req, 3e6);
  const p = propertyInput(body);
  p.created_by = u.id;
  if (isAdmin(u)) { p.approval = 'approved'; p.published_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
  else { p.agent_id = u.agent_id; p.featured = 0; p.approval = 'pending'; p.review_note = ''; }
  const keys = Object.keys(p);
  const r = db.prepare(`INSERT INTO properties (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(p));
  const id = Number(r.lastInsertRowid);
  // Zyra e pronës: ajo e agjentit (administratori mund të zgjedhë një tjetër); kodi merr shkurtimin e zyrës
  let officeId = isAdmin(u) && body.office_id ? int(body.office_id, null) : null;
  if (!officeId) officeId = offices.officeOfAgent(p.agent_id)?.id ?? null;
  if (officeId && !db.prepare('SELECT 1 FROM offices WHERE id = ?').get(officeId)) officeId = null;
  db.prepare('UPDATE properties SET code = ?, office_id = ? WHERE id = ?').run(offices.codeFor(id, officeId), officeId, id);
  saveOwner(id, ownerInput(body.owner));
  const dupes = notify.checkDuplicate(id);
  if (isAdmin(u)) afterLive(id);
  return { ...withBuyers(db.prepare('SELECT * FROM properties WHERE id = ?').get(id)), dupes };
});
route('PUT', '/api/admin/properties/:id', async ({ req, params }) => {
  const u = requireStaff(req), id = int(params.id);
  const old = ownProperty(u, id);
  const body = await readBody(req, 3e6);
  const p = propertyInput(body);
  // Ndryshimet e agjentit kthehen për miratim; agjenti nuk e ndryshon agjentin ose “të përzgjedhurën”
  if (!isAdmin(u)) { p.agent_id = u.agent_id; p.featured = old.featured; p.approval = 'pending'; p.review_note = ''; }
  db.prepare(`UPDATE properties SET ${Object.keys(p).map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(p), id);
  saveOwner(id, ownerInput(body.owner));
  // Administratori mund t’ia kalojë pronën një zyre tjetër (kodi nuk ndryshon)
  if (isAdmin(u) && 'office_id' in body) { const oid = body.office_id ? int(body.office_id, null) : null; if (!oid || db.prepare('SELECT 1 FROM offices WHERE id = ?').get(oid)) db.prepare('UPDATE properties SET office_id = ? WHERE id = ?').run(oid, id); }
  if (isAdmin(u)) { if (p.address !== old.address || p.lat !== old.lat || p.lng !== old.lng) notify.checkDuplicate(id); afterLive(id); }
  return hydrate(db.prepare('SELECT * FROM properties WHERE id = ?').get(id));
});
route('PATCH', '/api/admin/properties/:id', async ({ req, params }) => {
  const u = requireStaff(req), b = await readBody(req), id = int(params.id);
  ownProperty(u, id);
  if (('featured' in b || 'approval' in b) && !isAdmin(u)) throw new HttpError(403, 'Vetëm administratori mund ta bëjë këtë.');
  if ('featured' in b) db.prepare("UPDATE properties SET featured = ?, updated_at = datetime('now') WHERE id = ?").run(b.featured ? 1 : 0, id);
  if (['approved', 'rejected', 'pending'].includes(b.approval)) db.prepare("UPDATE properties SET approval = ?, review_note = ?, published_at = CASE WHEN ? = 'approved' THEN COALESCE(published_at, datetime('now')) ELSE published_at END, updated_at = datetime('now') WHERE id = ?").run(b.approval, b.approval === 'rejected' ? str(b.review_note, 500) : '', b.approval, id);
  if (['active', 'sold', 'rented', 'hidden'].includes(b.status)) db.prepare("UPDATE properties SET status = ?, updated_at = datetime('now') WHERE id = ?").run(b.status, id);
  if (b.approval === 'approved' || b.status === 'active') afterLive(id);
  return withBuyers(db.prepare('SELECT * FROM properties WHERE id = ?').get(id));
});
route('DELETE', '/api/admin/properties/:id', ({ req, params }) => {
  const u = requireStaff(req);
  const p = ownProperty(u, int(params.id));
  if (!isAdmin(u) && p.approval === 'approved') throw new HttpError(403, 'Pronat e miratuara nuk fshihen nga agjenti – shënojeni “E fshehur”, “E shitur” ose “E dhënë me qira”.');
  for (const img of JSON.parse(p.images || '[]')) if (img.startsWith('/uploads/')) fs.rm(path.join(UPLOADS, path.basename(img)), () => {});
  db.prepare('DELETE FROM properties WHERE id = ?').run(int(params.id));
  return { ok: true };
});

route('PUT', '/api/admin/properties/:id/owner', async ({ req, params }) => {
  const u = requireStaff(req), p = ownProperty(u, int(params.id));
  saveOwner(p.id, ownerInput(await readBody(req)));
  return db.prepare('SELECT * FROM property_private WHERE property_id = ?').get(p.id);
});
route('POST', '/api/admin/upload', async ({ req }) => {
  requireStaff(req);
  const b = await readBody(req, 12 * 1024 * 1024);
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(String(b.data || ''));
  if (!m) throw new HttpError(400, 'Lejohen vetëm foto JPG, PNG ose WEBP.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) throw new HttpError(413, 'Fotoja duhet të jetë më e vogël se 8 MB.');
  // Kontrollohet përmbajtja e vërtetë e skedarit, jo vetëm emri i llojit
  const head = buf.subarray(0, 12).toString('latin1');
  const real = head.startsWith('\xFF\xD8\xFF') ? 'jpg' : head.startsWith('\x89PNG') ? 'png' : (head.startsWith('RIFF') && head.slice(8) === 'WEBP') ? 'webp' : null;
  if (!real) throw new HttpError(400, 'Skedari nuk është foto e vlefshme JPG, PNG ose WEBP.');
  const name = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${real}`;
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return { url: `/uploads/${name}` };
});

route('GET', '/api/admin/inquiries', ({ req, query }) => {
  const u = requireStaff(req);
  const status = query.get('status'), where = [], params = [];
  if (!isAdmin(u)) { where.push('p.agent_id = ?'); params.push(u.agent_id); }
  if (['new', 'contacted', 'closed'].includes(status)) { where.push('i.status = ?'); params.push(status); }
  return db.prepare(`SELECT i.*, p.title AS property_title, p.code AS property_code FROM inquiries i LEFT JOIN properties p ON p.id = i.property_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.created_at DESC, i.id DESC`).all(...params);
});
route('PATCH', '/api/admin/inquiries/:id', async ({ req, params }) => {
  const u = requireStaff(req);
  const b = await readBody(req);
  if (!isAdmin(u)) {
    const own = db.prepare('SELECT 1 FROM inquiries i JOIN properties p ON p.id = i.property_id WHERE i.id = ? AND p.agent_id = ?').get(int(params.id), u.agent_id);
    if (!own) throw new HttpError(403, 'Kjo kërkesë nuk është për pronat tuaja.');
  }
  if (!['new', 'contacted', 'closed'].includes(b.status)) throw new HttpError(400, 'Status i pavlefshëm.');
  db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(b.status, int(params.id));
  return { ok: true };
});
route('DELETE', '/api/admin/inquiries/:id', ({ req, params }) => { requireAdmin(req); db.prepare('DELETE FROM inquiries WHERE id = ?').run(int(params.id)); return { ok: true }; });

route('GET', '/api/admin/agents', ({ req }) => {
  const u = requireStaff(req);
  const rows = db.prepare('SELECT a.*, (SELECT COUNT(*) FROM properties p WHERE p.agent_id = a.id) AS listings, us.username, us.active AS login_active, o.name AS office_name, o.code AS office_code, (SELECT id FROM offices b WHERE b.broker_agent_id = a.id) AS broker_of FROM agents a LEFT JOIN users us ON us.agent_id = a.id AND us.role = \'agent\' LEFT JOIN offices o ON o.id = a.office_id ORDER BY a.level DESC, a.id').all();
  return isAdmin(u) ? rows : rows.map(({ username, login_active, ...a }) => a);
});
// Krijon, ndryshon ose çaktivizon llogarinë e hyrjes së agjentit
function saveAgentLogin(agentId, b, isNew) {
  const username = str(b.username, 60).toLowerCase(), password = str(b.password, 200);
  const existing = db.prepare("SELECT * FROM users WHERE agent_id = ? AND role = 'agent'").get(agentId);
  const active = b.login_active === false || b.login_active === 'false' || b.login_active === 0 ? 0 : 1;
  if (!username && !existing) return;
  if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) throw new HttpError(400, 'Përdoruesi duhet të ketë 3–40 shkronja latine, shifra, pikë ose vizë (pa hapësira).');
  const taken = username && db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (taken && (!existing || taken.id !== existing.id)) throw new HttpError(400, `Përdoruesi “${username}” është i zënë. Zgjidhni një tjetër.`);
  if (password && password.length < 8) throw new HttpError(400, 'Fjalëkalimi i agjentit duhet të ketë të paktën 8 karaktere.');
  if (!existing) {
    if (!password) throw new HttpError(400, 'Vendosni një fjalëkalim për hyrjen e agjentit.');
    const { hash, salt } = hashPassword(password);
    db.prepare("INSERT INTO users (username, password_hash, salt, role, agent_id, active) VALUES (?,?,?,'agent',?,?)").run(username, hash, salt, agentId, active);
    return;
  }
  if (username && username !== existing.username) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, existing.id);
  if (password) { const { hash, salt } = hashPassword(password); db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, existing.id); }
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, existing.id);
  if (!active || password) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id); // e nxjerr nga paneli
}
function agentInput(b) {
  const a = { name: str(b.name, 100), role: str(b.role, 80) || 'Agjent', phone: str(b.phone, 40), email: str(b.email, 120), photo: str(b.photo, 600), bio: str(b.bio, 600), level: Math.min(10, Math.max(1, int(b.level, 2))), office_id: b.office_id ? int(b.office_id, null) : null };
  if (a.office_id && !db.prepare('SELECT 1 FROM offices WHERE id = ?').get(a.office_id)) throw new HttpError(400, 'Zyra e zgjedhur nuk ekziston.');
  if (!a.name) throw new HttpError(400, 'Emri i agjentit është i detyrueshëm.');
  if (a.email && !isEmail(a.email)) throw new HttpError(400, 'Email i pavlefshëm.');
  return a;
}
route('POST', '/api/admin/agents', async ({ req }) => {
  requireAdmin(req); const b = await readBody(req), a = agentInput(b);
  db.exec('BEGIN');
  try {
    const r = db.prepare('INSERT INTO agents (name, role, phone, email, photo, bio, level, office_id) VALUES (?,?,?,?,?,?,?,?)').run(a.name, a.role, a.phone, a.email, a.photo, a.bio, a.level, a.office_id);
    const id = Number(r.lastInsertRowid);
    saveAgentLogin(id, b, true);
    db.exec('COMMIT');
    return db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});
route('PUT', '/api/admin/agents/:id', async ({ req, params }) => {
  requireAdmin(req); const b = await readBody(req), a = agentInput(b), id = int(params.id);
  if (!db.prepare('SELECT 1 FROM agents WHERE id = ?').get(id)) throw new HttpError(404, 'Agjenti nuk u gjet.');
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE agents SET name=?, role=?, phone=?, email=?, photo=?, bio=?, level=?, office_id=? WHERE id=?').run(a.name, a.role, a.phone, a.email, a.photo, a.bio, a.level, a.office_id, id);
    db.prepare('UPDATE offices SET broker_agent_id = NULL WHERE broker_agent_id = ? AND id IS NOT ?').run(id, a.office_id); // brokeri që kalon në zyrë tjetër nuk mbetet broker i së vjetrës
    saveAgentLogin(id, b, false);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
});
route('DELETE', '/api/admin/agents/:id', ({ req, params }) => {
  requireAdmin(req); const id = int(params.id);
  db.prepare("DELETE FROM users WHERE agent_id = ? AND role = 'agent'").run(id);
  db.prepare('UPDATE offices SET broker_agent_id = NULL WHERE broker_agent_id = ?').run(id);
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  return { ok: true };
});

route('GET', '/api/admin/settings', ({ req }) => { requireAdmin(req); return getSettings(); });
route('PUT', '/api/admin/settings', async ({ req }) => {
  requireAdmin(req); const b = await readBody(req);
  const v = {
    hero_image: /^(\/uploads\/|https?:\/\/)/.test(str(b.hero_image, 600)) ? str(b.hero_image, 600) : '',
    hero_property_id: b.hero_property_id ? String(int(b.hero_property_id, '')) : '',
    hero_title: str(b.hero_title, 140), hero_text: str(b.hero_text, 300)
  };
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, val] of Object.entries(v)) up.run(k, val);
  return getSettings();
});
route('GET', '/api/admin/subscribers', ({ req }) => { requireAdmin(req); return db.prepare('SELECT * FROM subscribers ORDER BY created_at DESC').all(); });
route('DELETE', '/api/admin/subscribers/:id', ({ req, params }) => { requireAdmin(req); db.prepare('DELETE FROM subscribers WHERE id = ?').run(int(params.id)); return { ok: true }; });

crm.register({ route, HttpError, readBody, requireStaff, isAdmin, str, int });
extras.register({ route, HttpError, readBody, requireStaff, isAdmin, str, int, rateLimit });
offices.register({ route, HttpError, readBody, requireStaff, isAdmin, str, int, num });
setInterval(() => { try { notify.tick(); } catch (e) { console.error('Kujtuesit:', e); } }, 60 * 1000).unref();

/* ---------- skedarët statikë ---------- */
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const originOf = req => (process.env.SITE_URL || `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${req.headers.host || 'localhost'}`).replace(/\/$/, '');
const LIVE_SQL = "status = 'active' AND approval = 'approved'";
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg']);

// Faqja e pronës merr titullin, përshkrimin dhe foton e vet, që lidhja të duket bukur në WhatsApp, Facebook dhe Google
function propertyPage(req, res, url) {
  const id = int(url.searchParams.get('id'));
  const p = id ? db.prepare("SELECT * FROM properties WHERE id = ? AND approval = 'approved' AND status != 'hidden'").get(id) : null;
  let html;
  try { html = fs.readFileSync(path.join(PUBLIC, 'property.html'), 'utf8'); } catch { return false; }
  if (p) {
    const origin = originOf(req);
    const img = JSON.parse(p.images || '[]')[0];
    const title = `${p.title} – ${p.city} | ${config.site.name}`;
    const where = [p.zone, p.city].filter(Boolean).join(', ');
    const desc = `${p.type} ${p.deal === 'qira' ? 'me qira' : 'në shitje'} në ${where} · ${p.price.toLocaleString('de-DE')} €${p.deal === 'qira' ? ' / muaj' : ''}${p.area ? ` · ${p.area} m²` : ''}${p.rooms ? ` · ${p.rooms} dhoma` : ''}. Kodi ${p.code}.`;
    const tags = [
      `<title>${escHtml(title)}</title>`, `<meta name="description" content="${escHtml(desc)}">`,
      `<link rel="canonical" href="${escHtml(origin)}/property.html?id=${p.id}">`,
      `<meta property="og:type" content="website">`, `<meta property="og:site_name" content="${escHtml(config.site.name)}">`,
      `<meta property="og:title" content="${escHtml(title)}">`, `<meta property="og:description" content="${escHtml(desc)}">`,
      `<meta property="og:url" content="${escHtml(origin)}/property.html?id=${p.id}">`,
      img ? `<meta property="og:image" content="${escHtml(img.startsWith('/') ? origin + img : img)}">` : '',
      `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`
    ].filter(Boolean).join('\n');
    html = html.replace(/<title>[^<]*<\/title>/, () => tags);
  }
  send(res, 200, html, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }, req);
  return true;
}
function sitemap(req, res) {
  const origin = originOf(req);
  const urls = ['/', '/properties.html', '/properties.html?deal=shitje', '/properties.html?deal=qira']
    .map(u => `<url><loc>${escHtml(origin + u)}</loc></url>`)
    .concat(db.prepare(`SELECT id, updated_at FROM properties WHERE ${LIVE_SQL} ORDER BY id DESC LIMIT 5000`).all().map(p => `<url><loc>${escHtml(origin)}/property.html?id=${p.id}</loc><lastmod>${String(p.updated_at || '').slice(0, 10)}</lastmod></url>`));
  send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }, req);
}

function serveStatic(req, res, url) {
  const pathname = url.pathname;
  if (pathname === '/robots.txt') return send(res, 200, `User-agent: *\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${originOf(req)}/sitemap.xml\n`, { 'Cache-Control': 'public, max-age=3600' }, req);
  if (pathname === '/sitemap.xml') return sitemap(req, res);
  if (pathname === '/property.html' && propertyPage(req, res, url)) return;
  let base = PUBLIC, rel = pathname;
  if (pathname.startsWith('/uploads/')) { base = UPLOADS; rel = pathname.slice('/uploads'.length); }
  if (rel.endsWith('/')) rel += 'index.html';
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch { return send(res, 400, 'Adresë e pavlefshme'); }
  if (decoded.includes('\0')) return send(res, 400, 'Adresë e pavlefshme');
  const file = path.normalize(path.join(base, decoded));
  if (file !== base && !file.startsWith(base + path.sep)) return send(res, 403, 'Ndalohet');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      const nf = path.join(PUBLIC, '404.html');
      res.writeHead(404, { 'Content-Type': MIME['.html'], ...SECURITY });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(nf).on('error', () => res.end('Faqja nuk u gjet')).pipe(res);
    }
    const ext = path.extname(file).toLowerCase();
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' || pathname === '/sw.js' ? 'no-cache' : base === UPLOADS ? 'public, max-age=2592000, immutable' : 'public, max-age=3600', ETag: etag, ...SECURITY };
    // Skedarët e ngarkuar shërbehen vetëm si foto; çdo gjë tjetër shkarkohet, nuk hapet
    if (base === UPLOADS && !/^image\//.test(headers['Content-Type'])) headers['Content-Disposition'] = 'attachment';
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    const gzip = COMPRESSIBLE.has(ext) && st.size > 1024 && wantsGzip(req);
    if (gzip) { headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; } else headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(file).on('error', () => res.destroy());
    if (gzip) stream.pipe(zlib.createGzip()).pipe(res); else stream.pipe(res);
  });
}

/* ---------- serveri ---------- */
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, 'Adresë e pavlefshme'); }
  try {
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Metodë e palejuar');
      return serveStatic(req, res, url);
    }
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      try {
        const out = await r.handler({ req, res, params: m.groups || {}, query: url.searchParams });
        if (res.headersSent) return; // rruga e dërgoi vetë përgjigjen (p.sh. një dokument)
        return send(res, 200, out, {}, req);
      } catch (e) {
        if (!(e instanceof HttpError)) console.error(e);
        return send(res, e.status || 500, { error: e instanceof HttpError ? e.message : 'Ndodhi një gabim në server. Provoni sërish.' });
      }
    }
    send(res, 404, { error: 'Adresa e API-t nuk ekziston.' });
  } catch (e) {
    // Asnjë kërkesë e keqformuar nuk duhet ta rrëzojë serverin
    console.error(e);
    if (!res.headersSent) send(res, 500, 'Ndodhi një gabim në server.'); else res.destroy();
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
process.on('unhandledRejection', e => console.error('Gabim i pakapur:', e));
process.on('uncaughtException', e => console.error('Gabim i pakapur:', e));

server.listen(config.port, () => console.log(`De Luxe Real Estate po punon në http://localhost:${config.port}  ·  Paneli: http://localhost:${config.port}/admin/`));
