/* Serveros: the domain basket page. The basket itself lives in site.js (localStorage), prices in plans.json. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);

  const { drawRails, catalog, domainPrice, basket } = window.servero; // from site.js

  const VAT = .21;
  const kc = n => new Intl.NumberFormat('cs-CZ').format(Math.round(n));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const years = n => n === 1 ? '1 rok' : `${n} roky`;
  const domains = n => n === 1 ? 'doména' : n > 1 && n < 5 ? 'domény' : 'domén';
  const MODE = { register: 'registrace', transfer: 'převod' };
  const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  const list = $('.bitems'), upsell = $('.upsell__list');
  const sName = $('.summary__name'), sMeta = $('.summary__meta'), sLcd = $('.summary .lcd__text');
  const sRows = $('.summary__rows'), sNote = $('.summary__note'), go = $('.basket__go');
  let data = null; // catalog; without it every price reads "cenu potvrdíme"

  /* ---------- Items: one light 1U unit per domain ---------- */
  function itemHTML(d) {
    const price = domainPrice(data, d.name), id = 'd-' + d.name.replace(/[^a-z0-9]/g, '-');
    return `<li class="bitem" data-name="${esc(d.name)}">
      <span class="ear ear--light"><i class="screw"></i><i class="screw"></i></span>
      <div class="bitem__body">
        <p class="bitem__name">${esc(d.name)}<small>${price ? `${kc(price)} Kč / rok` : 'cenu potvrdíme e-mailem'}</small></p>
        <fieldset class="seg">
          <legend class="sr-only">Co s doménou ${esc(d.name)}</legend>
          <label><input type="radio" name="${id}-mode" value="register"${d.mode === 'register' ? ' checked' : ''}><span>Registrace</span></label>
          <label><input type="radio" name="${id}-mode" value="transfer"${d.mode === 'transfer' ? ' checked' : ''}><span>Převod</span></label>
        </fieldset>
        <label class="sr-only" for="${id}-years">Na kolik let ${esc(d.name)}</label>
        <select class="select" id="${id}-years" data-years>${[1, 2, 3].map(n => `<option value="${n}"${n === d.years ? ' selected' : ''}>${years(n)}</option>`).join('')}</select>
        <p class="bitem__price">${price ? `${kc(price * d.years)} Kč<small>bez DPH</small>` : 'cenu potvrdíme'}</p>
        <button class="rm" type="button" aria-label="Odebrat ${esc(d.name)}" title="Odebrat">${X}</button>
      </div>
      <span class="ear ear--light"><i class="screw"></i><i class="screw"></i></span>
    </li>`;
  }

  function render() {
    const items = basket.items();
    // keep focus on the control that triggered a re-render (mode, years)
    const f = document.activeElement, fItem = f && f.closest('.bitem'), fSel = f && (f.matches('[data-years]') ? '[data-years]' : f.matches('input') ? `input[value="${f.value}"]` : '');

    list.innerHTML = items.length ? items.map(itemHTML).join('') : `<li class="bitem">
      <span class="ear ear--light"><i class="screw"></i><i class="screw"></i></span>
      <div class="bempty">
        <p class="lcd"><i class="led"></i><span>košík je prázdný</span><i class="lcd__cursor" aria-hidden="true"></i></p>
        <p>Najděte doménu na úvodní stránce. Ověříme ji v registru a jedním klikem ji sem přidáte.</p>
        <a class="btn" href="index.html#domena"><i class="led led--on"></i>Najít doménu</a>
      </div>
      <span class="ear ear--light"><i class="screw"></i><i class="screw"></i></span>
    </li>`;
    if (fItem && fSel) { const el = $(`.bitem[data-name="${CSS.escape(fItem.dataset.name)}"] ${fSel}`, list); if (el) el.focus(); }

    // summary: known prices excl. VAT, the rest is confirmed by e-mail
    let known = 0, unknown = 0;
    const rows = items.map(d => {
      const p = domainPrice(data, d.name);
      if (p) known += p * d.years; else unknown++;
      return [`${d.name}, ${MODE[d.mode]}, ${years(d.years)}`, p ? `${kc(p * d.years)} Kč` : 'potvrdíme'];
    });
    if (items.length) {
      rows.push(['Mezisoučet bez DPH', `${kc(known)} Kč`, true]);
      if (known) rows.push(['S DPH 21 %', `${kc(known * (1 + VAT))} Kč`]);
    }
    sName.textContent = `${items.length} ${domains(items.length)}`;
    sMeta.textContent = items.length ? `${items.filter(d => d.mode === 'register').length}× registrace, ${items.filter(d => d.mode === 'transfer').length}× převod` : 'registrace a převody';
    sLcd.textContent = items.length ? `${kc(known)} Kč bez DPH` : '-- Kč';
    sRows.innerHTML = rows.map(([k, v, total]) => `<div${total ? ' class="is-total"' : ''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    sNote.textContent = unknown
      ? `Cenu ${unknown === 1 ? 'jedné domény' : `${unknown} domén`} potvrdíme e-mailem, než ji objednáme. Mezisoučet obsahuje jen známé ceny.`
      : items.length ? 'Registraci potvrdíme e-mailem, než doménu objednáme.' : '';
    go.hidden = !items.length;
    drawRails();
  }

  list.addEventListener('change', e => {
    const item = e.target.closest('.bitem');
    if (!item || !item.dataset.name) return;
    if (e.target.matches('[data-years]')) basket.update(item.dataset.name, { years: +e.target.value });
    else if (e.target.type === 'radio') basket.update(item.dataset.name, { mode: e.target.value });
  });
  list.addEventListener('click', e => {
    const rm = e.target.closest('.rm');
    if (!rm) return;
    const item = rm.closest('.bitem'), next = item.nextElementSibling || item.previousElementSibling;
    const nextName = next && next.dataset.name;
    basket.remove(item.dataset.name);
    // focus the neighbour's remove button, or the empty state's link
    const target = nextName ? $(`.bitem[data-name="${CSS.escape(nextName)}"] .rm`, list) : $('a', list);
    if (target) target.focus();
  });
  basket.onChange(render);

  /* ---------- Hosting suggestions: the two tariffs people pair with a domain ---------- */
  function renderUpsell() {
    const pick = ['web-start', 'wp-provoz'].map(code => data && data.plans.find(p => p.code === code)).filter(Boolean);
    $('.upsell').hidden = !pick.length;
    upsell.innerHTML = pick.map(p => `<article class="upsell__card">
      <h3>${esc(p.name)}</h3>
      <p class="upsell__price">${p.from ? 'od ' : ''}${kc(p.monthly)} Kč <small>/ měs. bez DPH</small></p>
      <p>${p.features.slice(0, 3).map(esc).join(' · ')}</p>
      <a class="btn btn--ghost btn--sm" href="objednat.html?plan=${encodeURIComponent(p.code)}">Objednat s doménami</a>
    </article>`).join('');
  }

  render();
  catalog()
    .then(d => { data = d; render(); renderUpsell(); })
    .catch(() => { $('.upsell').hidden = true; });
})();
