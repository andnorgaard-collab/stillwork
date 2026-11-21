// Blindet: skærmbillederne. Al spillogik ligger i engine.js.
(() => {
  'use strict';
  const E = window.Engine, CARDS = window.CARDS, KEY = 'blindet.v1';
  const app = document.getElementById('app'), bar = document.getElementById('bar'), modal = document.getElementById('modal');
  let S = null;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = (x, d) => E.fmt(x, d);
  const mio = x => E.fmt(x / 1e6, 1) + ' mio. kr.';
  const P = {
    'Mette': ['MH', '#e8590c', 'trial manager'], 'Jonas': ['JR', '#7048e8', 'randomiseringsstatistiker, ublindet'],
    'Line': ['LK', '#0c8599', 'clinical supplies'], 'Birgitte': ['BQ', '#c2255c', 'QA'],
    'Leverandøren': ['PM', '#495057', 'RTSM-leverandør'], 'Platformen': ['K', '#3b5bdb', 'system'],
    'Dr. Weber': ['DW', '#2b8a3e', 'investigator, site 205'], 'Dr. Tanaka': ['DT', '#2b8a3e', 'investigator, site 602'],
    'CRA, Spanien': ['CR', '#5c940d', 'monitor'], 'Du': ['DU', '#212529', '']
  };
  const av = who => { const p = P[who] || ['?', '#868e96']; return `<span class="av" style="background:${p[1]}">${p[0]}</span>`; };
  const quote = (who, text) => `<div class="quote">${av(who)}<div class="q"><span class="n">${esc(who)}${P[who] && P[who][2] ? ', ' + P[who][2] : ''}</span>${text}</div></div>`;
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
    const crumb = S.phase === 'month' ? `M${S.month}/${E.MONTHS}` : S.phase === 'end' ? 'Lock' : 'Setup';
    bar.innerHTML = `<div class="bar-in"><span class="brand"><span class="brand-mark">${MARK}</span><span class="brand-name">Kestrel</span></span>
      <span class="crumb">TIDEVAND · ${crumb}</span><span class="grow"></span>
      <span class="env${live ? ' prod' : ''}">${live ? 'PROD' : 'BUILD'}</span>
      <button class="icon-btn" data-act="cards" aria-label="Viden"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg><b>${S.cards.length}</b></button>
      <button class="icon-btn" data-act="audit" aria-label="Audit trail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg></button></div>`;
  }

  // ---------- Forside ----------
  function title() {
    const old = load();
    app.innerHTML = `<div class="hero"><div class="mark">${MARK}</div><h1>Blindet</h1><p>Et spil om at sætte et klinisk studie op, uden at nogen finder ud af, hvem der får hvad.</p></div>
      <div class="sys">kestrel rtsm · build 26.11<br>natural-language spec <b>ok</b> · supply engine <b>ok</b> · edc-integration <b>ok</b></div>
      ${card('Velkommen', `<p>Nordhavn Pharma har en fase 3-protokol klar, og du er RTSM-lead. Du skriver specifikationen, vælger randomisering og forsyningsstrategi, beslutter hvor meget der skal testes, og går live.</p>
        <p>Derefter kører studiet i tolv måneder. Sites laver fejl, kølerum svigter, en komité lukker en arm, og nogen vil altid gerne se en rapport, de ikke må se. Til sidst brydes koden, og en inspektør læser din audit trail.</p>
        <div class="lbl">Dit navn</div><input type="text" id="pname" maxlength="24" autocomplete="off" placeholder="RTSM-lead">
        <button class="btn primary" data-act="start">Åbn protokollen</button>
        ${old ? `<button class="btn" data-act="resume">Fortsæt ${old.phase === 'month' ? 'i måned ' + old.month : old.phase === 'end' ? 'til resultatet' : 'opsætningen'}</button>` : ''}`)}
      <p class="foot">Inspireret af moderne RTSM-platforme. Firma, studie, lægemiddel og personer er opdigtede.</p>`;
  }

  // ---------- Opsætning ----------
  const STEPS = 6;
  function stepper() { return `<div class="stepper">${Array.from({ length: STEPS }, (_, i) => `<i class="${i <= S.step ? 'on' : ''}"></i>`).join('')}</div>`; }
  function nav(ok) { return `<button class="btn primary" data-act="next" ${ok ? '' : 'disabled'}>${S.step === STEPS - 1 ? 'Godkend specifikation og kør UAT' : 'Næste'}</button>${S.step ? '<button class="btn ghost" data-act="prev">Tilbage</button>' : ''}`; }
  function lintBox(filter) {
    const L = E.lint(S.cfg).filter(filter);
    return L.length ? `<ul class="spec lint" style="margin-top:10px">${L.map(l => `<li class="${l.sev}">${esc(l.t)}</li>`).join('')}</ul>` : '';
  }

  function setup() {
    const c = S.cfg, f = c.factors;
    let h = stepper(), ok = true;
    if (S.step === 0) {
      h += `<p class="eyebrow">NHP-2290-3021 · Fase 3</p><h1 class="title">TIDEVAND</h1><p class="lead">Protokollen er landet i din indbakke.</p>`;
      h += card('Studiet', `<table>
        <tr><td class="muted">Design</td><td style="white-space:normal">Dobbeltblind, placebokontrolleret</td></tr>
        <tr><td class="muted">Patienter</td><td>600 på 30 sites i 6 lande</td></tr>
        <tr><td class="muted">Arme</td><td style="white-space:normal">NH-2290 1,2 mg · 2,4 mg · placebo</td></tr>
        <tr><td class="muted">Forhold</td><td>2:2:1</td></tr>
        <tr><td class="muted">Behandling</td><td style="white-space:normal">Ugentlig pen, ny pakning hver 4. uge</td></tr>
        <tr><td class="muted">Titrering</td><td style="white-space:normal">0,6 mg → 1,2 mg → 2,4 mg (kun højdosis)</td></tr>
        <tr><td class="muted">Stratificering</td><td style="white-space:normal">Baseline-BMI (&lt;35 / ≥35) og type 2-diabetes</td></tr>
        <tr><td class="muted">Mål</td><td style="white-space:normal">Alle randomiseret inden udgangen af måned ${E.LPFV_TARGET}</td></tr></table>`);
      h += quote('Mette', 'Vi har lovet første patient om seks uger. Platformen kan bygges på to, siger leverandøren. Så du har fire til at gøre det rigtigt.');
      h += quote('Jonas', 'Specifikationen skrives i almindeligt sprog, og systemet bygges direkte ud fra den. Det er hurtigt. Det betyder også, at det, du skriver, er det, der sker.');
    }
    if (S.step === 1) {
      ok = !!c.titr;
      h += `<p class="eyebrow">Trin 1 af 5</p><h1 class="title">Titrering og blinding</h1>`;
      h += card('', `<p>Alle starter på 0,6 mg og går til 1,2 mg i måned 2. Kun højdosis fortsætter til 2,4 mg i måned 3.</p>
        ${quote('Line', 'Hvis pennene hedder det, de indeholder, kan alle på sitet se, hvem der får lavdosis, fra måned 3. Men hver ekstra kit-type er mere at holde på lager.')}`);
      h += card('Hvordan skal pennene se ud?', [
        opt('titr', 'open', c.titr === 'open', 'Pakninger mærket efter dosis', 'Enkelt at forsyne: fem kit-typer. Lavdosis bliver på 1,2 mg-pennen.'),
        opt('titr', 'blind', c.titr === 'blind', 'Blindet titrering', 'Alle følger trin 1, 2 og 3. Lavdosis-patienternes trin 3-pen indeholder 1,2 mg. Syv kit-typer.'),
        opt('titr', 'dd', c.titr === 'dd', 'Double-dummy', 'To penne pr. patient hver uge. Blindingen er skudsikker, men alle skal stikke sig dobbelt, og forbruget fordobles.')
      ].join('') + lintBox(l => /trin|Double/.test(l.t)));
    }
    if (S.step === 2) {
      ok = !!c.method;
      h += `<p class="eyebrow">Trin 2 af 5</p><h1 class="title">Randomisering</h1>`;
      h += card('', quote('Jonas', 'Protokollen siger stratificeret efter BMI og diabetes. Resten er dit valg. Og mit problem, når det går galt.'));
      h += card('Metode', [
        opt('method', 'simple', c.method === 'simple', 'Simpel randomisering', 'Hver patient trækker lod efter 2:2:1. Ingen lister, ingen strata.'),
        opt('method', 'block', c.method === 'block', 'Stratificerede permuterede blokke', 'En liste pr. stratum. Klassisk og let at forklare.'),
        opt('method', 'min', c.method === 'min', 'Minimering', 'Systemet vælger armen, der giver mindst ubalance, med et tilfældigt element.')
      ].join('') + (c.method === 'block' ? `<div class="lbl">Blokstørrelse</div>${seg('bs', [['5', '5'], ['10', '10'], ['mix', '5 og 10 blandet']], c.bs)}` : ''));
      if (c.method && c.method !== 'simple') {
        h += card(c.method === 'min' ? 'Minimeringsfaktorer' : 'Stratifikationsfaktorer', [
          opt('fac', 'bmi', f.bmi, 'Baseline-BMI', '&lt;35 / ≥35', true),
          opt('fac', 't2d', f.t2d, 'Type 2-diabetes', 'Ja / nej', true),
          opt('fac', 'region', f.region, 'Region', 'EU, Nordamerika, Latinamerika, Asien', true),
          opt('fac', 'site', f.site, 'Site', '30 sites', true)
        ].join('') + (c.method === 'block' ? `<p class="muted" style="margin-top:10px;font-size:13px">${E.stratCount(c)} strata · ca. ${n(E.TARGET / E.stratCount(c))} patienter pr. stratum</p>` : ''));
      }
      h += lintBox(l => /strat|rand|blok|Blok|BMI|diabetes|Site|2:2:1/i.test(l.t) && !/Kit-numre/.test(l.t));
    }
    if (S.step === 3) {
      ok = !!c.kitlist;
      h += `<p class="eyebrow">Trin 3 af 5</p><h1 class="title">Kit-liste</h1>`;
      h += card('', quote('Line', 'Pakkeriet vil gerne have kit 1001 til 2400 som aktiv og 2401 til 3000 som placebo. Så er etiketterne lettere at holde styr på.'));
      h += card('Hvordan nummereres kits?', [
        opt('kitlist', 'seq', c.kitlist === 'seq', 'Fortløbende serier pr. kit-type', 'Som pakkeriet foreslår. Nemt at overskue på lageret.'),
        opt('kitlist', 'rand', c.kitlist === 'rand', 'Randomiseret kit-liste', 'Numrene blandes på tværs af typer. Kun systemet ved, hvad der er i æsken.')
      ].join('') + lintBox(l => /Kit-numre/.test(l.t)));
    }
    if (S.step === 4) {
      ok = c.resup && c.dnsd !== null && c.over !== null;
      h += `<p class="eyebrow">Trin 4 af 5</p><h1 class="title">Forsyning</h1>`;
      h += card('', quote('Line', 'Batch 1 udløber midt i måned 8, og batch 2 er klar fra måned 5. En pakning skal holde 28 dage plus besøgsvinduet på 7. Brasilien og Japan har en måneds leveringstid.'));
      h += card('Genforsyning', [
        opt('resup', 'minmax', c.resup === 'minmax', 'Min/max pr. site', 'Faste niveauer lagt ud fra planen. Robust, men følger ikke med, når studiet ændrer sig.'),
        opt('resup', 'pred', c.resup === 'pred', 'Prædiktiv', 'Systemet regner på hver patients besøgsplan og titrering, plus forventet rekruttering.')
      ].join('') + (c.resup ? `<div class="lbl">${c.resup === 'pred' ? 'Sikkerhedslager' : 'Niveau'}</div>${seg('buf', [[1, 'Lavt'], [2, 'Mellem'], [3, 'Højt']], c.buf)}<p class="faint" style="font-size:12.5px;margin-top:6px">Kan justeres undervejs i studiet.</p>` : ''));
      h += card('Do-not-dispense', `<p class="muted" style="font-size:13.5px">Hvor mange dage skal der mindst være til udløb, når en pen udleveres?</p>${seg('dnsd', [[0, '0 dage'], [14, '14 dage'], [35, '35 dage']], c.dnsd)}`);
      h += card('Overproduktion', `<p class="muted" style="font-size:13.5px">Hvor meget skal der produceres ud over planens forbrug?</p>${seg('over', [[1.2, '+20 %'], [1.5, '+50 %'], [2, '+100 %']], c.over)}
        ${c.over ? `<p class="faint" style="font-size:12.5px;margin-top:6px">Hver pen koster ${n(E.KIT_KR)} kr. at producere og destruere.</p>` : ''}`);
      h += lintBox(l => /dage|overproduktion/i.test(l.t));
    }
    if (S.step === 5) {
      ok = !!c.uat;
      h += `<p class="eyebrow">Trin 5 af 5</p><h1 class="title">Specifikation og UAT</h1>`;
      h += card('Specifikation', `<ul class="spec">${E.specLines(c).map(l => `<li>${esc(l)}</li>`).join('')}</ul>`, '<span class="tag acc">v1.0 udkast</span>');
      const L = E.lint(c);
      h += card('Spec-gennemgang', L.length ? `<ul class="spec lint">${L.map(l => `<li class="${l.sev}">${esc(l.t)}</li>`).join('')}</ul>` : '<p class="muted">Ingen bemærkninger.</p>',
        `<span class="tag ${L.some(l => l.sev === 'bad') ? 'bad' : L.some(l => l.sev === 'warn') ? 'warn' : 'ok'}">${L.filter(l => l.sev !== 'ok').length} bemærkninger</span>`);
      h += card('Hvor meget skal testes?', Object.entries(E.UAT).map(([k, u]) =>
        opt('uat', k, c.uat === k, `${u.name} · ${u.days} dage`, { happy: 'De mest almindelige forløb. Første patient kan randomiseres med det samme.', risk: 'Randomisering, titrering, nødafblinding og udløb testes grundigt. Første måned bliver lidt kortere.', full: 'Alle krav, alle roller, alle rapporter. Første måned er næsten væk.' }[k])).join('')
        + quote('Mette', 'Hver dag i UAT er en dag senere første patient. Bare så du ved det.'));
    }
    app.innerHTML = h + nav(ok);
  }

  function uat() {
    const u = S.uat, F = u.found.map(id => E.DEFECTS[id]);
    let h = `<p class="eyebrow">UAT afsluttet</p><h1 class="title">${u.n} scripts kørt</h1>`;
    h += card('Fundne fejl', F.length ? F.map(d => `<div class="alert ${d.crit ? 'bad' : 'warn'}"><span class="dot"></span><div>${esc(d.t)}${d.crit ? ' <span class="tag bad">kritisk</span>' : ''}<br><span class="muted" style="font-size:13px">Rettet og gentestet før go-live.</span></div></div>`).join('') : '<p class="muted">UAT fandt ingen fejl.</p>',
      `<span class="tag ${F.length ? 'warn' : 'ok'}">${F.length} rettet</span>`);
    h += card('', quote('Leverandøren', F.length ? 'Godt fanget. Det er præcis derfor, man tester.' : 'Ingen fejl. Det sker.') + quote('Birgitte', 'Fejl, der ikke blev fundet, står ikke på listen. Dem møder vi i produktion.'));
    h += `<button class="btn primary" data-act="golive">Gå live</button>`;
    app.innerHTML = h;
  }

  // ---------- Måned ----------
  function month() {
    const m = S.month, ev = E.EVENTS[m], D = E.dash(S), done = ev && S.decided[ev.id];
    const last = S.hist[S.hist.length - 1];
    let h = `<p class="eyebrow">Måned ${m} af ${E.MONTHS}</p><h1 class="title">${m === 1 ? 'Go-live' : ev ? ev.title : 'Drift'}</h1>`;
    // KPI
    const pen = S.pen.length;
    h += `<div class="kpis">
      <div class="kpi"><span>Randomiseret</span><b>${S.patients.length}<small> / ${E.TARGET}</small></b><div class="progress"><b style="width:${S.patients.length / E.TARGET * 100}%"></b></div></div>
      <div class="kpi"><span>I behandling</span><b>${D.active}</b><small>${S.sites.filter(s => m >= s.act).length} af 30 sites aktive</small></div>
      <div class="kpi"><span>Besøg uden kit</span><b class="${S.st.missed ? 'bad' : ''}">${S.st.missed}</b><small>${S.st.blocked} randomiseringer afvist</small></div>
      <div class="kpi"><span>Afvigelser</span><b class="${pen ? 'warn' : ''}">${pen}</b><small>${S.st.waste ? n(S.st.waste) + ' kits destrueret' : 'Intet spild endnu'}</small></div></div>`;
    if (last) {
      h += card(`Måned ${last.m} i tal`, `<table>
        <tr><td class="muted">Randomiseret</td><td>${last.rand}</td></tr>
        <tr><td class="muted">Forsendelser</td><td>${last.ships}</td></tr>
        <tr><td class="muted">Besøg uden kit</td><td class="${last.missed ? 'bad' : ''}">${last.missed}</td></tr>
        <tr><td class="muted">Afviste randomiseringer</td><td class="${last.blocked ? 'warn' : ''}">${last.blocked}</td></tr>
        ${last.waste ? `<tr><td class="muted">Destrueret</td><td class="bad">${n(last.waste)} kits</td></tr>` : ''}
        ${last.expDisp ? `<tr><td class="muted">Udleveret med for kort holdbarhed</td><td class="bad">${last.expDisp}</td></tr>` : ''}</table>`);
    }
    if (S.notes.length) h += card('Beskeder', S.notes.map(x => `<div class="alert ${x.sev}"><span class="dot"></span><div><span class="who">${esc(x.who)}:</span> ${x.t}</div></div>`).join(''));
    if (S.newCards.length) h += newCards();
    if (ev) {
      let b = `<p>${ev.text}</p>${quote(ev.who, ev.quote)}`;
      b += ev.options.map(o => opt('choose', o.id, done === o.id, o.label, '', false, done ? 'disabled' : '').replace('class="opt', `class="opt${done && done !== o.id ? ' faded' : ''}`)).join('');
      if (done) b += `<div class="alert info" style="margin-top:12px"><span class="dot"></span><div>${S.after.text}${S.after.extra ? `<br><br><span class="bad">${S.after.extra}</span>` : ''}</div></div>`;
      h += card(ev.title, b, done ? '<span class="tag ok">Besluttet</span>' : '<span class="tag warn">Kræver beslutning</span>');
    }
    // Rekruttering
    h += card('Rekruttering', chart() + `<div class="legend"><span><i></i>Faktisk</span><span><i class="plan"></i>Plan</span></div>
      <table style="margin-top:8px"><tr><th>Land</th><th>Sites</th><th>Randomiseret</th></tr>
      ${D.byC.map(c => `<tr><td>${c.name}</td><td>${c.sites}/${c.of}</td><td>${c.n}</td></tr>`).join('')}</table>
      ${quote('Jonas', D.bal)}`);
    // Forsyning
    h += card('Forsyning', `<table><tr><th>Kit-type</th><th>Depot</th><th>Sites</th><th>Tomme</th></tr>
      ${E.VARIANTS.filter(v => S.cfg.titr !== 'open' || v !== 'S3L').map(v => { const r = D.per[v], low = D.low.includes(v); return `<tr><td>${E.VLABEL[v]}${S.mods.hDrop && v === 'S3H' ? ' <span class="faint">lukket</span>' : ''}</td><td class="${low ? 'bad' : ''}">${n(r.central)}</td><td>${n(r.sites)}</td><td>${last ? `<span class="pill ${r.empty === 0 ? 'ok' : r.empty < 4 ? 'warn' : 'bad'}">${r.empty}</span>` : '<span class="faint">sendes</span>'}</td></tr>`; }).join('')}</table>
      <p class="faint" style="font-size:12px;margin-top:8px">Ublindet supply-visning. Sites og monitorer ser kun kit-numre.</p>
      ${D.low.length ? quote('Line', `Depotet er ved at løbe tørt for ${D.low.map(v => E.VLABEL[v].toLowerCase()).join(', ')}. En ekstra batch tager tre måneder.`) : ''}
      <div class="lbl">${S.cfg.resup === 'pred' ? 'Sikkerhedslager' : 'Min/max-niveau'}</div>${seg('setbuf', [[1, 'Lavt'], [2, 'Mellem'], [3, 'Højt']], S.cfg.buf)}
      <button class="btn" data-act="order" ${E.canOrder(S) ? '' : 'disabled'}>${E.canOrder(S) ? 'Bestil ekstra produktion · +15 % · 1,2 mio. kr.' : S.mods.extra.some(e => e.m > m) ? 'Ekstra produktion er på vej' : 'For sent at bestille mere'}</button>`);
    h += `<button class="btn primary" data-act="run" ${ev && !done ? 'disabled' : ''}>${m === E.MONTHS ? 'Kør sidste måned og lås databasen' : `Kør måned ${m}`}</button>`;
    if (S.month > 1 || done) h += `<button class="btn ghost" data-act="rewind">Rul måned ${m} tilbage${S.rewinds ? ` · brugt ${S.rewinds} gang${S.rewinds > 1 ? 'e' : ''}` : ''}</button>`;
    app.innerHTML = h;
  }

  function chart() {
    const W = 320, H = 110, pad = 4, max = E.TARGET, X = i => pad + (W - 2 * pad) * i / E.MONTHS, Y = v => H - pad - (H - 2 * pad) * v / max;
    const plan = [0].concat(S.planCum || []).map((v, i) => `${X(i)},${Y(Math.min(v, max))}`).join(' ');
    const act = [0].concat(S.hist.map(x => x.cum)).map((v, i) => `${X(i)},${Y(v)}`).join(' ');
    const tgt = X(E.LPFV_TARGET);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Kumuleret rekruttering mod plan">
      <line x1="${pad}" x2="${W - pad}" y1="${Y(max)}" y2="${Y(max)}" stroke="var(--line2)" stroke-dasharray="3 3"/>
      <line x1="${tgt}" x2="${tgt}" y1="${pad}" y2="${H - pad}" stroke="var(--line2)" stroke-dasharray="3 3"/>
      <polyline points="${plan}" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
      <polyline points="${act}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function newCards() {
    return card('Nyt i videnbasen', `<div class="tiles">${S.newCards.map(id => { const c = CARDS.find(x => x.id === id); return c ? `<button class="tile new" data-act="card" data-id="${id}">${c.t}<small>${c.s}</small></button>` : ''; }).join('')}</div>`);
  }

  // ---------- Slut ----------
  function end() {
    const R = S.end, G = E.grade(R.total), B = R.B.groups;
    let h = `<p class="eyebrow">Database lock · måned ${E.MONTHS}</p><h1 class="title">Koden er brudt</h1>`;
    h += card('', `<div class="between"><div><div class="big-score">${R.total}</div><div class="muted">af 100</div></div><div style="text-align:right"><b style="font-size:17px">${G[0]}</b><p class="muted" style="font-size:13.5px;max-width:230px;margin-top:2px">${G[1]}</p></div></div>
      ${[['Studieintegritet', R.integ, 'randomisering, blinding, afvigelser'], ['Patientforsyning', R.supply, `${S.st.missed} besøg uden kit, ${S.st.blocked} afviste randomiseringer`], ['Spild og omkostning', R.waste, `${mio(R.costKr)} i spild, fragt og ekstraarbejde`], ['Tidsplan', R.time, S.lpfv ? `sidste patient randomiseret i måned ${Math.ceil(S.lpfv)}` : `${S.patients.length} af ${E.TARGET} randomiseret`]]
        .map(([t, v, s]) => `<div class="score"><span>${t} <span class="faint" style="font-size:12px">· ${s}</span></span><b class="num">${v}</b><div class="bar"><b style="width:${v}%"></b></div></div>`).join('')}`);
    const arms = [['L', '1,2 mg', 'var(--a1)'], ['H', '2,4 mg', 'var(--a2)'], ['P', 'Placebo', 'var(--a3)']];
    h += card('Afblinding', `<p class="muted" style="font-size:13.5px">Nu må alle se det: sådan blev patienterne fordelt. I parentes står det, forholdet lovede.</p>
      <table><tr><th>Gruppe</th>${arms.map(a => `<th><span class="arm" style="background:${a[2]}"></span>${a[1]}</th>`).join('')}</tr>
      ${Object.entries(B).map(([g, r]) => `<tr><td>${g}</td>${arms.map(a => `<td>${r.n[a[0]]} <span class="faint">(${n(r.e[a[0]])})</span></td>`).join('')}</tr>`).join('')}</table>
      ${quote('Jonas', R.B.max < .03 ? 'Pænt. Det er sådan, det skal se ud, når ingen har pillet ved noget.' : R.B.max < .06 ? 'Lidt skævt hist og her, men intet, analysen ikke kan bære.' : 'Det her skal forklares i den statistiske rapport. Flere steder.')}`);
    h += card('Inspektørens fund', R.findings.length ? `<ul class="spec lint">${R.findings.slice().sort((a, b) => b.pts - a.pts).map(f => `<li class="${f.breach || f.pts >= 10 ? 'bad' : 'warn'}">${esc(f.why)}${f.m ? ` <span class="faint">· måned ${f.m}</span>` : ''}${f.breach ? ' <span class="tag bad">blinding</span>' : ''}</li>`).join('')}</ul>` : '<p class="muted">Ingen fund.</p>',
      `<span class="tag ${R.findings.length ? 'warn' : 'ok'}">${R.findings.length}</span>`);
    h += card('', quote('Birgitte', R.integ >= 90 ? 'Det er en audit trail, man kan læse højt. Tak.' : R.integ >= 70 ? 'Alt kan forklares. Noget af det tog bare lidt længere end nødvendigt.' : 'Jeg har booket et lokale til CAPA-mødet. Hele dagen.')
      + quote('Mette', S.lpfv && S.lpfv <= E.LPFV_TARGET ? 'Vi ramte tidsplanen. Det har jeg sagt til alle.' : 'Vi blev færdige. Lad os sige det sådan.')
      + quote('Line', R.costKr < 2.5e6 ? 'Der står næsten intet tilbage at destruere. Det er sjældent.' : 'Jeg har bestilt en container til destruktion. Den er stor.'));
    h += `<button class="btn primary" data-act="restart">Sæt et nyt studie op</button><button class="btn" data-act="audit">Læs audit trail</button>`;
    app.innerHTML = h;
  }

  // ---------- Modaler ----------
  function openCards(id) {
    modal.hidden = false;
    if (id) {
      const c = CARDS.find(c => c.id === id);
      modal.innerHTML = card(c.t, `<p class="muted" style="margin-bottom:8px">${c.s}</p><p>${c.b}</p>${c.f ? `<div class="formula">${c.f}</div>` : ''}
        <button class="btn primary" data-act="closemodal">Luk</button><button class="btn ghost" data-act="cards">Hele videnbasen</button>`);
    } else {
      modal.innerHTML = card('Videnbase', `<p class="muted" style="font-size:13.5px">Begreberne dukker op, når du støder på dem. ${S.cards.length} af ${CARDS.length} fundet.</p>
        <div class="tiles">${CARDS.map(c => S.cards.includes(c.id) ? `<button class="tile" data-act="card" data-id="${c.id}">${c.t}<small>${c.s}</small></button>` : `<div class="tile locked">Låst<small>Ikke fundet endnu</small></div>`).join('')}</div>
        <button class="btn primary" data-act="closemodal">Luk</button><button class="btn ghost" data-act="restart">Opgiv og start forfra</button>`);
    }
    modal.scrollTop = 0;
  }

  function openAudit() {
    modal.hidden = false;
    const L = S.log.slice().reverse();
    modal.innerHTML = card('Audit trail', `<p class="muted" style="font-size:13.5px">Alt, hvad der er sket i systemet, med hvem og hvornår. Intet kan slettes.</p>
      <ul class="log">${L.length ? L.map(e => `<li class="${e.sev}"><time>${e.m ? 'M' + String(e.m).padStart(2, '0') : 'BUILD'}</time><span><em>${esc(e.who)}</em> · ${esc(e.txt)}</span></li>`).join('') : '<li><time>—</time><span class="muted">Tom endnu.</span></li>'}</ul>
      <button class="btn primary" data-act="closemodal">Luk</button>`);
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
    else if (a === 'choose') { E.choose(S, v); stay(); }
    else if (a === 'setbuf') { E.setBuf(S, +v); stay(); }
    else if (a === 'order') { E.orderBatch(S); stay(); }
    else if (a === 'run') { E.runMonth(S); go(); }
    else if (a === 'rewind') { S = E.rewind(S); go(); }
    else if (a === 'restart') {
      if (S && S.phase !== 'end' && !confirm('Vil du opgive studiet og starte forfra?')) return;
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
