// Blindet: simulationsmotoren. Ingen DOM her, så den kan testes i Node.
(function (root) {
  'use strict';

  const MONTHS = 12, TARGET = 600, LPFV_TARGET = 10;
  const KIT_KR = 2500, SHIP_KR = 4000;
  const B1_EXP = 225;            // batch 1 udløber dag 225, midt i måned 8
  const B2_FROM = 5;             // batch 2 kan sendes fra måned 5
  const EXTEND = 180;            // holdbarhedsforlængelse i dage

  const COUNTRIES = [
    { id: 'DK', name: 'Denmark',  region: 'EU',    n: 4, lead: 0, rate: 2.3, base: 101 },
    { id: 'DE', name: 'Germany', region: 'EU',    n: 6, lead: 0, rate: 2.4, base: 201 },
    { id: 'ES', name: 'Spain',  region: 'EU',    n: 5, lead: 0, rate: 2.5, base: 301 },
    { id: 'US', name: 'United States',      region: 'NA',    n: 8, lead: 0, rate: 2.7, base: 401 },
    { id: 'BR', name: 'Brazil', region: 'LATAM', n: 4, lead: 1, rate: 2.4, base: 501 },
    { id: 'JP', name: 'Japan',    region: 'ASIA',  n: 3, lead: 1, rate: 1.9, base: 601 }
  ];
  const ACT_MONTH = [1, 2, 1, 3, 2, 1, 2, 3, 1, 2];   // aktiveringsmåned efter sitets plads
  const VARIANTS = ['S1A', 'S1P', 'S2A', 'S2P', 'S3L', 'S3H', 'S3P'];
  const VLABEL = { S1A: 'Step 1 · active', S1P: 'Step 1 · placebo', S2A: 'Step 2 · active', S2P: 'Step 2 · placebo', S3L: 'Step 3 · 1.2 mg', S3H: 'Step 3 · 2.4 mg', S3P: 'Step 3 · placebo' };
  const STEP_OF = { S1A: 1, S1P: 1, S2A: 2, S2P: 2, S3L: 3, S3H: 3, S3P: 3 };
  const MMIN = [null, .5, .9, 1.4], MMAX = [null, 1.1, 1.6, 2.3];   // min/max i måneders planlagt forbrug
  const RATIO3 = { L: .4, H: .4, P: .2 }, RATIO2 = { L: 2 / 3, H: 0, P: 1 / 3 };

  const DEFECTS = {
    D1: { t: 'Emergency unblinding notification shows treatment arm', crit: true, p: { happy: .1, risk: .85, full: .95 } },
    D2: { t: 'Do-not-dispense calculated in months, not days', p: { happy: .15, risk: .6, full: .9 } },
    D3: { t: 'Replacement kit selects previous titration step', p: { happy: .1, risk: .7, full: .9 } },
    D4: { t: 'T2D stratum mapping inverted (yes/no) in randomization', p: { happy: .3, risk: .8, full: .95 }, need: c => c.factors.t2d },
    D5: { t: 'Supply forecast omits titration step 3', p: { happy: .2, risk: .75, full: .9 }, need: c => c.resup === 'pred' }
  };
  const UAT = {
    happy: { name: 'Happy path', days: 3, scripts: 24, m1: 1 },
    risk: { name: 'Risk-based', days: 8, scripts: 71, m1: .6 },
    full: { name: 'Full UAT', days: 15, scripts: 148, m1: .2 }
  };

  let rand = Math.random;
  function pois(l) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= rand(); } while (p > L); return k - 1; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function fmt(x, d) { return Number(x).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }

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
    if (cfg.titr === 'open') out.push({ sev: 'bad', t: 'From month 3, sites can see who stays on step 2. This reveals the low-dose arm.' });
    if (cfg.titr === 'dd') out.push({ sev: 'warn', t: 'Double-dummy doubles the number of pens per visit.' });
    if (cfg.method && cfg.method !== 'simple') {
      if (!f.bmi) out.push({ sev: 'bad', t: 'Protocol requires stratification by baseline BMI. Missing.' });
      if (!f.t2d) out.push({ sev: 'bad', t: 'Protocol requires stratification by type 2 diabetes. Missing.' });
    }
    if (cfg.method === 'simple') out.push({ sev: 'bad', t: 'Simple randomization ignores the protocol stratification factors, and 2:2:1 may drift.' });
    if (cfg.method === 'block') {
      const per = TARGET / nStrata, bs = cfg.bs === 'mix' ? 7.5 : +cfg.bs;
      if (per < bs * 3) out.push({ sev: 'warn', t: `${nStrata} strata give approx. ${fmt(per)} participants per stratum. Many blocks will remain incomplete.` });
      if (cfg.bs === '5') out.push({ sev: f.site ? 'bad' : 'warn', t: f.site ? 'Blocks of 5 per site: after four randomizations the site can predict the fifth.' : 'Fixed blocks of 5 are easy to predict for a site that keeps count.' });
    }
    if (cfg.method === 'min' && f.site) out.push({ sev: 'ok', t: 'Site as a minimization factor is common and harmless.' });
    if (cfg.kitlist === 'seq') out.push({ sev: 'bad', t: 'Sequential kit number ranges per type reveal treatment to anyone who can count.' });
    if (cfg.dnsd !== null && cfg.dnsd < 35) out.push({ sev: 'warn', t: `Do-not-dispense of ${cfg.dnsd} days does not cover 28 days of use plus the 7-day visit window.` });
    if (cfg.over !== null && cfg.over <= 1.2 && cfg.resup === 'minmax' && cfg.buf >= 2) out.push({ sev: 'warn', t: 'Min/max keeps a lot of drug at sites. 20 % overage will be tight.' });
    if (!out.some(o => o.sev !== 'ok') && cfg.uat) out.push({ sev: 'ok', t: 'No findings.' });
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
    const fac = [f.region && 'region', f.bmi && 'baseline BMI (<35 / ≥35)', f.t2d && 'type 2 diabetes (yes/no)', f.site && 'site'].filter(Boolean);
    const facTxt = fac.length ? fac.join(', ') : 'no factors';
    if (cfg.method === 'simple') L.push('Randomize 2:2:1 to NH-2290 1.2 mg, NH-2290 2.4 mg and placebo using simple randomization.');
    if (cfg.method === 'block') L.push(`Randomize 2:2:1 to NH-2290 1.2 mg, NH-2290 2.4 mg and placebo in permuted blocks of ${cfg.bs === 'mix' ? '5 and 10 in random order' : cfg.bs}, stratified by ${facTxt}.`);
    if (cfg.method === 'min') L.push(`Randomize 2:2:1 using minimization on ${facTxt}. Assign the arm minimizing imbalance with probability 0.8, otherwise at random by ratio.`);
    if (cfg.method) L.push('Allow randomization only when the site holds kits for all arms.');
    if (cfg.titr === 'open') L.push('Dispense pens labelled 0.6 mg in month 1 and 1.2 mg in month 2. High dose receives 2.4 mg from month 3. Low dose continues on 1.2 mg.');
    if (cfg.titr === 'blind') L.push('All participants follow steps 1, 2 and 3. Low-dose participants receive step 3 pens containing 1.2 mg. Placebo matches each step.');
    if (cfg.titr === 'dd') L.push('Dispense two pens per visit: one active or placebo and one matching placebo, so all participants inject the same.');
    if (cfg.kitlist === 'seq') L.push('Assign kit numbers in sequential ranges: 1001 to 2400 active, 2401 to 3000 placebo.');
    if (cfg.kitlist === 'rand') L.push('Randomize kit numbers across kit types so the number reveals nothing about content.');
    if (cfg.resup === 'minmax') L.push(`Resupply a site when a kit type falls below ${fmt(MMIN[cfg.buf], 1)} months of planned use, up to ${fmt(MMAX[cfg.buf], 1)} months. Levels are fixed at go-live. Long lead-time countries get an add-on.`);
    if (cfg.resup === 'pred') L.push(`Resupply on forecast of scheduled visits and expected enrollment, plus safety stock of ${cfg.buf - 1} per kit type.`);
    if (cfg.dnsd !== null) L.push(`Do not dispense kits with fewer than ${cfg.dnsd} days to expiry. Do not ship kits that reach the limit before arrival.`);
    if (cfg.over !== null) L.push(`Produce ${fmt((cfg.over - 1) * 100)} % above planned demand.`);
    L.push('Investigators may emergency-unblind their own participants. The study team is notified of the unblinding, not the arm.');
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
    log(S, 'You', `Specification v1.0 approved. UAT: ${UAT[c.uat].name}, ${UAT[c.uat].scripts} scripts, ${found.length} defects found and fixed.`);
    found.forEach(id => log(S, 'Vendor', `Fixed before go-live: ${DEFECTS[id].t}.`));
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
    if (m === 1) { log(S, 'System', 'Go-live. Initial shipments dispatched to active sites.'); unlock(S, 'allearme'); }
    // Konsekvenser af designet
    if (m === 2 && c.titr === 'dd') { S.notes.push({ sev: 'warn', who: 'Mette', t: 'Flere patienter klager over to stik om ugen. Tre har trukket sig.' }); S.st.dropouts += 3; dropRandom(S, 3); }
    if (m === 3 && c.titr === 'open') { S.notes.push({ sev: 'bad', who: 'Jonas', t: 'Sites har opdaget, at nogle patienter bliver på 1,2 mg-pennen i måned 3. De ved nu, hvem der får lavdosis. Blindingen mellem doserne er brudt.' }); penal(S, 20, 'Titration design reveals low-dose arm', true); log(S, 'Jonas', 'Blinding breach: dose-labelled pens reveal low dose.', 'bad'); }
    if (m === 4 && c.kitlist === 'seq') { S.notes.push({ sev: 'bad', who: 'Birgitte', t: 'En CRA har skrevet i en mail, at "alle kits over 2400 er nok placebo". Hun har ret. Kit-listen skal genereres på ny, og blindingen er kompromitteret for de første patienter.' }); penal(S, 15, 'Sequential kit numbers reveal placebo', true); log(S, 'Birgitte', 'Blinding breach: sequential kit numbers. New kit list ordered.', 'bad'); unlock(S, 'kitliste'); }
    // Fejl fra build, der ikke blev fundet i UAT
    const D = S.defects;
    if (m === 3 && D.D4 && !D.D4.found && !D.D4.surfaced) {
      D.D4.surfaced = true;
      S.notes.push({ sev: 'bad', who: 'Jonas', t: `Afstemning mod EDC viser, at T2D-stratum er byttet om i systemet for alle ${S.patients.length} patienter. Randomiseringen står ved magt, men alle er fejlstratificeret og skal dokumenteres. Leverandøren retter det i en ny version.` });
      penal(S, 8, 'Stratum mapping defect from build (not found in UAT)'); log(S, 'Vendor', 'Hotfix: T2D stratum mapping corrected.', 'bad'); unlock(S, 'fejlstrat');
    }
    if (m === 4 && D.D5 && !D.D5.found && !D.D5.surfaced) {
      D.D5.surfaced = true;
      S.notes.push({ sev: 'bad', who: 'Line', t: 'Prognosen sendte ingen trin 3-penne til sites. De første patienter på trin 3 blev mødt af tomme hylder. Fejlen var med fra build og er nu rettet.' });
      log(S, 'Vendor', 'Hotfix: forecast includes step 3.', 'bad');
    }
    if (m === 9 && D.D2 && !D.D2.found && !D.D2.surfaced) {
      D.D2.surfaced = true;
      S.notes.push({ sev: 'bad', who: 'Line', t: `Systemet har regnet do-not-dispense i måneder i stedet for dage. Kits med under 35 dage tilbage er blevet udleveret. ${S.st.expDisp ? 'Det gælder ' + S.st.expDisp + ' udleveringer.' : ''}` });
      penal(S, 6, 'Expiry calculation defect from build'); log(S, 'Vendor', 'Hotfix: do-not-dispense calculated in days.', 'bad');
    }
    S.snap = null; S.snap = JSON.stringify(S);
    S.phase = 'month';
  }

  function dropRandom(S, n) { for (let i = 0; i < n; i++) { const act = S.patients.filter(p => !p.out); if (act.length) act[Math.floor(rand() * act.length)].out = true; } }

  function rewind(S) { const T = JSON.parse(S.snap); T.rewinds = S.rewinds + 1; T.snap = S.snap; return T; }

  // ---------- Valg undervejs ----------
  // Hver måned har en eller flere sager. Sagen (titel, tekst, handlinger) er systemets og står på engelsk.
  // Personerne og det, der sker bagefter, er på dansk.
  const EVENTS = {
    1: [{ id: 'akt', card: 'aktivering', title: 'Site 101 requests activation', who: 'Mette',
      text: 'Site 101 (Aarhus) has its first participant scheduled tomorrow morning. Ethics approval arrived by email but has not been entered, so the site is not activated in the system.',
      quote: 'Kan du ikke bare trykke på knappen? Det er jo godkendt.',
      options: [
        { id: 'a', label: 'Override: activate site manually now', after: 'Patienten er randomiseret kl. 8.04. Birgitte fra QA har sat et flueben i sin notesbog.', fx: S => penal(S, 5, 'Site activated before regulatory approval was documented') },
        { id: 'b', label: 'Enter the approval first and let the system activate the site', after: 'Det tager to dage. Patienten kommer igen torsdag, lidt fortørnet, men randomiseret efter bogen.', fx: S => { S.mods.site0Slow = true; } },
        { id: 'c', label: 'Allow paper randomization, enter it afterwards', after: 'Der findes ingen papirliste. Sitet improviserer. Jonas får hikke.', fx: S => penal(S, 12, 'Randomization performed outside the system') }
      ] }],
    2: [{ id: 'fejlstrat', card: 'fejlstrat', title: 'Mis-stratification at site 302', who: 'Jonas',
      text: 'Site 302 (Madrid) randomized a participant in stratum BMI < 35. EDC shows BMI 37.2. Data entry error at screening.',
      quote: 'Patienten er randomiseret og har fået sin første pen. Spørgsmålet er, hvad vi gør nu.',
      options: [
        { id: 'a', label: 'Re-randomize the participant in the correct stratum', after: 'Systemet tillader det med en override. Patienten har nu to randomiseringsnumre og to behandlinger i historikken. Jonas har lukket sin dør.', fx: S => penal(S, 12, 'Participant randomized twice') },
        { id: 'b', label: 'Correct the stratum in RTSM to match EDC', after: 'Rettelsen står i audit trail. Men blokken i det gamle stratum har nu et hul, og det nye stratum har en patient, det aldrig har tildelt. Listen passer ikke længere med virkeligheden.', fx: S => penal(S, 7, 'Stratum changed after randomization') },
        { id: 'c', label: 'Keep randomization, correct EDC, log a protocol deviation', after: 'Patienten fortsætter i sin arm. Statistikerne analyserer efter det stratum, der blev brugt ved randomiseringen, og nævner det i rapporten. Kedeligt og korrekt.', fx: S => {} }
      ] },
      { id: 'sentinel', card: 'kohorte', title: 'PMDA: sentinel cohort in Japan', who: 'Jonas',
      text: 'The Japanese authority requires a sentinel cohort: the first 6 Japanese participants are dosed through titration step 2, followed by a safety review before further Japanese participants may be randomized. Expected review: end of month 3.',
      quote: 'Seks patienter, så stop. Lyder enkelt. Det plejer det at gøre.',
      options: [
        { id: 'a', label: 'Configure a cohort cap for Japan that opens on sponsor approval', after: 'Systemet stopper Japan ved seks og viser sites en venteliste. Da review-komitéen godkender, åbner studieteamet kohorten med ét klik, og det står i audit trail.', fx: S => { S.mods.jpCohort = { cap: 6, until: 4 }; } },
        { id: 'b', label: 'Ask the CRA to tell Japanese sites to stop after six', after: 'Mailen når frem til to af tre sites. Site 603 randomiserer patient 7 og 8, før nogen opdager det.', fx: S => { S.mods.jpCohort = { cap: 8, until: 4 }; penal(S, 8, 'Two participants randomized in Japan before the sentinel safety review'); } },
        { id: 'c', label: 'Close Japan entirely until the review is done', after: 'Japan står stille i to måneder, også de sites, der havde patienter klar til at blive kohortens første seks.', fx: S => { S.mods.pause.JP = [2, 3]; } }
      ] }],
    3: [{ id: 'titr', card: 'aendring', title: 'Dose hold request, site 205', who: 'Dr. Weber',
      text: 'A participant at site 205 (Hamburg) is due to move from step 2 to step 3 today but has had nausea for two weeks. The protocol allows one additional month on step 2. That rule was not in the specification, so the system will dispense a step 3 pen.',
      quote: 'Jeg vil ikke give hende den højere dosis i dag. Hvad gør jeg?',
      options: [
        { id: 'a', label: 'Change request: add the protocol dose hold to the configuration', after: 'Leverandøren bygger reglen på tre dage som en ny version af konfigurationen, testet og godkendt. Patienten får sin trin 2-pen ved et ikke-planlagt besøg, og fremtidige patienter kan få det samme.', fx: S => { S.mods.titrFix = true; S.st.extraKr += 150000; } },
        { id: 'b', label: 'Site dispenses a step 2 pen from the shelf outside the system', after: 'Patienten er glad. Systemet tror, at pennen stadig står på hylden, og lagerregnskabet har nu et hul.', fx: S => { penal(S, 6, 'Kit dispensed outside the system'); unlock(S, 'accountability'); } },
        { id: 'c', label: 'Follow the system: participant moves to step 3', after: 'Patienten kaster op i en uge og trækker sig fra studiet. Dr. Weber skriver en lang mail til medical monitor.', fx: S => { penal(S, 5, 'Protocol dose hold could not be applied'); S.st.dropouts++; dropRandom(S, 1); } }
      ] }],
    4: [{ id: 'temp', card: 'temp', title: 'Temperature excursion, Brazil', who: 'Line',
      text: 'Data loggers at the Brazilian sites show 14 °C for 9 hours during a power outage. Labelled storage condition: 2 to 8 °C.',
      quote: 'Stabilitetsdata dækker måske udsvinget. Måske.',
      options: [
        { id: 'a', label: 'Quarantine affected kits pending QA stability assessment', after: 'Systemet springer kittene over og bestiller erstatning med det samme. Efter tre uger frigiver QA dem igen: stabilitetsdata dækker udsvinget.', fx: S => { S.mods.quar = 4; } },
        { id: 'b', label: 'Continue dispensing', after: 'Ingen opdager noget i en måned. Så kommer loggerdata med i en rutinegennemgang.', fx: S => penal(S, 10, 'Kits dispensed after temperature excursion without assessment') },
        { id: 'c', label: 'Destroy all stock at Brazilian sites', after: 'Det er sikkert. Det er også tomme hylder, indtil nye penne er gennem tolden.', fx: S => { S.sites.filter(s => s.c === 'BR').forEach(s => VARIANTS.forEach(v => { S.st.waste += s.stock[v][0] + s.stock[v][1]; s.stock[v] = [0, 0]; })); } }
      ] }],
    5: [{ id: 'afbl', card: 'nodafbl', title: 'Emergency unblinding, site 602', who: 'Dr. Tanaka',
      text: '02:40 local time (Osaka). A participant has been admitted with acute pancreatitis. The treating physician needs to know whether the participant is on active drug.',
      quote: 'Jeg har brug for svaret nu, ikke i morgen.',
      options: [
        { id: 'a', label: 'Investigator performs emergency unblinding in the system', after: 'Det tager to minutter. Kun investigatoren ser behandlingen. Studieteamet får besked om, at en afblinding er sket, men ikke hvad den viste.', fx: S => d1(S) },
        { id: 'b', label: 'Investigator calls the study team, who contact the statistician', after: 'Jonas sover. Efter fire timer får lægen svaret, og nu ved tre personer i det blindede studieteam det også.', fx: S => { penal(S, 8, 'Blinded study team became aware of treatment', true); d1(S); } },
        { id: 'c', label: 'Treat as if on active drug, do not unblind', after: 'Patienten bliver rask. Men beslutningen om at afblinde er investigatorens, ikke din, og den ret står i protokollen.', fx: S => penal(S, 4, 'Emergency unblinding prevented by the study team') }
      ] }],
    6: [{ id: 'holdbar', card: 'holdbar', title: 'Shelf-life extension, batch 1', who: 'Line',
      text: 'New stability data extend the shelf life of batch 1 by six months. Labels still show the original expiry, mid month 8.',
      quote: 'En stor del af lageret i verden er batch 1. Uden forlængelse ryger det hele.',
      options: [
        { id: 'a', label: 'Relabel, then update expiry in the system after QP release', after: 'Ommærkningen koster 400.000 kr. og tre ugers koordinering. Batch 1 kan bruges resten af studiet.', fx: S => { S.mods.b1Exp = B1_EXP + EXTEND; S.st.extraKr += 400000; } },
        { id: 'b', label: 'Update expiry in the system now, relabel later', after: 'System og etiketter er nu uenige. Det opdager en farmaceut i Hamborg efter en uge, og hun skriver til myndighederne.', fx: S => { S.mods.b1Exp = B1_EXP + EXTEND; penal(S, 10, 'Expiry updated in system without relabelling and release'); } },
        { id: 'c', label: 'Let batch 1 expire as planned', after: 'Batch 2 tager over. Det, der står tilbage af batch 1, destrueres.', fx: S => {} }
      ] },
      { id: 'transfer', card: 'transfer', title: 'Possible duplicate participant, site 405', who: 'Mette',
      text: 'Site 405 (Chicago) is screening a participant. The duplicate check matches date of birth and initials with participant 402-0117, randomized at site 402 (Boston) in month 3 and since lost to follow-up. The participant has moved.',
      quote: 'Hun vil gerne fortsætte. Hun var glad for medicinen, siger hun.',
      options: [
        { id: 'a', label: 'Transfer 402-0117 to site 405. No new randomization.', after: 'Patienten fortsætter som den samme patient med samme randomisering og arm. Systemet flytter historikken, og site 405 overtager. Ingen ved, hvad hun fik, og sådan skal det være.', fx: S => {} },
        { id: 'b', label: 'Screen and randomize as a new participant', after: 'Hun får et nyt nummer og en ny arm. I databasen er hun nu to personer, og den ene har to behandlinger. Det finder data management i måned 11.', fx: S => penal(S, 10, 'Same participant randomized twice under two IDs') },
        { id: 'c', label: 'Decline: participant has left the study', after: 'Hun går. Det er ikke forkert, men protokollen tillod at fortsætte, og nu mangler hendes data.', fx: S => penal(S, 2, 'Eligible transfer declined, data lost') }
      ] }],
    7: [{ id: 'dsmb', card: 'aendring', title: 'DSMB recommendation: close 2.4 mg arm', who: 'Jonas',
      text: 'The DSMB recommends closing the 2.4 mg arm to new participants due to GI tolerability. Participants already on 2.4 mg continue. New allocation ratio 2:1 (1.2 mg : placebo).',
      quote: 'Jeg kan have nye lister klar i morgen. Det er sådan set resten, der er svært.',
      options: [
        { id: 'a', label: 'New configuration version: close the arm, kits remain blinded', after: 'Ændringen testes og går i produktion uden nedetid. Sites mærker ingenting. Nye patienter fordeles 2:1.', fx: S => { S.mods.hDrop = S.month; S.queues = {}; } },
        { id: 'b', label: 'Send sites a list of kit numbers that must no longer be dispensed', after: 'Listen virker. Nu ved alle sites også præcis, hvilke kits der er 2,4 mg.', fx: S => { S.mods.hDrop = S.month; S.queues = {}; penal(S, 18, 'Sites received list of 2.4 mg kit numbers', true); } },
        { id: 'c', label: 'Pause randomization until the next planned release (6 weeks)', after: 'Sites venter. Nogle patienter går til et andet studie i mellemtiden.', fx: S => { S.mods.hDrop = S.month; S.queues = {}; S.mods.pause.all = [7, 8]; } }
      ] }],
    8: [{ id: 'us', card: 'loft', title: 'Enrollment surge, United States', who: 'Mette',
      text: 'A competing study has closed. US sites now expect three times as many referrals.',
      quote: 'Vi kan blive færdige før tid! Hvad venter vi på? (Line ser ikke glad ud.)',
      options: [
        { id: 'a', label: 'Keep enrolling and order an extra batch now', after: 'Produktionen er bestilt og ankommer om to måneder. Den koster 1,5 mio. kr.', fx: S => { S.mods.usBoost = 2.6; S.mods.extra.push({ m: S.month + 2, f: .18 }); S.st.extraKr += 1500000; } },
        { id: 'b', label: 'Keep enrolling and raise safety stock everywhere', after: 'Sites fyldes op. Line sover lidt bedre, depotet lidt dårligere.', fx: S => { S.mods.usBoost = 2.6; S.cfg.buf = Math.min(3, S.cfg.buf + 1); } },
        { id: 'c', label: 'Configure a country cap: max 40 % of participants per country', after: 'Loftet ligger i konfigurationen og håndhæves automatisk. Mette synes, du er en lyseslukker.', fx: S => { S.mods.usBoost = 2.6; S.mods.usCap = true; } }
      ] }],
    9: [{ id: 'kitfejl', card: 'kitfejl', title: 'Wrong kit dispensed, site 404', who: 'Line',
      text: 'Site 404 (Boston) dispensed kit 40817 to a participant. The system had assigned that kit to another participant the same morning.',
      quote: 'Begge patienter har nu hinandens penne. Den ene ved det ikke endnu.',
      options: [
        { id: 'a', label: 'Record the misallocation and let the system assign a replacement', after: 'Systemet noterer fejlen og viser kun det ublindede team, om patienten har fået en anden behandling. Der skrives en protokolafvigelse, og patienten får det rigtige kit.', fx: S => d3(S) },
        { id: 'b', label: 'Swap the two kit numbers in the system so records match', after: 'Nu passer tallene. Men audit trail viser, at historikken er ændret bagefter, og ingen kan se, hvad patienten egentlig fik.', fx: S => penal(S, 10, 'Dispensation record altered retrospectively to hide error') },
        { id: 'c', label: 'No action', after: 'Det var ikke samme slags pen. Den ene patient tog placebo i fire uger, uden at nogen registrerede det.', fx: S => penal(S, 8, 'Misallocation not recorded') }
      ] }],
    10: [{ id: 'import', card: 'import', title: 'Import license renewal, Japan', who: 'Line',
      text: 'The Japanese import license must be renewed. Expected processing time: 8 weeks. No shipments to Japan during that period. Participants in treatment still need drug.',
      quote: 'Vi har én forsendelse tilbage, før døren lukker.',
      options: [
        { id: 'a', label: 'Ship two months of demand to Japanese sites now', after: 'Hylderne i Osaka og Tokyo er fyldt. Det er dyrt, og noget kommer måske retur. Men ingen går forgæves.', fx: S => { S.mods.jpBlock = [11, 12]; S.mods.jpPre = true; } },
        { id: 'b', label: 'Stop enrollment in Japan and wait', after: 'Nye patienter venter. Dem, der er i behandling, skal klare sig med det, der står på hylden.', fx: S => { S.mods.jpBlock = [11, 12]; S.mods.pause.JP = [11, 12]; } },
        { id: 'c', label: 'Let resupply run as normal', after: 'Systemet bestiller som altid. Forsendelserne står i lufthavnen.', fx: S => { S.mods.jpBlock = [11, 12]; } }
      ] },
      { id: 'rescreen', card: 'rescreen', title: 'Re-screening, site 304', who: 'Dr. Ortega',
      text: 'Site 304 (Valencia) wants to re-screen a participant who failed screening in month 7 on HbA1c. The protocol allows one re-screening. The site has created a new subject ID.',
      quote: 'Hun opfylder kriterierne nu. Jeg har bare oprettet hende igen, det var hurtigst.',
      options: [
        { id: 'a', label: 'Link the new screening to the original subject ID as a re-screen', after: 'Systemet registrerer det som re-screening nummer ét og ville have afvist et nummer to. Sporbarheden er intakt, og hun bliver randomiseret samme uge.', fx: S => {} },
        { id: 'b', label: 'Accept the new subject ID as is', after: 'Hun er nu to personer i systemet: en screenfejl og en ny patient. Data management sender en query, der tager tre uger at lukke.', fx: S => penal(S, 4, 'Re-screened participant registered under new ID without link') },
        { id: 'c', label: 'Reject: a screen failure is final', after: 'Hun går hjem. Protokollen tillod det, så det var et valg, ikke en regel.', fx: S => {} }
      ] }],
    11: [{ id: 'roller', card: 'roller', title: 'Report request from blinded CRA', who: 'CRA, Spanien',
      text: 'The CRA for site 303 requests a report showing kit type per participant to reconcile site inventory at her next visit.',
      quote: 'Det er bare en rapport. Den findes jo allerede i systemet.',
      options: [
        { id: 'a', label: 'Run the unblinded report and send it', after: 'Hun takker. Rapporten ligger nu i hendes indbakke, på hendes bærbare og i et delt drev.', fx: S => penal(S, 15, 'Unblinded report sent to blinded monitor', true) },
        { id: 'b', label: 'Send the blinded report; kit types reconciled by the unblinded supply role', after: 'Hun får kit-numre, status og datoer. Det er alt, hun skal bruge. Line tager kit-typerne.', fx: S => {} },
        { id: 'c', label: 'Ask her to count the pens manually', after: 'Hun gør det. Det tager en dag og passer på to nær.', fx: S => penal(S, 2, 'Manual reconciliation without system support') }
      ] }],
    12: [{ id: 'insp', card: 'audit', title: 'Regulatory inspection announced', who: 'Birgitte',
      text: 'The authority will inspect in two weeks and requests the audit trail for all manual changes and overrides in the system.',
      quote: 'Vi viser, hvad vi har. Det er hele pointen med en audit trail.',
      options: [
        { id: 'a', label: 'Provide the audit trail as is, with explanations', after: 'Inspektøren læser i tre timer og stiller fire spørgsmål. Alle kan besvares.', fx: S => {} },
        { id: 'b', label: 'Tidy up the comments first', after: 'Systemet logger også, at kommentarerne er ændret. Inspektøren finder det på side to.', fx: S => penal(S, 15, 'Audit trail comments edited before inspection') }
      ] }]
  };

  function d1(S) {
    const D = S.defects.D1;
    if (D && !D.found) { D.surfaced = true; penal(S, 15, 'Unblinding notification with treatment arm sent to study team (build defect)', true);
      S.after[S.cur].extra = 'Men: notifikationsmailen indeholdt behandlingsarmen og gik til 14 personer i studieteamet. Fejlen var med fra build og blev ikke fanget i UAT.'; log(S, 'Vendor', 'Hotfix: unblinding notification no longer shows treatment arm.', 'bad'); }
  }
  function d3(S) {
    const D = S.defects.D3;
    if (D && !D.found) { D.surfaced = true; penal(S, 4, 'Replacement kit on wrong titration step (build defect)');
      S.after[S.cur].extra = 'Men: erstatningskittet var på trin 2 i stedet for trin 3. Endnu en afvigelse, og endnu en hotfix.'; log(S, 'Vendor', 'Hotfix: replacement kit follows participant step.', 'bad'); }
  }

  function eventsNow(S) { return EVENTS[S.month] || []; }
  function pending(S) { return eventsNow(S).some(e => !S.decided[e.id]); }

  function choose(S, evId, optId) {
    const E = eventsNow(S).find(e => e.id === evId); if (!E || S.decided[E.id]) return;
    const o = E.options.find(x => x.id === optId);
    S.cur = E.id; S.after[E.id] = { text: o.after };
    const n0 = S.pen.length;
    o.fx(S);
    S.decided[E.id] = optId;
    log(S, 'You', `${E.title}: ${o.label}.`, S.pen.length > n0 ? 'warn' : 'info');
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
        if (S.mods.jpCohort && site.c === 'JP' && m < S.mods.jpCohort.until && S.patients.filter(p => S.sites.find(x => x.id === p.s).c === 'JP').length >= S.mods.jpCohort.cap) break;
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
    if (H.missed > 0) log(S, 'System', `${H.missed} visits with no kit available.`, 'warn');
    if (H.waste > 0) log(S, 'System', `${H.waste} kits destroyed.`, 'warn');
    log(S, 'System', `Month ${m}: ${H.rand} randomized, ${H.ships} shipments.`);
    if (m >= MONTHS) finish(S); else startMonth(S);
  }

  // ---------- Status til dashboardet ----------
  function dash(S) {
    const m = S.month, day0 = 30 * (m - 1);
    const per = {}; VARIANTS.forEach(v => { per[v] = { central: S.central[v][0] + S.central[v][1], b1: S.central[v][0], sites: 0, empty: 0 }; });
    S.sites.forEach(s => { if (m < s.act) return; VARIANTS.forEach(v => { const n = onHand(S, s, v, day0); per[v].sites += n; if (n === 0 && m > s.act && forecastRaw(S, s, m, v) >= .5) per[v].empty++; }); });
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
    const groups = { 'All': () => true, 'BMI < 35': p => !p.b, 'BMI ≥ 35': p => p.b, 'No T2D': p => !p.d, 'T2D': p => p.d };
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
    if (c.method !== 'simple' && !c.factors.bmi) findings.push({ pts: 10, why: 'Randomization not stratified by BMI as required by protocol' });
    if (c.method !== 'simple' && !c.factors.t2d) findings.push({ pts: 10, why: 'Randomization not stratified by T2D as required by protocol' });
    if (c.method === 'simple') findings.push({ pts: 14, why: 'Simple randomization used instead of protocol-specified stratified randomization' });
    const B = balance(S), balPen = Math.round(clamp(B.max * 220, 0, 25));
    if (balPen >= 4) findings.push({ pts: balPen, why: `Treatment imbalance (largest deviation ${fmt(B.max * 100, 1)} %)` });
    let pred = 0;
    if (c.method === 'block' && c.bs === '5') pred = c.factors.site ? 8 : 3;
    if (pred) findings.push({ pts: pred, why: 'Predictable block size' });
    const missRate = S.st.missed / Math.max(1, S.st.visits);
    if (S.st.expDisp) findings.push({ pts: Math.min(14, Math.ceil(S.st.expDisp / 25)), why: `${S.st.expDisp} dispensations with insufficient shelf life for the visit interval` });
    const supply = Math.round(clamp(100 - missRate * 900 - S.st.blocked * .1, 0, 100));
    const integ = clamp(100 - findings.reduce((a, f) => a + f.pts, 0), 0, 100);
    const wasteKr = S.st.waste * KIT_KR, shipKr = S.st.ships * SHIP_KR, costKr = wasteKr + shipKr + S.st.extraKr;
    const waste = Math.round(clamp(100 - (costKr / 1e6 - 1.2) * 9, 0, 100));
    const lp = S.lpfv || 12;
    const time = Math.round(clamp(100 - Math.max(0, lp - (LPFV_TARGET - 1)) * 30 - (S.lpfv ? 0 : (TARGET - S.patients.length) / 6), 0, 100));
    const total = Math.round(integ * .4 + supply * .25 + waste * .15 + time * .2);
    S.end = { integ, supply, waste, time, total, findings, B, wasteKr, shipKr, costKr, lp, missRate };
    S.phase = 'end';
    log(S, 'System', 'Database lock. Treatment codes released for analysis.');
  }

  // Styring undervejs
  function setBuf(S, b) {
    if (b === S.cfg.buf) return;
    log(S, 'You', `${S.cfg.resup === 'pred' ? 'Safety stock' : 'Min/max level'} changed from ${BUFNAME[S.cfg.buf]} to ${BUFNAME[b]}.`);
    S.cfg.buf = b;
  }
  function canOrder(S) { return !S.mods.extra.some(e => e.m > S.month) && S.month <= MONTHS - 3; }
  function orderBatch(S) {
    if (!canOrder(S)) return;
    S.mods.extra.push({ m: S.month + 3, f: .15 }); S.st.extraKr += 1200000;
    log(S, 'You', `Additional production ordered (+15 %). Release in month ${S.month + 3}.`);
  }
  const BUFNAME = [null, 'low', 'medium', 'high'];

  function grade(t) {
    if (t >= 88) return ['Inspection ready', 'No critical findings. A study you can show anyone.'];
    if (t >= 75) return ['Solid', 'A few findings, all explainable. Most good studies look like this.'];
    if (t >= 60) return ['Completed with scars', 'The study holds, but the CSR gets an extra section on deviations.'];
    if (t >= 45) return ['Hard work for QA', 'Usable, but someone will be explaining a lot to the authorities.'];
    return ['Critical findings', 'The statisticians are unsure what the study can actually show.'];
  }

  const api = { eventsNow, pending, setBuf, canOrder, orderBatch, BUFNAME, newGame, goLive, startMonth, runMonth, choose, rewind, dash, balance, lint, specLines, stratCount, grade, fmt,
    EVENTS, DEFECTS, UAT, COUNTRIES, VARIANTS, VLABEL, STEP_OF, MMIN, MMAX, MONTHS, TARGET, LPFV_TARGET, KIT_KR,
    _seed(f) { rand = f; } };
  if (typeof module !== 'undefined') module.exports = api; else root.Engine = api;
})(this);
