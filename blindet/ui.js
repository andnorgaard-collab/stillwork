// Blindet: skærmbillederne. Al spillogik ligger i engine.js.
(() => {
  'use strict';
  const E = window.Engine, CARDS = window.CARDS, KEY = 'blindet.v1';
  const app = document.getElementById('app'), bar = document.getElementById('bar'), modal = document.getElementById('modal');
  let S = null;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = (x, d) => E.fmt(x, d);
  const mio = x => 'DKK ' + E.fmt(x / 1e6, 1) + 'M';
  const P = {
    'Mette': ['MH', '#e8590c', 'Trial Manager'], 'Jonas': ['JR', '#7048e8', 'Randomization Statistician · unblinded'],
    'Line': ['LK', '#0c8599', 'Clinical Supplies · unblinded'], 'Birgitte': ['BQ', '#c2255c', 'QA'],
    'Vendor': ['PM', '#495057', 'Vendor Project Manager'], 'System': ['K', '#3b5bdb', ''],
    'Dr. Weber': ['DW', '#2b8a3e', 'Investigator · site 205'], 'Dr. Tanaka': ['DT', '#2b8a3e', 'Investigator · site 602'],
    'Dr. Ortega': ['DO', '#2b8a3e', 'Investigator · site 304'],
    'CRA, Spanien': ['CR', '#5c940d', 'CRA · blinded'], 'You': ['YOU', '#212529', '']
  };
  const av = who => { const p = P[who] || ['?', '#868e96']; return `<span class="av" style="background:${p[1]}">${p[0]}</span>`; };
  const quote = (who, text) => `<div class="quote">${av(who)}<div class="q"><span class="n">${esc(who)}${P[who] && P[who][2] ? ' · ' + P[who][2] : ''}</span>${text}</div></div>`;
  const card = (title, body, tag) => `<section class="card">${title ? `<div class="card-h"><h2>${title}</h2>${tag || ''}</div>` : ''}<div class="card-b">${body}</div></section>`;
  const opt = (act, val, on, title, sub, check, extra) => `<button class="opt${check ? ' check' : ''}${on ? ' on' : ''}" data-act="${act}" data-v="${val}" ${extra || ''}><span class="r"></span><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`;
  const seg = (act, items, cur) => `<div class="seg">${items.map(([v, l]) => `<button class="${String(v) === String(cur) ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M4 12h4l2-6 4 12 2-6h4"/></svg>';

  function save() { try { if (S) localStorage.setItem(KEY, JSON.stringify(S)); else localStorage.removeItem(KEY); } catch (e) { /* uden lagring virker spillet stadig */ } }
  function load() { try { const t = localStorage.getItem(KEY); const o = t ? JSON.parse(t) : null; return o && o.v === 1 ? o : null; } catch (e) { return null; } }
  function go() { save(); render(); window.scrollTo(0, 0); }
  function stay() { const y = window.scrollY; save(); render(); window.scrollTo(0, y); }

  function render() {
    renderBar();
    if (!S) return title();
    ({ intro: setup, setup, uat, month, end })[S.phase]();
  }

  function renderBar() {
    if (!S) { bar.hidden = true; return; }
    bar.hidden = false;
    const live = S.phase === 'month' || S.phase === 'end';
    const crumb = S.phase === 'month' ? `M${S.month}/${E.MONTHS}` : S.phase === 'end' ? 'Locked' : 'Setup';
    bar.innerHTML = `<div class="bar-in"><span class="brand"><span class="brand-mark">${MARK}</span><span class="brand-name">Kestrel</span></span>
      <span class="crumb">TIDEVAND · ${crumb}</span><span class="grow"></span>
      <span class="env${live ? ' prod' : ''}">${live ? 'PROD' : 'BUILD'}</span>
      <button class="icon-btn" data-act="cards" aria-label="Knowledge base"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg><b>${S.cards.length}</b></button>
      <button class="icon-btn" data-act="audit" aria-label="Audit trail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg></button></div>`;
  }

  // ---------- Forside ----------
  function title() {
    const old = load();
    app.innerHTML = `<div class="hero"><div class="mark">${MARK}</div><h1>Blindet</h1><p>Et spil om at sætte et klinisk studie op, uden at nogen finder ud af, hvem der får hvad.</p></div>
      <div class="sys">kestrel rtsm · build 26.11<br>natural-language spec <b>ok</b> · supply engine <b>ok</b> · edc integration <b>ok</b></div>
      ${card('Welcome', `<p>Nordhavn Pharma har en fase 3-protokol klar, og du er RTSM-lead. Du skriver specifikationen, vælger randomisering og forsyningsstrategi, beslutter hvor meget der skal testes, og går live.</p>
        <p>Derefter kører studiet i tolv måneder. Sites laver fejl, kølerum svigter, en komité lukker en arm, og nogen vil altid gerne se en rapport, de ikke må se. Til sidst brydes koden, og en inspektør læser din audit trail.</p>
        <div class="lbl">Your name</div><input type="text" id="pname" maxlength="24" autocomplete="off" placeholder="RTSM Lead">
        <button class="btn primary" data-act="start">Open protocol</button>
        ${old ? `<button class="btn" data-act="resume">Resume ${old.phase === 'month' ? 'month ' + old.month : old.phase === 'end' ? 'results' : 'setup'}</button>` : ''}`)}
      <p class="foot">Inspireret af moderne RTSM-platforme. Firma, studie, lægemiddel og personer er opdigtede.</p>`;
  }

  // ---------- Opsætning ----------
  const STEPS = 6;
  function stepper() { return `<div class="stepper">${Array.from({ length: STEPS }, (_, i) => `<i class="${i <= S.step ? 'on' : ''}"></i>`).join('')}</div>`; }
  function nav(ok) { return `<button class="btn primary" data-act="next" ${ok ? '' : 'disabled'}>${S.step === STEPS - 1 ? 'Approve specification and run UAT' : S.step === 0 ? 'Start configuration' : 'Continue'}</button>${S.step ? '<button class="btn ghost" data-act="prev">Back</button>' : ''}`; }
  function lintBox(filter) {
    const L = E.lint(S.cfg).filter(filter);
    return L.length ? `<ul class="spec lint" style="margin-top:10px">${L.map(l => `<li class="${l.sev}">${esc(l.t)}</li>`).join('')}</ul>` : '';
  }

  function setup() {
    const c = S.cfg, f = c.factors;
    let h = stepper(), ok = true;
    if (S.step === 0) {
      h += `<p class="eyebrow">NHP-2290-3021 · Fase 3</p><h1 class="title">TIDEVAND</h1><p class="lead">Protokollen er landet i din indbakke.</p>`;
      h += card('Protocol synopsis', `<table>
        <tr><td class="muted">Design</td><td style="white-space:normal">Double-blind, placebo-controlled</td></tr>
        <tr><td class="muted">Participants</td><td style="white-space:normal">600 at 30 sites in 6 countries</td></tr>
        <tr><td class="muted">Arms</td><td style="white-space:normal">NH-2290 1.2 mg · 2.4 mg · placebo</td></tr>
        <tr><td class="muted">Ratio</td><td>2:2:1</td></tr>
        <tr><td class="muted">Treatment</td><td style="white-space:normal">Once-weekly pen, new pack every 4 weeks</td></tr>
        <tr><td class="muted">Titration</td><td style="white-space:normal">0.6 → 1.2 → 2.4 mg (high dose only)</td></tr>
        <tr><td class="muted">Stratification</td><td style="white-space:normal">Baseline BMI (&lt;35 / ≥35), type 2 diabetes</td></tr>
        <tr><td class="muted">Japan</td><td style="white-space:normal">Local requirements may apply</td></tr>
        <tr><td class="muted">LPFV target</td><td style="white-space:normal">End of month ${E.LPFV_TARGET}</td></tr></table>`);
      h += quote('Mette', 'Vi har lovet første patient om seks uger. Platformen kan bygges på to, siger leverandøren. Så du har fire til at gøre det rigtigt.');
      h += quote('Jonas', 'Specifikationen skrives i almindeligt sprog, og systemet bygges direkte ud fra den. Det er hurtigt. Det betyder også, at det, du skriver, er det, der sker.');
    }
    if (S.step === 1) {
      ok = !!c.titr;
      h += `<p class="eyebrow">Step 1 of 5</p><h1 class="title">Titration &amp; blinding</h1>`;
      h += card('', `<p>All participants start on 0.6 mg and move to 1.2 mg in month 2. Only the high-dose arm continues to 2.4 mg in month 3.</p>
        ${quote('Line', 'Hvis pennene hedder det, de indeholder, kan alle på sitet se, hvem der får lavdosis, fra måned 3. Men hver ekstra kit-type er mere at holde på lager.')}`);
      h += card('Pen presentation', [
        opt('titr', 'open', c.titr === 'open', 'Dose-labelled packs', 'Five kit types, simple to supply. Low dose stays on the 1.2 mg pen.'),
        opt('titr', 'blind', c.titr === 'blind', 'Blinded titration', 'Everyone follows steps 1, 2 and 3. The low-dose step 3 pen contains 1.2 mg. Seven kit types.'),
        opt('titr', 'dd', c.titr === 'dd', 'Double-dummy', 'Two pens per participant per week. Bulletproof blinding, double the injections, double the drug.')
      ].join('') + lintBox(l => /step|Double/.test(l.t)));
    }
    if (S.step === 2) {
      ok = !!c.method;
      h += `<p class="eyebrow">Step 2 of 5</p><h1 class="title">Randomization</h1>`;
      h += card('', quote('Jonas', 'Protokollen siger stratificeret efter BMI og diabetes. Resten er dit valg. Og mit problem, når det går galt.'));
      h += card('Method', [
        opt('method', 'simple', c.method === 'simple', 'Simple randomization', 'Each participant is allocated by chance at 2:2:1. No lists, no strata.'),
        opt('method', 'block', c.method === 'block', 'Stratified permuted blocks', 'One list per stratum. Classic and easy to explain.'),
        opt('method', 'min', c.method === 'min', 'Minimization', 'Assigns the arm that minimizes imbalance, with a random element.')
      ].join('') + (c.method === 'block' ? `<div class="lbl">Block size</div>${seg('bs', [['5', '5'], ['10', '10'], ['mix', 'Mixed 5/10']], c.bs)}` : ''));
      if (c.method && c.method !== 'simple') {
        h += card(c.method === 'min' ? 'Minimization factors' : 'Stratification factors', [
          opt('fac', 'bmi', f.bmi, 'Baseline BMI', '&lt;35 / ≥35', true),
          opt('fac', 't2d', f.t2d, 'Type 2 diabetes', 'Yes / no', true),
          opt('fac', 'region', f.region, 'Region', 'EU, North America, Latin America, Asia', true),
          opt('fac', 'site', f.site, 'Site', '30 sites', true)
        ].join('') + (c.method === 'block' ? `<p class="muted" style="margin-top:10px;font-size:13px">${E.stratCount(c)} strata · approx. ${n(E.TARGET / E.stratCount(c))} participants per stratum</p>` : ''));
      }
      h += lintBox(l => /strat|random|block|BMI|diabetes|Site|2:2:1|minimiz/i.test(l.t) && !/kit number/i.test(l.t));
    }
    if (S.step === 3) {
      ok = !!c.kitlist;
      h += `<p class="eyebrow">Step 3 of 5</p><h1 class="title">Kit list</h1>`;
      h += card('', quote('Line', 'Pakkeriet vil gerne have kit 1001 til 2400 som aktiv og 2401 til 3000 som placebo. Så er etiketterne lettere at holde styr på.'));
      h += card('Kit numbering', [
        opt('kitlist', 'seq', c.kitlist === 'seq', 'Sequential ranges per kit type', 'As proposed by packaging. Easy to manage in the warehouse.'),
        opt('kitlist', 'rand', c.kitlist === 'rand', 'Randomized kit list', 'Numbers are shuffled across types. Only the system knows what is in the box.')
      ].join('') + lintBox(l => /kit number/i.test(l.t)));
    }
    if (S.step === 4) {
      ok = c.resup && c.dnsd !== null && c.over !== null;
      h += `<p class="eyebrow">Step 4 of 5</p><h1 class="title">Supply strategy</h1>`;
      h += card('', quote('Line', 'Batch 1 udløber midt i måned 8, og batch 2 er klar fra måned 5. En pakning skal holde 28 dage plus besøgsvinduet på 7. Brasilien og Japan har en måneds leveringstid.'));
      h += card('Resupply', [
        opt('resup', 'minmax', c.resup === 'minmax', 'Min/max per site', 'Fixed levels based on the plan. Robust, but blind to how the study actually develops.'),
        opt('resup', 'pred', c.resup === 'pred', 'Predictive', 'Forecasts from each participant’s visit schedule and titration, plus expected enrollment.')
      ].join('') + (c.resup ? `<div class="lbl">${c.resup === 'pred' ? 'Safety stock' : 'Level'}</div>${seg('buf', [[1, 'Low'], [2, 'Medium'], [3, 'High']], c.buf)}<p class="faint" style="font-size:12.5px;margin-top:6px">Can be adjusted during the study.</p>` : ''));
      h += card('Do-not-dispense window', `<p class="muted" style="font-size:13.5px">Minimum days to expiry at dispensation.</p>${seg('dnsd', [[0, '0 days'], [14, '14 days'], [35, '35 days']], c.dnsd)}`);
      h += card('Overage', `<p class="muted" style="font-size:13.5px">Production above planned demand.</p>${seg('over', [[1.2, '+20 %'], [1.5, '+50 %'], [2, '+100 %']], c.over)}
        ${c.over ? `<p class="faint" style="font-size:12.5px;margin-top:6px">Cost per pen produced and destroyed: DKK ${n(E.KIT_KR)}.</p>` : ''}`);
      h += lintBox(l => /days|overage/i.test(l.t));
    }
    if (S.step === 5) {
      ok = !!c.uat;
      h += `<p class="eyebrow">Step 5 of 5</p><h1 class="title">Specification &amp; UAT</h1>`;
      h += card('Specification', `<ul class="spec">${E.specLines(c).map(l => `<li>${esc(l)}</li>`).join('')}</ul>`, '<span class="tag acc">v1.0 draft</span>');
      const L = E.lint(c);
      h += card('Spec review', L.length ? `<ul class="spec lint">${L.map(l => `<li class="${l.sev}">${esc(l.t)}</li>`).join('')}</ul>` : '<p class="muted">No findings.</p>',
        `<span class="tag ${L.some(l => l.sev === 'bad') ? 'bad' : L.some(l => l.sev === 'warn') ? 'warn' : 'ok'}">${L.filter(l => l.sev !== 'ok').length} findings</span>`);
      h += card('UAT scope', Object.entries(E.UAT).map(([k, u]) =>
        opt('uat', k, c.uat === k, `${u.name} · ${u.days} days`, { happy: 'Main workflows only. First participant can be randomized immediately.', risk: 'Randomization, titration, emergency unblinding and expiry tested in depth. Month 1 gets shorter.', full: 'Every requirement, role and report. Month 1 is mostly gone.' }[k])).join('')
        + quote('Mette', 'Hver dag i UAT er en dag senere første patient. Bare så du ved det.'));
    }
    app.innerHTML = h + nav(ok);
  }

  function uat() {
    const u = S.uat, F = u.found.map(id => E.DEFECTS[id]);
    let h = `<p class="eyebrow">UAT complete</p><h1 class="title">${u.n} scripts executed</h1>`;
    h += card('Defects', F.length ? F.map(d => `<div class="alert ${d.crit ? 'bad' : 'warn'}"><span class="dot"></span><div>${esc(d.t)}${d.crit ? ' <span class="tag bad">critical</span>' : ''}<br><span class="muted" style="font-size:13px">Fixed and retested before go-live.</span></div></div>`).join('') : '<p class="muted">No defects found.</p>',
      `<span class="tag ${F.length ? 'warn' : 'ok'}">${F.length} fixed</span>`);
    h += card('', quote('Vendor', F.length ? 'Godt fanget. Det er præcis derfor, man tester.' : 'Ingen fejl. Det sker.') + quote('Birgitte', 'Fejl, der ikke blev fundet, står ikke på listen. Dem møder vi i produktion.'));
    h += `<button class="btn primary" data-act="golive">Release to production</button>`;
    app.innerHTML = h;
  }

  // ---------- Måned ----------
  function month() {
    const m = S.month, evs = E.eventsNow(S), D = E.dash(S), wait = E.pending(S);
    const last = S.hist[S.hist.length - 1];
    let h = `<p class="eyebrow">Month ${m} of ${E.MONTHS}</p><h1 class="title">${m === 1 ? 'Go-live' : 'Study dashboard'}</h1>`;
    const pen = S.pen.length;
    h += `<div class="kpis">
      <div class="kpi"><span>Randomized</span><b>${S.patients.length}<small> / ${E.TARGET}</small></b><div class="progress"><b style="width:${S.patients.length / E.TARGET * 100}%"></b></div></div>
      <div class="kpi"><span>On treatment</span><b>${D.active}</b><small>${S.sites.filter(s => m >= s.act).length} of 30 sites active</small></div>
      <div class="kpi"><span>Missed dispensations</span><b class="${S.st.missed ? 'bad' : ''}">${S.st.missed}</b><small>${S.st.blocked} randomizations blocked</small></div>
      <div class="kpi"><span>Deviations</span><b class="${pen ? 'warn' : ''}">${pen}</b><small>${S.st.waste ? n(S.st.waste) + ' kits destroyed' : 'No waste yet'}</small></div></div>`;
    if (last) {
      h += card(`Month ${last.m} summary`, `<table>
        <tr><td class="muted">Randomized</td><td>${last.rand}</td></tr>
        <tr><td class="muted">Shipments</td><td>${last.ships}</td></tr>
        <tr><td class="muted">Missed dispensations</td><td class="${last.missed ? 'bad' : ''}">${last.missed}</td></tr>
        <tr><td class="muted">Blocked randomizations</td><td class="${last.blocked ? 'warn' : ''}">${last.blocked}</td></tr>
        ${last.waste ? `<tr><td class="muted">Destroyed</td><td class="bad">${n(last.waste)} kits</td></tr>` : ''}
        ${last.expDisp ? `<tr><td class="muted">Dispensed with short expiry</td><td class="bad">${last.expDisp}</td></tr>` : ''}</table>`);
    }
    if (S.notes.length) h += card('Messages', S.notes.map(x => `<div class="alert ${x.sev}"><span class="dot"></span><div><span class="who">${esc(x.who)}:</span> ${x.t}</div></div>`).join(''));
    if (S.newCards.length) h += newCards();
    evs.forEach((ev, i) => {
      const done = S.decided[ev.id], af = S.after[ev.id] || {};
      let b = `<p class="eyebrow" style="margin-bottom:6px">CASE ${String(m).padStart(2, '0')}-${i + 1} · ${done ? 'CLOSED' : 'OPEN'}</p><p>${ev.text}</p>${quote(ev.who, ev.quote)}`;
      b += ev.options.map(o => opt('choose', o.id, done === o.id, o.label, '', false, `data-ev="${ev.id}"${done ? ' disabled' : ''}`).replace('class="opt', `class="opt${done && done !== o.id ? ' faded' : ''}`)).join('');
      if (done) b += `<div class="alert info" style="margin-top:12px"><span class="dot"></span><div>${af.text}${af.extra ? `<br><br><span class="bad">${af.extra}</span>` : ''}</div></div>`;
      h += card(ev.title, b, done ? '<span class="tag ok">Resolved</span>' : '<span class="tag warn">Action required</span>');
    });
    h += card('Enrollment', chart() + `<div class="legend"><span><i></i>Actual</span><span><i class="plan"></i>Plan</span></div>
      <table style="margin-top:8px"><tr><th>Country</th><th>Sites</th><th>Randomized</th></tr>
      ${D.byC.map(c => `<tr><td>${c.name}</td><td>${c.sites}/${c.of}</td><td>${c.n}</td></tr>`).join('')}</table>
      ${quote('Jonas', D.bal)}`);
    h += card('Supply', `<table><tr><th>Kit type</th><th>Depot</th><th>Sites</th><th>Empty</th></tr>
      ${E.VARIANTS.filter(v => S.cfg.titr !== 'open' || v !== 'S3L').map(v => { const r = D.per[v], low = D.low.includes(v); return `<tr><td>${E.VLABEL[v]}${S.mods.hDrop && v === 'S3H' ? ' <span class="faint">closed</span>' : ''}</td><td class="${low ? 'bad' : ''}">${n(r.central)}</td><td>${n(r.sites)}</td><td>${last ? `<span class="pill ${r.empty === 0 ? 'ok' : r.empty < 4 ? 'warn' : 'bad'}">${r.empty}</span>` : '<span class="faint">shipping</span>'}</td></tr>`; }).join('')}</table>
      <p class="faint" style="font-size:12px;margin-top:8px">Unblinded supply view. Sites and CRAs see kit numbers only.</p>
      ${D.low.length ? quote('Line', `Depotet er ved at løbe tørt for ${D.low.map(v => E.VLABEL[v]).join(', ')}. En ekstra batch tager tre måneder.`) : ''}
      <div class="lbl">${S.cfg.resup === 'pred' ? 'Safety stock' : 'Min/max level'}</div>${seg('setbuf', [[1, 'Low'], [2, 'Medium'], [3, 'High']], S.cfg.buf)}
      <button class="btn" data-act="order" ${E.canOrder(S) ? '' : 'disabled'}>${E.canOrder(S) ? 'Order additional production · +15 % · DKK 1.2M' : S.mods.extra.some(e => e.m > m) ? 'Additional production in progress' : 'Too late to order more'}</button>`);
    h += `<button class="btn primary" data-act="run" ${wait ? 'disabled' : ''}>${wait ? 'Resolve open cases to continue' : m === E.MONTHS ? 'Run final month and lock database' : `Run month ${m}`}</button>`;
    if (S.month > 1 || evs.some(e => S.decided[e.id])) h += `<button class="btn ghost" data-act="rewind">Roll back month ${m}${S.rewinds ? ` · used ${S.rewinds}×` : ''}</button>`;
    app.innerHTML = h;
  }

  function chart() {
    const W = 320, H = 110, pad = 4, max = E.TARGET, X = i => pad + (W - 2 * pad) * i / E.MONTHS, Y = v => H - pad - (H - 2 * pad) * v / max;
    const plan = [0].concat(S.planCum || []).map((v, i) => `${X(i)},${Y(Math.min(v, max))}`).join(' ');
    const act = [0].concat(S.hist.map(x => x.cum)).map((v, i) => `${X(i)},${Y(v)}`).join(' ');
    const tgt = X(E.LPFV_TARGET);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Cumulative enrollment vs plan">
      <line x1="${pad}" x2="${W - pad}" y1="${Y(max)}" y2="${Y(max)}" stroke="var(--line2)" stroke-dasharray="3 3"/>
      <line x1="${tgt}" x2="${tgt}" y1="${pad}" y2="${H - pad}" stroke="var(--line2)" stroke-dasharray="3 3"/>
      <polyline points="${plan}" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
      <polyline points="${act}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function newCards() {
    return card('New in knowledge base', `<div class="tiles">${S.newCards.map(id => { const c = CARDS.find(x => x.id === id); return c ? `<button class="tile new" data-act="card" data-id="${id}">${c.t}<small>${c.s}</small></button>` : ''; }).join('')}</div>`);
  }

  // ---------- Slut ----------
  function end() {
    const R = S.end, G = E.grade(R.total), B = R.B.groups;
    let h = `<p class="eyebrow">Database lock · month ${E.MONTHS}</p><h1 class="title">Treatment codes released</h1>`;
    h += card('', `<div class="between"><div><div class="big-score">${R.total}</div><div class="muted">of 100</div></div><div style="text-align:right"><b style="font-size:17px">${G[0]}</b><p class="muted" style="font-size:13.5px;max-width:230px;margin-top:2px">${G[1]}</p></div></div>
      ${[['Study integrity', R.integ, 'randomization, blinding, deviations'], ['Patient supply', R.supply, `${S.st.missed} missed, ${S.st.blocked} blocked`], ['Waste & cost', R.waste, `${mio(R.costKr)} waste, freight, rework`], ['Timeline', R.time, S.lpfv ? `LPFV month ${Math.ceil(S.lpfv)}` : `${S.patients.length} of ${E.TARGET} randomized`]]
        .map(([t, v, s]) => `<div class="score"><span>${t} <span class="faint" style="font-size:12px">· ${s}</span></span><b class="num">${v}</b><div class="bar"><b style="width:${v}%"></b></div></div>`).join('')}`);
    const arms = [['L', '1.2 mg', 'var(--a1)'], ['H', '2.4 mg', 'var(--a2)'], ['P', 'Placebo', 'var(--a3)']];
    h += card('Unblinded allocation', `<p class="muted" style="font-size:13.5px">Actual (expected by ratio).</p>
      <table><tr><th>Group</th>${arms.map(a => `<th><span class="arm" style="background:${a[2]}"></span>${a[1]}</th>`).join('')}</tr>
      ${Object.entries(B).map(([g, r]) => `<tr><td>${g}</td>${arms.map(a => `<td>${r.n[a[0]]} <span class="faint">(${n(r.e[a[0]])})</span></td>`).join('')}</tr>`).join('')}</table>
      ${quote('Jonas', R.B.max < .03 ? 'Pænt. Det er sådan, det skal se ud, når ingen har pillet ved noget.' : R.B.max < .06 ? 'Lidt skævt hist og her, men intet, analysen ikke kan bære.' : 'Det her skal forklares i den statistiske rapport. Flere steder.')}`);
    h += card('Inspection findings', R.findings.length ? `<ul class="spec lint">${R.findings.slice().sort((a, b) => b.pts - a.pts).map(f => `<li class="${f.breach || f.pts >= 10 ? 'bad' : 'warn'}">${esc(f.why)}${f.m ? ` <span class="faint">· M${f.m}</span>` : ''}${f.breach ? ' <span class="tag bad">blinding</span>' : ''}</li>`).join('')}</ul>` : '<p class="muted">No findings.</p>',
      `<span class="tag ${R.findings.length ? 'warn' : 'ok'}">${R.findings.length}</span>`);
    h += card('', quote('Birgitte', R.integ >= 90 ? 'Det er en audit trail, man kan læse højt. Tak.' : R.integ >= 70 ? 'Alt kan forklares. Noget af det tog bare lidt længere end nødvendigt.' : 'Jeg har booket et lokale til CAPA-mødet. Hele dagen.')
      + quote('Mette', S.lpfv && S.lpfv <= E.LPFV_TARGET ? 'Vi ramte tidsplanen. Det har jeg sagt til alle.' : 'Vi blev færdige. Lad os sige det sådan.')
      + quote('Line', R.costKr < 2.5e6 ? 'Der står næsten intet tilbage at destruere. Det er sjældent.' : 'Jeg har bestilt en container til destruktion. Den er stor.'));
    h += `<button class="btn primary" data-act="restart">Set up a new study</button><button class="btn" data-act="audit">View audit trail</button>`;
    app.innerHTML = h;
  }

  // ---------- Modaler ----------
  function openCards(id) {
    modal.hidden = false;
    if (id) {
      const c = CARDS.find(c => c.id === id);
      modal.innerHTML = card(c.t, `<p class="muted" style="margin-bottom:8px">${c.s}</p><p>${c.b}</p>${c.f ? `<div class="formula">${c.f}</div>` : ''}
        <button class="btn primary" data-act="closemodal">Close</button><button class="btn ghost" data-act="cards">All articles</button>`);
    } else {
      modal.innerHTML = card('Knowledge base', `<p class="muted" style="font-size:13.5px">${S.cards.length} of ${CARDS.length} articles unlocked.</p>
        <div class="tiles">${CARDS.map(c => S.cards.includes(c.id) ? `<button class="tile" data-act="card" data-id="${c.id}">${c.t}<small>${c.s}</small></button>` : `<div class="tile locked">Locked<small>Not discovered yet</small></div>`).join('')}</div>
        <button class="btn primary" data-act="closemodal">Close</button><button class="btn ghost" data-act="restart">Abandon study and start over</button>`);
    }
    modal.scrollTop = 0;
  }

  function openAudit() {
    modal.hidden = false;
    const L = S.log.slice().reverse();
    modal.innerHTML = card('Audit trail', `<p class="muted" style="font-size:13.5px">Who, what, when. Read-only.</p>
      <ul class="log">${L.length ? L.map(e => `<li class="${e.sev}"><time>${e.m ? 'M' + String(e.m).padStart(2, '0') : 'BUILD'}</time><span><em>${esc(e.who)}</em> · ${esc(e.txt)}</span></li>`).join('') : '<li><time>·</time><span class="muted">No entries.</span></li>'}</ul>
      <button class="btn primary" data-act="closemodal">Close</button>`);
    modal.scrollTop = 0;
  }

  // ---------- Hændelser ----------
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act, v = b.dataset.v, c = S && S.cfg;
    if (a === 'start') { S = E.newGame(document.getElementById('pname').value.trim()); S.phase = 'setup'; go(); }
    else if (a === 'resume') { S = load(); go(); }
    else if (a === 'next') { if (S.step < STEPS - 1) { S.step++; go(); } else { E.goLive(S); go(); } }
    else if (a === 'prev') { S.step--; go(); }
    else if (a === 'titr' || a === 'method' || a === 'kitlist' || a === 'resup' || a === 'uat') { c[a] = v; stay(); }
    else if (a === 'bs') { c.bs = v; stay(); }
    else if (a === 'fac') { c.factors[v] = !c.factors[v]; stay(); }
    else if (a === 'buf') { c.buf = +v; stay(); }
    else if (a === 'dnsd') { c.dnsd = +v; stay(); }
    else if (a === 'over') { c.over = +v; stay(); }
    else if (a === 'golive') { E.startMonth(S); go(); }
    else if (a === 'choose') { E.choose(S, b.dataset.ev, v); stay(); }
    else if (a === 'setbuf') { E.setBuf(S, +v); stay(); }
    else if (a === 'order') { E.orderBatch(S); stay(); }
    else if (a === 'run') { E.runMonth(S); go(); }
    else if (a === 'rewind') { S = E.rewind(S); go(); }
    else if (a === 'restart') {
      if (S && S.phase !== 'end' && !confirm('Abandon this study and start over?')) return;
      S = null; modal.hidden = true; go();
    }
    else if (a === 'cards') openCards();
    else if (a === 'card') openCards(b.dataset.id);
    else if (a === 'audit') openAudit();
    else if (a === 'closemodal') modal.hidden = true;
  });
  modal.addEventListener('click', ev => { if (ev.target === modal) modal.hidden = true; });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') modal.hidden = true; });

  render();
})();
