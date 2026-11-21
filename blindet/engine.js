// Blindet: simulationsmotoren. Ingen DOM her, så den kan testes i Node.
(function (root) {
  'use strict';

  const MONTHS = 12, TARGET = 600, LPFV_TARGET = 10;
  const KIT_KR = 2500, SHIP_KR = 4000;
  const B1_EXP = 225;            // batch 1 udløber dag 225, midt i måned 8
  const B2_FROM = 5;             // batch 2 kan sendes fra måned 5
  const EXTEND = 180;            // holdbarhedsforlængelse i dage

  const COUNTRIES = [
    { id: 'DK', name: 'Danmark',  region: 'EU',    n: 4, lead: 0, rate: 2.3, base: 101 },
    { id: 'DE', name: 'Tyskland', region: 'EU',    n: 6, lead: 0, rate: 2.4, base: 201 },
    { id: 'ES', name: 'Spanien',  region: 'EU',    n: 5, lead: 0, rate: 2.5, base: 301 },
    { id: 'US', name: 'USA',      region: 'NA',    n: 8, lead: 0, rate: 2.7, base: 401 },
    { id: 'BR', name: 'Brasilien', region: 'LATAM', n: 4, lead: 1, rate: 2.4, base: 501 },
    { id: 'JP', name: 'Japan',    region: 'ASIA',  n: 3, lead: 1, rate: 1.9, base: 601 }
  ];
  const ACT_MONTH = [1, 2, 1, 3, 2, 1, 2, 3, 1, 2];   // aktiveringsmåned efter sitets plads
  const VARIANTS = ['S1A', 'S1P', 'S2A', 'S2P', 'S3L', 'S3H', 'S3P'];
  const VLABEL = { S1A: 'Trin 1 · aktiv', S1P: 'Trin 1 · placebo', S2A: 'Trin 2 · aktiv', S2P: 'Trin 2 · placebo', S3L: 'Trin 3 · 1,2 mg', S3H: 'Trin 3 · 2,4 mg', S3P: 'Trin 3 · placebo' };
  const STEP_OF = { S1A: 1, S1P: 1, S2A: 2, S2P: 2, S3L: 3, S3H: 3, S3P: 3 };
  const MMIN = [null, .5, .9, 1.4], MMAX = [null, 1.1, 1.6, 2.3];   // min/max i måneders planlagt forbrug
  const RATIO3 = { L: .4, H: .4, P: .2 }, RATIO2 = { L: 2 / 3, H: 0, P: 1 / 3 };

  const DEFECTS = {
    D1: { t: 'Nødafblindingsmailen viser behandlingsarmen', crit: true, p: { happy: .1, risk: .85, full: .95 } },
    D2: { t: 'Do-not-dispense regnes i måneder, ikke dage', p: { happy: .15, risk: .6, full: .9 } },
    D3: { t: 'Erstatningskit vælger forrige titreringstrin', p: { happy: .1, risk: .7, full: .9 } },
    D4: { t: 'T2D-stratum er byttet om (ja/nej) i randomiseringen', p: { happy: .3, risk: .8, full: .95 }, need: c => c.factors.t2d },
    D5: { t: 'Lagerprognosen glemmer trin 3', p: { happy: .2, risk: .75, full: .9 }, need: c => c.resup === 'pred' }
  };
  const UAT = {
    happy: { name: 'Happy path', days: 3, scripts: 24, m1: 1 },
    risk: { name: 'Risikobaseret', days: 8, scripts: 71, m1: .6 },
    full: { name: 'Fuld UAT', days: 15, scripts: 148, m1: .2 }
  };

  let rand = Math.random;
  function pois(l) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= rand(); } while (p > L); return k - 1; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function fmt(x, d) { return Number(x).toLocaleString('da-DK', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }

  // ---------- Opstart ----------
  function defaultCfg() {
    return { titr: null, method: null, bs: '10', factors: { region: false, bmi: false, t2d: false, site: false }, kitlist: null,
      resup: null, buf: 2, dnsd: null, over: null, uat: null };
  }

  function newGame(player) {
    const sites = [];
    COUNTRIES.forEach(c => { for (let i = 0; i < c.n; i++) sites.push({ id: c.base + i, c: c.id, act: ACT_MONTH[(sites.length + i * 3) % ACT_MONTH.length], stock: {}, pipe: [], backlog: 0, nrand: 0 }); });
    sites.forEach(s => VARIANTS.forEach(v => { s.stock[v] = [0, 0]; }));
    sites[0].act = 1;
    return {
      v: 1, player: player || 'RTSM-lead', month: 0, phase: 'intro', step: 0, cfg: defaultCfg(), defects: {}, sites,
      central: {}, patients: [], queues: {}, cards: [], newCards: [], log: [], pen: [], notes: [], hist: [],
      st: { rand: 0, blocked: 0, missed: 0, visits: 0, expDisp: 0, waste: 0, ships: 0, extraKr: 0, produced: 0, dropouts: 0 },
      mods: { hDrop: 0, b1Exp: B1_EXP, extra: [], pause: {}, usBoost: 0, usCap: false, jpBlock: null, quar: 0, titrFix: false, site0Slow: false },
      decided: {}, after: {}, lpfv: 0, rewinds: 0, snap: null, end: null
    };
  }

  function unlock(S, id) { if (!S.cards.includes(id)) { S.cards.push(id); S.newCards.push(id); } }
  function log(S, who, txt, sev) { S.log.push({ m: S.month, who, txt, sev: sev || 'info' }); }
  function penal(S, pts, why, breach) { S.pen.push({ m: S.month, pts, why, breach: !!breach }); }

  // Hvad kræver protokollen, og hvad er forkert i specifikationen? Bruges af "spec-linteren" i opsætningen.
  function lint(cfg) {
    const out = [], f = cfg.factors;
    const nStrata = stratCount(cfg);
    if (cfg.titr === 'open') out.push({ sev: 'bad', t: 'Fra måned 3 kan sitet se, hvem der står stille på trin 2. Det afslører lavdosis.' });
    if (cfg.titr === 'dd') out.push({ sev: 'warn', t: 'Double-dummy fordobler antallet af penne pr. besøg.' });
    if (cfg.method && cfg.method !== 'simple') {
      if (!f.bmi) out.push({ sev: 'bad', t: 'Protokollen kræver stratificering efter baseline-BMI. Den mangler.' });
      if (!f.t2d) out.push({ sev: 'bad', t: 'Protokollen kræver stratificering efter type 2-diabetes. Den mangler.' });
    }
    if (cfg.method === 'simple') out.push({ sev: 'bad', t: 'Simpel randomisering bruger ikke protokollens stratifikationsfaktorer, og 2:2:1 kan skride.' });
    if (cfg.method === 'block') {
      const per = TARGET / nStrata, bs = cfg.bs === 'mix' ? 7.5 : +cfg.bs;
      if (per < bs * 3) out.push({ sev: 'warn', t: `${nStrata} strata giver ca. ${fmt(per)} patienter pr. stratum. Mange blokke ender halvfyldte.` });
      if (cfg.bs === '5') out.push({ sev: f.site ? 'bad' : 'warn', t: f.site ? 'Blokke på 5 pr. site: efter fire randomiseringer kan sitet gætte den femte.' : 'Faste blokke på 5 er lette at gætte for et site, der tæller efter.' });
    }
    if (cfg.method === 'min' && f.site) out.push({ sev: 'ok', t: 'Site som minimeringsfaktor er almindeligt og ufarligt.' });
    if (cfg.kitlist === 'seq') out.push({ sev: 'bad', t: 'Kit-numre i fortløbende serier pr. arm afslører behandlingen for alle, der kan tælle.' });
    if (cfg.dnsd !== null && cfg.dnsd < 35) out.push({ sev: 'warn', t: `Do-not-dispense på ${cfg.dnsd} dage dækker ikke 28 dages forbrug plus 7 dages besøgsvindue.` });
    if (cfg.over !== null && cfg.over <= 1.2 && cfg.resup === 'minmax' && cfg.buf >= 2) out.push({ sev: 'warn', t: 'Med min/max-lager ligger meget medicin ude på sites. 20 % overproduktion bliver stramt.' });
    if (!out.some(o => o.sev !== 'ok') && cfg.uat) out.push({ sev: 'ok', t: 'Ingen bemærkninger til specifikationen.' });
    return out;
  }

  function stratCount(cfg) {
    const f = cfg.factors; let n = 1;
    if (cfg.method !== 'block') return 1;
    if (f.region) n *= 4; if (f.bmi) n *= 2; if (f.t2d) n *= 2; if (f.site) n *= 30;
    return n;
  }

  // Specifikationen i almindeligt sprog, sådan som platformen bygger ud fra den.
  function specLines(cfg) {
    const f = cfg.factors, L = [];
    const fac = [f.region && 'region', f.bmi && 'baseline-BMI (<35 / ≥35)', f.t2d && 'type 2-diabetes (ja/nej)', f.site && 'site'].filter(Boolean);
    const facTxt = fac.length ? fac.join(', ') : 'ingen faktorer';
    if (cfg.method === 'simple') L.push('Randomisér 2:2:1 til NH-2290 1,2 mg, NH-2290 2,4 mg og placebo med simpel randomisering.');
    if (cfg.method === 'block') L.push(`Randomisér 2:2:1 til NH-2290 1,2 mg, NH-2290 2,4 mg og placebo i permuterede blokke på ${cfg.bs === 'mix' ? '5 og 10 i tilfældig rækkefølge' : cfg.bs}, stratificeret efter ${facTxt}.`);
    if (cfg.method === 'min') L.push(`Randomisér 2:2:1 med minimering efter ${facTxt}. Vælg armen med mindst ubalance med 80 % sandsynlighed, ellers tilfældigt efter forholdet.`);
    if (cfg.method) L.push('Tillad kun randomisering, når sitet har kits på lager til alle arme.');
    if (cfg.titr === 'open') L.push('Udlevér pen mærket 0,6 mg i måned 1 og 1,2 mg i måned 2. Højdosis får 2,4 mg fra måned 3. Lavdosis fortsætter på 1,2 mg.');
    if (cfg.titr === 'blind') L.push('Alle patienter følger trin 1, 2 og 3. Lavdosis-patienter får trin 3-penne med 1,2 mg. Placebo matcher hvert trin.');
    if (cfg.titr === 'dd') L.push('Udlevér to penne pr. besøg: én med aktivt stof eller placebo og én matchende placebo, så alle stikker det samme.');
    if (cfg.kitlist === 'seq') L.push('Kit-numre tildeles i fortløbende serier: 1001 til 2400 aktiv, 2401 til 3000 placebo.');
    if (cfg.kitlist === 'rand') L.push('Kit-numre blandes på tværs af kit-typer, så nummeret ikke siger noget om indholdet.');
    if (cfg.resup === 'minmax') L.push(`Genforsyn hvert site, når en kit-type falder under ${fmt(MMIN[cfg.buf], 1)} måneds planlagt forbrug, op til ${fmt(MMAX[cfg.buf], 1)} måneds forbrug. Niveauerne lægges fast ved go-live. Lande med lang leveringstid får tillæg.`);
    if (cfg.resup === 'pred') L.push(`Genforsyn efter prognose over planlagte besøg og forventet rekruttering, plus et sikkerhedslager på ${cfg.buf - 1} pr. kit-type.`);
    if (cfg.dnsd !== null) L.push(`Udlevér ikke kits med mindre end ${cfg.dnsd} dage til udløb. Send ikke kits, der rammer grænsen inden ankomst.`);
    if (cfg.over !== null) L.push(`Producér ${fmt((cfg.over - 1) * 100)} % over den planlagte efterspørgsel.`);
    L.push('Investigatoren kan nødafblinde egne patienter. Studieteamet får besked om afblindingen, ikke om armen.');
    return L;
  }

  // ---------- Forventet forløb, til produktionsplanen ----------
  function planDemand(S) {
    const cfg = S.cfg, d = {}; VARIANTS.forEach(v => { d[v] = [0, 0]; });
    const mult = cfg.titr === 'dd' ? 2 : 1, starts = [];
    let cum = 0;
    for (let m = 1; m <= MONTHS; m++) {
      let n = 0;
      S.sites.forEach(s => { if (m >= s.act) n += countryOf(s).rate; });
      n = Math.min(n, TARGET - cum); cum += n; starts.push(n);
    }
    d.monthly = []; d.starts = starts;
    for (let m = 1; m <= MONTHS; m++) {
      const b = m <= 7 ? 0 : 1, mm = {}; VARIANTS.forEach(v => { mm[v] = 0; });
      starts.forEach((n, i) => {
        const k = m - (i + 1) + 1; if (k < 1) return;
        for (const a of ['L', 'H', 'P']) { const v = variantFor(a, k, cfg); d[v][b] += n * RATIO3[a] * mult; mm[v] += n * RATIO3[a] * mult; }
      });
      d.monthly.push(mm);
    }
    return d;
  }

  function variantFor(a, k, cfg) {
    const step = k <= 1 ? 1 : k === 2 ? 2 : 3;
    if (step === 1) return a === 'P' ? 'S1P' : 'S1A';
    if (step === 2) return a === 'P' ? 'S2P' : 'S2A';
    if (a === 'P') return 'S3P';
    if (a === 'H') return 'S3H';
    return cfg.titr === 'open' ? 'S2A' : 'S3L';
  }

  // ---------- Opsætning færdig: UAT og go-live ----------
  function goLive(S) {
    const c = S.cfg, found = [], missed = [];
    for (const id in DEFECTS) {
      const D = DEFECTS[id]; if (D.need && !D.need(c)) continue;
      const hit = rand() < D.p[c.uat];
      S.defects[id] = { found: hit, surfaced: false };
      (hit ? found : missed).push(id);
    }
    const plan = planDemand(S);
    // Min/max-niveauer lægges fast ved go-live ud fra planens travleste måned pr. site.
    const avgRate = S.sites.reduce((a, s) => a + countryOf(s).rate, 0) / S.sites.length;
    let cum = 0; S.planCum = plan.starts.map(n => Math.round(cum += n));
    S.levels = {};
    VARIANTS.forEach(v => {
      const peak = Math.max(...plan.monthly.map(x => x[v])) / S.sites.length;
      S.levels[v] = peak / avgRate;
    });
    VARIANTS.forEach(v => {
      const pipe = c.resup === 'pred' ? c.buf * 15 : S.levels[v] * 2.6 * MMAX[c.buf] * 30 * .5;
      const tail = STEP_OF[v] < 3 ? plan[v][0] * .2 : 0;   // rekrutteringen kan glide ind i batch 2
      S.central[v] = [Math.ceil((plan[v][0] + pipe) * c.over), Math.ceil((plan[v][1] + pipe + tail) * c.over)];
      S.st.produced += S.central[v][0] + S.central[v][1];
    });
    S.uat = { found, n: UAT[c.uat].scripts };
    log(S, 'Du', `Specifikation godkendt. UAT: ${UAT[c.uat].name}, ${UAT[c.uat].scripts} scripts, ${found.length} fejl fundet og rettet.`);
    found.forEach(id => log(S, 'Leverandøren', `Rettet før go-live: ${DEFECTS[id].t}.`));
    ['blok', 'uat'].forEach(id => unlock(S, id));
    if (c.method === 'min') unlock(S, 'min');
    if (c.method !== 'simple') unlock(S, 'strat');
    unlock(S, c.resup === 'pred' ? 'prediktiv' : 'minmax');
    unlock(S, 'dnsd'); unlock(S, 'dummytit'); unlock(S, 'overage');
    if (c.method === 'block' && c.bs === '5') unlock(S, 'forudsig');
    S.phase = 'uat';
  }

  function startMonth(S) {
    S.month++;
    S.newCards = [];
    S.notes = [];
    const m = S.month, c = S.cfg;
    if (m === 1) { log(S, 'Platformen', 'Systemet er i produktion. Første forsendelser er på vej til de aktive sites.'); unlock(S, 'allearme'); }
    // Konsekvenser af designet
    if (m === 2 && c.titr === 'dd') { S.notes.push({ sev: 'warn', who: 'Mette', t: 'Flere patienter klager over to stik om ugen. Tre har trukket sig.' }); S.st.dropouts += 3; dropRandom(S, 3); }
    if (m === 3 && c.titr === 'open') { S.notes.push({ sev: 'bad', who: 'Jonas', t: 'Sites har opdaget, at nogle patienter bliver på 1,2 mg-pennen i måned 3. De ved nu, hvem der får lavdosis. Blindingen mellem doserne er brudt.' }); penal(S, 20, 'Titreringsdesign afslører lavdosis-armen', true); log(S, 'Jonas', 'Blindingsbrud: åbne dosisetiketter afslører lavdosis.', 'bad'); }
    if (m === 4 && c.kitlist === 'seq') { S.notes.push({ sev: 'bad', who: 'Birgitte', t: 'En CRA har skrevet i en mail, at "alle kits over 2400 er nok placebo". Hun har ret. Kit-listen skal genereres på ny, og blindingen er kompromitteret for de første patienter.' }); penal(S, 15, 'Fortløbende kit-numre afslører placebo', true); log(S, 'Birgitte', 'Blindingsbrud: kit-numre i serier. Ny kit-liste bestilt.', 'bad'); unlock(S, 'kitliste'); }
    // Fejl fra build, der ikke blev fundet i UAT
    const D = S.defects;
    if (m === 3 && D.D4 && !D.D4.found && !D.D4.surfaced) {
      D.D4.surfaced = true;
      S.notes.push({ sev: 'bad', who: 'Jonas', t: `Afstemning mod EDC viser, at T2D-stratum er byttet om i systemet for alle ${S.patients.length} patienter. Randomiseringen står ved magt, men alle er fejlstratificeret og skal dokumenteres. Leverandøren retter det i en ny version.` });
      penal(S, 8, 'Fejl i stratum-mapping fra build (ikke fundet i UAT)'); log(S, 'Leverandøren', 'Hotfix: T2D-stratum mapping rettet.', 'bad'); unlock(S, 'fejlstrat');
    }
    if (m === 4 && D.D5 && !D.D5.found && !D.D5.surfaced) {
      D.D5.surfaced = true;
      S.notes.push({ sev: 'bad', who: 'Line', t: 'Prognosen sendte ingen trin 3-penne til sites. De første patienter på trin 3 blev mødt af tomme hylder. Fejlen var med fra build og er nu rettet.' });
      log(S, 'Leverandøren', 'Hotfix: prognosen medregner trin 3.', 'bad');
    }
    if (m === 9 && D.D2 && !D.D2.found && !D.D2.surfaced) {
      D.D2.surfaced = true;
      S.notes.push({ sev: 'bad', who: 'Line', t: `Systemet har regnet do-not-dispense i måneder i stedet for dage. Kits med under 35 dage tilbage er blevet udleveret. ${S.st.expDisp ? 'Det gælder ' + S.st.expDisp + ' udleveringer.' : ''}` });
      penal(S, 6, 'Fejl i udløbsberegning fra build'); log(S, 'Leverandøren', 'Hotfix: do-not-dispense regnes i dage.', 'bad');
    }
    S.snap = null; S.snap = JSON.stringify(S);
    S.phase = 'month';
  }

  function dropRandom(S, n) { for (let i = 0; i < n; i++) { const act = S.patients.filter(p => !p.out); if (act.length) act[Math.floor(rand() * act.length)].out = true; } }

  function rewind(S) { const T = JSON.parse(S.snap); T.rewinds = S.rewinds + 1; T.snap = S.snap; return T; }

  // ---------- Valg undervejs ----------
  const EVENTS = {
    1: { id: 'akt', card: 'aktivering', title: 'Site 101 vil i gang', who: 'Mette',
      text: 'Site 101 i Aarhus har sin første patient klar i morgen tidlig. Den etiske komités godkendelse er kommet på mail, men er ikke registreret, så sitet er ikke grønt i systemet.',
      quote: 'Kan du ikke bare trykke på knappen? Det er jo godkendt.',
      options: [
        { id: 'a', label: 'Aktivér sitet manuelt nu', after: 'Patienten er randomiseret kl. 8.04. Birgitte fra QA har sat et flueben i sin notesbog.', fx: S => penal(S, 5, 'Site aktiveret, før den regulatoriske godkendelse var dokumenteret') },
        { id: 'b', label: 'Registrér godkendelsen først, så åbner systemet sitet', after: 'Det tager to dage. Patienten kommer igen torsdag, lidt fortørnet, men randomiseret efter bogen.', fx: S => { S.mods.site0Slow = true; } },
        { id: 'c', label: 'Lad sitet randomisere på papir og indtaste bagefter', after: 'Der findes ingen papirliste. Sitet improviserer. Jonas får hikke.', fx: S => penal(S, 12, 'Randomisering uden om systemet') }
      ] },
    2: { id: 'fejlstrat', card: 'fejlstrat', title: 'Forkert stratum i Madrid', who: 'Jonas',
      text: 'Site 302 har randomiseret en patient med BMI under 35. I EDC står der 37,2. Det er en tastefejl fra screeningen.',
      quote: 'Patienten er randomiseret og har fået sin første pen. Spørgsmålet er, hvad vi gør nu.',
      options: [
        { id: 'a', label: 'Randomisér patienten igen i det rigtige stratum', after: 'Systemet tillader det med en override. Patienten har nu to randomiseringsnumre og to behandlinger i historikken. Jonas har lukket sin dør.', fx: S => penal(S, 12, 'Patient randomiseret to gange') },
        { id: 'b', label: 'Ret stratum i systemet, så det passer med EDC', after: 'Rettelsen står i audit trail. Men blokken i det gamle stratum har nu et hul, og det nye stratum har en patient, det aldrig har tildelt. Listen passer ikke længere med virkeligheden.', fx: S => penal(S, 7, 'Stratum ændret efter randomisering') },
        { id: 'c', label: 'Lad randomiseringen stå, ret EDC og registrér en protokolafvigelse', after: 'Patienten fortsætter i sin arm. Statistikerne analyserer efter det stratum, der blev brugt ved randomiseringen, og nævner det i rapporten. Kedeligt og korrekt.', fx: S => {} }
      ] },
    3: { id: 'titr', card: 'aendring', title: 'Kvalme i Hamborg', who: 'Dr. Weber',
      text: 'En patient på site 205 skal fra trin 2 til trin 3 i dag, men har haft kvalme i to uger. Protokollen tillader én måned ekstra på trin 2. Den regel kom ikke med i specifikationen, så systemet vil udlevere en trin 3-pen.',
      quote: 'Jeg vil ikke give hende den højere dosis i dag. Hvad gør jeg?',
      options: [
        { id: 'a', label: 'Ændringsanmodning: byg dosispausen ind, som protokollen beskriver', after: 'Leverandøren bygger reglen på tre dage som en ny version af konfigurationen, testet og godkendt. Patienten får sin trin 2-pen ved et ikke-planlagt besøg, og fremtidige patienter kan få det samme.', fx: S => { S.mods.titrFix = true; S.st.extraKr += 150000; } },
        { id: 'b', label: 'Sitet tager en trin 2-pen fra hylden uden om systemet', after: 'Patienten er glad. Systemet tror, at pennen stadig står på hylden, og lagerregnskabet har nu et hul.', fx: S => { penal(S, 6, 'Kit udleveret uden om systemet'); unlock(S, 'accountability'); } },
        { id: 'c', label: 'Følg systemet: patienten skal op på trin 3', after: 'Patienten kaster op i en uge og trækker sig fra studiet. Dr. Weber skriver en lang mail til medical monitor.', fx: S => { penal(S, 5, 'Protokollens dosispause kunne ikke bruges'); S.st.dropouts++; dropRandom(S, 1); } }
      ] },
    4: { id: 'temp', card: 'temp', title: '14 grader i São Paulo', who: 'Line',
      text: 'Dataloggerne på de brasilianske sites viser, at kølerummene var 14 °C i ni timer under et strømsvigt. Det tilladte er 2 til 8 °C.',
      quote: 'Stabilitetsdata dækker måske udsvinget. Måske.',
      options: [
        { id: 'a', label: 'Karantæne i systemet, til QA har vurderet stabilitetsdata', after: 'Systemet springer kittene over og bestiller erstatning med det samme. Efter tre uger frigiver QA dem igen: stabilitetsdata dækker udsvinget.', fx: S => { S.mods.quar = 4; } },
        { id: 'b', label: 'Fortsæt udlevering. 14 grader er næsten køleskab.', after: 'Ingen opdager noget i en måned. Så kommer loggerdata med i en rutinegennemgang.', fx: S => penal(S, 10, 'Kits udleveret efter temperaturudsving uden vurdering') },
        { id: 'c', label: 'Destruér alt på de brasilianske sites for en sikkerheds skyld', after: 'Det er sikkert. Det er også tomme hylder, indtil nye penne er gennem tolden.', fx: S => { S.sites.filter(s => s.c === 'BR').forEach(s => VARIANTS.forEach(v => { S.st.waste += s.stock[v][0] + s.stock[v][1]; s.stock[v] = [0, 0]; })); } }
      ] },
    5: { id: 'afbl', card: 'nodafbl', title: 'Kl. 02.40 i Osaka', who: 'Dr. Tanaka',
      text: 'En patient på site 602 er indlagt med akut pancreatitis. Lægen på vagt vil vide, om patienten får aktivt stof, før behandlingen lægges fast.',
      quote: 'Jeg har brug for svaret nu, ikke i morgen.',
      options: [
        { id: 'a', label: 'Investigatoren afblinder selv i systemet', after: 'Det tager to minutter. Kun investigatoren ser behandlingen. Studieteamet får besked om, at en afblinding er sket, men ikke hvad den viste.', fx: S => d1(S) },
        { id: 'b', label: 'Investigatoren ringer til studieteamet, som finder statistikeren', after: 'Jonas sover. Efter fire timer får lægen svaret, og nu ved tre personer i det blindede studieteam det også.', fx: S => { penal(S, 8, 'Blindet studieteam fik kendskab til behandling', true); d1(S); } },
        { id: 'c', label: 'Behandl, som om der er aktivt stof, og afblind ikke', after: 'Patienten bliver rask. Men beslutningen om at afblinde er investigatorens, ikke din, og den ret står i protokollen.', fx: S => penal(S, 4, 'Nødafblinding forhindret af studieteamet') }
      ] },
    6: { id: 'holdbar', card: 'holdbar', title: 'Seks måneder mere', who: 'Line',
      text: 'Nye stabilitetsdata forlænger holdbarheden for batch 1 med seks måneder. Etiketterne viser stadig den gamle dato, midt i måned 8.',
      quote: 'En stor del af lageret i verden er batch 1. Uden forlængelse ryger det hele.',
      options: [
        { id: 'a', label: 'Ommærk, og opdatér udløbsdatoen i systemet, når QP har frigivet', after: 'Ommærkningen koster 400.000 kr. og tre ugers koordinering. Batch 1 kan bruges resten af studiet.', fx: S => { S.mods.b1Exp = B1_EXP + EXTEND; S.st.extraKr += 400000; } },
        { id: 'b', label: 'Opdatér datoen i systemet nu. Etiketterne kan vente.', after: 'System og etiketter er nu uenige. Det opdager en farmaceut i Hamborg efter en uge, og hun skriver til myndighederne.', fx: S => { S.mods.b1Exp = B1_EXP + EXTEND; penal(S, 10, 'Udløbsdato ændret i systemet uden ommærkning og frigivelse'); } },
        { id: 'c', label: 'Lad batch 1 udløbe som planlagt', after: 'Batch 2 tager over. Det, der står tilbage af batch 1, destrueres.', fx: S => {} }
      ] },
    7: { id: 'dsmb', card: 'aendring', title: 'DSMB lukker en arm', who: 'Jonas',
      text: 'Den uafhængige komité anbefaler at lukke 2,4 mg-armen for nye patienter på grund af mave-tarm-bivirkninger. Patienter, der allerede er på 2,4 mg, fortsætter. Forholdet bliver 2:1 mellem 1,2 mg og placebo.',
      quote: 'Jeg kan have nye lister klar i morgen. Det er sådan set resten, der er svært.',
      options: [
        { id: 'a', label: 'Ny konfigurationsversion: armen lukkes, kits forbliver blindede', after: 'Ændringen testes og går i produktion uden nedetid. Sites mærker ingenting. Nye patienter fordeles 2:1.', fx: S => { S.mods.hDrop = S.month; S.queues = {}; } },
        { id: 'b', label: 'Send sites en liste over kit-numre, der ikke længere må udleveres', after: 'Listen virker. Nu ved alle sites også præcis, hvilke kits der er 2,4 mg.', fx: S => { S.mods.hDrop = S.month; S.queues = {}; penal(S, 18, 'Sites fik liste over kit-numre med 2,4 mg', true); } },
        { id: 'c', label: 'Stop al randomisering til næste planlagte release om seks uger', after: 'Sites venter. Nogle patienter går til et andet studie i mellemtiden.', fx: S => { S.mods.hDrop = S.month; S.queues = {}; S.mods.pause.all = [7, 8]; } }
      ] },
    8: { id: 'us', card: 'loft', title: 'Amerika vil have mere', who: 'Mette',
      text: 'Et konkurrerende studie er lukket, og de amerikanske sites får tre gange så mange henvisninger. Mette er i himlen. Line er ikke.',
      quote: 'Vi kan blive færdige før tid! Hvad venter vi på?',
      options: [
        { id: 'a', label: 'Lad dem randomisere, og bestil en ekstra batch nu', after: 'Produktionen er bestilt og ankommer om to måneder. Den koster 1,5 mio. kr.', fx: S => { S.mods.usBoost = 2.6; S.mods.extra.push({ m: S.month + 2, f: .18 }); S.st.extraKr += 1500000; } },
        { id: 'b', label: 'Lad dem randomisere, og hæv sikkerhedslageret overalt', after: 'Sites fyldes op. Line sover lidt bedre, depotet lidt dårligere.', fx: S => { S.mods.usBoost = 2.6; S.cfg.buf = Math.min(3, S.cfg.buf + 1); } },
        { id: 'c', label: 'Sæt et loft: højst 40 % af patienterne fra ét land', after: 'Loftet ligger i konfigurationen og håndhæves automatisk. Mette synes, du er en lyseslukker.', fx: S => { S.mods.usBoost = 2.6; S.mods.usCap = true; } }
      ] },
    9: { id: 'kitfejl', card: 'kitfejl', title: 'Forkert pen i Boston', who: 'Line',
      text: 'En sygeplejerske på site 404 har givet en patient kit 40817 med hjem. Systemet havde tildelt det til en anden patient samme formiddag.',
      quote: 'Begge patienter har nu hinandens penne. Den ene ved det ikke endnu.',
      options: [
        { id: 'a', label: 'Registrér fejludleveringen, og lad systemet tildele erstatning', after: 'Systemet noterer fejlen og viser kun det ublindede team, om patienten har fået en anden behandling. Der skrives en protokolafvigelse, og patienten får det rigtige kit.', fx: S => d3(S) },
        { id: 'b', label: 'Byt de to kit-numre i systemet, så registreringen passer', after: 'Nu passer tallene. Men audit trail viser, at historikken er ændret bagefter, og ingen kan se, hvad patienten egentlig fik.', fx: S => penal(S, 10, 'Udlevering ændret bagudrettet for at skjule fejl') },
        { id: 'c', label: 'Lad det ligge. Det er nok samme slags pen.', after: 'Det var det ikke. Den ene patient tog placebo i fire uger uden at nogen registrerede det.', fx: S => penal(S, 8, 'Fejludlevering ikke registreret') }
      ] },
    10: { id: 'import', card: 'import', title: 'Tolden i Japan', who: 'Line',
      text: 'Den japanske importtilladelse skal fornys, og myndigheden melder otte ugers behandlingstid. I den periode kan der ikke sendes kits til Japan. Patienterne skal stadig have medicin.',
      quote: 'Vi har én forsendelse tilbage, før døren lukker.',
      options: [
        { id: 'a', label: 'Send to måneders forbrug til de japanske sites nu', after: 'Hylderne i Osaka og Tokyo er fyldt. Det er dyrt, og noget kommer måske retur. Men ingen går forgæves.', fx: S => { S.mods.jpBlock = [11, 12]; S.mods.jpPre = true; } },
        { id: 'b', label: 'Stop rekrutteringen i Japan, og vent', after: 'Nye patienter venter. Dem, der er i behandling, skal klare sig med det, der står på hylden.', fx: S => { S.mods.jpBlock = [11, 12]; S.mods.pause.JP = [11, 12]; } },
        { id: 'c', label: 'Lad systemet køre som normalt', after: 'Systemet bestiller som altid. Forsendelserne står i lufthavnen.', fx: S => { S.mods.jpBlock = [11, 12]; } }
      ] },
    11: { id: 'roller', card: 'roller', title: 'En CRA vil afstemme', who: 'CRA, Spanien',
      text: 'Monitoren på site 303 vil gerne have en rapport, der viser kit-type pr. patient, så hun kan afstemme lageret ved sit næste besøg.',
      quote: 'Det er bare en rapport. Den findes jo allerede i systemet.',
      options: [
        { id: 'a', label: 'Træk den ublindede rapport og send den', after: 'Hun takker. Rapporten ligger nu i hendes indbakke, på hendes bærbare og i et delt drev.', fx: S => penal(S, 15, 'Ublindet rapport sendt til blindet monitor', true) },
        { id: 'b', label: 'Send den blindede rapport. Kit-typer afstemmes af den ublindede supply-rolle.', after: 'Hun får kit-numre, status og datoer. Det er alt, hun skal bruge. Line tager kit-typerne.', fx: S => {} },
        { id: 'c', label: 'Bed hende tælle pennene i hånden', after: 'Hun gør det. Det tager en dag og passer på to nær.', fx: S => penal(S, 2, 'Manuel afstemning uden systemstøtte') }
      ] },
    12: { id: 'insp', card: 'audit', title: 'Inspektøren kommer', who: 'Birgitte',
      text: 'Myndigheden varsler inspektion om to uger og vil se audit trail for alle manuelle ændringer og overrides i systemet.',
      quote: 'Vi viser, hvad vi har. Det er hele pointen med en audit trail.',
      options: [
        { id: 'a', label: 'Udlevér audit trail, som den er, med forklaringer', after: 'Inspektøren læser i tre timer og stiller fire spørgsmål. Alle kan besvares.', fx: S => {} },
        { id: 'b', label: 'Ryd lidt op i kommentarerne først', after: 'Systemet logger også, at kommentarerne er ændret. Inspektøren finder det på side to.', fx: S => penal(S, 15, 'Audit trail-kommentarer ændret før inspektion') }
      ] }
  };

  function d1(S) {
    const D = S.defects.D1;
    if (D && !D.found) { D.surfaced = true; penal(S, 15, 'Nødafblindingsmail med behandlingsarm sendt til studieteamet (fejl fra build)', true);
      S.after.extra = 'Men: notifikationsmailen indeholdt behandlingsarmen og gik til 14 personer i studieteamet. Fejlen var med fra build og blev ikke fanget i UAT.'; log(S, 'Leverandøren', 'Hotfix: afblindingsmail viser ikke længere arm.', 'bad'); }
  }
  function d3(S) {
    const D = S.defects.D3;
    if (D && !D.found) { D.surfaced = true; penal(S, 4, 'Erstatningskit på forkert trin (fejl fra build)');
      S.after.extra = 'Men: erstatningskittet var på trin 2 i stedet for trin 3. Endnu en afvigelse, og endnu en hotfix.'; log(S, 'Leverandøren', 'Hotfix: erstatningskit følger patientens trin.', 'bad'); }
  }

  function choose(S, optId) {
    const E = EVENTS[S.month]; if (!E || S.decided[E.id]) return;
    const o = E.options.find(x => x.id === optId);
    S.after = {};
    const n0 = S.pen.length;
    o.fx(S);
    S.decided[E.id] = optId; S.after.text = o.after;
    log(S, 'Du', `${E.title}: ${o.label}.`, S.pen.length > n0 ? 'warn' : 'info');
    unlock(S, E.card);
  }

  // ---------- Simulation af en måned ----------
  // Kan batch 1 udleveres på denne dag? Batch 2 kan altid.
  function dispensable(S, b, dayAt) {
    if (b === 1) return true;
    const dnsd = S.defects.D2 && !S.defects.D2.found && !S.defects.D2.surfaced ? 0 : S.cfg.dnsd;
    return S.mods.b1Exp - dayAt >= dnsd;
  }

  function take(S, site, v, day) {
    const st = site.stock[v];
    if (st[0] > 0 && dispensable(S, 0, day)) { st[0]--; if (S.mods.b1Exp - day < 35) S.st.expDisp++; return true; }
    if (st[1] > 0) { st[1]--; return true; }
    return false;
  }

  function onHand(S, site, v, day) { const st = site.stock[v]; return (dispensable(S, 0, day) ? st[0] : 0) + st[1]; }

  function lead(site) { return COUNTRIES.find(c => c.id === site.c).lead; }
  function countryOf(site) { return COUNTRIES.find(c => c.id === site.c); }

  function ratio(S) { return S.mods.hDrop && S.month >= S.mods.hDrop ? RATIO2 : RATIO3; }

  function expectedRand(S, site, m) {
    if (m < site.act) return 0;
    return countryOf(site).rate * (site.c === 'US' && S.mods.usBoost ? S.mods.usBoost : 1);
  }

  // Hvad sitet skal bruge i måned m (kendte besøg + forventede nye patienter).
  function forecast(S, site, m) {
    const f = {}; VARIANTS.forEach(v => { f[v] = 0; });
    const mult = S.cfg.titr === 'dd' ? 2 : 1;
    S.patients.forEach(p => { if (p.s !== site.id || p.out) return; f[variantFor(p.a, m - p.st + 1, S.cfg)] += mult; });
    const e = expectedRand(S, site, m), r = ratio(S);
    f.S1A += e * (r.L + r.H) * mult; f.S1P += e * r.P * mult;
    if (S.defects.D5 && !S.defects.D5.found && !S.defects.D5.surfaced) { f.S3L = 0; f.S3H = 0; f.S3P = 0; }
    return f;
  }

  function ship(S, site, v, q, m) {
    const lt = site.held ? 0 : lead(site), arr = m + lt, day = 30 * (arr - 1);
    let sent = 0;
    // FEFO: send batch 1, så længe den kan udleveres ved ankomst.
    const c = S.central[v];
    if (c[0] > 0 && dispensable(S, 0, day)) { const x = Math.min(q, c[0]); c[0] -= x; sent += x; site.pipe.push({ arr, v, b: 0, q: x }); }
    if (sent < q && m >= B2_FROM && c[1] > 0) { const x = Math.min(q - sent, c[1]); c[1] -= x; sent += x; site.pipe.push({ arr, v, b: 1, q: x }); }
    return sent;
  }

  function resupply(S, m) {
    const c = S.cfg, day0 = 30 * (m - 1);
    let orders = 0, short = 0;
    S.sites.forEach(site => {
      if (m + lead(site) < site.act) return;
      if (S.mods.jpBlock && site.c === 'JP' && m >= S.mods.jpBlock[0] && m <= S.mods.jpBlock[1]) return;
      let shipped = false;
      const lt = site.held ? 0 : lead(site);
      const pipeQ = v => site.pipe.filter(x => x.v === v).reduce((a, x) => a + x.q, 0);
      let fc = null;
      if (c.resup === 'pred') {
        fc = {}; VARIANTS.forEach(v => { fc[v] = 0; });
        for (let k = 0; k <= lt; k++) { const f = forecast(S, site, m + k); VARIANTS.forEach(v => { fc[v] += f[v]; }); }
        if (S.mods.jpPre && site.c === 'JP' && m === 10) { const f = forecast(S, site, 12); VARIANTS.forEach(v => { fc[v] += f[v] * 2; }); }
      }
      VARIANTS.forEach(v => {
        if (S.mods.hDrop && v === 'S3H' && !S.patients.some(p => p.s === site.id && p.a === 'H' && !p.out)) return;
        const lvl = onHand(S, site, v, day0) + pipeQ(v);
        let q = 0;
        if (c.resup === 'minmax') {
          const per = S.levels[v] * countryOf(site).rate;
          let t = Math.max(c.buf, Math.round(per * (MMIN[c.buf] + lt))), mx = Math.max(t + 2, Math.round(per * (MMAX[c.buf] + lt)));
          if (S.mods.jpPre && site.c === 'JP' && m === 10) { t += Math.round(per * 2); mx += Math.round(per * 2); }
          if (lvl < t) q = mx - lvl;
        } else {
          const target = Math.ceil(fc[v] + (c.buf - 1));
          if (lvl < target) q = target - lvl;
        }
        if (q > 0) { const s = ship(S, site, v, q, m); if (s > 0) shipped = true; if (s < q) short += q - s; }
      });
      if (shipped) orders++;
    });
    S.st.ships += orders;
    return { orders, short };
  }

  function arrivals(S, m) {
    S.sites.forEach(site => {
      site.pipe = site.pipe.filter(x => { if (x.arr <= m) { site.stock[x.v][x.b] += x.q; return false; } return true; });
    });
    S.mods.extra.forEach(e => { if (e.m === m && !e.done) { e.done = true; VARIANTS.forEach(v => { const q = Math.ceil((S.central[v][0] + S.central[v][1] + 40) * e.f) + 40; S.central[v][1] += q; S.st.produced += q; }); } });
  }

  function expire(S, m) {
    const day0 = 30 * (m - 1);
    if (dispensable(S, 0, day0) && S.mods.b1Exp > day0) return 0;
    let w = 0;
    S.sites.forEach(site => VARIANTS.forEach(v => { w += site.stock[v][0]; site.stock[v][0] = 0; }));
    S.sites.forEach(site => site.pipe.forEach(x => { if (x.b === 0) { w += x.q; x.q = 0; } }));
    VARIANTS.forEach(v => { w += S.central[v][0]; S.central[v][0] = 0; });
    S.st.waste += w;
    return w;
  }

  function stratKey(S, p, site) {
    const f = S.cfg.factors, k = [];
    if (f.region) k.push(countryOf(site).region);
    if (f.bmi) k.push(p.b);
    if (f.t2d) k.push(p.d);
    if (f.site) k.push(site.id);
    return k.join('|') || 'alle';
  }

  function assign(S, p, site) {
    const r = ratio(S), arms = r.H ? ['L', 'H', 'P'] : ['L', 'P'];
    const byRatio = () => { const u = rand(); let acc = 0; for (const a of arms) { acc += r[a]; if (u < acc) return a; } return arms[arms.length - 1]; };
    const c = S.cfg;
    if (c.method === 'simple') return byRatio();
    if (c.method === 'block') {
      const key = stratKey(S, p, site);
      let q = S.queues[key];
      if (!q || !q.length) {
        const size = c.bs === 'mix' ? (rand() < .5 ? 5 : 10) : +c.bs;
        const unit = r.H ? ['L', 'L', 'H', 'H', 'P'] : ['L', 'L', 'P'];
        const reps = r.H ? size / 5 : Math.max(1, Math.round(size / 3));
        q = S.queues[key] = shuffle([].concat(...Array(reps).fill(unit)));
      }
      return q.shift();
    }
    // Minimering (Pocock-Simon) over de valgte faktorer
    const f = c.factors, fac = [];
    if (f.region) fac.push(x => countryOf(S.sites.find(s => s.id === x.s)).region);
    if (f.bmi) fac.push(x => x.b);
    if (f.t2d) fac.push(x => x.d);
    if (f.site) fac.push(x => x.s);
    if (!fac.length) fac.push(() => 0);
    const cnt = fac.map(g => { const me = g(p), o = {}; arms.forEach(a => { o[a] = 0; }); S.patients.forEach(x => { if (o[x.a] !== undefined && g(x) === me) o[x.a]++; }); return o; });
    const score = a => cnt.reduce((s, o) => { const vals = arms.map(b => (o[b] + (b === a ? 1 : 0)) / r[b]); return s + Math.max(...vals) - Math.min(...vals); }, 0);
    if (rand() < .8) { const sc = arms.map(score), mn = Math.min(...sc); const best = arms.filter((a, i) => sc[i] === mn); return best[Math.floor(rand() * best.length)]; }
    return byRatio();
  }

  function paused(S, site, m) {
    const p = S.mods.pause;
    if (p.all && (m === p.all[0])) return 1;
    if (p.all && (m === p.all[1])) return .5;
    if (p[site.c] && m >= p[site.c][0] && m <= p[site.c][1]) return 1;
    return 0;
  }

  function runMonth(S) {
    const m = S.month, c = S.cfg, day0 = 30 * (m - 1), H = { m, rand: 0, blocked: 0, missed: 0, waste: 0, ships: 0, short: 0, expDisp: 0 };
    const st0 = Object.assign({}, S.st);
    arrivals(S, m);
    H.waste += expire(S, m);
    const quarBR = S.mods.quar === m;
    if (quarBR) S.sites.filter(s => s.c === 'BR').forEach(s => { s.held = s.stock; s.stock = {}; VARIANTS.forEach(v => { s.stock[v] = [0, 0]; }); });
    const rs = resupply(S, m); H.ships = rs.orders; H.short = rs.short;
    arrivals(S, m);   // forsendelser uden leveringstid når frem før besøgene
    const mult = c.titr === 'dd' ? 2 : 1;
    // Besøg for patienter i behandling
    S.patients.forEach(p => {
      if (p.out || p.st >= m) return;
      const site = S.sites.find(s => s.id === p.s);
      const v = variantFor(p.a, m - p.st + 1, c);
      for (let i = 0; i < mult; i++) {
        S.st.visits++;
        if (!take(S, site, v, day0)) S.st.missed++;
      }
    });

    // Nye randomiseringer
    const total = () => S.patients.length;
    const usN = () => S.patients.filter(p => S.sites.find(s => s.id === p.s).c === 'US').length;
    S.sites.forEach(site => {
      if (m < site.act) return;
      let lam = expectedRand(S, site, m);
      if (m === 1) lam *= UAT[c.uat].m1;
      if (site === S.sites[0] && S.mods.site0Slow && m === 1) lam *= .7;
      lam *= 1 - paused(S, site, m);
      let n = pois(lam) + site.backlog; site.backlog = 0;
      for (let i = 0; i < n; i++) {
        if (total() >= TARGET) break;
        if (S.mods.usCap && site.c === 'US' && usN() >= TARGET * .4) break;
        const needA = 'S1A', needP = 'S1P';
        const okA = onHand(S, site, needA, day0) >= mult;
        const okP = onHand(S, site, needP, day0) >= mult;
        if (!okA || !okP) { H.blocked++; S.st.blocked++; if (rand() < .7) site.backlog++; continue; }
        const p = { s: site.id, st: m, b: rand() < .45 ? 1 : 0, d: rand() < .3 ? 1 : 0, a: null, t: m };
        p.a = assign(S, p, site);
        const v = variantFor(p.a, 1, c);
        for (let k = 0; k < mult; k++) { take(S, site, v, day0); S.st.visits++; }
        S.patients.push(p); site.nrand++; H.rand++;
        if (total() >= TARGET && !S.lpfv) S.lpfv = m - 1 + (S.sites.indexOf(site) + 1) / S.sites.length;
      }
    });
    if (quarBR) S.sites.filter(s => s.held).forEach(s => { VARIANTS.forEach(v => { s.stock[v][0] += s.held[v][0]; s.stock[v][1] += s.held[v][1]; }); delete s.held; });
    S.st.rand = S.patients.length;
    H.missed = S.st.missed - st0.missed; H.expDisp = S.st.expDisp - st0.expDisp; H.waste = S.st.waste - st0.waste;
    H.cum = S.patients.length;
    S.hist.push(H);
    if (H.missed > 0) log(S, 'Platformen', `${H.missed} besøg uden kit på lager.`, 'warn');
    if (H.waste > 0) log(S, 'Platformen', `${H.waste} kits destrueret.`, 'warn');
    log(S, 'Platformen', `Måned ${m}: ${H.rand} randomiseret, ${H.ships} forsendelser.`);
    if (m >= MONTHS) finish(S); else startMonth(S);
  }

  // ---------- Status til dashboardet ----------
  function dash(S) {
    const m = S.month, day0 = 30 * (m - 1);
    const per = {}; VARIANTS.forEach(v => { per[v] = { central: S.central[v][0] + S.central[v][1], b1: S.central[v][0], sites: 0, empty: 0 }; });
    S.sites.forEach(s => { if (m < s.act) return; VARIANTS.forEach(v => { const n = onHand(S, s, v, day0); per[v].sites += n; if (n === 0 && !(S.mods.hDrop && v === 'S3H')) per[v].empty++; }); });
    const byC = COUNTRIES.map(c => ({ id: c.id, name: c.name, n: S.patients.filter(p => S.sites.find(s => s.id === p.s).c === c.id).length, sites: S.sites.filter(s => s.c === c.id && m >= s.act).length, of: c.n }));
    const strata = { b: [0, 0], d: [0, 0] }; S.patients.forEach(p => { strata.b[p.b]++; strata.d[p.d]++; });
    const active = S.patients.filter(p => !p.out).length;
    // Månedligt forbrug fra centrallageret, til Lines advarsel
    let low = [];
    VARIANTS.forEach(v => {
      if (S.mods.hDrop && v === 'S3H') return;
      const need = S.sites.reduce((a, s) => a + forecastRaw(S, s, m + 1, v), 0);
      if (per[v].central < need * 1.5 && per[v].central < 120) low.push(v);
    });
    return { per, byC, strata, active, low, bal: balanceComment(S) };
  }

  function forecastRaw(S, site, m, v) {
    let n = 0; const mult = S.cfg.titr === 'dd' ? 2 : 1;
    S.patients.forEach(p => { if (p.s === site.id && !p.out && variantFor(p.a, m - p.st + 1, S.cfg) === v) n += mult; });
    if (v === 'S1A' || v === 'S1P') n += expectedRand(S, site, m) * (v === 'S1A' ? .8 : .2) * mult;
    return n;
  }

  // Jonas er ublindet og siger kun noget i ord.
  function balanceComment(S) {
    const b = balance(S);
    if (S.patients.length < 30) return 'For tidligt at sige noget.';
    if (b.max < .03) return 'Fordelingen ligger tæt på 2:2:1 i alle strata. Mere siger jeg ikke.';
    if (b.max < .06) return 'Lidt skævhed i et par strata. Inden for det forventelige.';
    if (b.max < .1) return 'Der er en skævhed, jeg ikke bryder mig om. Jeg kan ikke sige hvor.';
    return 'Fordelingen er skæv. Det kommer til at stå i rapporten.';
  }

  function balance(S) {
    const groups = { 'Alle': () => true, 'BMI < 35': p => !p.b, 'BMI ≥ 35': p => p.b, 'Uden T2D': p => !p.d, 'Med T2D': p => p.d };
    const out = {}; let max = 0;
    for (const g in groups) {
      const P = S.patients.filter(groups[g]); if (!P.length) continue;
      const n = { L: 0, H: 0, P: 0 }, e = { L: 0, H: 0, P: 0 };
      P.forEach(p => { n[p.a]++; const r = S.mods.hDrop && p.t >= S.mods.hDrop ? RATIO2 : RATIO3; for (const a in e) e[a] += r[a]; });
      const dev = ['L', 'H', 'P'].reduce((s, a) => s + Math.abs(n[a] - e[a]), 0) / P.length / 2;
      out[g] = { n, e, N: P.length, dev }; max = Math.max(max, dev);
    }
    return { groups: out, max };
  }

  // ---------- Slutopgørelse ----------
  function finish(S) {
    const c = S.cfg, findings = [];
    S.pen.forEach(p => findings.push({ pts: p.pts, why: p.why, breach: p.breach, m: p.m }));
    if (c.method !== 'simple' && !c.factors.bmi) findings.push({ pts: 10, why: 'Randomiseringen var ikke stratificeret efter BMI, som protokollen kræver' });
    if (c.method !== 'simple' && !c.factors.t2d) findings.push({ pts: 10, why: 'Randomiseringen var ikke stratificeret efter T2D, som protokollen kræver' });
    if (c.method === 'simple') findings.push({ pts: 14, why: 'Simpel randomisering i stedet for protokollens stratificerede randomisering' });
    const B = balance(S), balPen = Math.round(clamp(B.max * 220, 0, 25));
    if (balPen >= 4) findings.push({ pts: balPen, why: `Ubalance mellem armene (største afvigelse ${fmt(B.max * 100, 1)} %)` });
    let pred = 0;
    if (c.method === 'block' && c.bs === '5') pred = c.factors.site ? 8 : 3;
    if (pred) findings.push({ pts: pred, why: 'Forudsigelig blokstørrelse' });
    const missRate = S.st.missed / Math.max(1, S.st.visits);
    if (S.st.expDisp) findings.push({ pts: Math.min(14, Math.ceil(S.st.expDisp / 25)), why: `${S.st.expDisp} udleveringer med for kort holdbarhed til hele besøgsintervallet` });
    const supply = Math.round(clamp(100 - missRate * 900 - S.st.blocked * .1, 0, 100));
    const integ = clamp(100 - findings.reduce((a, f) => a + f.pts, 0), 0, 100);
    const wasteKr = S.st.waste * KIT_KR, shipKr = S.st.ships * SHIP_KR, costKr = wasteKr + shipKr + S.st.extraKr;
    const waste = Math.round(clamp(100 - (costKr / 1e6 - 1.2) * 9, 0, 100));
    const lp = S.lpfv || 12;
    const time = Math.round(clamp(100 - Math.max(0, lp - (LPFV_TARGET - 1)) * 30 - (S.lpfv ? 0 : (TARGET - S.patients.length) / 6), 0, 100));
    const total = Math.round(integ * .4 + supply * .25 + waste * .15 + time * .2);
    S.end = { integ, supply, waste, time, total, findings, B, wasteKr, shipKr, costKr, lp, missRate };
    S.phase = 'end';
    log(S, 'Platformen', 'Database lock. Behandlingskoden er brudt for analysen.');
  }

  // Styring undervejs
  function setBuf(S, b) {
    if (b === S.cfg.buf) return;
    log(S, 'Du', `${S.cfg.resup === 'pred' ? 'Sikkerhedslager' : 'Min/max-niveau'} ændret fra ${BUFNAME[S.cfg.buf]} til ${BUFNAME[b]}.`);
    S.cfg.buf = b;
  }
  function canOrder(S) { return !S.mods.extra.some(e => e.m > S.month) && S.month <= MONTHS - 3; }
  function orderBatch(S) {
    if (!canOrder(S)) return;
    S.mods.extra.push({ m: S.month + 3, f: .15 }); S.st.extraKr += 1200000;
    log(S, 'Du', `Ekstra produktion bestilt (+15 %). Frigives i måned ${S.month + 3}.`);
  }
  const BUFNAME = [null, 'lavt', 'mellem', 'højt'];

  function grade(t) {
    if (t >= 88) return ['Inspektionsklar', 'Ingen kritiske fund. Det her studie kan man vise frem.'];
    if (t >= 75) return ['Solidt', 'Et par fund, alle kan forklares. Sådan ser de fleste gode studier ud.'];
    if (t >= 60) return ['Gennemført med ar', 'Studiet holder, men rapporten får et ekstra afsnit om afvigelser.'];
    if (t >= 45) return ['Hårdt arbejde for QA', 'Studiet kan bruges, men nogen skal forklare meget for myndighederne.'];
    return ['Kritiske fund', 'Statistikerne er i tvivl om, hvad studiet egentlig kan vise.'];
  }

  const api = { setBuf, canOrder, orderBatch, BUFNAME, newGame, goLive, startMonth, runMonth, choose, rewind, dash, balance, lint, specLines, stratCount, grade, fmt,
    EVENTS, DEFECTS, UAT, COUNTRIES, VARIANTS, VLABEL, STEP_OF, MMIN, MMAX, MONTHS, TARGET, LPFV_TARGET, KIT_KR,
    _seed(f) { rand = f; } };
  if (typeof module !== 'undefined') module.exports = api; else root.Engine = api;
})(this);
