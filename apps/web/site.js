/* Serveros: shared bits for every page. Loads before the page script, which finds them on window.servero. */
window.servero = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Rails: U numbers along the page ---------- */
  const U = 44;
  function drawRails() {
    const rack = $('.rack');
    if (!rack) return;
    const count = Math.floor(rack.offsetHeight / U);
    $$('.rail__marks').forEach(m => {
      let html = '';
      for (let i = 1; i <= count; i++) html += `<span style="top:${i * U - 13}px">${i}</span>`;
      m.innerHTML = html;
    });
  }
  drawRails();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawRails, 200); });
  addEventListener('load', drawRails);

  /* ---------- Panel origin ----------
     The panel origin can be overridden with <meta name="servero-panel" content="...">.
     A localhost override only applies while this page is served from localhost too,
     so a dev value left in the HTML never sends real orders to a dev machine. */
  const isLocal = h => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(h);
  // Served from the old servero.cz (until it redirects), talk to the panel on that domain too.
  let panel = /(^|\.)servero\.cz$/.test(location.hostname) ? 'https://panel.servero.cz' : 'https://panel.serveros.cz';
  const metaPanel = $('meta[name="servero-panel"]');
  if (metaPanel && metaPanel.content) {
    try {
      const u = new URL(metaPanel.content);
      if (!isLocal(u.hostname) || isLocal(location.hostname)) panel = u.origin;
    } catch { /* malformed meta: keep the default */ }
  }
  // links into the panel (status page, login) follow the same origin: <a data-panel-path="/stav">
  $$('a[data-panel-path]').forEach(a => { a.href = panel + a.dataset.panelPath; });

  /* ---------- Domain availability (panel /api/domain-check, RDAP behind it) ---------- */
  // what people paste: "https://www.Firma.cz/kontakt" -> "firma.cz"
  const cleanDomain = v => String(v || '').trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/^www\./, '').replace(/\.$/, '');

  // resolves to { name, available: true | false | null, reason?, price, invalid }; never throws.
  // invalid: the panel refused the name itself (400), so it cannot be registered as typed.
  async function checkDomain(name) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    try {
      const res = await fetch(`${panel}/api/domain-check?name=${encodeURIComponent(name)}`, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      const json = await res.json().catch(() => ({}));
      if (typeof json.available === 'boolean' || json.reason) return { name, price: null, ...json, invalid: res.status === 400 };
      throw new Error(res.status);
    } catch {
      return { name, available: null, price: null, reason: 'Dostupnost teď nejde ověřit. Zkuste to za chvíli, nebo ji ověříme my po objednávce.' };
    } finally {
      clearTimeout(timer);
    }
  }

  // the same check with a small cache and at most 6 lookups in flight (the panel allows 30 a minute per IP)
  const LIMIT = 6, seen = new Map(), queue = [];
  let active = 0;
  function pump() {
    while (active < LIMIT && queue.length) {
      const { name, resolve } = queue.shift();
      active++;
      checkDomain(name).then(resolve).finally(() => { active--; pump(); });
    }
  }
  function checkQueued(name) {
    const hit = seen.get(name);
    // definite answers keep 10 minutes, "do not know" only 30 s so a retry soon asks again
    if (hit && Date.now() - hit.at < (hit.sure ? 6e5 : 3e4)) return hit.promise;
    const promise = new Promise(resolve => { queue.push({ name, resolve }); pump(); });
    const entry = { at: Date.now(), sure: true, promise };
    promise.then(r => { entry.sure = typeof r.available === 'boolean'; });
    seen.set(name, entry);
    return promise;
  }

  /* ---------- Catalog: plans.json, a copy of /catalog/plans.json (see main.js) ---------- */
  let catalogP;
  const catalog = () => catalogP || (catalogP = fetch('plans.json?v=5')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .catch(e => { catalogP = null; throw e; }));
  // price per year from the "domains" table; null means "cenu potvrdíme". Tolerates older catalogs.
  function domainPrice(data, name) {
    const tld = String(name).slice(String(name).lastIndexOf('.') + 1);
    const table = data && data.domains && typeof data.domains === 'object' ? data.domains : {};
    if (Object.prototype.hasOwnProperty.call(table, tld)) return typeof table[tld] === 'number' ? table[tld] : null;
    const cz = tld === 'cz' && data && Array.isArray(data.extras) ? data.extras.find(x => x.code === 'domena-cz') : null;
    return cz ? cz.price : null;
  }

  /* ---------- Domain basket (košík) ----------
     [{ name, mode: register | transfer, years: 1..3 }] in localStorage, shared by every page.
     Without storage (private mode, blocked cookies) it still works for the current page. */
  const KEY = 'serveros-kosik', MAX = 20;
  let mem = [];
  const subs = new Set();
  const tidy = list => (Array.isArray(list) ? list : [])
    .filter(d => d && typeof d.name === 'string' && /^[^\s/:@?#\\]{3,253}$/.test(d.name))
    .map(d => ({ name: d.name.toLowerCase(), mode: d.mode === 'transfer' ? 'transfer' : 'register', years: Math.min(3, Math.max(1, parseInt(d.years, 10) || 1)) }))
    .filter((d, i, all) => all.findIndex(x => x.name === d.name) === i)
    .slice(0, MAX);
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw != null) mem = tidy(JSON.parse(raw)); } catch { /* keep the in-memory copy */ }
    return mem.map(d => ({ ...d }));
  }
  function save(list) {
    mem = tidy(list);
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* storage off: memory only */ }
    subs.forEach(fn => fn(load()));
  }
  const basket = {
    MAX,
    items: load,
    get: name => load().find(d => d.name === name) || null,
    // adds, or switches the mode of a domain already inside; false when the basket is full
    put(name, mode = 'register') {
      const list = load(), d = list.find(x => x.name === name);
      if (d) d.mode = mode;
      else if (list.length >= MAX) return false;
      else list.push({ name, mode, years: 1 });
      save(list);
      return true;
    },
    update(name, patch) { save(load().map(d => d.name === name ? { ...d, ...patch } : d)); },
    remove(name) { save(load().filter(d => d.name !== name)); },
    clear() { save([]); },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  // another tab changed it
  addEventListener('storage', e => { if (e.key === KEY || e.key === null) subs.forEach(fn => fn(load())); });

  /* ---------- Header: the basket as a 1U counter next to "Přihlásit" ---------- */
  const login = $('.top .nav__login');
  if (login) {
    const logo = $('.top .logo');
    let href = 'kosik.html';
    try { href = new URL('kosik.html', logo ? logo.href : location.href).href; } catch { /* relative link is fine */ }
    const cart = Object.assign(document.createElement('a'), { className: 'nav__cart', href });
    cart.innerHTML = '<span class="nav__cart-label">Košík</span><span class="cart-u" aria-hidden="true"><i class="led"></i><b>0</b></span>';
    if (/\/kosik\.html$/.test(location.pathname)) cart.setAttribute('aria-current', 'page');
    login.before(cart);
    const led = $('.led', cart), num = $('b', cart);
    let last = -1, flash;
    const paint = list => {
      const n = list.length;
      num.textContent = n;
      cart.setAttribute('aria-label', n ? `Košík domén, položek: ${n}` : 'Košík domén, prázdný');
      led.className = 'led' + (n ? ' led--on' : '');
      if (last >= 0 && n !== last) { // activity blink, as a drive LED would
        clearTimeout(flash);
        led.className = 'led led--act';
        flash = setTimeout(() => { led.className = 'led' + (n ? ' led--on' : ''); }, 260);
      }
      last = n;
    };
    paint(load());
    basket.onChange(paint);
  }

  return { panel, drawRails, cleanDomain, checkDomain, checkQueued, catalog, domainPrice, basket };
})();
