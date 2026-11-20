// Selskabet: simulationsmotoren. Ingen DOM her, så den kan testes i Node.
(function (root) {
  'use strict';

  const START = 1982, END = 1992;

  // Rente, inflation og aktieafkast er løst baseret på Danmark i perioden.
  const MACRO = {
    1982: { rate: .20, infl: .10, eq: .10 },
    1983: { rate: .14, infl: .07, eq: .60 },
    1984: { rate: .14, infl: .06, eq: -.15 },
    1985: { rate: .11, infl: .05, eq: .35 },
    1986: { rate: .10, infl: .04, eq: -.18 },
    1987: { rate: .11, infl: .04, eq: -.15 },
    1988: { rate: .10, infl: .045, eq: .40 },
    1989: { rate: .10, infl: .05, eq: .30 },
    1990: { rate: .11, infl: .025, eq: -.15 },
    1991: { rate: .09, infl: .025, eq: .08 },
    1992: { rate: .09, infl: .02, eq: -.22 }
  };
  const PAST_INFL = { 1980: .12, 1981: .117 };

  const PATTERN = [.15, .25, .25, .20, .15];   // udbetalingsmønster for erhverv
  const CUM = [.15, .40, .65, .85, 1];
  const FIXED_SHARE = .06, MARGIN = .03, TAX = .5, SOLV = .16, FLOAT = .35;
  const P_STORM = .17, P_ORKAN = .05, STORM_KR = 1100, ORKAN_KR = 4200;
  const CAT_LOAD = P_STORM * STORM_KR + P_ORKAN * ORKAN_KR;
  const TREND_EXTRA = .015;                    // aktuarens faste tillæg til inflationen

  const LINES = {
    motor:   { name: 'Motor',   n: 40000, f: .125, s: 13500, varExp: .16, elast: 1.5, sd: .03, extra: .015, k: .5 },
    hus:     { name: 'Hus',     n: 30000, f: .06,  s: 12000, varExp: .18, elast: 1.0, sd: .06, extra: .01,  k: .5 },
    erhverv: { name: 'Erhverv', n: 2500,  f: .30,  s: 35000, varExp: .14, elast: 1.2, sd: .10, extra: .02,  k: .8 }
  };
  const ORDER = ['motor', 'hus', 'erhverv'];

  const G0 = { 1985: { motor: .03 }, 1986: { motor: .03 }, 1987: { motor: -.03 }, 1988: { motor: -.02 }, 1991: { erhverv: -.04 } };
  const FREQ = { 1987: { hus: 1.25, motor: 1.03 }, 1988: { motor: .97 }, 1991: { erhverv: 1.05 } };
  const CYC = {
    motor: { 1984: -.02, 1986: .02, 1987: .02, 1988: -.06, 1989: -.06, 1990: -.02, 1991: .03, 1992: .04 },
    hus: { 1985: -.03, 1986: -.03 },
    erhverv: { 1985: -.04, 1986: -.06, 1987: -.02, 1988: .04, 1989: .05, 1990: .03 }
  };
  const MKT_MARGIN = .04;
  const RI_SHARES = [null, .5, .25, .10];
  const RI_NAMES = ['Ingen genforsikring', 'Højt selvbehold', 'Mellem selvbehold', 'Lavt selvbehold'];

  let rand = Math.random;
  function randn() { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); }
  function ln(sd) { return Math.exp(sd * randn() - sd * sd / 2); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function last(a) { return a[a.length - 1]; }
  function sum(a) { return a.reduce((x, y) => x + y, 0); }
  function activeLines(S) { return ORDER.filter(id => S.lines[id].active).map(id => S.lines[id]); }

  // ---------- Nyheder ----------
  const NEWS = {
    1982: ['Poul Schlüter bliver statsminister til september. Obligationsrenten er 20 %, og inflationen 10 %.',
           'Fjernsynet har én kanal, og selskabets regnskab føres på en terminal med grøn skrift.',
           'Du er netop tiltrådt som direktør. Bestyrelsen ønsker "ro på og sorte tal".'],
    1983: ['Renten falder brat til 14 %, og aktiemarkedet går amok.',
           'Kim fra salg har fået personsøger og mener, den gør ham uundværlig.',
           'Genforsikringskontrakten skal fornyes. Fra i år er selvbeholdet dit valg.'],
    1984: ['Danmark spiller EM i Frankrig, og hele landet synger med.',
           'Bestyrelsen har besluttet, at selskabet går ind på erhvervsmarkedet: ansvar og arbejdsskade.',
           'Erhvervsskader betales over mange år. Fra i år skal du sætte en erstatningsreserve ved årets udgang.'],
    1985: ['Opsvinget buldrer, og der sælges biler som aldrig før.',
           'EDB-afdelingen har installeret FARVESKÆRME. Ingen ved helt hvorfor, men flot er det.',
           'Bestyrelsen giver dig lov til at lægge en del af formuen i aktier.'],
    1986: ['VM i Mexico. Hele kontoret går i rødt og hvidt.',
           'I oktober kommer kartoffelkuren: forbrugslån bliver dyre, og bilsalget ventes at bremse hårdt op næste år.'],
    1987: ['Året begynder med en isvinter. Frosne vandrør springer landet over.',
           'Bilsalget er næsten halveret efter kartoffelkuren.',
           'På børserne taler alle om, at kurserne kun kan gå én vej.'],
    1988: ['TV 2 går i luften til oktober. Kim vil købe reklamer.',
           'Forsikringstilsynet bliver en del af det nye Finanstilsyn.',
           'En ny konkurrent sælger bilforsikring over telefonen til priser, ingen forstår.'],
    1989: ['Muren falder i Berlin til november.',
           'Tyverier fra biler er eksploderet. Bilradioer forsvinder hurtigere, end de kan monteres.',
           'Priskrigen på bilforsikring fortsætter.'],
    1990: ['Kontoret har fået pc\'er med mus og vinduer. Fru Mortensen nægter at røre musen.',
           'En stribe voldsomme storme rammer Nordeuropa i januar og februar.',
           'Inflationen er faldet til 2,5 %. Det er længe siden, nogen har set så lavt et tal.'],
    1991: ['Lavkonjunktur. Ejendomspriserne er faldet i flere år, og flere finansielle virksomheder vakler.',
           'Virksomheder lukker, og antallet af arbejdsskadesager stiger.'],
    1992: ['2. juni stemmer Danmark nej til Maastricht. 26. juni vinder Danmark EM.',
           'EF vedtager det tredje skadesforsikringsdirektiv: fra 1994 er der fri konkurrence på tværs af grænserne.',
           'Det er dit sidste år i denne omgang. Bestyrelsen gør status til nytår.']
  };

  // ---------- Valg undervejs ----------
  const CHOICES = {
    1983: {
      id: 'edb', title: 'EDB-chefen banker på',
      text: 'Han vil købe en ny mainframe til 6 mio. kr. Policer og skader kan så behandles af færre hænder. "Det er fremtiden," siger han. Det siger han om alt.',
      options: [
        { id: 'a', label: 'Køb maskinen (6 mio. nu)', after: 'Maskinen fylder et helt lokale og brummer. Fra næste år falder de variable omkostninger med 2 procentpoint.' },
        { id: 'b', label: 'Vent og se', after: 'EDB-chefen går skuffet tilbage til sine hulkort.' }
      ]
    },
    1986: {
      id: 'unge', title: 'Kim har en idé',
      text: '"Unge bilister! Ingen vil have dem, så vi kan tage hele markedet. Samme pris som alle andre, så strømmer de til." Fru Mortensen rømmer sig i baggrunden.',
      options: [
        { id: 'a', label: 'Samme pris til alle unge', after: '4.000 nye unge kunder på få måneder. Kim har bestilt kage.' },
        { id: 'b', label: 'Ja, men med ungdomstillæg', after: '1.200 unge kunder siger ja til en pris, der passer til risikoen. Færre, men de betaler for sig selv.' },
        { id: 'c', label: 'Nej tak', after: 'Kim mumler noget om manglende visioner.' }
      ]
    },
    1989: {
      id: 'kemi', title: 'En mægler ringer',
      text: 'Nordisk Kemi A/S søger forsikring for hele fabrikken. Præmien er 5 mio. kr. om året. Fru Mortensen anslår, at der er cirka 5 % risiko om året for en totalskade på omkring 90 mio. kr.',
      options: [
        { id: 'a', label: 'Tegn det hele selv', after: 'Kontrakten er underskrevet. 5 mio. om året lige ned i kassen. Indtil videre.' },
        { id: 'b', label: 'Tegn den, og genforsikr 85 %', after: 'Du beholder 15 % af både præmie og risiko. Mindre fest, mere nattesøvn.' },
        { id: 'c', label: 'Afslå', after: 'Mægleren går videre til en konkurrent.' }
      ]
    },
    1991: {
      id: 'opkob', title: 'Et selskab til salg',
      text: 'Lillebælt Forsikring er i knibe og kan købes for 20 mio. kr. Med følger 6.000 bilkunder og 4.000 huskunder. Regnskaberne ser pæne ud. Næsten for pæne.',
      options: [
        { id: 'a', label: 'Køb nu for 20 mio.', after: 'Handlen er lukket. 10.000 nye kunder på en eftermiddag.' },
        { id: 'b', label: 'Lad Fru Mortensen se reserverne først', after: 'Hun finder et hul på 14 mio. i reserverne. Sælger går modvilligt ned til 6 mio., og du afsætter de 14 mio. med det samme.' },
        { id: 'c', label: 'Afslå', after: 'Lillebælt bliver købt af en anden. Du hører senere, at de fortrød.' }
      ]
    }
  };

  // ---------- Opstart ----------
  function newGame(player, company) {
    const S = {
      v: 1, player: player || 'Direktøren', company: company || 'Kattegat Forsikring',
      year: START, phase: 'news', capital: 35, idx: 1, lines: {}, cohorts: [], reserve: 0,
      riOpt: 2, riHard: 1, eq: 0, cards: [], hist: [], flags: {}, cyc: JSON.parse(JSON.stringify(CYC)),
      rewinds: 0, underRes: 0, watch: 0, fixedBase: 8, unlocked: { ri: false, res: false, inv: false },
      storms: {}, lastPct: {}, info: null, cur: null, report: null, over: null
    };
    for (const id of ORDER) {
      const c = LINES[id];
      S.lines[id] = { id, name: c.name, active: id !== 'erhverv', n: c.n, prem: 0, f: c.f, s: c.s, q: 1, varExp: c.varExp, obs: [] };
    }
    for (const id of ['motor', 'hus']) {
      const L = S.lines[id], c = LINES[id];
      const s81 = L.s / (1 + MACRO[1982].infl + c.extra), s80 = s81 / (1 + PAST_INFL[1981] + c.extra);
      [[1980, s80], [1981, s81]].forEach(([y, s]) => {
        const f = L.f * (1 + .03 * randn());
        L.obs.push({ year: y, n: L.n, freq: f, perPol: f * s * ln(.03) });
      });
    }
    let early = false;
    for (let y = 1983; y <= END; y++) {
      const r = rand();
      if (r < .05) S.storms[y] = 'orkan'; else if (r < .09) S.storms[y] = 'storm';
      if (S.storms[y] && y <= 1986) early = true;
    }
    if (!early) S.storms[1983 + Math.floor(rand() * 4)] = 'storm';
    if (!S.storms[1990]) S.storms[1990] = 'storm';
    startYear(S);
    return S;
  }

  function marketPrice(S, L, noise) {
    const c = LINES[L.id], m = MACRO[S.year];
    const cat = L.id === 'hus' ? CAT_LOAD * S.idx * (1 + .22 * S.riHard) : 0;
    const margin = MKT_MARGIN - c.k * (m.rate - .10) + (S.cyc[L.id][S.year] || 0) + (noise ? .012 * randn() : 0);
    return (L.f * L.s + cat) / (1 - c.varExp - FIXED_SHARE - margin);
  }

  function inflAt(S, y) { return y === S.year ? S.info.inflForecast : (MACRO[y] ? MACRO[y].infl : PAST_INFL[y]); }
  function trendTo(S, from) { let t = 1; for (let u = from + 1; u <= S.year; u++) t *= 1 + inflAt(S, u) + TREND_EXTRA; return t; }

  // Fru Mortensens tekniske pris: bygger kun på det, selskabet selv har observeret.
  function techEstimate(S, L) {
    let pts = [];
    if (L.id === 'erhverv') {
      pts = S.cohorts.filter(c => c.ay < S.year).map(c => ({ year: c.ay, perPol: (last(c.paid) + (c.closed ? 0 : c.booked)) * 1e6 / c.n, freq: c.freq }));
      if (!pts.length) pts = [{ year: S.year - 1, perPol: S.flags.erhvervSeed, freq: LINES.erhverv.f }];
    } else pts = L.obs;
    pts = pts.slice(-3);
    let w = 0, risk = 0, freq = 0;
    pts.forEach((p, i) => { const wi = i + 1 + (3 - pts.length); w += wi; risk += wi * p.perPol * trendTo(S, p.year); freq += wi * p.freq; });
    risk /= w; freq /= w;
    let storm = 0;
    if (L.id === 'hus') {
      const q = S.info.ri && S.info.ri[S.riOpt];
      storm = CAT_LOAD * S.idx + (q ? (q.price - q.avg) * 1e6 / L.n : 0);
    }
    const load = 1 - L.varExp - FIXED_SHARE - MARGIN;
    return { freq, sev: risk / freq, risk, storm, load, tech: (risk + storm) / load };
  }

  function riQuotes(S) {
    const H = S.lines.hus, vol = H.n * H.prem / 1e6, N = 3000, sims = [];
    for (let i = 0; i < N; i++) {
      const u = rand();
      sims.push(u < P_ORKAN ? H.n * ORKAN_KR * S.idx * ln(.3) / 1e6 : u < P_ORKAN + P_STORM ? H.n * STORM_KR * S.idx * ln(.45) / 1e6 : 0);
    }
    return RI_SHARES.map((sh, i) => {
      if (sh === null) return { id: i, name: RI_NAMES[i], ret: null, price: 0, avg: 0 };
      const ret = Math.max(1, Math.round(vol * sh));
      const avg = sum(sims.map(g => Math.max(0, g - ret))) / N;
      return { id: i, name: RI_NAMES[i], ret, price: avg * 1.35 * S.riHard, avg };
    });
  }

  function unlock(S, id) { if (!S.cards.includes(id)) { S.cards.push(id); S.newCards.push(id); } }

  function startYear(S) {
    S.snap = null;
    S.snap = JSON.stringify(S);
    const y = S.year, m = MACRO[y];
    S.newCards = [];
    if (y > START) {
      S.idx *= 1 + m.infl;
      for (const id of ORDER) S.lines[id].s *= 1 + m.infl + LINES[id].extra;
      S.riHard = 1 + (S.riHard - 1) * .5;
    }
    const news = NEWS[y].slice(), unlocks = [];
    if (y === 1983) { S.unlocked.ri = true; unlocks.push('Genforsikring'); unlock(S, 'genforsikring'); }
    if (y === 1984) {
      S.lines.erhverv.active = true; S.fixedBase += 3; S.unlocked.res = true;
      S.flags.erhvervSeed = S.lines.erhverv.f * S.lines.erhverv.s * (1 + .06 * randn()) / (1 + m.infl + TREND_EXTRA);
      unlocks.push('Erhvervsforsikring', 'Erstatningsreserver'); unlock(S, 'ibnr');
    }
    if (y === 1985) { S.unlocked.inv = true; unlocks.push('Investeringer'); unlock(S, 'aktivrisiko'); }
    if (y === 1989) S.lines.motor.f *= 1.06;
    if (y === 1982) { unlock(S, 'risikopraemie'); unlock(S, 'cashflow'); }
    if (y === 1988) unlock(S, 'cyklus');
    if (S.storms[y - 1]) news.push('Efter sidste års storm er genforsikring blevet dyrere, og konkurrenterne hæver priserne på husforsikring.');

    const info = S.info = { inflForecast: Math.max(.005, m.infl + .008 * randn()), rate: m.rate, news, unlocks, lines: {}, choice: CHOICES[y] ? CHOICES[y].id : null, choiceDone: null };
    for (const L of activeLines(S)) {
      const pm = marketPrice(S, L, y > START);
      if (!L.prem) L.prem = L.id === 'erhverv' ? Math.round(pm / 100) * 100 : Math.round(pm / 10) * 10;
      if (L.id === 'hus') info.ri = riQuotes(S);
      const t = techEstimate(S, L);
      info.lines[L.id] = { pm, gapEst: L.prem / pm - 1 + (y > START ? .012 * randn() : 0), tech: t };
    }
    S.phase = 'news';
    return S;
  }

  function choose(S, optId) {
    const y = S.year, ch = CHOICES[y]; if (!ch || S.info.choiceDone) return;
    const opt = ch.options.find(o => o.id === optId); S.info.choiceDone = optId; S.info.choiceAfter = opt.after;
    S.flags[ch.id] = optId;
    if (ch.id === 'edb' && optId === 'a') { S.flags.edbCost = 6; S.flags.edbFrom = 1984; }
    if (ch.id === 'unge') {
      const M = S.lines.motor;
      if (optId === 'a') { M.q = (M.n * M.q + 4000 * 2.2) / (M.n + 4000); M.n += 4000; unlock(S, 'antiselektion'); }
      if (optId === 'b') { M.n += 1200; unlock(S, 'antiselektion'); }
    }
    if (ch.id === 'kemi') { unlock(S, 'storrisiko'); if (optId !== 'c') { S.flags.kemiShare = optId === 'a' ? 1 : .15; S.flags.kemiIdx = S.idx; } }
    if (ch.id === 'opkob') {
      unlock(S, 'duediligence');
      if (optId !== 'c') { S.lines.motor.n += 6000; S.lines.hus.n += 4000; S.info.ri = riQuotes(S); }
      if (optId === 'a') { S.flags.buyCost = 20; S.flags.hole = 14; }
      if (optId === 'b') { S.flags.buyCost = 20.5; }
    }
  }

  // ---------- Året kører ----------
  function runYear(S, dec) {
    const y = S.year, m = MACRO[y];
    const cur = S.cur = { prem: {}, claims: {}, n: {}, growth: {}, lr: {}, events: [], closed: [] };
    if (S.unlocked.ri) S.riOpt = dec.ri;
    if (S.unlocked.inv) S.eq = dec.eq || 0;
    if (S.flags.edbFrom === y) { for (const id of ORDER) S.lines[id].varExp -= .02; }

    for (const L of activeLines(S)) {
      const c = LINES[L.id], pct = (dec.pct && dec.pct[L.id]) || 0;
      S.lastPct[L.id] = pct;
      L.prem = Math.round(L.prem * (1 + pct));
      const g = clamp(.01 + ((G0[y] || {})[L.id] || 0) - c.elast * (L.prem / S.info.lines[L.id].pm - 1), -.30, .30);
      L.q = 1 + (L.q - 1) * .6 + .25 * Math.max(0, g - .03) + .10 * Math.max(0, -g - .03);
      L.n = Math.round(L.n * (1 + g));
      cur.growth[L.id] = g; cur.n[L.id] = L.n; cur.prem[L.id] = L.n * L.prem / 1e6;
      const lam = L.n * L.f * L.q * ((FREQ[y] || {})[L.id] || 1);
      const count = Math.max(0, Math.round(lam + Math.sqrt(lam) * randn()));
      const agg = count * L.s * ln(c.sd) / 1e6;
      if (L.id !== 'erhverv') {
        cur.claims[L.id] = agg;
        L.obs.push({ year: y, n: L.n, freq: count / L.n, perPol: agg * 1e6 / L.n });
      } else {
        S.cohorts.push({ ay: y, n: L.n, freq: count / L.n, ult: agg * (y === 1987 ? 1.08 : 1), exp: L.n * S.info.lines.erhverv.tech.risk / 1e6, paid: [], booked: 0, first: null, closed: false });
      }
    }

    // Storm
    const H = S.lines.hus, type = S.storms[y], q = S.info.ri[S.riOpt];
    cur.storm = type || null; cur.stormGross = 0; cur.riRec = 0; cur.riPrem = q.price; cur.riRet = q.ret;
    if (type) {
      cur.stormGross = H.n * (type === 'orkan' ? ORKAN_KR * ln(.3) : STORM_KR * ln(.45)) * S.idx / 1e6;
      cur.riRec = q.ret === null ? 0 : Math.max(0, cur.stormGross - q.ret);
      S.riHard = Math.max(S.riHard, type === 'orkan' ? 2.2 : 1.6);
      S.cyc.hus[y + 1] = (S.cyc.hus[y + 1] || 0) + .05; S.cyc.hus[y + 2] = (S.cyc.hus[y + 2] || 0) + .03;
    }
    cur.claims.storm = cur.stormGross - cur.riRec;

    // Erhverv: udbetalinger på alle åbne årgange
    cur.paidPrior = 0; cur.paidNew = 0;
    if (y === 1987) { S.lines.erhverv.s *= 1.10; cur.events.push('retspraksis'); }
    for (const c of S.cohorts) {
      if (c.closed) continue;
      const d = y - c.ay, paid = d ? last(c.paid) : 0;
      if (d > 0) {
        const eps = .03 * randn() + (y === 1987 ? .15 : 0) - (y >= 1990 ? .025 : 0);
        c.ult = paid + (c.ult - paid) * (1 + eps);
      }
      const pay = d === 4 ? c.ult - paid : Math.min((c.ult - paid) * .92, c.ult * PATTERN[d] * ln(.08));
      c.paid.push(paid + pay);
      if (d === 0) cur.paidNew += pay; else cur.paidPrior += pay;
      if (d === 4) { c.closed = true; cur.closed.push({ ay: c.ay, final: c.ult, first: c.first }); }
    }

    // Storkunden og det opkøbte selskab
    cur.prem.kemi = 0; cur.claims.kemi = 0; cur.claims.hole = 0;
    if (S.flags.kemiShare) {
      const k = S.idx / S.flags.kemiIdx;
      cur.prem.kemi = 5 * k * S.flags.kemiShare;
      if (rand() < .05) { cur.claims.kemi = 90 * k * S.flags.kemiShare; cur.kemiGross = 90 * k; S.flags.kemiShare = 0; S.flags.kemiHit = y; }
    }
    if (S.flags.hole && y === 1992) { cur.claims.hole = S.flags.hole; S.flags.hole = 0; }
    if (S.flags.opkob === 'b' && y === 1991) cur.claims.hole = 14;

    const premTotal = sum(Object.values(cur.prem));
    cur.premTotal = premTotal;
    cur.invRate = (1 - S.eq) * m.rate + S.eq * (m.eq + .06 * randn());
    cur.eqRet = S.eq ? (cur.invRate - (1 - S.eq) * m.rate) / S.eq : null;
    cur.assets = Math.max(0, S.capital) + S.reserve + FLOAT * premTotal;
    cur.inv = cur.assets * cur.invRate;

    if (S.lines.erhverv.active) { S.phase = 'reserve'; return S; }
    return closeYear(S, 0);
  }

  // ---------- Reserver ----------
  function reserveInfo(S) {
    const y = S.year, all = S.cohorts, open = all.filter(c => !c.closed);
    const factors = [];
    for (let j = 0; j < 4; j++) {
      let a = 0, b = 0, k = 0;
      for (const c of all) if (c.paid.length > j + 1) { a += c.paid[j + 1]; b += c.paid[j]; k++; }
      factors.push(k ? { f: a / b, own: true, k } : { f: CUM[j + 1] / CUM[j], own: false, k: 0 });
    }
    const rows = open.map(c => {
      const d = c.paid.length - 1, paid = last(c.paid), proj = c.paid.slice();
      for (let j = d; j < 4; j++) proj.push(last(proj) * factors[j].f);
      const cdf = last(proj) / paid;
      return { ay: c.ay, cum: c.paid.slice(), proj, paid, ultCL: last(proj), ultELR: Math.max(paid, c.exp), ultBF: paid + c.exp * (1 - 1 / cdf) };
    });
    const tot = k => sum(rows.map(r => Math.max(0, r[k] - r.paid)));
    const methods = { elr: tot('ultELR'), cl: all.length >= 2 ? tot('ultCL') : null, bf: y >= 1987 ? tot('ultBF') : null };
    const rec = y >= 1987 ? 'bf' : y >= 1985 ? 'cl' : 'elr';
    const vals = Object.values(methods).filter(v => v !== null);
    return { rows, factors, methods, rec, recValue: methods[rec], min: Math.floor(Math.min(...vals) * .5), max: Math.ceil(Math.max(...vals) * 1.6), prev: S.reserve };
  }

  function trueNeed(S) { return sum(S.cohorts.filter(c => !c.closed).map(c => c.ult - last(c.paid))); }

  // ---------- Årsafslutning ----------
  function closeYear(S, reserveBooked) {
    const y = S.year, cur = S.cur, R = { year: y, remarks: [], forced: 0 };
    let res = 0, runoff = 0, need = 0;
    if (S.lines.erhverv.active) {
      const ri = reserveInfo(S), key = { elr: 'ultELR', cl: 'ultCL', bf: 'ultBF' }[ri.rec];
      need = trueNeed(S); res = Math.max(0, reserveBooked);
      if (need > 5 && res < .8 * need) S.underRes++; else S.underRes = 0;
      if (S.underRes >= 2) { R.forced = need * 1.02 - res; res = need * 1.02; S.underRes = 0; }
      const needs = ri.rows.map(r => Math.max(0, r[key] - r.paid)), tn = sum(needs) || 1;
      let priorRes = 0;
      ri.rows.forEach((r, i) => {
        const c = S.cohorts.find(c => c.ay === r.ay); c.booked = res * needs[i] / tn;
        if (c.first === null) c.first = r.paid + c.booked;
        if (c.ay < y) priorRes += c.booked;
      });
      runoff = y > 1984 ? S.reserve - cur.paidPrior - priorRes : 0;
      cur.claims.erhverv = cur.paidNew + cur.paidPrior + (res - S.reserve);
    }
    const fixed = S.fixedBase * S.idx;
    const varExp = sum(activeLines(S).map(L => L.varExp * cur.prem[L.id])) + .10 * cur.prem.kemi;
    const oneOff = (S.flags.edbCost || 0) + (S.flags.buyCost || 0); S.flags.edbCost = 0; S.flags.buyCost = 0;
    const exp = fixed + varExp + oneOff;
    const claims = sum(Object.values(cur.claims));
    const uw = cur.premTotal - claims - cur.riPrem - exp;
    const pre = uw + cur.inv, tax = Math.max(0, pre) * TAX, net = pre - tax;
    S.capital += net; S.reserve = res;
    const krav = SOLV * cur.premTotal;
    Object.assign(R, {
      prem: cur.prem, premTotal: cur.premTotal, claims: cur.claims, claimsTotal: claims, storm: cur.storm, stormGross: cur.stormGross,
      riRec: cur.riRec, riPrem: cur.riPrem, riRet: cur.riRet, exp, oneOff, uw, inv: cur.inv, invRate: cur.invRate, eqRet: cur.eqRet, eq: S.eq,
      pre, tax, net, capital: S.capital, krav, solv: S.capital / krav, n: cur.n, growth: cur.growth, runoff, reserve: res, need,
      cr: (claims + cur.riPrem + exp - oneOff) / cur.premTotal, closed: cur.closed, kemiHit: cur.claims.kemi > 0, lr: {}, pct: Object.assign({}, S.lastPct)
    });
    R.lr.motor = cur.claims.motor / cur.prem.motor;
    R.lr.hus = (cur.claims.hus + cur.claims.storm + cur.riPrem) / cur.prem.hus;
    if (S.lines.erhverv.active) R.lr.erhverv = cur.claims.erhverv / cur.prem.erhverv;
    R.gaps = {}; R.techGap = {};
    for (const L of activeLines(S)) { R.gaps[L.id] = L.prem / S.info.lines[L.id].pm - 1; R.techGap[L.id] = L.prem / S.info.lines[L.id].tech.tech - 1; }

    S.newCards = [];
    remarks(S, R);
    S.hist.push(R); S.report = R;

    if (S.capital < 0) S.over = { reason: 'konkurs' };
    else if (S.capital < krav) { S.watch++; if (S.watch >= 2) S.over = { reason: 'tilsyn' }; }
    else S.watch = 0;
    R.watch = S.watch; R.newCards = S.newCards.slice();
    S.phase = 'report';
    return S;
  }

  function fmt(x, d) { return x.toLocaleString('da-DK', { minimumFractionDigits: d === undefined ? 1 : d, maximumFractionDigits: d === undefined ? 1 : d }); }
  function pc(x) { return fmt(x * 100, 0) + ' %'; }

  function remarks(S, R) {
    const y = R.year, out = [], M = 'Fru Mortensen', K = 'Kim fra salg', B = 'Formand Holm';
    const say = (p, who, text) => out.push({ p, who, text });
    unlock(S, 'combined'); unlock(S, 'solvens');
    if (y === 1982) { unlock(S, 'storetal'); say(5, M, 'Læg mærke til, at skaderne aldrig rammer præcis det forventede. Med 40.000 biler er udsvingene små. Med få kunder bliver de store.'); }
    if (R.storm) {
      unlock(S, 'katastrofe');
      const t = R.storm === 'orkan' ? 'Orkanen' : 'Stormen';
      if (R.riRet === null) say(10, M, t + ' kostede ' + fmt(R.stormGross) + ' mio. kr., og vi stod med hele regningen selv. Det er den slags år, genforsikring er opfundet til.');
      else if (R.riRec > 0) say(10, M, t + ' kostede ' + fmt(R.stormGross) + ' mio. kr. Vi betalte selvbeholdet på ' + fmt(R.riRet, 0) + ' mio., og genforsikringen tog de sidste ' + fmt(R.riRec) + ' mio.');
      else say(10, M, t + ' kostede ' + fmt(R.stormGross) + ' mio. kr. Det lå under selvbeholdet, så vi betalte selv det hele.');
    } else if (S.unlocked.ri && R.riRet === null && y < END) say(4, M, 'Vi slap igennem året uden genforsikring. Det går godt, lige indtil det ikke gør.');
    if (R.kemiHit) say(10, M, 'Nordisk Kemi er brændt ned til grunden. Vores andel af regningen er ' + fmt(R.claims.kemi) + ' mio. kr.');
    if (S.cur.events.includes('retspraksis')) { unlock(S, 'skadesinflation'); say(9, M, 'Domstolene har hævet erstatningerne ved personskade markant. Det rammer også de gamle sager, vi ikke har betalt endnu. Chain ladder ser kun bagud og har ikke opdaget det.'); }
    if (R.forced > 0) say(10, 'Finanstilsynet', 'Vi har gennemgået Deres erstatningsreserver og finder dem utilstrækkelige. De bedes straks styrke dem med ' + fmt(R.forced) + ' mio. kr.');
    if (S.flags.opkob === 'a' && y === 1992) say(10, M, 'De gamle sager fra Lillebælt er dukket op. Reserverne, vi købte, manglede 14 mio. kr. Det havde jeg gerne kigget på inden handlen.');
    for (const c of R.closed) {
      if (c.first) {
        const diff = c.final - c.first; unlock(S, 'afloeb');
        say(7, M, 'Årgang ' + c.ay + ' er nu færdigbetalt. Den endte på ' + fmt(c.final) + ' mio. kr. Vores første bud lød på ' + fmt(c.first) + ' mio., altså ' + (Math.abs(diff) < .05 * c.final ? 'meget tæt på.' : diff > 0 ? fmt(diff) + ' mio. for lidt.' : fmt(-diff) + ' mio. for meget.'));
      }
    }
    if (Math.abs(R.runoff) > 1) { unlock(S, 'afloeb'); say(6, M, R.runoff > 0 ? 'De gamle årgange udviklede sig bedre end reserveret. Det gav en afløbsgevinst på ' + fmt(R.runoff) + ' mio. kr.' : 'De gamle årgange blev dyrere end reserveret. Det gav et afløbstab på ' + fmt(-R.runoff) + ' mio. kr., som belaster i år.'); }
    for (const id of ORDER) {
      const g = R.growth[id]; if (g === undefined) continue;
      const nm = LINES[id].name.toLowerCase();
      if (g > .10) { unlock(S, 'elasticitet'); unlock(S, 'antiselektion'); say(6, M, 'Vi voksede ' + pc(g) + ' på ' + nm + '. Nye kunder, der kommer for prisens skyld, er sjældent de bedste. Hold øje med frekvensen de næste år.'); }
      else if (g < -.08) { unlock(S, 'elasticitet'); unlock(S, 'fasteomk'); say(6, K, 'Vi mistede ' + pc(-g) + ' af kunderne på ' + nm + '. Telefonerne står stille, og huslejen er den samme.'); }
      if (R.gaps[id] < -.03 && R.techGap[id] < -.05 && R.lr[id] > .8) say(5, M, 'På ' + nm + ' ligger vi under min tekniske pris. Vi køber kunder for penge, vi ikke har tjent endnu.');
    }
    if (y === 1982 || (R.cr > 1 && R.net > 0 && !S.flags.cfSaid)) { S.flags.cfSaid = 1; say(6, B, 'Forsikringsdriften gav ' + (R.uw >= 0 ? 'et lille plus' : 'underskud') + ', men renterne reddede året med ' + fmt(R.inv) + ' mio. kr. Det er nemt at se godt ud, når renten er ' + pc(MACRO[y].rate) + '.'); }
    if (y === 1984) { unlock(S, 'elr'); say(8, M, 'Af erhvervsskaderne fra i år har vi kun betalt en lille del. Resten kommer over de næste fire år. Reserven er vores bedste bud på den regning.'); }
    if (y === 1985) { unlock(S, 'chainladder'); unlock(S, 'kredibilitet'); say(7, M, 'Nu har vi to årgange og kan bruge chain ladder. Men pas på: med så få erhvervskunder kan ét enkelt år narre os.'); }
    if (y === 1987) { unlock(S, 'bf'); }
    if (R.eq > 0 && R.eqRet !== null) {
      if (R.eqRet < -.05) say(7, B, 'Aktierne gav ' + pc(R.eqRet) + ' i år. Bestyrelsen spørger, hvis idé det var.');
      else if (R.eqRet > .2) say(5, K, 'Aktierne gav ' + pc(R.eqRet) + '! Vi burde sælge forsikringerne og blive børsmæglere.');
    }
    if (y === 1987 && R.eq === 0) say(5, B, 'Sort mandag den 19. oktober. Vi ejede ingen aktier. Jeg vil gerne påstå, at det var planlagt.');
    if (S.flags.unge === 'a' && y === 1987) say(8, M, 'De unge bilister fra Kims kampagne anmelder mere end dobbelt så mange skader som resten. De betaler det samme som en bibliotekar på 50.');
    if (R.solv < 1) say(10, 'Finanstilsynet', 'Deres egenkapital er under solvenskravet. Selskabet er sat under skærpet tilsyn. Er kapitalen ikke genoprettet om et år, overtager vi styringen.');
    else if (R.solv < 1.3) say(8, B, 'Solvensen er nede på ' + pc(R.solv) + ' af kravet. Én dårlig vinter mere, og vi får besøg af tilsynet.');
    if (R.net > 0 && R.cr < .97 && !R.storm) say(3, K, 'Rekordår! Skal vi ikke sætte prisen lidt ned og hente nogle flere kunder?');
    if (R.net < 0 && !R.storm && !R.kemiHit) say(4, B, 'Rødt tal på bundlinjen uden en eneste storm at skyde skylden på. Jeg ser frem til en forklaring.');
    if (y === 1988) say(5, K, 'Telefonselskabet tager vores bilkunder med priser, der ligger langt under vores. Vi er nødt til at følge med!');
    out.sort((a, b) => b.p - a.p);
    R.remarks = out.slice(0, 4).map(o => ({ who: o.who, text: o.text }));
  }

  function preview(S, res) { const T = JSON.parse(JSON.stringify(S)); closeYear(T, res); return T.report; }

  function nextYear(S) {
    if (S.over) { S.phase = 'over'; return S; }
    if (S.year >= END) { S.phase = 'end'; S.final = score(S); return S; }
    S.year++;
    return startYear(S);
  }

  function rewind(S) {
    const T = JSON.parse(S.snap);
    T.rewinds = (S.rewinds || 0) + 1; T.cards = S.cards.slice();
    T.over = null; T.watch = Math.min(T.watch, 0);
    return startYear(T);
  }

  function score(S) {
    const h = S.hist, cap = S.capital / 35;
    const n0 = 72500, n = sum(Object.values(last(h).n)), cust = n / n0 - 1;
    const cr = sum(h.map(r => r.cr)) / h.length;
    const need = trueNeed(S), adeq = need > 0 ? S.reserve / need : 1;
    const st = (v, a, b, c) => v >= a ? 3 : v >= b ? 2 : v >= c ? 1 : 0;
    const stars = {
      kapital: st(cap, 6, 4, 2),
      kunder: st(cust, .35, .10, -.15),
      drift: st(-cr, -.97, -1.0, -1.04),
      reserver: (adeq >= .95 && adeq <= 1.2) ? 3 : (adeq >= .85 && adeq <= 1.35) ? 2 : 1
    };
    const total = sum(Object.values(stars));
    const title = total >= 11 ? 'Branchens grand old lady' : total >= 10 ? 'Årets forsikringsdirektør 1992' : total >= 8 ? 'Solid hånd på rattet' : total >= 6 ? 'Kom helskindet gennem 80\'erne' : 'Overlevede. Det gjorde ikke alle.';
    return { stars, total, title, cap, cust, cr, adeq, need, n, storms: Object.values(S.storms).length };
  }

  const API = { START, END, MACRO, LINES, ORDER, CHOICES, PATTERN, newGame, choose, runYear, reserveInfo, closeYear, preview, nextYear, rewind, score, trueNeed, fmt,
    eraOf: y => y <= 1984 ? 1 : y <= 1989 ? 2 : 3, setRandom: f => { rand = f; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
