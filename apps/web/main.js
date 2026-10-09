(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, reduced ? 0 : ms));
  const setLed = (el, state) => { el.className = 'led' + (state ? ' led--' + state : ''); };

  const { drawRails, panel, cleanDomain, checkDomain } = window.servero; // from site.js
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
    ['▸ živě    https://servero.cz', '✓ živě    200 OK, 84 ms'],
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

  /* ---------- Patch cable + parallax (scroll-driven) ---------- */
  const cable = $('.patch__cable path');
  const ports = $$('.ports li');
  const patch = $('.patch');
  let cableLen = 0;
  if (cable) {
    cableLen = cable.getTotalLength();
    cable.style.strokeDasharray = cableLen;
    cable.style.strokeDashoffset = reduced ? 0 : cableLen;
    if (reduced) ports.forEach(p => p.classList.add('is-linked'));
  }
  const photo = $('.photo'), photoImg = $('.photo__img');

  let ticking = false;
  function onScroll() {
    updatePos();
    if (!reduced) {
      const r = patch.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (innerHeight * .55)));
      cable.style.strokeDashoffset = cableLen * (1 - p);
      ports.forEach((li, i) => li.classList.toggle('is-linked', p >= [0.02, .5, .98][i]));

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

  /* ---------- Domain search: the answer on a small LCD ---------- */
  const kc = n => new Intl.NumberFormat('cs-CZ').format(Math.round(n));
  const dsForm = $('.dsearch');
  if (dsForm) {
    const dsInput = $('input', dsForm), dsBtn = $('button', dsForm);
    const dsOut = $('.dsearch__out'), dsText = $('.dsearch__text', dsOut), dsLed = $('.led', dsOut), dsAct = $('.dsearch__act');
    const show = (state, text, link) => {
      dsOut.dataset.state = state;
      dsLed.className = 'led' + ({ free: ' led--on', busy: ' led--act', taken: ' led--fault' }[state] || '');
      dsText.textContent = text;
      dsAct.replaceChildren();
      if (link) dsAct.append(link);
    };
    const linkTo = (props, html) => Object.assign(document.createElement('a'), props, html ? { innerHTML: html } : {});
    dsForm.addEventListener('submit', async e => {
      e.preventDefault();
      let name = cleanDomain(dsInput.value);
      if (name && !name.includes('.')) name += '.cz'; // a bare "firma" means firma.cz here
      if (!name) { show('err', 'napište doménu, třeba firma.cz'); dsInput.focus(); return; }
      dsInput.value = name;
      dsBtn.disabled = true;
      show('busy', `ověřuji ${name} …`);
      const r = await checkDomain(name);
      dsBtn.disabled = false;
      const order = rezim => `objednat.html?${new URLSearchParams({ plan: 'web-start', domena: r.name || name, rezim })}`;
      if (r.available === true) {
        show('free', `${r.name} je volná · ${r.price ? kc(r.price) + ' Kč/rok' : 'cenu potvrdíme'}`,
          linkTo({ className: 'btn btn--light', href: order('registrace') }, '<i class="led led--on"></i>Registrovat s hostingem'));
      } else if (r.available === false) {
        show('taken', `${r.name} je obsazená`, linkTo({ className: 'dsearch__link', href: order('vlastni'), textContent: 'Máte ji? Převeďte ji k nám' }));
      } else {
        show('err', r.reason || 'dostupnost teď nejde ověřit');
      }
    });
  }

  /* ---------- Pricing: tabs rendered from plans.json ----------
     plans.json is a copy of /catalog/plans.json, the single source of prices.
     Copy step (deploy runs it, run it by hand after editing the catalog):
       cp catalog/plans.json apps/web/plans.json
     For local dev the copied file simply stays in apps/web next to index.html. */
  const pricing = $('.pricing');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const months = n => n === 1 ? 'měsíc' : n < 5 ? 'měsíce' : 'měsíců';
  const extraUnit = { rok: '/ rok', hodina: '/ hod.' };

  async function initPricing() {
    let data;
    try {
      const res = await fetch('plans.json?v=4');
      if (!res.ok) throw new Error(res.status);
      data = await res.json();
    } catch {
      pricing.insertAdjacentHTML('afterend', '<p class="pricing__nojs">Ceník se teď nepodařilo načíst. Můžete rovnou <a href="objednat.html">objednat službu</a> nebo napsat na <a href="mailto:info@servero.cz">info@servero.cz</a>.</p>');
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
