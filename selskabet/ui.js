// Selskabet: skærmbillederne. Al spillogik ligger i engine.js.
(() => {
  'use strict';
  const E = window.Engine, CARDS = window.CARDS, KEY = 'selskabet.v1';
  const app = document.getElementById('app'), bar = document.getElementById('bar'), modal = document.getElementById('modal');
  let S = null, dec = null, resVal = 0, showProj = true;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mio = (x, d) => E.fmt(x, d);
  const kr = x => Math.round(x).toLocaleString('da-DK');
  const pct = (x, d) => E.fmt(x * 100, d === undefined ? 0 : d) + ' %';
  const sgn = (x, d) => (x >= 0 ? '+' : '−') + mio(Math.abs(x), d);
  const sgnPct = x => (x >= 0 ? '+' : '−') + E.fmt(Math.abs(x) * 100, 0) + ' %';
  const cls = x => x >= 0 ? 'good' : 'bad';
  const INIT = { 'Fru Mortensen': 'FM', 'Kim fra salg': 'KIM', 'Formand Holm': 'FH', 'Finanstilsynet': 'FT' };
  const ROLE = { 'Fru Mortensen': 'chefaktuar', 'Kim fra salg': 'salgschef', 'Formand Holm': 'bestyrelsen', 'Finanstilsynet': '' };
  const quote = (who, text) => `<div class="quote"><span class="who">${INIT[who] || '??'}</span><div><span class="name">${who}${ROLE[who] ? ', ' + ROLE[who] : ''}</span>${text}</div></div>`;
  const win = (title, body) => `<section class="win"><h2 class="win-title">${title}</h2><div class="win-body">${body}</div></section>`;

  function save() { try { if (S) localStorage.setItem(KEY, JSON.stringify(S)); else localStorage.removeItem(KEY); } catch (e) { /* uden lagring virker spillet stadig */ } }
  function load() { try { const t = localStorage.getItem(KEY); const o = t ? JSON.parse(t) : null; return o && o.v === 1 ? o : null; } catch (e) { return null; } }

  function go() { save(); render(); window.scrollTo(0, 0); }

  function render() {
    const era = S ? E.eraOf(S.year) : 1;
    document.body.dataset.era = era;
    document.title = 'Selskabet · ' + (S ? S.year : 1982);
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = ['#020a04', '#10022a', '#008080'][era - 1];
    renderBar();
    if (!S) return title();
    ({ news, desk, reserve, report, over, end })[S.phase]();
  }

  function renderBar() {
    if (!S) { bar.hidden = true; return; }
    bar.hidden = false;
    const h = S.hist[S.hist.length - 1];
    bar.innerHTML = `<div class="stat"><span>${esc(S.company)}</span><b>${S.year}</b></div>
      <div class="stat"><span>Egenkapital</span><b class="${S.capital < 0 ? 'bad' : ''}">${mio(S.capital)} mio.</b></div>
      <div class="stat"><span>Solvens</span><b>${h ? pct(h.solv) : 'ny'}</b></div>
      <span class="grow"></span><button class="btn" data-act="cards">Kartotek ${S.cards.length}/${CARDS.length}</button>`;
  }

  // ---------- Forside ----------
  function title() {
    const old = load();
    app.innerHTML = `<div class="center"><div class="logo">SELSKABET</div><p class="dim">Forsikring 1982 til 1992</p></div>
      <p class="dim" style="margin-top:22px">KATTEGAT DATACENTRAL, TERMINAL 04<br>64 KB RAM OK<br>REGNSKABSSYSTEM V2.1 INDLÆST<br>KLAR<span class="cursor"></span></p>
      ${win('Velkommen, direktør', `<p>Du overtager et lille dansk skadesforsikringsselskab i 1982. Renten er 20 %, regnskabet er grønt på sort, og ingen har hørt om Solvens II.</p>
        <p>Hvert år sætter du priser, køber genforsikring og afsætter reserver. Så ser du, hvad der sker. Der er ingen facitliste, kun konsekvenser, og en chefaktuar, der gerne forklarer undervejs.</p>
        <label class="fld">DIT NAVN:<input type="text" id="pname" maxlength="24" autocomplete="off" placeholder="Direktøren"></label>
        <label class="fld">SELSKABETS NAVN:<input type="text" id="cname" maxlength="28" autocomplete="off" placeholder="Kattegat Forsikring"></label>
        <button class="btn go" data-act="start">Start i 1982</button>
        ${old ? `<button class="btn" data-act="resume">Fortsæt ${esc(old.company)} (${old.year})</button>` : ''}`)}
      <p class="dim center" style="font-size:.85em">Løst baseret på virkelighedens 80'ere. Selskaber og personer er opdigtede.</p>`;
  }

  // ---------- Nyt år ----------
  function news() {
    const I = S.info, y = S.year, ch = I.choice ? E.CHOICES[y] : null;
    let h = '';
    if (y === 1985) h += `<div class="banner">EDB-AFDELINGEN MEDDELER:<br>NU MED FARVER!</div>`;
    if (y === 1990) h += `<div class="banner">Velkommen til den grafiske brugerflade.<br>Brug musen. Den bider ikke.</div>`;
    h += win('Nyt år', `<div class="big">${y}</div><ul class="news">${I.news.map(n => `<li>${n}</li>`).join('')}</ul>
      <p class="dim" style="margin-top:8px">Obligationsrente ${pct(I.rate)}. Ventet inflation ${pct(I.inflForecast, 1)}.</p>`);
    if (I.unlocks.length) h += win('Nyt på skrivebordet', `<p class="hi">${I.unlocks.join(' · ')}</p>${unlockText(y)}`);
    if (ch) {
      h += win(ch.title, `<p>${ch.text}</p>` + (I.choiceDone
        ? `<p class="hi">${I.choiceAfter}</p>`
        : ch.options.map(o => `<button class="btn" data-act="choose" data-id="${o.id}">${o.label}</button>`).join('')));
    }
    if (S.newCards.length) h += newCards(S.newCards);
    h += `<button class="btn go" data-act="desk" ${ch && !I.choiceDone ? 'disabled' : ''}>Til skrivebordet</button>`;
    app.innerHTML = h;
  }

  function unlockText(y) {
    if (y === 1983) return quote('Fru Mortensen', 'En storm rammer alle vores huskunder samme nat. Genforsikringen betaler alt over selvbeholdet. Vælg et selvbehold, egenkapitalen kan tåle at miste.');
    if (y === 1984) return quote('Fru Mortensen', 'Erhvervskunder er få, store og langsomme. En arbejdsskade kan tage fem år at afslutte. Vi får præmien nu og regningen senere.');
    if (y === 1985) return quote('Formand Holm', 'Obligationer giver en sikker rente. Aktier kan give mere. Eller mindre. Brug hovedet.');
    return '';
  }

  function newCards(ids) {
    return win('Nye kort i kartoteket', `<div class="cards">${ids.map(id => { const c = CARDS.find(c => c.id === id); return `<button class="card-tile new" data-act="card" data-id="${id}">${c.t}<small>${c.s}</small></button>`; }).join('')}</div>`);
  }

  // ---------- Skrivebordet ----------
  function desk() {
    const I = S.info, y = S.year, prev = S.hist[S.hist.length - 1];
    if (!dec || dec.year !== y) dec = { year: y, pct: {}, ri: S.riOpt, eq: S.eq };
    let body = '';
    for (const id of E.ORDER) {
      const L = S.lines[id]; if (!L.active) continue;
      const li = I.lines[id], t = li.tech; if (dec.pct[id] === undefined) dec.pct[id] = 0;
      const gap = li.gapEst, lr = prev && prev.lr[id] !== undefined ? pct(prev.lr[id]) : 'ny';
      const kim = Math.abs(gap) < .015 ? 'Vi ligger på niveau med konkurrenterne.' : gap > 0 ? `Vi ligger cirka ${pct(gap)} over konkurrenterne.` : `Vi ligger cirka ${pct(-gap)} under konkurrenterne.`;
      body += `<div class="line" data-line="${id}">
        <div class="row"><h3>${L.name}</h3><span class="num">${kr(L.n)} kunder</span></div>
        <div class="row dim"><span>Præmie i fjor ${kr(L.prem)} kr.</span><span>Skadespct. ${lr}</span></div>
        ${quote('Fru Mortensen', `Frekvens ${pct(t.freq, 1)}, snitskade ${kr(t.sev)} kr.${t.storm ? ' Storm og genforsikring ' + kr(t.storm) + ' kr.' : ''} Med omkostninger og 3 % margin: <span class="hi">teknisk pris ${kr(t.tech)} kr.</span>`)}
        ${quote('Kim fra salg', kim)}
        <input type="range" min="-15" max="25" step="1" value="${Math.round(dec.pct[id] * 100)}" data-inp="pct" data-id="${id}" aria-label="Præmieændring ${L.name}">
        <div class="row"><span>Ny præmie</span><b class="hi num" data-out="prem"></b></div>
        <div class="pbar" data-out="bar"></div>
      </div>`;
    }
    let h = win('Præmier ' + y, body);

    const q = I.ri;
    if (S.unlocked.ri) {
      h += win('Genforsikring mod storm', q.map(o => `<button class="opt ${dec.ri === o.id ? 'on' : ''}" data-act="ri" data-id="${o.id}"><span class="dot">${dec.ri === o.id ? '(o)' : '( )'}</span><span>${o.name}<small>${o.ret === null ? 'Selskabet bærer alle stormskader selv.' : `Selvbehold ${mio(o.ret, 0)} mio. · pris ${mio(o.price)} mio. · giver i snit ${mio(o.avg)} mio. tilbage om året`}</small></span></button>`).join('')
        + quote('Fru Mortensen', `En almindelig storm koster os omkring ${mio(S.lines.hus.n * 1100 * S.idx / 1e6, 0)} mio. kr. En orkan det firedobbelte. Egenkapitalen er ${mio(S.capital, 0)} mio.`));
    } else {
      h += win('Genforsikring mod storm', `<p class="dim">Den gamle kontrakt løber året ud: selvbehold ${mio(q[S.riOpt].ret, 0)} mio. kr., pris ${mio(q[S.riOpt].price)} mio. kr.</p>`);
    }
    if (S.unlocked.inv) {
      h += win('Formuen', `<div class="row"><span>Aktier</span><b class="hi num" data-out="eq"></b></div>
        <input type="range" min="0" max="50" step="5" value="${Math.round(dec.eq * 100)}" data-inp="eq" aria-label="Aktieandel">
        <p class="dim">Resten står i obligationer til ${pct(I.rate)} i rente.</p>`);
    }
    h += `<button class="btn go" data-act="run">Kør året ${y}</button><button class="btn" data-act="back">Tilbage til nyhederne</button>`;
    app.innerHTML = h;
    updateDesk();
  }

  function updateDesk() {
    app.querySelectorAll('[data-line]').forEach(el => {
      const id = el.dataset.line, L = S.lines[id], li = S.info.lines[id], p = dec.pct[id];
      const np = Math.round(L.prem * (1 + p)), mk = L.prem / (1 + li.gapEst), te = li.tech.tech;
      el.querySelector('[data-out=prem]').textContent = `${kr(np)} kr. (${sgnPct(p)})`;
      const lo = Math.min(L.prem * .85, mk, te) * .97, hi = Math.max(L.prem * 1.25, mk, te) * 1.03, pos = v => ((v - lo) / (hi - lo) * 100).toFixed(1);
      const near = Math.abs(pos(mk) - pos(te)) < 17;
      el.querySelector('[data-out=bar]').innerHTML = `<i style="left:${pos(mk)}%">marked</i><i style="left:${pos(te)}%;top:${near ? -12 : 0}px">teknisk</i><i class="me" style="left:${pos(np)}%">dig</i>`;
    });
    const eq = app.querySelector('[data-out=eq]'); if (eq) eq.textContent = pct(dec.eq);
  }

  // ---------- Årsafslutning med reserve ----------
  function reserve() {
    const ri = E.reserveInfo(S), c = S.cur, y = S.year;
    if (!resVal || resVal < ri.min || resVal > ri.max) resVal = Math.round(ri.recValue * 10) / 10;
    let facts = `<ul class="news">`;
    if (c.storm) facts += `<li class="bad">${c.storm === 'orkan' ? 'EN ORKAN har hærget landet.' : 'En storm har ramt landet.'} Skader for ${mio(c.stormGross)} mio. kr. hos vores huskunder${c.riRec > 0 ? `, hvoraf genforsikringen betaler ${mio(c.riRec)} mio.` : '.'}</li>`;
    if (c.claims.kemi > 0) facts += `<li class="bad">Nordisk Kemi A/S er brændt. Vores regning: ${mio(c.claims.kemi)} mio. kr.</li>`;
    if (c.events.includes('retspraksis')) facts += `<li class="bad">Domstolene har hævet erstatningerne ved personskade. Også ubetalte sager fra tidligere år bliver dyrere.</li>`;
    facts += E.ORDER.filter(id => c.n[id]).map(id => `<li>${S.lines[id].name}: ${kr(c.n[id])} kunder (${sgnPct(c.growth[id])})</li>`).join('');
    facts += `<li>Udbetalt på erhvervsskader i år: ${mio(c.paidNew + c.paidPrior)} mio. kr.</li></ul>`;
    let h = win('Året der gik: ' + y, facts);

    const nm = { elr: 'Forventet skadesprocent', cl: 'Chain ladder', bf: 'Bornhuetter-Ferguson' };
    let tri = `<table class="tri"><tr><th>Årgang</th>${[1, 2, 3, 4, 5].map(k => `<th>År ${k}</th>`).join('')}</tr>`;
    for (const r of ri.rows) tri += `<tr><td>${r.ay}</td>${[0, 1, 2, 3, 4].map(j => j < r.cum.length ? `<td>${mio(r.cum[j])}</td>` : `<td class="p">${showProj ? mio(r.proj[j]) : '·'}</td>`).join('')}</tr>`;
    tri += `<tr class="fac"><td>Faktor</td><td></td>${ri.factors.map(f => `<td>${E.fmt(f.f, 2)}${f.own ? '' : '*'}</td>`).join('')}</tr></table>`;
    const intro = y === 1984
      ? 'Vi har kun betalt en lille del af årets erhvervsskader. Resten kommer de næste fire år. Hvor meget lægger vi til side?'
      : 'Trekanten viser, hvad vi har betalt i alt på hver årgang, år for år. De skrå tal er min fremskrivning med chain ladder.';
    const tips = y === 1984 ? 'Uden historik bruger jeg det, vi regnede med, da vi satte prisen.'
      : y < 1987 ? 'Chain ladder svinger meget på den nyeste årgang, hvor kun lidt er betalt. Se på begge tal, og brug din dømmekraft.'
      : y === 1987 ? 'Fra i år regner jeg også Bornhuetter-Ferguson. Men husk: ingen af metoderne kender den nye retspraksis. Dem, der ser bagud, undervurderer.'
      : 'Metoderne ser bagud. Er der sket noget nyt i år, som tallene ikke kan vide?';
    h += win('Erstatningsreserve, erhverv', `${quote('Fru Mortensen', intro)}
      <div style="margin-top:10px">${tri}</div>
      <p class="dim" style="font-size:.85em;margin-top:4px">Akkumuleret betalt, mio. kr. ${ri.factors.some(f => !f.own) ? '* = branchetal, vi har ingen egne endnu.' : ''}
        <button class="btn small" data-act="proj">${showProj ? 'Skjul' : 'Vis'} fremskrivning</button></p>
      <div class="line">${Object.keys(nm).filter(k => ri.methods[k] !== null).map(k => `<button class="opt" data-act="method" data-v="${ri.methods[k]}"><span class="dot">${k === ri.rec ? 'FM' : ''}</span><span>${nm[k]}: ${mio(ri.methods[k])} mio.<small>${k === ri.rec ? 'Fru Mortensens anbefaling' : k === 'elr' ? 'Bygger på det, vi ventede, da prisen blev sat' : k === 'cl' ? 'Bygger kun på trekanten' : 'Blanding af de to'}</small></span></button>`).join('')}
      ${quote('Fru Mortensen', tips)}</div>
      <div class="line"><div class="row"><span>Din reserve</span><b class="hi num" data-out="res"></b></div>
      <input type="range" min="${ri.min}" max="${ri.max}" step="0.1" value="${resVal}" data-inp="res" aria-label="Erstatningsreserve">
      <div class="row dim"><span>Reserve sidste år</span><span class="num">${mio(ri.prev)} mio.</span></div>
      <div class="row"><span>Årets resultat før skat bliver</span><b class="num" data-out="pre"></b></div>
      <p class="dim" style="font-size:.85em">Hver million i reserven trækker en million fra årets resultat. Den kommer igen, hvis du har sat for meget af.</p></div>`);
    h += `<button class="btn go" data-act="close">Luk regnskabet ${y}</button>`;
    app.innerHTML = h;
    updateReserve();
  }

  function updateReserve() {
    const r = E.preview(S, resVal), o = app.querySelector('[data-out=pre]');
    app.querySelector('[data-out=res]').textContent = mio(resVal) + ' mio. kr.';
    o.textContent = sgn(r.pre) + ' mio.'; o.className = 'num ' + cls(r.pre);
  }

  // ---------- Årsregnskab ----------
  function spark(vals, zero) {
    const lo = Math.min(0, ...vals), hi = Math.max(1, ...vals), W = 300, H = 60, n = vals.length;
    const x = i => n === 1 ? W / 2 : 6 + i * (W - 12) / (n - 1), yy = v => H - 5 - (v - lo) / (hi - lo) * (H - 10);
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Egenkapitalens udvikling">
      <line x1="0" x2="${W}" y1="${yy(zero || 0)}" y2="${yy(zero || 0)}" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="3 4"/>
      <polyline fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" points="${vals.map((v, i) => x(i).toFixed(1) + ',' + yy(v).toFixed(1)).join(' ')}"/>
      ${vals.map((v, i) => `<rect x="${(x(i) - 2.5).toFixed(1)}" y="${(yy(v) - 2.5).toFixed(1)}" width="5" height="5" fill="currentColor"/>`).join('')}</svg>`;
  }

  function report() {
    const R = S.report, y = R.year, c = R.claims;
    const row = (l, v, k) => `<tr class="${k || ''}"><td>${l}</td><td class="${k === 'sum' ? cls(v) : ''}">${sgn(v)}</td></tr>`;
    let pl = `<table class="pl">${row('Præmier', R.premTotal)}${row('Erstatninger', -R.claimsTotal)}`;
    if (R.storm) pl += row(`heraf ${R.storm} (efter genforsikring)`, -c.storm, 'sub');
    if (Math.abs(R.runoff) > .05) pl += row('heraf afløb på gamle årgange', R.runoff, 'sub');
    if (c.kemi > 0) pl += row('heraf Nordisk Kemi', -c.kemi, 'sub');
    if (c.hole > 0) pl += row('heraf reservehul, Lillebælt', -c.hole, 'sub');
    if (R.forced > 0) pl += row('heraf påbud fra tilsynet', -R.forced, 'sub');
    pl += row('Genforsikringspræmie', -R.riPrem) + row('Omkostninger', -R.exp);
    if (R.oneOff > 0) pl += row('heraf engangsudgift', -R.oneOff, 'sub');
    pl += row('Forsikringsresultat', R.uw, 'sum') + row(`Afkast af formuen (${pct(R.invRate, 1)})`, R.inv) + row('Skat', -R.tax) + row('Årets resultat', R.net, 'sum') + '</table>';

    let h = win('Årsregnskab ' + y, `<div class="big ${cls(R.net)}">${sgn(R.net)} mio.</div>${pl}
      <div class="row" style="margin-top:8px"><span>Combined ratio</span><b class="num ${R.cr <= 1 ? 'good' : 'bad'}">${pct(R.cr, 1)}</b></div>`);

    const mx = Math.max(R.capital, R.krav) * 1.15 || 1;
    h += win('Kapital og kunder', `<div class="row"><span>Egenkapital</span><b class="num ${cls(R.capital)}">${mio(R.capital)} mio.</b></div>
      <div class="meter"><b style="width:${Math.max(0, R.capital / mx * 100).toFixed(1)}%"></b><u style="left:${(R.krav / mx * 100).toFixed(1)}%"></u></div>
      <div class="row dim"><span>Solvenskrav ${mio(R.krav)} mio. (stregen)</span><span>${pct(R.solv)} af kravet</span></div>
      ${S.hist.length > 1 ? spark([35].concat(S.hist.map(r => r.capital))) + `<div class="row dim" style="font-size:.85em"><span>1982</span><span>Egenkapital</span><span>${y}</span></div>` : ''}
      <table style="margin-top:8px"><tr><th></th><th>Kunder</th><th>Vækst</th><th>Skadespct.</th></tr>
      ${E.ORDER.filter(id => R.n[id]).map(id => `<tr><td>${S.lines[id].name}</td><td>${kr(R.n[id])}</td><td class="${cls(R.growth[id])}">${sgnPct(R.growth[id])}</td><td>${pct(R.lr[id])}</td></tr>`).join('')}</table>
      ${R.lr.hus !== undefined ? '<p class="dim" style="font-size:.85em;margin-top:4px">Skadesprocent for hus er inklusive storm og genforsikring.</p>' : ''}`);

    if (R.remarks.length) h += win('På direktionsgangen', R.remarks.map(r => quote(r.who, r.text)).join(''));
    if (R.newCards.length) h += newCards(R.newCards);
    h += S.over ? `<button class="btn go" data-act="next">Åbn brevet fra tilsynet</button>`
      : y >= E.END ? `<button class="btn go" data-act="next">Til nytårskuren 1992</button>`
      : `<button class="btn go" data-act="next">Videre til ${y + 1}</button>`;
    app.innerHTML = h;
  }

  // ---------- Slut ----------
  function over() {
    const k = S.over.reason === 'konkurs';
    app.innerHTML = win(k ? 'Kassen er tom' : 'Tilsynet overtager', `<div class="big bad">${S.year}</div>
      <p>${k ? 'Egenkapitalen er brugt op. Selskabet kan ikke betale sine skader, og Finanstilsynet har overtaget ledelsen.' : 'Egenkapitalen har ligget under solvenskravet to år i træk. Finanstilsynet har indsat en administrator.'}</p>
      <p>Det skete for flere rigtige selskaber i de år. Forskellen er, at du har en tidsmaskine.</p>
      ${quote('Fru Mortensen', 'Jeg har gemt alle papirerne fra nytårsdag. Vi kan tage året en gang til, hvis De vil. Det bliver ikke helt det samme år, men næsten.')}
      <button class="btn go" data-act="rewind">Spol tilbage til 1. januar ${S.year}</button>
      <button class="btn" data-act="restart">Start forfra i 1982</button>`);
  }

  function end() {
    const F = S.final, st = n => '★'.repeat(n) + '☆'.repeat(3 - n);
    const resTxt = F.adeq < .95 ? `Reserverne var ${mio(F.need - S.reserve)} mio. for små. Det finder din efterfølger ud af.` : F.adeq > 1.2 ? `Reserverne var ${mio(S.reserve - F.need)} mio. større end nødvendigt. Din efterfølger får nogle gode år.` : 'Reserverne passede næsten på kronen.';
    app.innerHTML = win('Nytårskur 1992', `<p class="dim">Bestyrelsen har gjort status over ${esc(S.player)}s elleve år i spidsen for ${esc(S.company)}.</p>
      <div class="big hi">${F.title}</div>
      <table>
        <tr><td>Egenkapital</td><td>${mio(35, 0)} → ${mio(S.capital, 0)} mio.</td><td class="stars">${st(F.stars.kapital)}</td></tr>
        <tr><td>Kunder</td><td>${sgnPct(F.cust)}</td><td class="stars">${st(F.stars.kunder)}</td></tr>
        <tr><td>Combined ratio, snit</td><td>${pct(F.cr, 1)}</td><td class="stars">${st(F.stars.drift)}</td></tr>
        <tr><td>Reserver</td><td>${pct(F.adeq)} af behovet</td><td class="stars">${st(F.stars.reserver)}</td></tr>
      </table>
      ${spark([35].concat(S.hist.map(r => r.capital)))}
      <p style="margin-top:8px">${resTxt}</p>
      <p class="dim">Kort i kartoteket: ${S.cards.length} af ${CARDS.length}. ${S.rewinds ? 'Tidsmaskinen blev brugt ' + S.rewinds + (S.rewinds === 1 ? ' gang.' : ' gange.') : 'Tidsmaskinen blev aldrig brugt.'}</p>
      ${quote('Fru Mortensen', F.total >= 10 ? 'Det har været en fornøjelse. De regner stadig som en aktuar, selv om De har fået hjørnekontor.' : F.total >= 7 ? 'Vi kom igennem, og bøgerne stemmer. Mere kan man ikke forlange af et årti.' : 'Det var ikke kedeligt. Næste gang lytter De måske lidt mere til mig og lidt mindre til Kim.')}
      ${quote('Kim fra salg', 'Fra 1994 er der fri konkurrence i hele EF. Det bliver vildt. Er du med?')}
      <button class="btn go" data-act="restart">Tag en tur mere fra 1982</button>
      <button class="btn" data-act="cards">Se kartoteket</button>`);
  }

  // ---------- Kartotek ----------
  function openCards(id) {
    modal.hidden = false;
    if (id) {
      const c = CARDS.find(c => c.id === id);
      modal.innerHTML = win(c.t, `<p class="hi">${c.s}</p><p>${c.b}</p>${c.f ? `<div class="formula">${c.f}</div>` : ''}
        <button class="btn" data-act="cards">Hele kartoteket</button><button class="btn go" data-act="closemodal">Luk</button>`);
    } else {
      modal.innerHTML = win('Kartotek', `<p class="dim">Begreberne dukker op, når du støder på dem. ${S.cards.length} af ${CARDS.length} fundet.</p>
        <div class="cards">${CARDS.map(c => S.cards.includes(c.id) ? `<button class="card-tile" data-act="card" data-id="${c.id}">${c.t}<small>${c.s}</small></button>` : `<div class="card-tile locked">? ? ?<small>Ikke fundet endnu</small></div>`).join('')}</div>
        <button class="btn go" data-act="closemodal">Luk</button><button class="btn" data-act="restart">Opgiv og start forfra</button>`);
    }
    modal.scrollTop = 0;
  }

  // ---------- Hændelser ----------
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'start') {
      S = E.newGame(document.getElementById('pname').value.trim(), document.getElementById('cname').value.trim()); dec = null; resVal = 0; go();
    } else if (a === 'resume') { S = load(); dec = null; resVal = 0; go(); }
    else if (a === 'choose') { E.choose(S, b.dataset.id); go(); }
    else if (a === 'desk') { S.phase = 'desk'; go(); }
    else if (a === 'back') { S.phase = 'news'; go(); }
    else if (a === 'ri') { dec.ri = +b.dataset.id; const y = window.scrollY; render(); window.scrollTo(0, y); }
    else if (a === 'run') { resVal = 0; E.runYear(S, dec); go(); }
    else if (a === 'proj') { showProj = !showProj; const y = window.scrollY; render(); window.scrollTo(0, y); }
    else if (a === 'method') { resVal = Math.round(+b.dataset.v * 10) / 10; app.querySelector('[data-inp=res]').value = resVal; updateReserve(); }
    else if (a === 'close') { E.closeYear(S, resVal); go(); }
    else if (a === 'next') { E.nextYear(S); dec = null; go(); }
    else if (a === 'rewind') { S = E.rewind(S); dec = null; go(); }
    else if (a === 'restart') {
      if (S.phase !== 'end' && S.phase !== 'over' && !confirm('Vil du opgive dette selskab og starte forfra?')) return;
      S = null; modal.hidden = true; go();
    }
    else if (a === 'cards') openCards();
    else if (a === 'card') openCards(b.dataset.id);
    else if (a === 'closemodal') modal.hidden = true;
  });
  modal.addEventListener('click', ev => { if (ev.target === modal) modal.hidden = true; });
  document.addEventListener('input', ev => {
    const t = ev.target, k = t.dataset.inp; if (!k) return;
    if (k === 'pct') { dec.pct[t.dataset.id] = +t.value / 100; updateDesk(); }
    if (k === 'eq') { dec.eq = +t.value / 100; updateDesk(); }
    if (k === 'res') { resVal = +t.value; updateReserve(); }
  });

  render();
})();
