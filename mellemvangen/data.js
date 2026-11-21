/* Mellemvangen 59 · sagsdata. Opdateres dagligt kl. 10 af Claude.
   Priser er Claudes bedste estimat af markedspriser i København (inkl. moms), indtil rigtige tilbud erstatter dem. */
window.SAG = {
  updated: '2026-11-21T09:53',
  updatedNote: 'MUFF Byg bekræfter, at de byder. Dermed tre bydende: CPH Wood, MUFF Byg og Adamson Byg. Besigtigelsen 16/11 er holdt. Estimatet er uændret.',
  frame: 1700000,

  tasks: [
    {id:'p1',n:'Udbud hos tre bydende',tr:'Rådgiver',base:'2026-11-02',dur:28,deps:[],room:'hus',by:'Nordpil (Lyubomir)'},
    {id:'p2',n:'Besigtigelse med bydende',tr:'Rådgiver',base:'2026-11-16',dur:1,deps:[],room:'hus',by:'Nordpil'},
    {id:'p6',n:'Gjensidige: tilbud på sanering og anmeldelse',tr:'Bygherre',base:'2026-11-16',dur:21,deps:[],room:'kaelder',by:'Anders og Melanie'},
    {id:'p4',n:'Finansiering på plads',tr:'Bygherre',base:'2026-11-16',dur:21,deps:[],room:'hus',by:'Anders og Melanie'},
    {id:'p3',n:'Licitation og tilbudsgennemgang',tr:'Rådgiver',base:'2026-11-30',dur:8,deps:['p1'],room:'hus',by:'Nordpil'},
    {id:'p5',n:'Kontrakt med entreprenør',tr:'Bygherre',base:'2026-12-07',dur:5,deps:['p3','p4'],room:'hus',by:'Anders og Melanie'},
    {id:'p7',n:'Genhusning og nedpakning',tr:'Bygherre',base:'2026-12-14',dur:19,deps:['p5'],room:'hus',by:'Anders og Melanie'},
    {id:'t0',n:'Byggestart og afdækning',tr:'Tømrer',base:'2027-01-04',dur:3,deps:['p5','p7'],room:'hus',est:true},
    {id:'t1',n:'Asbestsanering',tr:'Asbest',base:'2027-01-04',dur:10,deps:['t0','p6'],room:'kaelder',est:true},
    {id:'t2',n:'Nedrivning, stueetage',tr:'Tømrer',base:'2027-01-04',dur:12,deps:['t1'],room:'alrum',est:true},
    {id:'t3',n:'Stålbjælke og murhuller',tr:'Murer',base:'2027-01-04',dur:8,deps:['t2'],room:'alrum',est:true},
    {id:'t4',n:'VVS, kloak og teknik i kælder',tr:'VVS',base:'2027-01-04',dur:14,deps:['t2'],room:'kaelder',est:true},
    {id:'t5',n:'El: tavle og føringer',tr:'El',base:'2027-01-04',dur:10,deps:['t3'],room:'alrum',est:true},
    {id:'t6',n:'Altandøre, murpille og dør til udestue',tr:'Murer',base:'2027-01-04',dur:12,deps:['t3'],room:'stue',est:true},
    {id:'t7',n:'Værelsesopdeling, 1. sal',tr:'Tømrer',base:'2027-01-04',dur:10,deps:['t2'],room:'vaer',est:true},
    {id:'t8',n:'Gulvvarme og undergulv',tr:'VVS',base:'2027-01-04',dur:12,deps:['t4','t5'],room:'alrum',est:true},
    {id:'t9',n:'Bad 1. sal (omfang afklares)',tr:'Murer',base:'2027-01-04',dur:30,deps:['t4'],room:'bad1',est:true},
    {id:'t10',n:'Nyt bad i stueetagen',tr:'Murer',base:'2027-01-04',dur:25,deps:['t8'],room:'bad0',est:true},
    {id:'t11',n:'Dinesen fyrregulv',tr:'Tømrer',base:'2027-01-04',dur:12,deps:['t8'],room:'stue',est:true},
    {id:'t12',n:'Køkkenmontage, Nordiska Kök',tr:'Tømrer',base:'2027-01-04',dur:8,deps:['t11'],room:'alrum',est:true},
    {id:'t13',n:'Maler, alle rum',tr:'Maler',base:'2027-01-04',dur:16,deps:['t12','t10','t9','t6','t7'],room:'hus',est:true},
    {id:'t14',n:'Aflevering og gennemgang',tr:'Fælles',base:'2027-01-04',dur:1,deps:['t13'],room:'hus',est:true}
  ],

  actions: [
    {id:'A20',t:'Adamson Byg: overslag senest fredag 20/11',s:'Cihan lover overslaget i denne uge. Deles med Nordpil, som aftalt med Lyubomir',who:'Adamson Byg',status:'Afventer andre',due:'2026-11-20'},
    {id:'A19',t:'Spørgsmål til Lyubomir efter besigtigelsen',s:'Alternativpriser mangler i tilbudslisten (radiatorer, andet gulv, døre, armaturer, facade). Bad 1. sal skal afklares',who:'Anders og Melanie',status:'Åben',due:'2026-11-18'},
    {id:'A05',t:'Licitation: tilbud modtages 30/11 kl. 12:30',s:'Bydende: CPH Wood og MUFF Byg, plus Adamsons overslag. Nordpil sammenligner tilbud og forbehold med jer',who:'Nordpil',status:'Afventer andre',due:'2026-11-30'},
    {id:'A08',t:'Gjensidige asbestsag',s:'2 til 3 tilbud fra autoriserede saneringsfirmaer plus et VVS-tilbud før kravet anmeldes. Ingen sanering før samtykke (§3.4)',who:'Anders og Melanie',status:'Åben',due:'2026-12-07'},
    {id:'A09',t:'Finansiering før kontrakt i uge 50',s:'Ingen mail om Danske Bank, Nykredit eller Nordea siden juni',who:'Anders og Melanie',status:'Åben',due:'2026-12-07'},
    {id:'A10',t:'Besparelsesliste til tilbudsgennemgangen',s:'Rammen på 1,7 mio. kr. holdes. Se forslag under Økonomi',who:'Anders og Melanie',status:'Åben',due:'2026-11-30'},
    {id:'A13',t:'Genhusning og nedpakning',s:'Klar før byggestart uge 1 2027, helst inden for 5 km af Vanløse Privatskole',who:'Anders og Melanie',status:'Åben',due:'2026-12-31'},
    {id:'A14',t:'Bad 1. sal: sidste udeståender om indretning',s:'Frederik mener ikke, de påvirker tilbudsprisen',who:'Anders og Melanie',status:'Åben',due:'2026-12-07'}
  ],

  decisions: [
    {id:'d1',q:'Hvilke besparelser tager I med til tilbudsgennemgangen?',ctx:'Estimatet ligger over rammen. Listen bruges, hvis tilbuddene også gør.',task:'p3',lead:0,room:'hus',opts:['Funkis Kök i stedet for Nordiska Kök (ca. 60.000 kr.)','Egen nedrivning af ikke-bærende dele og egen maling (ca. 45.000 kr.)','Klinker i stedet for terrazzo i begge bade (ca. 30.000 kr.)','Kombination af alle tre'],status:'open'},
    {id:'d2',q:'Hvilken bank finansierer ombygningen?',ctx:'Lånet skal være på plads, før kontrakten underskrives.',task:'p5',lead:0,room:'hus',opts:['Danske Bank','Nykredit','Nordea'],status:'open'},
    {id:'d7',q:'Hvor bor I under ombygningen?',ctx:'Omkring 3 til 4 måneder.',task:'p7',lead:0,room:'hus',opts:['Lejebolig tæt på Vanløse Privatskole','Sommerhuset som kortsigtet løsning','Kombination: lejebolig, sommerhus i ferier'],status:'open'},
    {id:'d5',q:'Kogeplade i køkkenet',ctx:'Skal ligge fast, før Nordiska Kök bestilles, da udskæring og aftræk afhænger af den.',task:'t12',lead:70,room:'alrum',opts:['BORA X Pure Max (ca. 32.000 kr.)','BORA Professional 3.0 (ca. 38.000 kr.)'],status:'open'},
    {id:'d4',q:'Gulv i badeværelserne',ctx:'Murer skal kende opbygningen før vådrumsarbejdet.',task:'t9',lead:21,room:'bad1',opts:['Terrazzo med hulkehl (ca. +15.000 kr. pr. bad)','Klinker 30×60','Mikrocement (ca. +6.000 kr. pr. bad)'],status:'open'},
    {id:'d6',q:'Overfladebehandling af Dinesen fyrregulv',ctx:'Dinesen skal vide det ved bestilling.',task:'t11',lead:45,room:'stue',opts:['Hvidpigmenteret sæbe','Hårdvoksolie, natur','Mat lak'],status:'open'},
    {id:'k1',q:'Arkitekt og udbud',choice:'Nordpil kører udbuddet med tre bydende inden for honoraret',by:'Anders og Melanie',at:'2026-10-28',status:'done',room:'hus',task:'p1',lead:0,opts:[]},
    {id:'k2',q:'Myndighedsprojekt',choice:'Fravalgt, også for murhullerne',by:'Anders og Melanie',at:'2026-10-04',status:'done',room:'alrum',task:'p1',lead:0,opts:[]},
    {id:'k3',q:'Køkkenleverandør',choice:'Nordiska Kök, malet ask',by:'Anders og Melanie',at:'2026-11-14',status:'done',room:'alrum',task:'t12',lead:0,opts:[]},
    {id:'k4',q:'Huzar Construction som bydende',choice:'Frabedt, aftalt med Lyubomir',by:'Anders og Melanie',at:'2026-11-14',status:'done',room:'hus',task:'p1',lead:0,opts:[]},
    {id:'k5',q:'Glastag og ovenlys på udestuen',choice:'Taget ud af projektet af økonomiske grunde. Døren udvides stadig',by:'Anders og Melanie',at:'2026-11-01',status:'done',room:'udestue',task:'t6',lead:0,opts:[]}
  ],

  changes: [],

  deliveries: [
    {id:'l1',n:'Køkken, malet ask',who:'Bygherre',sup:'Nordiska Kök',task:'t12',off:0,lead:63,eta:null,status:'Ikke bestilt',room:'alrum',price:206000},
    {id:'l2',n:'Kogeplade BORA',who:'Bygherre',sup:'BORA-forhandler',task:'t12',off:0,lead:21,eta:null,status:'Afventer beslutning',waits:'d5',room:'alrum'},
    {id:'l3',n:'Stålbordplade, rundet kant',who:'Bygherre',sup:'Afventer valg af leverandør',task:'t12',off:2,lead:35,eta:null,status:'Ikke bestilt',room:'alrum'},
    {id:'l4',n:'Integreret køleskab og ovn',who:'Bygherre',sup:'Hvidevareforhandler',task:'t12',off:0,lead:14,eta:null,status:'Ikke bestilt',room:'alrum'},
    {id:'l5',n:'Sanitet og armaturer, to bade',who:'Bygherre',sup:'VVS-grossist',task:'t9',off:14,lead:14,eta:null,status:'Ikke bestilt',room:'bad1'},
    {id:'l6',n:'Gulvmateriale til bade',who:'Bygherre',sup:'Afhænger af valg',task:'t9',off:7,lead:21,eta:null,status:'Afventer beslutning',waits:'d4',room:'bad1'},
    {id:'l7',n:'Dinesen fyrregulv, smalle planker',who:'Entreprenør',sup:'Dinesen',task:'t11',off:0,lead:42,eta:null,status:'Ikke bestilt',room:'stue'},
    {id:'l8',n:'Stålbjælke',who:'Entreprenør',sup:'Stålgrossist, efter ingeniørberegning',task:'t3',off:0,lead:14,eta:null,status:'Ikke bestilt',room:'alrum'}
  ],

  log: [
    {d:'2026-11-18',who:'Lyubomir, Nordpil',txt:'MUFF Byg giver tilbud. De byder ud fra 3D-modellen uden besigtigelse.',vis:true},
    {d:'2026-11-17',who:'Lyubomir, Nordpil',txt:'God gennemgang med CPH Wood. Erch Entreprise eller Lund Junget var i spil, hvis MUFF Byg faldt fra.',vis:true},
    {d:'2026-11-16',who:'Anders',txt:'Besigtigelse holdt med CPH Wood. Bad Lyubomir sikre mindst tre reelle tilbud til 30/11.',vis:true},
    {d:'2026-11-16',who:'Adamson Byg (Cihan)',txt:'Overslaget er undervejs og kommer senest fredag 20/11.',vis:true},
    {d:'2026-11-15',who:'Claude',txt:'Udbudsmaterialet gennemgået. Tilbudslisten har 10 poster og 3 optioner, men ingen alternativpriser til besparelser.',vis:true},
    {d:'2026-11-14',who:'Anders',txt:'Telefonaftaler med Lyubomir: besigtigelse mandag 16/11 kl. 10, Adamsons overslag deles med Nordpil, Huzar er ude af udbuddet.',vis:true},
    {d:'2026-11-14',who:'Anders',txt:'Nordiska Kök er umiddelbart valgt: ca. 314.000 SEK (ca. 206.000 kr.) uden bordplade, hvidevarer og hylder. Nordpils fakturaer er betalt.',vis:true},
    {d:'2026-11-12',who:'Adamson Byg (Cihan)',txt:'Besigtigede huset uden Nordpil. Indledende overslag på vej.',vis:true},
    {d:'2026-11-03',who:'Lyubomir, Nordpil',txt:'Tre bydende bekræftet: CPH Wood, MUFF Byg og Adamson Byg. TP Murer meldte fra 2/11.',vis:true},
    {d:'2026-11-02',who:'Lyubomir, Nordpil',txt:'Udbudsmaterialet er godkendt og sendt i udbud. Licitation 30/11 kl. 12:30.',vis:true},
    {d:'2026-10-28',who:'Kim, Nordpil',txt:'Bekræftede skriftligt, at Nordpil kører hele udbuddet inden for honoraret. Gjorde opmærksom på, at budgettet er stramt.',vis:true},
    {d:'2026-10-26',who:'VIP Byg',txt:'Trak sig fra udbuddet.',vis:true},
    {d:'2026-10-23',who:'Melanie',txt:'Enkelte udeståender om badeværelset på 1. sal. Byggestart planlagt uge 1 2027.',vis:true},
    {d:'2026-10-04',who:'Melanie',txt:'Beslutning: I kører videre uden myndighedsprojekt.',vis:true},
    {d:'2026-09-21',who:'Milva',txt:'Miljøundersøgelse leveret. Forventes at indgå i udbudsmaterialet.',vis:true}
  ],

  defects: [],

  /* Budget: estimat inkl. moms. src: 'tilbud' når et rigtigt tilbud findes, ellers 'estimat'. */
  budget: [
    {g:'Hovedentreprise (udbud)',n:'1. Byggeplads og byggeledelse',lo:50000,hi:100000,est:70000,src:'estimat'},
    {g:'Hovedentreprise (udbud)',n:'2. Nedbrydning inkl. forsigtig optagning og opbevaring af gulv og døre',lo:40000,hi:80000,est:55000,src:'estimat'},
    {g:'Hovedentreprise (udbud)',n:'3. Kloak og spildevand',lo:25000,hi:55000,est:35000,src:'estimat'},
    {g:'Hovedentreprise (udbud)',n:'4. Tømrer: vægge, vådrumsdæk, altandøre, døre, Dinesen-gulv, repos, Velux, altanværn',lo:320000,hi:470000,est:390000,src:'estimat',note:'Dinesen 35x150 fyr i ca. 51 m² alene ca. 140.000 kr. Nye indvendige døre fremstillet som de originale'},
    {g:'Hovedentreprise (udbud)',n:'5. Murer: klinker bad, murpille, huller, overliggere, puds',lo:100000,hi:180000,est:135000,src:'estimat',note:'Pudsreetablering på alle facader vurderes ved besigtigelse: åben post'},
    {g:'Hovedentreprise (udbud)',n:'6. VVS: brugsvand, gulvvarme stueplan, afløb, VOLA-armaturer, toiletter',lo:170000,hi:270000,est:220000,src:'estimat',note:'Gulvvarme med shunt og Wavin AHC 9000 ca. 75.000 kr.'},
    {g:'Hovedentreprise (udbud)',n:'7. El efter el-rådgivers plan',lo:60000,hi:120000,est:85000,src:'estimat'},
    {g:'Hovedentreprise (udbud)',n:'8. Maler: alle indvendige vægge og lofter Q3, døre, udvendigt murværk',lo:90000,hi:170000,est:130000,src:'estimat',note:'Udvendig maling nævner alle fire facader: afklar omfang'},
    {g:'Hovedentreprise (udbud)',n:'9. Stål: bjælker, søjler, brandbeskyttelse',lo:45000,hi:85000,est:60000,src:'estimat'},
    {g:'Hovedentreprise (udbud)',n:'10. Slutrengøring',lo:5000,hi:12000,est:8000,src:'estimat'},
    {g:'Uafklaret i udbuddet',n:'Bad 1. sal: klinker, membran og sanitet',lo:80000,hi:160000,est:120000,src:'estimat',note:'Vist på tegningerne, men beskrivelsen dækker kun badet i stuen. Afklar inden 30/11'},
    {g:'Bygherre, uden for udbuddet',n:'Asbest- og PCB-sanering',lo:45000,hi:110000,est:75000,src:'estimat',note:'Søges dækket af Gjensidige ejerskifteforsikring'},
    {g:'Bygherre, uden for udbuddet',n:'Teknik i kælder: fjernvarmeunit, VVB, tavle',lo:80000,hi:120000,est:100000,src:'estimat',note:'Ikke med i udbuddet, kun føring til teknikskab'},
    {g:'Bygherre, uden for udbuddet',n:'Nordiska Kök, elementer i malet ask',lo:206000,hi:215000,est:206000,src:'tilbud',note:'Ca. 314.000 SEK, før prisregulering'},
    {g:'Bygherre, uden for udbuddet',n:'Stålbordplade, hvidevarer og BORA',lo:75000,hi:125000,est:100000,src:'estimat'},
    {g:'Bygherre, uden for udbuddet',n:'Køkkenmontage',lo:20000,hi:40000,est:30000,src:'estimat',note:'Alt køkkeninventar er bygherreleverance i udbuddet'},
    {g:'Bygherre, uden for udbuddet',n:'Badmøbler og spejle, begge bade',lo:15000,hi:40000,est:25000,src:'estimat'},
    {g:'Rådgivning',n:'Nordpil: projektering, udbud og tilsyn',lo:90000,hi:150000,est:120000,src:'estimat',note:'Afklar om honoraret ligger inden for rammen'},
    {g:'Reserve',n:'Uforudsete udgifter, ca. 8 %',lo:120000,hi:170000,est:150000,src:'estimat',note:'Gamle huse giver typisk overraskelser i bjælkelag og murværk'}
  ],
  options: [
    {n:'11.1 Varm skunk i tre værelser',lo:50000,hi:100000,est:70000},
    {n:'11.2 Nye vinduer og dør med original opsprosning',lo:150000,hi:260000,est:200000},
    {n:'11.3 Puds og klinker på udvendig trappe',lo:15000,hi:35000,est:25000}
  ],
  outside: [
    {n:'Genhusning, ca. 4 måneder',est:75000,note:'Ligger uden for byggebudgettet'}
  ],
  savings: [
    {n:'Radiatorer i stuen i stedet for gulvvarme, gulvvarme bevares i badet',save:55000},
    {n:'Massivt fyrregulv 35 mm fra anden leverandør end Dinesen, samme udtryk',save:35000},
    {n:'Genbrugte og standarddøre i stedet for nye døre fremstillet som de originale',save:20000},
    {n:'Armaturer i samme stil som VOLA, men billigere mærke',save:18000},
    {n:'Udvendig maling og puds kun ved murpille og reparationer, fast sum',save:40000},
    {n:'Egen indvendig maling efter spartling, egen nedpakning',save:50000},
    {n:'Funkis Kök i stedet for Nordiska Kök',save:60000}
  ],

  feed: [
    {d:'2026-11-18',who:'Nordpil',txt:'MUFF Byg byder. Tre bydende til licitationen.'},
    {d:'2026-11-16',who:'Anders',txt:'Besigtigelse holdt med CPH Wood.'},
    {d:'2026-11-16',who:'Adamson Byg',txt:'Overslag lovet senest fredag 20/11.'},
    {d:'2026-11-15',who:'Claude',txt:'Budget lagt om efter udbudsmaterialet.'},
    {d:'2026-11-15',who:'Claude',txt:'Estimat rettet: franske altaner og ovenlys tilføjet. Ny besparelsesliste.'},
    {d:'2026-11-15',who:'Claude',txt:'Oversigten flyttet over i Sitefellow-layoutet. Priser er estimater, indtil tilbuddene kommer 30/11.'},
    {d:'2026-11-14',who:'Anders',txt:'Lukkede tre punkter efter telefonsamtale med Lyubomir.'},
    {d:'2026-11-14',who:'Anders',txt:'Besluttede: Nordiska Kök som køkkenleverandør.'}
  ]
};
