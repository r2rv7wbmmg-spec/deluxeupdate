# De Luxe Real Estate

Faqe interneti për agjenci imobiliare: faqja publike, kërkim me filtra, faqe për çdo pronë, asistent për pyetje të shpejta, buton anësor WhatsApp dhe panel administrimi me databazë.

**Pa asnjë varësi të jashtme**: vetëm Node.js (server HTTP + SQLite i integruar). Nuk ka `npm install`.

## Nisja

Kërkohet **Node.js 22.13 ose më i ri** (`node -v`).

```bash
npm start            # ose: node src/server.js
```

- Faqja: http://localhost:3000
- Paneli: http://localhost:3000/admin/ – hyrja e parë: `admin` / `admin123`. Paneli hapet vetëm pasi të vendosni një fjalëkalim të ri (ose caktojeni që në fillim me `ADMIN_PASSWORD` te `.env`).

Në nisjen e parë databaza (`data/deluxe.db`) krijohet vetë **bosh**: pa prona, pa agjentë, vetëm me llogarinë e administratorit.
Për provë mund të ngarkoni 16 prona dhe 4 agjentë shembull me `SEED_DEMO=1` te `.env` (vetëm në një databazë bosh), ose me `npm run seed`. Mos e përdorni në faqen e vërtetë.

**Përditësimi i një faqeje ekzistuese:** zëvendësoni kodin dhe rinisni. Databaza dhe fotot ekzistuese nuk preken; tabelat dhe kolonat e reja shtohen vetë në nisje.

## Lagjet

Lista e lagjeve të Tiranës (dhe e qyteteve të tjera, nëse i shtoni) është te `src/zones.js`. Ato dalin si zgjedhje te kërkimi në faqen kryesore, te filtrat e listës, si sugjerime kur shtoni një pronë në panel, dhe asistenti i kupton në pyetje (p.sh. “apartament në Bllok”). Për të shtuar një qytet: `'Durrës': ['Plazh', 'Currila', ...]`.

## Të dhënat e biznesit

Ndryshoni telefonin, numrin e WhatsApp, email-in, adresën dhe orarin te `src/config.js` ose me variabla mjedisi (shih `.env.example`).
Numri i WhatsApp shkruhet vetëm me shifra, me prefiksin e shtetit: `355691234567`.

Përgjigjet e asistentit (orari, komisioni, dokumentet, kredia etj.) i ndryshoni te lista `FAQ` në `src/chat.js`.

## Çfarë bën

**Faqja publike**
- Kërkim sipas shitje/qira, qytetit, llojit, buxhetit dhe dhomave
- Lista me filtra, renditje, faqosje, pamje rrjetë/listë dhe lidhje që ruajnë filtrat
- Faqja e pronës: galeri me shikues (shigjeta, tastierë, rrëshqitje në telefon), karakteristikat, harta, kalkulatori i kredisë, formular për info ose vizitë, WhatsApp me kodin e pronës, shpërndarje, printim, prona të ngjashme
- Pronat e ruajtura (zemra) dhe dërgimi i tyre në WhatsApp
- Vlerësim falas i pronës, regjistrim në email, faqe 404
- Butoni anësor WhatsApp (në telefon bëhet buton i rrumbullakët poshtë majtas)
- Asistenti “Pyetje të shpejta”: kupton qytetin, llojin, buxhetin dhe “2+1”, kërkon direkt në databazë dhe përgjigjet për orarin, adresën, dokumentet, kredinë, vizitat dhe diasporën

**Agjentët me hyrje të veçantë**
- Te *Agjentët → Shto agjent* plotësoni edhe **Përdoruesi** dhe **Fjalëkalimi** (butoni *Krijo* jep një fjalëkalim të sigurt). Pas ruajtjes, paneli ju jep tekstin me të dhënat e hyrjes, gati për ta dërguar te agjenti me WhatsApp.
- Agjenti hyn te `/admin/` dhe sheh vetëm: *Paneli*, *Pronat e mia*, *Kërkesat* (vetëm për pronat e veta) dhe *Llogaria*.
- Çdo pronë që agjenti shton ose ndryshon shkon te **Miratime** dhe del në faqe vetëm pasi ta miratojë administratori. Nëse e refuzoni, shkruani arsyen dhe agjenti e sheh te pronat e tij.
- Agjenti mund ta shënojë vetë pronën *E shitur*, *E dhënë me qira* ose *E fshehur* pa miratim; pronat e miratuara nuk i fshin dot.
- Për ta bllokuar një agjent, hiqni *Hyrja aktive* – nxirret menjëherë nga paneli.
- **Niveli** (1 Praktikant … 7 Agjent Partner … 10 Themelues & CEO) përcakton renditjen te “Agjentët tanë”: niveli më i lartë del i pari. Titulli që shfaqet plotësohet vetë nga niveli dhe mund ta ndryshoni lirisht.

