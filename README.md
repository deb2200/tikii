# tikii 🗨️

Aplikacioni im personal për të mësuar gjuhë, në stilin e Duolingo-s. Ndërfaqja është në shqip.

## Çfarë ka

- **3 kurse:** anglisht (6 njësi), gjermanisht (3 njësi), italisht (3 njësi)
- **Rruga e mësimeve:** njësi dhe mësime që hapen njëra pas tjetrës
- **Ushtrime të ndryshme:** zgjidh përkthimin, ndërto fjalinë me fjalë, shkruaj përkthimin, dëgjo dhe shkruaj, gjej çiftet
- **Zëri:** shqiptimi i fjalëve me zërin e shfletuesit (🔊 normal, 🐢 ngadalë)
- **XP, seria e ditëve 🔥, qëllimi ditor dhe zemrat ❤️** (zemrat mund t'i çaktivizosh te Profili)
- **Praktika:** përsërit fjalët ku ke gabuar më shumë, pa harxhuar zemra
- **Fjalori:** lista e gjithë fjalëve që ke mësuar
- **Statistika** për javën e fundit
- **Funksionon offline** dhe mund të instalohet në telefon (PWA)
- **Ruajtja/ngarkimi i progresit** si skedar JSON (te Profili)

Progresi ruhet vetëm në shfletuesin tënd (localStorage). Nuk ka llogari, server apo reklama.

## Si ta hap

Nuk ka nevojë për instalim apo build. Mjafton një server statik:

```bash
python3 -m http.server 8000
# hap http://localhost:8000
```

### Në telefon (falas, me GitHub Pages)

1. Në GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, zgjidh degën dhe dosjen `/ (root)`.
2. Hap linkun `https://<emri-yt>.github.io/tikii/` në telefon.
3. **Android (Chrome):** menyja ⋮ → *Install app / Add to Home screen*.
   **iPhone (Safari):** butoni Share → *Add to Home Screen*.

## Si të shtosh fjalë ose mësime

Gjithë përmbajtja është te `js/courses.js`. Çdo mësim është një listë çiftesh:

```js
["Titulli i mësimit", [
  ["shqip", "english"],
  ["mirupafshim", "goodbye", ["bye"]], // elementi i tretë: përgjigje të tjera të pranueshme
]],
```

Ushtrimet krijohen automatikisht nga këto çifte. Mund të shtosh edhe një kurs të ri (p.sh. `fr`) me të njëjtën strukturë.

Pas ndryshimeve, rrit versionin `CACHE` te `sw.js` që telefoni të marrë përditësimin.

## Struktura

```
index.html        faqja
css/style.css     stilet (me modalitet të errët automatik)
js/courses.js     përmbajtja e kurseve
js/app.js         logjika e aplikacionit
sw.js             service worker (offline)
manifest.json     konfigurimi i PWA-së
icons/            ikonat
```
