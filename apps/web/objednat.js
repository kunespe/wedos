/* Servero: order form. Plans come from plans.json, a copy of /catalog/plans.json (see main.js). */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Rails: U numbers along the page ---------- */
  const U = 44;
  function drawRails() {
    const count = Math.floor($('.rack').offsetHeight / U);
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

  /* ---------- Config ----------
     The panel origin can be overridden with <meta name="servero-panel" content="...">.
     A localhost override only applies while this page is served from localhost too,
     so a dev value left in the HTML never sends real orders to a dev machine. */
  const isLocal = h => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(h);
  let PANEL_ORIGIN = 'https://panel.servero.cz';
  const metaPanel = $('meta[name="servero-panel"]');
  if (metaPanel && metaPanel.content) {
    try {
      const u = new URL(metaPanel.content);
      if (!isLocal(u.hostname) || isLocal(location.hostname)) PANEL_ORIGIN = u.origin;
    } catch { /* malformed meta: keep the default */ }
  }
  const ARES = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/';
  const VAT = .21;
  const MAIL = 'info@servero.cz';

  const kc = n => new Intl.NumberFormat('cs-CZ').format(Math.round(n));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const months = n => n === 1 ? 'měsíc' : n < 5 ? 'měsíce' : 'měsíců';

  const form = $('#order');
  const el = name => form.elements[name];
  const pick = $('.pick');
  const alertBox = $('.alert');
  const submitBtn = $('.order__submit');

  /* ---------- State from the URL: ?plan=<code>&obdobi=mesic|rok ---------- */
  const q = new URLSearchParams(location.search);
  let planCode = q.get('plan') || '';
  let period = q.get('obdobi') === 'rok' ? 'year' : 'month';
  let data, plans = {}, catName = {}, mc = 10, domainPrice = null;

  function syncUrl() {
    if (!plans[planCode]) return;
    const p = new URLSearchParams({ plan: planCode });
    if (plans[planCode].monthly != null) p.set('obdobi', period === 'year' ? 'rok' : 'mesic');
    history.replaceState(null, '', '?' + p);
  }

  /* ---------- Plan picker + summary ---------- */
  function perMonth(p) { return period === 'year' ? p.monthly * mc / 12 : p.monthly; }
  function priceLabel(p) {
    return p.monthly == null ? 'Individuálně' : `${p.from ? 'od ' : ''}${kc(perMonth(p))} Kč / měs.`;
  }

  function renderPick() {
    pick.innerHTML = data.categories.map(c => `
      <div class="pick__group" role="group" aria-labelledby="cat-${c.id}">
        <p class="pick__cat" id="cat-${c.id}">${esc(c.name)}</p>
        <div class="pick__list">${data.plans.filter(p => p.category === c.id).map(p => `
          <label class="pick__opt">
            <input type="radio" name="plan" value="${p.code}"${p.code === planCode ? ' checked' : ''}>
            <i class="led"></i><span class="pick__name">${esc(p.name)}</span><span class="pick__price" data-price="${p.code}"></span>
          </label>`).join('')}
        </div>
      </div>`).join('');
    updatePrices();
  }
  function updatePrices() {
    $$('[data-price]', pick).forEach(s => { s.textContent = priceLabel(plans[s.dataset.price]); });
  }

  const sName = $('.summary__name'), sMeta = $('.summary__meta'), sLcd = $('.summary .lcd__text');
  const sRows = $('.summary__rows'), sVat = $('.summary__vat');
  function renderSummary() {
    const p = plans[planCode];
    const rows = [];
    if (!p) {
      sName.textContent = 'Vyberte službu';
      sMeta.textContent = '';
      sLcd.textContent = '-- Kč';
    } else {
      sName.textContent = p.name;
      sLcd.textContent = priceLabel(p);
      if (p.monthly == null) {
        sMeta.textContent = catName[p.category];
        rows.push(['Cena', 'domluvíme podle rozsahu']);
      } else {
        const od = p.from ? 'od ' : '';
        const base = period === 'year' ? p.monthly * mc : p.monthly;
        const free = 12 - mc;
        sMeta.textContent = `${catName[p.category]}, ${period === 'year' ? `ročně (${free} ${months(free)} zdarma)` : 'měsíčně'}`;
        rows.push([period === 'year' ? 'Za rok bez DPH' : 'Za měsíc bez DPH', `${od}${kc(base)} Kč`]);
        rows.push(['DPH 21 %', `${od}${kc(base * VAT)} Kč`]);
        rows.push(['Celkem s DPH', `${od}${kc(base * (1 + VAT))} Kč`, true]);
      }
    }
    const domain = values().domain;
    if (domain && formChoice('domainMode') === 'register') {
      rows.push([`Registrace ${domain}`, /\.cz$/.test(domain) && domainPrice ? `${kc(domainPrice)} Kč / rok` : 'cenu potvrdíme']);
    }
    sRows.innerHTML = rows.map(([k, v, total]) => `<div${total ? ' class="is-total"' : ''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  }

  /* ---------- Values + validation ---------- */
  const formChoice = name => { const r = $(`input[name="${name}"]:checked`, form); return r ? r.value : ''; };
  function values() {
    const v = n => (el(n) ? el(n).value : '').trim();
    const domain = v('domain').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
    let ico = v('ico').replace(/\s/g, '');
    if (/^\d{1,7}$/.test(ico)) ico = ico.padStart(8, '0');
    return {
      plan: plans[planCode] ? planCode : '',
      period,
      domain,
      domainMode: domain ? formChoice('domainMode') : 'none',
      name: v('name'),
      email: v('email'),
      phone: v('phone'),
      company: v('company'),
      ico,
      dic: v('dic').replace(/\s/g, '').toUpperCase(),
      address: v('address'),
      note: v('note'),
      website: el('website').value,
      consent: el('consent').checked,
    };
  }

  function icoOk(v) { // Czech IČO: 8 digits, weighted mod 11 check digit
    if (!/^\d{8}$/.test(v)) return false;
    const sum = [...v.slice(0, 7)].reduce((s, d, i) => s + d * (8 - i), 0);
    return (11 - sum % 11) % 10 === +v[7];
  }

  // order = visual order, so the first error is the first one on the page
  const rules = {
    plan: v => v ? '' : 'Vyberte službu.',
    domain: v => !v || /^(?=.{3,253}$)([\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+\p{L}{2,63}$/iu.test(v) ? '' : 'Zadejte doménu ve tvaru vasefirma.cz.',
    name: v => v.length >= 3 ? '' : 'Vyplňte jméno a příjmení.',
    email: v => !v ? 'Vyplňte e-mail, pošleme na něj přístupy.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Tohle nevypadá jako e-mail.',
    phone: v => !v || (/^\+?[\d\s()-]{9,20}$/.test(v) && v.replace(/\D/g, '').length >= 9) ? '' : 'Zadejte telefon, třeba +420 777 123 456.',
    ico: v => !v || icoOk(v) ? '' : 'IČO má 8 číslic a platný kontrolní součet.',
    dic: v => !v || /^[A-Z]{2}[0-9A-Z]{8,12}$/.test(v) ? '' : 'DIČ zadejte ve tvaru CZ12345678.',
    note: v => v.length <= 2000 ? '' : 'Poznámka je moc dlouhá, nejvýš 2000 znaků.',
    consent: v => v ? '' : 'Bez souhlasu s obchodními podmínkami objednávku nepřijmeme.',
  };
  const alias = { domainMode: 'domain', period: 'plan' }; // server keys without their own field

  function control(name) { return name === 'plan' ? pick : el(name); }
  function setError(name, msg) {
    const err = $('#err-' + name), ctrl = control(name);
    if (!err) return false;
    err.textContent = msg || '';
    err.hidden = !msg;
    if (ctrl && ctrl.setAttribute) msg ? ctrl.setAttribute('aria-invalid', 'true') : ctrl.removeAttribute('aria-invalid');
    return true;
  }
  function focusField(name) {
    if (name === 'plan') ($('input[name="plan"]:checked', pick) || $('input[name="plan"]', pick) || pick).focus();
    else if (control(name)) control(name).focus();
  }
  function validate() {
    const body = values();
    let first = '';
    for (const [k, rule] of Object.entries(rules)) {
      const msg = rule(body[k]);
      setError(k, msg);
      if (msg && !first) first = k;
    }
    return { body, first };
  }
  function check(name) { if (rules[name]) setError(name, rules[name](values()[name])); }

  // re-check a field once it has been touched: on blur with a value, live while it is invalid
  form.addEventListener('focusout', e => { const n = e.target.name; if (n && rules[n] && e.target.value && e.target.type !== 'radio') check(n); });
  form.addEventListener('input', e => {
    const n = e.target.name;
    if (n && e.target.getAttribute('aria-invalid') === 'true') check(n);
    if (n === 'domain') renderSummary();
  });
  form.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'plan') { planCode = t.value; setError('plan', ''); renderSummary(); syncUrl(); }
    if (t.name === 'period') { period = t.value; updatePrices(); renderSummary(); syncUrl(); }
    if (t.name === 'domainMode') renderSummary();
  });
  // the consent box lives in the summary (form="order"), outside the form's DOM subtree
  el('consent').addEventListener('change', () => check('consent'));

  /* ---------- ARES: fill company from IČO ---------- */
  const aresBtn = $('.ares'), aresStatus = $('#ares-status');
  aresBtn.addEventListener('click', async () => {
    const ico = values().ico;
    const msg = ico ? rules.ico(ico) : 'Zadejte IČO, firmu pak načteme z ARES.';
    setError('ico', msg);
    if (msg) { el('ico').focus(); return; }
    el('ico').value = ico;
    aresBtn.disabled = true;
    aresStatus.textContent = 'Hledám v ARES…';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(ARES + ico, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      if (res.status === 404 || res.status === 400) throw new Error('notfound');
      if (!res.ok) throw new Error('down');
      const s = await res.json();
      const addr = s.sidlo && s.sidlo.textovaAdresa
        || (s.adresaDorucovaci ? [s.adresaDorucovaci.radekAdresy1, s.adresaDorucovaci.radekAdresy2, s.adresaDorucovaci.radekAdresy3].filter(Boolean).join(', ') : '');
      el('company').value = s.obchodniJmeno || '';
      el('dic').value = s.dic || '';
      el('address').value = addr;
      ['company', 'dic', 'address'].forEach(n => setError(n, ''));
      aresStatus.textContent = `Načteno z ARES: ${s.obchodniJmeno || ico}${s.dic ? '' : ', bez DIČ'}`.replace(/\.?$/, '.');
    } catch (err) {
      aresStatus.textContent = err.message === 'notfound'
        ? 'Subjekt s tímto IČO v ARES není. Zkontrolujte číslo.'
        : 'ARES teď neodpovídá. Údaje prosím vyplňte ručně.';
    } finally {
      clearTimeout(timer);
      aresBtn.disabled = false;
    }
  });

  /* ---------- Submit ---------- */
  function showAlert(text, withMail) {
    alertBox.textContent = text || '';
    if (withMail) {
      const a = document.createElement('a');
      a.href = `mailto:${MAIL}?subject=${encodeURIComponent('Objednávka ' + (planCode || ''))}`;
      a.textContent = MAIL;
      alertBox.append(' Nebo nám napište na ', a, '.');
    }
    alertBox.hidden = !text;
  }
  let sending = false;
  function setSending(on) {
    sending = on;
    submitBtn.disabled = on;
    form.setAttribute('aria-busy', on);
    $('span', submitBtn).textContent = on ? 'Odesílám…' : 'Odeslat objednávku';
    $('.led', submitBtn).className = 'led ' + (on ? 'led--act' : 'led--on');
  }
  function success(id) {
    $('.order__grid').hidden = true;
    $('.page-head').hidden = true;
    const done = $('.done');
    $('.done__id', done).textContent = `Objednávka č. ${id} je u nás.`;
    done.hidden = false;
    done.focus({ preventScroll: true });
    scrollTo({ top: 0 });
    drawRails();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    showAlert();
    const { body, first } = validate();
    if (first) { showAlert('Zkontrolujte prosím označená pole.'); focusField(first); return; }

    setSending(true);
    let res, json = {};
    try {
      res = await fetch(`${PANEL_ORIGIN}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...body, consent: true }),
      });
      json = await res.json().catch(() => ({}));
    } catch {
      setSending(false);
      showAlert('Objednávku se nepodařilo odeslat, nejspíš vypadlo spojení. Zkuste to znovu.', true);
      return;
    }
    setSending(false);

    if (res.status === 201 && json.id != null) return success(json.id);
    if (res.status === 400 && json.errors && typeof json.errors === 'object') {
      const orphan = [];
      let firstBad = '';
      for (const [k, m] of Object.entries(json.errors)) {
        const name = alias[k] || k;
        if (setError(name, String(m))) firstBad = firstBad || name;
        else orphan.push(String(m));
      }
      showAlert(['Zkontrolujte prosím označená pole.', ...orphan].join(' '));
      if (firstBad) focusField(firstBad);
      return;
    }
    if (res.status === 429) return showAlert('Zkuste to prosím za chvíli.');
    showAlert('Něco se u nás pokazilo a objednávka nedošla.', true);
  });

  /* ---------- Load plans ---------- */
  fetch('plans.json?v=4')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => {
      data = d;
      mc = d.yearlyMonthsCharged;
      d.plans.forEach(p => { plans[p.code] = p; });
      d.categories.forEach(c => { catName[c.id] = c.name; });
      const dom = d.extras.find(x => x.code === 'domena-cz');
      domainPrice = dom ? dom.price : null;
      if (!plans[planCode]) planCode = '';
      $('.seg__free', form).textContent = `${12 - mc} ${months(12 - mc)} zdarma`;
      $(`input[name="period"][value="${period}"]`, form).checked = true;
      sVat.textContent = d.vatNote;
      renderPick();
      renderSummary();
      drawRails();
    })
    .catch(() => {
      pick.innerHTML = `<p class="field__err">Nabídku se nepodařilo načíst. Obnovte stránku, nebo napište na <a href="mailto:${MAIL}">${MAIL}</a>.</p>`;
      submitBtn.disabled = true;
    });
})();