**Match: klient ↔ pronë (i ri në 2.0)**
- Te çdo opportunity agjenti plotëson **çfarë kërkon klienti**: shitje/qira, lloji, qyteti, lagjet, buxheti, dhomat, sipërfaqja, mobilim, parkim. Kur opportunity hapet nga një lead, kërkesat plotësohen vetë nga të dhënat e tij.
- Sapo plotësohen kërkesat, djathtas dalin **pronat e gjithë agjencisë** që përputhen (jo vetëm të agjentit), me përqindjen dhe arsyet: “✓ Brenda buxhetit”, “≈ 5% mbi buxhet”, “✕ Lagje tjetër”. Te pronat e kolegëve shfaqet emri dhe telefoni i agjentit të pronës.
- Me një klik: **Dërgoja klientit** (WhatsApp me lidhjen e pronës), **I pëlqeu**, **Nuk i pëlqeu** (nuk i del më këtij klienti), **Lidhe** (bëhet prona e opportunity-së). Çdo veprim shënohet vetë te historiku i klientit.
- **Drejtimi tjetër:** për një shitës ose qiradhënës zgjidhni “Ofron pronën e vet” dhe pronën e tij – sistemi tregon blerësit/qiramarrësit që presin. E njëjta listë hapet te *Pronat* nga butoni me numër. Klientët e agjentëve të tjerë shfaqen pa emër e telefon: kontaktohet agjenti i tyre.
- **Prona të reja:** kur një pronë miratohet, administratori sheh sa klientë e presin, dhe agjentët e tyre e gjejnë te *Paneli → Prona të reja për klientët* dhe si shenjë te karta e opportunity-së.
- Rregullat e pikëzimit janë te `src/match.js` (peshat te `WEIGHTS`): buxheti 35, lagjja 25, dhomat 20, sipërfaqja 10, mobilimi 5, parkimi 5. Lloji, qyteti dhe shitje/qira duhet të përputhen patjetër; prona mbi 10% më e shtrenjtë se buxheti nuk propozohet.

