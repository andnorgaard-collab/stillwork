# Stillwork (stillwork.dk)

Anders Nørgaard-Carlsens personlige site og hjem for hans små apps og projekter. Siden præsenterer ham som person, ikke som et studie.

Personlige præferencer (sprog, tone, ingen tankestreger) står i Claudes hukommelse og gentages ikke her. Filen her rummer kun det, der gælder for selve repoet.

Claude holder filen opdateret: når en ændring tilføjer, flytter eller fjerner en side, en tabel eller en konvention, opdateres CLAUDE.md i samme commit.

## Sådan arbejder vi
- Vis resultatet med et mobil-screenshot (ca. 390 px bredt).
- Alt arbejde skal ende i repoet. Filer, der kun ligger i arbejdsområdet, er væk, når sessionen slutter. Commit og push til `main`, når en ændring er færdig og tjekket.
- Vercel bygger og udgiver automatisk ved push til `main` (Hobby-plan). Domæne og DNS ligger hos Simply.com.

## Opbygning
- Ren statisk HTML, ingen build-step og ingen package.json. Hver side er en mappe med `index.html`.
- Fælles filer: `style.css` (identitet og design tokens), `site.js` (header, årstal, nav-prik), `favicon.svg`.
- Kernesiderne bruger det fælles header-markup med SVG-wordmark og nav (About, Work, Contact). Kopiér det fra en eksisterende side, når du laver en ny.
- `vercel.json` sætter `noindex`-headers. `middleware.js` beskytter `/mellemvangen` med Basic Auth via Vercel-miljøvariablerne `MELLEMVANGEN_USER` og `MELLEMVANGEN_PASS`.
- Vercel Web Analytics er lagt ind i `<head>` på alle sider. Tag det med på nye sider:
  ```html
  <script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
  <script defer src="/_vercel/insights/script.js"></script>
  ```

## Sider
| Sti | Hvad | Sprog | Bemærk |
|---|---|---|---|
| `/` | Forside med sloganet | en | Fælles stil |
| `/about/`, `/work/`, `/contact/` | Kernesider | en | Work viser projekterne |
| `/brand/` | Stillwork-identiteten | en | |
| `/projects/`, `/projects/holdaand/`, `/madtruck/` | Tidligere projekter | en | Billeder og video i `img/` og `video/` |
| `/sitefellow/` | Software-idé til håndværkere | en | Egen stil |
| `/coffeebuddies/` | Kaffe-rating-app | en | Egen Supabase-instans, egen stil |
| `/eagles/` | Dragør Eagles' check-in (tirsdag 20:00) | en | Holdets egen side. Tabeller `hoops_*`, SQL i `eagles/setup.sql` |
| `/talons/` | Offentlig demo-klon af Eagles | en | Det er den, Work linker til. Tabeller `talons_*` |
| `/foremind/` | Skjult salgsside for Foremind | da | Må aldrig linkes fra andre sider. `noindex` |
| `/mellemvangen/` | Privat byggesagsdashboard | da | Login og `noindex`. `data.js` opdateres dagligt af en planlagt opgave |

## Identitet
- Design tokens står øverst i `style.css` (papir, blæk, ember, cobalt, moss) med dark mode via `prefers-color-scheme`. Brug variablerne, ikke nye farver.
- Skrifter: Instrument Serif, Instrument Sans og IBM Plex Mono fra Google Fonts.
- Wordmarket er det originale serif-wordmark. Håndtegnede versioner er afvist.
- Sloganet skal stå med "still work" i den rækkefølge: "I like having fun, so I make things that are fun. Every now and then I have to remind myself: this is still work."
- Stillwork-siderne er på engelsk. Foremind og Mellemvangen er på dansk.
- Tonen er rolig, ærlig og uden salgssprog.

## Data
- Supabase-apps bruger den offentlige anon-nøgle i klienten. Sikkerheden ligger i row level security, så nye tabeller skal altid have RLS slået til og eksplicitte policies.
- Gem SQL for nye tabeller i appens mappe, som `eagles/setup.sql`.
- Læg aldrig hemmeligheder (service role-nøgler, adgangskoder) i repoet. De hører hjemme i Vercels miljøvariabler.

## Før push
- Tjek siden i mobilbredde og i både lys og mørk tilstand.
- Tjek, at links virker, og at skjulte sider ikke er kommet med i nav eller på Work.
