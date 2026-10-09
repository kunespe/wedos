(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, reduced ? 0 : ms));
  const setLed = (el, state) => { el.className = 'led' + (state ? ' led--' + state : ''); };

  const { drawRails, panel, cleanDomain, checkQueued, catalog, domainPrice, basket } = window.servero; // from site.js
  const U = 44; // one rack unit, as in site.js

  const pos = $('.rail-pos'), posLabel = $('.rail-pos span');
  function updatePos() {
    const u = Math.max(1, Math.round((scrollY + innerHeight / 2) / U));
    posLabel.textContent = 'U' + String(u).padStart(2, '0');
    pos.classList.toggle('is-shown', scrollY > 200);
  }

  /* ---------- Hero: server boot ---------- */
  const chassis = $('.chassis');
  const baysEl = $('.bays');
  for (let i = 0; i < 12; i++) baysEl.insertAdjacentHTML('beforeend', '<div class="bay"><i class="led"></i><i class="led"></i></div>');
  const bays = $$('.bay', baysEl).map(b => $$('.led', b));
  const letters = $$('.wordmark span');
  const wordmark = $('.wordmark');
  function fitWordmark() { // size the wordmark to fill the panel exactly
    wordmark.style.fontSize = '100px';
    const avail = wordmark.clientWidth;
    const used = letters.reduce((w, l) => w + l.getBoundingClientRect().width, 0);
    wordmark.style.fontSize = Math.floor(100 * avail / used * 0.97) + 'px';
  }
  fitWordmark();
  addEventListener('resize', fitWordmark);
  document.fonts && document.fonts.ready.then(fitWordmark);
  const lcd = $('.chassis .lcd__text');
  const ctrl = Object.fromEntries($$('[data-led]').map(l => [l.dataset.led, l]));
  const bootedAt = Date.now();
  let booting = false, lcdTimer, flickerTimer;

  async function type(text) {
    lcd.textContent = '';
    for (const ch of text) { lcd.textContent += ch; await wait(22); }
  }

  async function boot() {
    if (booting) return;
    booting = true;
    clearTimeout(lcdTimer); clearTimeout(flickerTimer);
    chassis.dataset.state = 'off';
    letters.forEach(l => l.classList.remove('is-lit'));
    bays.flat().forEach(l => setLed(l));
    Object.values(ctrl).forEach(l => setLed(l));
    lcd.textContent = ' ';
    await wait(500);

    chassis.dataset.state = 'booting';
    setLed(ctrl.sys, 'act');
    await type('POST ...');
    await wait(250);
    await type('Kontrola disků');
    for (let i = 0; i < bays.length; i++) {
      setLed(bays[i][0], 'act');
      await wait(55);
      setLed(bays[i][0], 'on');
      lcd.textContent = `Kontrola disků ${String(i + 1).padStart(2, '0')}/12`;
    }
    setLed(ctrl.hdd, 'on');
    await wait(200);
    await type('Síť eth0 10 Gbit/s');
    setLed(ctrl.net, 'on');
    await wait(250);
    for (const l of letters) { l.classList.add('is-lit'); await wait(70); }
    setLed(ctrl.sys, 'on');
    chassis.dataset.state = 'on';
    await type('Online. Vše běží.');
    booting = false;
    await wait(1600);
    cycleLcd();
    flicker();
  }

  const fmt = n => String(n).padStart(2, '0');
  const pragueTime = () => new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const lcdMessages = [
    () => { const s = Math.floor((Date.now() - bootedAt) / 1000); return `uptime ${fmt(Math.floor(s / 3600))}:${fmt(Math.floor(s / 60) % 60)}:${fmt(s % 60)}`; },
    () => `load ${(Math.random() * .2 + .05).toFixed(2)} ${(Math.random() * .2 + .08).toFixed(2)} ${(Math.random() * .2 + .1).toFixed(2)}`,
    () => 'záloha 03:00 ok',
    () => `deploy #${1200 + Math.floor((Date.now() / 36e5) % 99)} ok`,
    () => `Plzeň ${pragueTime()}`,
    () => 'ssl platné 87 dní',
  ];
  let msgIdx = 0, msgStart = 0;
  function cycleLcd() {
    if (booting) return;
    if (!msgStart) msgStart = Date.now();
    lcd.textContent = lcdMessages[msgIdx]();
    if (Date.now() - msgStart > 2600) { msgIdx = (msgIdx + 1) % lcdMessages.length; msgStart = Date.now(); }
    lcdTimer = setTimeout(cycleLcd, 250);
  }

  function flicker() {
    if (booting || reduced) return;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const led = bays[Math.floor(Math.random() * bays.length)][1];
      setLed(led, 'act');
      setTimeout(() => setLed(led), 60 + Math.random() * 140);
    }
    setLed(ctrl.hdd, Math.random() > .5 ? 'act' : 'on');
    flickerTimer = setTimeout(flicker, 90 + Math.random() * 260);
  }

  $('.power').addEventListener('click', boot);
  boot();

  /* ---------- Clock ---------- */
  const clock = $('.clock__time');
  const tick = () => { clock.textContent = pragueTime(); };
  tick(); setInterval(tick, 15000);

  /* ---------- Service units: pull out ---------- */
  $$('.unit__panel').forEach(btn => {
    btn.addEventListener('click', () => {
      const unit = btn.closest('.unit');
      const open = !unit.classList.contains('is-open');
      unit.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open);
      setTimeout(drawRails, 600);
    });
  });

  /* ---------- Pipeline ---------- */
  const stations = $$('.stations li');
  const packet = $('.packet');
  const log = $('.log');
  const steps = [
    ['$ git push origin main', 'Enumerating objects: 14, done.'],
    ['▸ build   docker build -t app:3f9c2e1', '✓ build   image 184 MB, 38 s'],
    ['▸ testy   npm test', '✓ testy   214 prošlo, 0 selhalo'],
    ['▸ deploy  rolling update 3/3', '✓ deploy  zdravé, 0 s výpadku'],
    ['▸ živě    https://serveros.cz', '✓ živě    200 OK, 84 ms'],
  ];
  const addLog = (text, cls) => {
    const line = document.createElement('div');
    line.textContent = text;
    if (cls) line.className = cls;
    log.appendChild(line);
    while (log.children.length > 6) log.firstChild.remove();
  };
  let pipeRunning = false, pipeVisible = false;
  const packetLeft = i => (10 + i * 20) + '%';
  async function runPipe() {
    if (pipeRunning) return;
    pipeRunning = true;
    while (pipeVisible) {
      stations.forEach(s => s.className = '');
      log.innerHTML = '';
      packet.style.opacity = 1;
      for (let i = 0; i < stations.length; i++) {
        packet.style.left = packetLeft(i);
        stations[i].className = 'is-run';
        addLog(steps[i][0], 'run');
        await wait(i === 0 ? 500 : 1100);
        stations[i].className = 'is-done';
        addLog(steps[i][1], i === 0 ? '' : 'ok');
        await wait(250);
      }
      packet.style.opacity = 0;
      await wait(3200);
    }
    pipeRunning = false;
  }
  if (reduced) {
    stations.forEach(s => s.className = 'is-done');
    steps.forEach(s => addLog(s[1], 'ok'));
  } else {
    new IntersectionObserver(([e]) => {
      pipeVisible = e.isIntersecting;
      if (pipeVisible) runPipe();
    }, { threshold: .35 }).observe($('.pipe'));
  }

  /* ---------- Status bars ----------
     Decorative first (a calm quarter), then replaced by real days from the panel's /stav.json
     once monitoring has at least a week of measurements. */
  const bars = $('.bars'), tip = $('.bars__tip');
  const today = new Date();
  const df = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long' });
  const maintDay = 61;
  for (let i = 0; i < 90; i++) {
    const d = new Date(today); d.setDate(today.getDate() - (89 - i));
    const s = document.createElement('span');
    const maint = i === maintDay;
    if (maint) s.className = 'is-maint';
    s.dataset.tip = `${df.format(d)}: ${maint ? 'plánovaná údržba 02:00 až 02:12' : '100 % v provozu'}`;
    bars.appendChild(s);
  }
  const showTip = t => { tip.textContent = t || ' '; };
  bars.addEventListener('pointermove', e => { if (e.target.dataset.tip) showTip(e.target.dataset.tip); });
  bars.addEventListener('pointerleave', () => showTip());

  const pct = n => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n) + ' %';
  async function realBars() {
    let st;
    try {
      const res = await fetch(`${panel}/stav.json`, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      st = await res.json();
    } catch { return; } // panel unreachable: the decorative bars stay
    const days = Array.isArray(st.days) ? st.days.slice(-90) : [];
    const measured = days.filter(d => d.uptime != null);
    if (!st.enabled || measured.length < 7) return;
    bars.replaceChildren(...days.map(d => {
      const s = document.createElement('span');
      if (d.uptime == null) s.className = 'is-none';
      else if (d.uptime < 99) s.className = 'is-fault';
      else if (d.uptime < 99.9) s.className = 'is-maint';
      s.dataset.tip = `${df.format(new Date(d.date + 'T12:00:00'))}: ${d.uptime == null ? 'bez měření' : pct(d.uptime) + ' v provozu'}`;
      return s;
    }));
    const avg = measured.reduce((a, d) => a + d.uptime, 0) / measured.length;
    $('#status-lead').textContent = `Skutečná dostupnost z našeho monitoringu, průměr ${pct(avg)}. Najeďte na den.`;
    bars.setAttribute('aria-label', `Graf dostupnosti za 90 dní, průměr ${pct(avg)}`);
  }
  realBars();

  /* ---------- Process: each rack unit powers on as it scrolls into view ---------- */
  const stages = $$('.stages .stage');
  if (reduced || !('IntersectionObserver' in window)) stages.forEach(el => el.classList.add('is-on'));
  else {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-on'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -25% 0px', threshold: .4 });
    stages.forEach(el => io.observe(el));
  }

  /* ---------- Parallax (scroll-driven) ---------- */
  const photo = $('.photo'), photoImg = $('.photo__img');

  let ticking = false;
  function onScroll() {
    updatePos();
    if (!reduced) {
      const pr = photo.getBoundingClientRect();
      if (pr.bottom > 0 && pr.top < innerHeight) {
        const t = (pr.top + pr.height / 2 - innerHeight / 2) / innerHeight;
        photoImg.style.transform = `translate3d(0, ${t * -12}%, 0)`;
      }
    }
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- Domain search: the typed TLD plus the popular ones, one 1U row each ----------
     The LCD sums the answer up; rows put domains into the basket (site.js), which kosik.html
     and objednat.html read. Lookups go through site.js's queue: cached, at most 6 at once. */
  const kc = n => new Intl.NumberFormat('cs-CZ').format(Math.round(n));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plural = (n, one, few, many) => n === 1 ? one : n > 1 && n < 5 ? few : many;
  const dsForm = $('.dsearch');
  if (dsForm) {
    const POPULAR = ['cz', 'eu', 'sk', 'com'];
    const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;
    const dsInput = $('input', dsForm), dsBtn = $('button', dsForm);
    const dsOut = $('.dsearch__out'), dsText = $('.dsearch__text', dsOut), dsLed = $('.led', dsOut), dsAct = $('.dsearch__act');
    const dsList = $('.dres', dsForm);
    let prices = null, rows = [], run = 0, debounce;
    catalog().then(d => { prices = d; render(); }).catch(() => {}); // without it every price reads "cenu potvrdíme"

    const show = (state, text) => {
      dsOut.dataset.state = state;
      dsLed.className = 'led' + ({ free: ' led--on', busy: ' led--act', taken: ' led--fault' }[state] || '');
      dsText.textContent = text;
    };
    // "https://www.Firma.de" -> firma.de, then firma.cz, .eu, .sk, .com; a bare "firma" -> the popular four
    function namesFor(value) {
      const clean = cleanDomain(value);
      const dot = clean.indexOf('.');
      const base = dot < 0 ? clean : clean.slice(0, dot);
      if (!LABEL.test(base)) return { base, names: [] };
      return { base, names: [...new Set([...(dot < 0 ? [] : [clean]), ...POPULAR.map(t => `${base}.${t}`)])] };
    }
    const stateOf = r => !r ? 'busy' : r.available === true ? 'free' : r.available === false ? 'taken' : r.invalid ? 'bad' : 'unknown';
    const STATE = { busy: 'ověřuji…', free: 'volná', taken: 'obsazená', unknown: 'ověříme ručně', bad: 'neplatná' };
    const LED = { busy: 'led--act', free: 'led--on', taken: 'led--fault', unknown: 'led--act', bad: 'led--fault' };

    function rowHTML({ name, r }) {
      const st = stateOf(r), inside = basket.get(name);
      const dot = name.indexOf('.');
      const price = domainPrice(prices, name);
      let btn = '';
      if (st !== 'busy' && st !== 'bad') {
        const mode = st === 'taken' ? 'transfer' : 'register';
        const on = !!inside && inside.mode === mode;
        const label = mode === 'transfer' ? (on ? 'Převod v košíku' : 'Převést k nám') : (on ? 'V košíku' : 'Do košíku');
        btn = `<button class="btn btn--sm dres__btn" type="button" data-name="${esc(name)}" data-mode="${mode}" aria-pressed="${on}"><i class="led${on ? ' led--on' : ''}"></i>${label}</button>`;
      }
      return `<li class="dres__row" data-state="${st}">
        <i class="led ${LED[st]}"></i>
        <span class="dres__name">${esc(name.slice(0, dot))}<span>${esc(name.slice(dot))}</span></span>
        <span class="dres__state"${r && r.reason ? ` title="${esc(r.reason)}"` : ''}>${STATE[st]}</span>
        <span class="dres__price">${st === 'bad' ? '' : price ? `${kc(price)} Kč / rok` : 'cenu potvrdíme'}</span>
        ${btn}
      </li>`;
    }
    function render() {
      const focused = document.activeElement && document.activeElement.closest('.dres__btn');
      const keep = focused ? focused.dataset.name : '';
      dsList.innerHTML = rows.map(rowHTML).join('');
      dsList.hidden = !rows.length;
      if (keep) { const b = $(`.dres__btn[data-name="${CSS.escape(keep)}"]`, dsList); if (b) b.focus(); }
      const n = basket.items().length;
      dsAct.replaceChildren();
      if (n) dsAct.insertAdjacentHTML('beforeend', `<a class="btn btn--light" href="kosik.html"><i class="led led--on"></i>Košík (${n}), pokračovat</a>`);
      drawRails();
    }
    function summary(base) {
      const count = s => rows.filter(x => stateOf(x.r) === s).length;
      if (count('busy')) return show('busy', `ověřuji ${base} v ${rows.length} ${plural(rows.length, 'koncovce', 'koncovkách', 'koncovkách')} …`);
      const free = count('free'), taken = count('taken'), unknown = count('unknown') + count('bad');
      const parts = [];
      if (free) parts.push(`${free} ${plural(free, 'volná', 'volné', 'volných')}`);
      if (taken) parts.push(`${taken} ${plural(taken, 'obsazená', 'obsazené', 'obsazených')}`);
      if (unknown) parts.push(`${unknown} ověříme ručně`);
      show(free ? 'free' : taken && !unknown ? 'taken' : 'err', `${base}: ${parts.join(', ')}`);
    }

    async function search(now) {
      clearTimeout(debounce);
      const { base, names } = namesFor(dsInput.value);
      if (!names.length) {
        if (now) { show('err', base ? 'jen písmena, číslice a pomlčky, třeba firma' : 'napište doménu, třeba firma.cz'); dsInput.focus(); }
        return;
      }
      if (rows.map(x => x.name).join() === names.join() && rows.every(x => x.r)) return; // same search, answers on screen
      const id = ++run;
      rows = names.map(name => ({ name, r: null }));
      render();
      summary(base);
      if (now) dsBtn.disabled = true;
      await Promise.all(names.map(async (name, i) => {
        const r = await checkQueued(name);
        if (id !== run) return; // a newer search took over the rows
        rows[i] = { name, r };
        render();
        summary(base);
      }));
      if (id === run) dsBtn.disabled = false;
    }
    dsForm.addEventListener('submit', e => {
      e.preventDefault();
      const clean = cleanDomain(dsInput.value);
      if (clean) dsInput.value = clean;
      search(true);
    });
    // live while typing, once the name settles; site.js caches answers so retyping costs nothing
    dsInput.addEventListener('input', () => {
      clearTimeout(debounce);
      if (cleanDomain(dsInput.value).replace(/\..*$/, '').length >= 2) debounce = setTimeout(() => search(false), 700);
    });
    dsList.addEventListener('click', e => {
      const b = e.target.closest('.dres__btn');
      if (!b) return;
      const { name, mode } = b.dataset, inside = basket.get(name);
      if (inside && inside.mode === mode) basket.remove(name);
      else if (!basket.put(name, mode)) show('err', `košík je plný, nejvýš ${basket.MAX} domén`);
    });
    basket.onChange(render);
    render();
  }

  /* ---------- Pricing: tabs rendered from plans.json ----------
     plans.json is a copy of /catalog/plans.json, the single source of prices.
     Copy step (deploy runs it, run it by hand after editing the catalog):
       cp catalog/plans.json apps/web/plans.json
     For local dev the copied file simply stays in apps/web next to index.html. */
  const pricing = $('.pricing');
  const months = n => n === 1 ? 'měsíc' : n < 5 ? 'měsíce' : 'měsíců';
  const extraUnit = { rok: '/ rok', hodina: '/ hod.' };

  async function initPricing() {
    let data;
    try {
      data = await catalog(); // site.js, shared with the domain search
    } catch {
      pricing.insertAdjacentHTML('afterend', '<p class="pricing__nojs">Ceník se teď nepodařilo načíst. Můžete rovnou <a href="objednat.html">objednat službu</a> nebo napsat na <a href="mailto:info@serveros.cz">info@serveros.cz</a>.</p>');
      return;
    }
    const mc = data.yearlyMonthsCharged, free = 12 - mc;
    const tablist = $('.tabs', pricing), panels = $('.pricing__panels', pricing);
    $('.seg__free', pricing).textContent = `${free} ${months(free)} zdarma`;

    tablist.innerHTML = data.categories.map((c, i) =>
      `<button class="tab" type="button" role="tab" id="tab-${c.id}" aria-controls="panel-${c.id}" aria-selected="${!i}" tabindex="${i ? -1 : 0}"><i class="led"></i>${esc(c.name)}</button>`).join('');
    panels.innerHTML = data.categories.map((c, i) =>
      `<div class="plans" role="tabpanel" id="panel-${c.id}" aria-labelledby="tab-${c.id}" tabindex="0"${i ? ' hidden' : ''}></div>`).join('');
    const tabs = $$('.tab', tablist);

    function select(tab, focus) {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      drawRails();
    }
    tablist.addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) select(t); });
    tablist.addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (i < 0 || to === undefined) return;
      e.preventDefault();
      select(tabs[(to + tabs.length) % tabs.length], true);
    });

    function planHTML(p, u) {
      const main = !!p.featured;
      const btn = main ? 'btn' : 'btn btn--ghost';
      const led = main ? '<i class="led led--on"></i>' : '';
      const yearly = $('input[name="obdobi"]:checked', pricing).value === 'rok';
      const od = p.from ? '<small>od</small> ' : '';
      let cost, cta;
      if (p.monthly == null) {
        cost = '<p class="plan__price">Individuálně</p><span class="plan__note">podle rozsahu</span>';
        cta = `<a class="${btn}" href="objednat.html?plan=${p.code}">${led}Domluvit</a>`;
      } else {
        const per = yearly ? p.monthly * mc / 12 : p.monthly;
        cost = `<p class="plan__price">${od}${kc(per)} <small>Kč / měs.</small></p>` +
          `<span class="plan__note">${yearly ? `${p.from ? 'od ' : ''}${kc(p.monthly * mc)} Kč za rok` : 'platba měsíčně'}</span>`;
        cta = `<a class="${btn}" href="objednat.html?plan=${p.code}&amp;obdobi=${yearly ? 'rok' : 'mesic'}">${led}Objednat</a>`;
      }
      return `<article class="plan${main ? ' plan--main' : ''}" style="--u:${u}">
        <span class="ear ear--light"><i class="screw"></i><i class="screw"></i></span>
        <div class="plan__body">
          <span class="plan__size">${u}U</span>
          <h3>${esc(p.name.replace(/^\dU\s+/, ''))}</h3>
          <ul class="plan__feats">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
          <div class="plan__cost">${cost}</div>
          ${cta}
        </div>
        <span class="ear ear--light"><i class="screw"></i><i class="screw"></i></span>
      </article>`;
    }

    function renderPlans() { // unit heights grow with the tier: 1U, 2U, 4U
      data.categories.forEach(c => {
        const list = data.plans.filter(p => p.category === c.id);
        const sizes = list.length > 2 ? [1, 2, 4] : [1, 2];
        $('#panel-' + c.id).innerHTML = list.map((p, i) => planHTML(p, sizes[i] || 4)).join('');
      });
      drawRails();
    }
    $$('input[name="obdobi"]', pricing).forEach(r => r.addEventListener('change', renderPlans));

    $('.extras', pricing).innerHTML = data.extras.map(x =>
      `<li><b>${esc(x.name)}</b><span class="extras__price">${x.from ? 'od ' : ''}${kc(x.price)} Kč ${extraUnit[x.unit] || esc(x.unit)}</span>${x.note ? `<small>${esc(x.note)}</small>` : ''}</li>`).join('');
    $('.pricing__vat', pricing).textContent = data.vatNote;

    pricing.hidden = false;
    renderPlans();
  }
  if (pricing) initPricing();
})();