**3.0: bashkëpunimi mes agjentëve**
- **Match (menu më vete):** dy skeda, “Klientët e mi” (pronat e gjithë agjencisë që u përshtaten) dhe “Pronat e mia” (klientët e të gjithë agjentëve që i kërkojnë). Klientët e kolegëve shfaqen pa emër e kontakt: bashkëpunimi kalon gjithmonë përmes agjentit të tyre.
- **Njoftimet 🔔:** kur një pronë del në faqe, njoftohen agjentët e klientëve që i përshtaten (mbi 60%); kur hidhet një kërkesë klienti, njoftohen agjentët e pronave që përputhen. Edhe për uljen e çmimit, vizitat, dokumentet që skadojnë, pronat e dyfishta dhe kërkesat “Më njofto”.
- **Njoftime në telefon (falas):** te *Llogaria → Aktivizo njoftimet*. Kërkon HTTPS. Në iPhone paneli shtohet njëherë te ekrani kryesor (“Add to Home Screen”). Njoftimi nuk mbart tekst: teksti merret nga paneli.
- **Kalendari i vizitave:** vizita me klientin, pronën dhe orën; paralajmërim kur përplasen; kujtues 1 orë para; “Si shkoi?” shënohet te historiku. Agjenti i pronës njoftohet kur një koleg vjen me klient (pa emrin e klientit).
- **Ndarja e komisionit:** kur fitohet një marrëveshje me pronën e një kolegu, komisioni ndahet vetë 50/50 (administratori e ndryshon). Raporti llogarit pjesën e secilit.
- **Pronari dhe dokumentet (private):** te çdo pronë, kartela e pronarit dhe dokumentet (PDF/foto deri 10 MB). I shohin vetëm agjenti listues dhe administratori. Asnjë dokument nuk është i detyrueshëm; paneli tregon vetëm çfarë mungon. Dokumentet ruhen te `data/docs/` (ose `DOCS_DIR`), jashtë faqes publike.
- **Pini në hartë:** te formulari i pronës, kërkim adrese, “Vendndodhja ime” dhe pin që tërhiqet (OpenStreetMap, falas).
- **Prona e dyfishtë:** kur dy prona ngjajnë (e njëjta adresë, ose pin brenda 40 m me të njëjtat dhoma e sipërfaqe), administratori njoftohet.
- **Kujtuesi “pa kontakt”:** klientët aktivë pa telefonatë, mesazh, vizitë ose shënim prej 7 ditësh (administratori e ndryshon te *Raporti*) dalin te “Për sot”, me shenjë te kartela e lead-it dhe me njoftim te agjenti.
- **Objektivat mujore:** administratori cakton te *Raporti* për çdo agjent leads të reja, opportunitete të reja, prona të listuara (të miratuara), vizita të kryera, marrëveshje të fituara dhe komisionin e muajit. Lini 0 për ato që nuk doni t’i ndiqni. Agjenti sheh progresin te paneli i tij. Nëse një muaj nuk ka objektiva, vazhdojnë ato të muajit të kaluar.
- **Zyrat (3.2):** administratori hap zyra me emër, zonë dhe kod (p.sh. BLK), cakton brokerin dhe agjentët, dhe hap ose fshin llogaritë. Pronat e reja të një zyre marrin kodin e saj (BLK-1001…); pronat ekzistuese mbajnë kodin DLX. Administratori mund t’ia kalojë një pronë një zyre tjetër (kodi nuk ndryshon).
- **Brokeri:** ka “Zyra ime” me komisionin e mbyllur dhe atë në pritje, objektivat dhe renditjen e agjentëve; cakton objektivat e agjentëve të zyrës dhe **mbyll komisionet**: kur një agjent shënon një marrëveshje të fituar, komisioni mbetet “në pritje” dhe nuk hyn në raporte derisa brokeri ta mbyllë. Komisionin e vetë brokerit (ose të agjentëve pa zyrë) e mbyll administratori.
- **Komisionet (menu më vete):** agjenti sheh komisionet e veta (të mbyllura, në pritje, pjesën kur ndahen, ecurinë 12-mujore dhe objektivin); brokeri sheh edhe zyrën, renditjen e agjentëve dhe i mbyll komisionet aty; administratori sheh të gjitha me filtër sipas zyrës, agjentit, muajit dhe statusit, krahason zyrat, mbyll ose rihap komisionet dhe e shkarkon listën në Excel (CSV).
- **Miratimi** i pronave mbetet vetëm te administratori; pronat që mund të jenë të dyfishta dalin me të kuqe te “Miratime” dhe kërkojnë konfirmim.
- **“Më njofto për prona si kjo”** te lista e pronave: vizitori lë numrin dhe kërkimi i tij bëhet vetë lead + kërkesë klienti me match.

**CRM: leads dhe opportunitete**
- **Leads (portofoli):** çdo kërkesë nga faqja shtohet vetë si lead te agjenti i pronës; kërkesat pa pronë (kontakt, vlerësim) shkojnë te administratori si “Pa agjent”. Numri i njëjtë telefoni nuk dyfishohet – kërkesat e reja shtohen te i njëjti klient. Agjenti shton vetë klientët nga telefoni, Instagrami, zyra ose rekomandimet.
- Çdo lead ka llojin (blerës, qiramarrës, shitës, qiradhënës, investitor), burimin, buxhetin, çfarë kërkon, shënime dhe **historikun** e çdo telefonate, mesazhi, vizite e takimi. Butonat Telefono/WhatsApp e shënojnë vetë kontaktin në historik.
- **Opportunitete:** marrëveshjet në faza *E re → Kontaktuar → Vizitë → Ofertë → Negocim → Fituar / Humbur*, me pronën, vlerën, komisionin, hapin e radhës dhe datën. Kartat lëvizen duke i tërhequr ose me shigjetat ‹ ›; kur humbet, shënohet arsyeja.
- **Për sot:** paneli tregon kë duhet të kontaktoni sot dhe kush ka mbetur me vonesë.
- **Raporti** (administratori): leads, opportunitete të hapura, fitore dhe komision për çdo agjent – këtë muaj dhe gjithsej – dhe nga cili burim vijnë klientët.
- Agjenti sheh vetëm portofolin e vet; administratori sheh gjithçka dhe ia cakton lead-in një agjenti (opportunitetet e hapura kalojnë bashkë me të).

