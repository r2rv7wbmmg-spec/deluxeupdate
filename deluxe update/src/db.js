// Databaza SQLite (modul i integruar në Node.js ≥ 22.13 – pa varësi të jashtme)
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'deluxe.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Agjent',
  phone TEXT,
  email TEXT,
  photo TEXT,
  bio TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  deal TEXT NOT NULL CHECK (deal IN ('shitje','qira')),
  type TEXT NOT NULL,
  city TEXT NOT NULL,
  zone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  area INTEGER DEFAULT 0,
  rooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  floor TEXT DEFAULT '',
  year_built INTEGER,
  furnished INTEGER DEFAULT 0,
  parking INTEGER DEFAULT 0,
  features TEXT DEFAULT '[]',
  images TEXT DEFAULT '[]',
  lat REAL,
  lng REAL,
  featured INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','sold','rented','hidden')),
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  views INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prop_search ON properties(status, deal, city, type, price);
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT DEFAULT 'contact' CHECK (kind IN ('contact','property','visit','valuation')),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  message TEXT,
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
`);

// CRM: leads (portofoli i klientëve), opportunitete (marrëveshjet në faza) dhe historiku i kontakteve
db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  phone_norm TEXT DEFAULT '',
  email TEXT DEFAULT '',
  client_type TEXT DEFAULT 'bleres',
  source TEXT DEFAULT 'tjeter',
  status TEXT DEFAULT 'active',
  budget_min INTEGER,
  budget_max INTEGER,
  city TEXT DEFAULT '',
  ptype TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_agent ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone_norm);
CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  deal TEXT DEFAULT 'shitje',
  stage TEXT DEFAULT 'new',
  value INTEGER DEFAULT 0,
  commission INTEGER DEFAULT 0,
  next_action TEXT DEFAULT '',
  next_date TEXT DEFAULT '',
  lost_reason TEXT DEFAULT '',
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_opp_agent ON opportunities(agent_id, stage);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  opp_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id INTEGER,
  author TEXT DEFAULT '',
  type TEXT DEFAULT 'note',
  text TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_act_lead ON activities(lead_id);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '');
`);

