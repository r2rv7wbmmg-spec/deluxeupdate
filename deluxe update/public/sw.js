/* Njoftimet në telefon (Web Push). Mesazhi nuk mbart tekst: teksti merret nga paneli, kështu asgjë private nuk kalon te shërbimi i njoftimeve. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => e.waitUntil((async () => {
  let title = 'De Luxe – njoftim i ri', body = 'Hapni panelin për ta parë.', tag = 'deluxe';
  try {
    const r = await fetch('/api/admin/notifications?unread=1&limit=1', { credentials: 'include' });
    const d = await r.json(); const n = d.items && d.items[0];
    if (n) { title = n.title; body = n.body; tag = 'n' + n.id; }
  } catch (err) {}
  await self.registration.showNotification(title, { body, tag, icon: '/img/icon-512.png', badge: '/img/favicon.png', data: { url: '/admin/#njoftime' } });
})()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => new URL(c.url).pathname.startsWith('/admin'));
    if (open) { await open.focus(); open.navigate('/admin/#njoftime').catch(() => {}); }
    else await self.clients.openWindow('/admin/#njoftime');
  })());
});