**Paneli**
- Statistika, kërkesat e fundit, pronat më të shikuara
- Pronat: shto, ndrysho, fshi, ndrysho statusin (aktive / e shitur / me qira / e fshehur), shëno si të përzgjedhur, ngarko foto (tërhiq e lësho), rendit fotot dhe zgjidh foton kryesore
- Kërkesat: filtro sipas statusit, telefono ose shkruaj në WhatsApp me një klik, ndrysho statusin, fshi
- Agjentët me foto, abonentët me shkarkim CSV, ndryshimi i fjalëkalimit

## Struktura

```
src/
  server.js   serveri, API dhe skedarët statikë
  db.js       tabelat SQLite dhe fjalëkalimet (scrypt)
  chat.js     logjika e asistentit
  crm.js      leads, opportunitete, historiku dhe raporti
  seed.js     të dhënat shembull
  config.js   të dhënat e biznesit
public/
  index.html, properties.html, property.html, favorites.html, 404.html
  css/  style.css (i përbashkët), home.css, list.css, property.css
  js/   common.js (koka, fundi, karta, WhatsApp, asistenti), home.js, properties.js, property.js, favorites.js
  admin/ index.html, admin.css, admin.js
data/     databaza (krijohet vetë)
uploads/  fotot e ngarkuara nga paneli
```

## API

| Metoda | Adresa | Përshkrimi |
|---|---|---|
| GET | `/api/meta` | të dhënat e biznesit, qytetet, llojet, numrat |
| GET | `/api/properties` | `deal, city, type, min, max, rooms, minArea, furnished, parking, q, sort, page, limit, featured, ids, exclude` |
| GET | `/api/properties/:id` | një pronë me agjentin |
| GET | `/api/agents` | agjentët |
| POST | `/api/inquiries` | `{kind, name, phone, email, message, property_id}` |
| POST | `/api/subscribe` | `{email}` |
| POST | `/api/chat` | `{message}` → `{reply, properties, link}` |
| * | `/api/admin/...` | kërkon hyrje: `login, logout, me, password, stats, properties, upload, inquiries, agents, subscribers, leads, leads/:id/activities, opportunities, crm`. Agjentët shohin vetëm të dhënat e veta; `agents`, `subscribers` dhe miratimet janë vetëm për administratorin |

## Publikimi në internet

Funksionon në çdo VPS ose hostim që mbështet Node.js 22.13+ (Hetzner, DigitalOcean, Render, Railway…):

1. Ngarkoni dosjen dhe vendosni variablat nga `.env.example` (sidomos `ADMIN_PASSWORD` dhe `NODE_ENV=production`).
2. Nisni me `node src/server.js` (me `pm2` ose `systemd` që të rinisë vetë).
3. Vendosni Nginx/Caddy përpara me HTTPS. Me `NODE_ENV=production` cookie e hyrjes dërgohet vetëm me HTTPS.
4. Ruani kopje rezervë të `data/` dhe `uploads/`. Në hostim pa disk të përhershëm (p.sh. Render falas) vendosni `DATA_DIR` dhe `UPLOAD_DIR` në një disk të montuar.

## Siguria

Fjalëkalime me scrypt, sesione me cookie HttpOnly, kufizim kërkesash për formularët, hyrjen dhe asistentin, fushë kurth kundër spam-it, mbrojtje nga `../` te skedarët dhe kontroll i llojit dhe madhësisë së fotove.

## Siguria dhe publikimi (2.0)

- Fjalëkalimi fillestar duhet ndryshuar në hyrjen e parë; ndryshimi i fjalëkalimit i nxjerr pajisjet e tjera nga paneli.
- Kufizim tentativash për hyrjen (edhe për çdo përdorues), formularët dhe asistentin.
- Fotot e ngarkuara kontrollohen sipas përmbajtjes së vërtetë (JPG, PNG, WEBP).
- Faqja e çdo prone ka titullin, përshkrimin dhe foton e vet për WhatsApp, Facebook dhe Google; ka edhe `/sitemap.xml` dhe `/robots.txt`.
- Skedarët dërgohen të ngjeshur (gzip) dhe ruhen në memorien e shfletuesit.
- Në hosting vendosni `NODE_ENV=production` dhe `SITE_URL`, dhe mbajeni `data/` dhe `uploads/` në një disk që nuk fshihet (`DATA_DIR`, `UPLOAD_DIR`). Bëni rregullisht kopje të `data/deluxe.db`.