// Migrime: shton kolonat e reja në databazat ekzistuese pa humbur të dhëna
const cols = t => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
const addCol = (t, c, def) => { if (!cols(t).includes(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
addCol('agents', 'level', 'INTEGER DEFAULT 2');  // 1 = praktikant … 10 = themelues & CEO (renditja në faqe)
addCol('users', 'role', "TEXT DEFAULT 'admin'");      // 'admin' ose 'agent'
addCol('users', 'agent_id', 'INTEGER');               // lidhja me profilin e agjentit
addCol('users', 'active', 'INTEGER DEFAULT 1');       // 0 = hyrja e çaktivizuar
addCol('properties', 'approval', "TEXT DEFAULT 'approved'"); // 'pending' | 'approved' | 'rejected'
addCol('properties', 'review_note', "TEXT DEFAULT ''");
addCol('properties', 'created_by', 'INTEGER');
addCol('inquiries', 'lead_id', 'INTEGER');
addCol('users', 'must_change', 'INTEGER DEFAULT 0');  // 1 = fjalëkalimi fillestar, duhet ndryshuar para se të përdoret paneli
addCol('properties', 'published_at', 'TEXT');         // kur doli për herë të parë në faqe (për “prona të reja” te match-i)

// Match-i: kërkesat e klientit ruhen te opportunity-ja dhe krahasohen me pronat e gjithë agjencisë
addCol('opportunities', 'side', "TEXT DEFAULT 'demand'"); // 'demand' = kërkon pronë · 'supply' = ofron pronë (shitës / qiradhënës)
addCol('opportunities', 'c_type', "TEXT DEFAULT ''");
addCol('opportunities', 'c_city', "TEXT DEFAULT ''");
addCol('opportunities', 'c_zones', "TEXT DEFAULT '[]'");
addCol('opportunities', 'c_price_min', 'INTEGER');
addCol('opportunities', 'c_price_max', 'INTEGER');
addCol('opportunities', 'c_rooms', 'INTEGER');
addCol('opportunities', 'c_area_min', 'INTEGER');
addCol('opportunities', 'c_furnished', 'INTEGER DEFAULT 0');
addCol('opportunities', 'c_parking', 'INTEGER DEFAULT 0');
addCol('opportunities', 'matches_seen_at', 'TEXT');
db.exec(`
CREATE TABLE IF NOT EXISTS opp_matches (
  opp_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('proposed','liked','dismissed')),
  note TEXT DEFAULT '',
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (opp_id, property_id)
);
CREATE INDEX IF NOT EXISTS idx_match_prop ON opp_matches(property_id);
`);

// 3.0: njoftimet, kalendari, dokumentet dhe pronari (privatë), ndarja e komisionit
addCol('opportunities', 'split_agent_id', 'INTEGER'); // agjenti tjetër në një marrëveshje të përbashkët (zakonisht agjenti i pronës)
addCol('opportunities', 'split_pct', 'INTEGER');      // pjesa (%) e agjentit të opportunity-së; pjesa tjetër i takon split_agent_id
addCol('properties', 'last_public_price', 'INTEGER'); // çmimi i fundit në faqe – për njoftimin e uljes së çmimit
db.exec(`
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER,            -- NULL = për administratorët
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  link TEXT DEFAULT '{}',      -- ku të çojë klikimi: {"opp":4} | {"view":"match"} | {"prop":17} | {"visit":3}
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_agent ON notifications(agent_id, read_at);
CREATE TABLE IF NOT EXISTS match_notified (
  opp_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (opp_id, property_id)
);
CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS property_private (
  property_id INTEGER PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  owner_name TEXT DEFAULT '', owner_phone TEXT DEFAULT '', owner_email TEXT DEFAULT '',
  commission_terms TEXT DEFAULT '', exclusive INTEGER DEFAULT 0, exclusive_until TEXT DEFAULT '',
  owner_notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS property_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  note TEXT DEFAULT '',
  expires_at TEXT DEFAULT '',
  file TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  uploaded_by INTEGER,
  expiry_notified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_prop ON property_docs(property_id);
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  opp_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,     -- ora e Shqipërisë: 'YYYY-MM-DD HH:MM'
  duration INTEGER DEFAULT 45,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','done','cancelled','noshow')),
  reaction TEXT DEFAULT '',
  feedback TEXT DEFAULT '',
  reminded INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visits_time ON visits(starts_at);
`);
// 3.1: kujtuesi për klientët pa kontakt dhe objektivat mujore të agjentëve
addCol('leads', 'followup_notified_at', 'TEXT');
// objektivat e reja: leads të reja, opportunitete të reja, prona të listuara (shtohen pas krijimit të tabelës)
db.exec(`
CREATE TABLE IF NOT EXISTS agent_targets (
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  month TEXT NOT NULL,          -- 'YYYY-MM'
  visits INTEGER DEFAULT 0,
  deals INTEGER DEFAULT 0,
  commission INTEGER DEFAULT 0,
  PRIMARY KEY (agent_id, month)
);
`);
addCol('agent_targets', 'leads', 'INTEGER DEFAULT 0');
addCol('agent_targets', 'opps', 'INTEGER DEFAULT 0');
addCol('agent_targets', 'listings', 'INTEGER DEFAULT 0');

// 3.2: zyrat (degët) me brokerin e tyre, kodi i pronave sipas zyrës, mbyllja e komisioneve nga brokeri
db.exec(`
CREATE TABLE IF NOT EXISTS offices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,           -- shkurtimi i kodeve të pronave, p.sh. BLK → BLK-1001
  city TEXT DEFAULT '', zone TEXT DEFAULT '', address TEXT DEFAULT '',
  phone TEXT DEFAULT '', whatsapp TEXT DEFAULT '', email TEXT DEFAULT '', hours TEXT DEFAULT '',
  lat REAL, lng REAL,
  broker_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  next_seq INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
`);
addCol('agents', 'office_id', 'INTEGER');
addCol('properties', 'office_id', 'INTEGER');
addCol('opportunities', 'commission_status', 'TEXT');   // NULL = e vjetër (llogaritet) · 'pending' = pret brokerin · 'closed' = e mbyllur
addCol('opportunities', 'commission_closed_by', 'TEXT');
addCol('opportunities', 'commission_closed_at', 'TEXT');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}
function verifyPassword(password, hash, salt) {
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

// Përdoruesi i parë i administrimit
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const { hash, salt } = hashPassword(password);
  // Pa ADMIN_PASSWORD hyrja e parë bëhet me admin123, por paneli hapet vetëm pasi të vendoset një fjalëkalim i ri
  db.prepare("INSERT INTO users (username, password_hash, salt, role, must_change) VALUES (?,?,?,'admin',?)").run(username, hash, salt, process.env.ADMIN_PASSWORD ? 0 : 1);
  console.log(`\n  Përdoruesi i administrimit u krijua: ${username}${process.env.ADMIN_PASSWORD ? '' : ' / ' + password}`);
  if (!process.env.ADMIN_PASSWORD) console.log('  Në hyrjen e parë paneli ju kërkon të vendosni një fjalëkalim të ri.\n');
}

module.exports = { db, hashPassword, verifyPassword };
