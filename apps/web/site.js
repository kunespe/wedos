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
  let panel = 'https://panel.serveros.cz';
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

  // resolves to { name, available: true | false | null, reason?, price }; never throws
  async function checkDomain(name) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    try {
      const res = await fetch(`${panel}/api/domain-check?name=${encodeURIComponent(name)}`, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      const json = await res.json().catch(() => ({}));
      if (typeof json.available === 'boolean' || json.reason) return { name, price: null, ...json };
      throw new Error(res.status);
    } catch {
      return { name, available: null, price: null, reason: 'Dostupnost teď nejde ověřit. Zkuste to za chvíli, nebo ji ověříme my po objednávce.' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { panel, drawRails, cleanDomain, checkDomain };
})();
