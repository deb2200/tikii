# tikii 🗨️

Aplikacioni im personal për të mësuar gjuhë, në stilin e Duolingo-s. Ndërfaqja është në shqip.

## Çfarë ka

- **4 kurse:** anglisht (6 njësi), frëngjisht (4 njësi), gjermanisht (3 njësi), italisht (3 njësi)
- **Rruga e mësimeve:** njësi dhe mësime që hapen njëra pas tjetrës
- **Ushtrime të ndryshme:** zgjidh përkthimin, ndërto fjalinë me fjalë, shkruaj përkthimin, dëgjo dhe shkruaj, gjej çiftet
- **Zëri:** shqiptimi i fjalëve me zërin e shfletuesit (🔊 normal, 🐢 ngadalë)
- **XP, seria e ditëve 🔥 dhe qëllimi ditor**; zemrat ❤️ janë pa limit
- **Praktika:** përsërit fjalët ku ke gabuar më shumë
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

## 📡 Skaneri – pajisjet afër meje

Një aplikacion i dytë, i thjeshtë, te dosja `skaner/`: skanon pajisjet Bluetooth përreth (kufje, ora, telefona, TV…) dhe tregon fuqinë e sinjalit dhe largësinë e përafërt.

- Hape në telefon: `https://<emri-yt>.github.io/tikii/skaner/` dhe instaloje si aplikacion (⋮ → *Add to Home screen*).
- **Android + Chrome:** për skanimin e vazhdueshëm ndiz një herë `chrome://flags/#enable-experimental-web-platform-features` → *Enabled*. Pa këtë, punon butoni “Zgjidh pajisje” (lista e Chrome + lexon baterinë/prodhuesin kur pajisja lejon).
- **iPhone:** Safari nuk e lejon Bluetooth-in nga faqet; përdor aplikacionin falas **Bluefy**.
- Ndiz Bluetooth-in dhe Vendndodhjen. Faqja duhet të jetë në `https://` (GitHub Pages e ka).

## 🎧 Përkthyesi live – çdo gjuhë në shqip, në AirPods

Aplikacioni i tretë, te dosja `perkthyes/`. Dëgjon me mikrofonin e iPhone-it, e njeh vetë gjuhën (anglisht, gjermanisht, italisht, turqisht, arabisht…) dhe ta thotë përkthimin **shqip me zë në AirPods**, si një përkthyes simultan. Në ekran shfaqet edhe teksti origjinal dhe përkthimi.

- Hape në iPhone me Safari: `https://<emri-yt>.github.io/tikii/perkthyes/` → Share → *Add to Home Screen*.
- Duhet një **çelës API i OpenAI** (platform.openai.com → API keys, me kredit te Billing). Vendose te ⚙️; ruhet vetëm në telefonin tënd. Paguhet sipas minutave të përdorura.
- Përdor modelin `gpt-realtime-2` (zë-në-zë, pa hapa të ndërmjetëm, ~1 sekondë vonesë). Nëse nuk punon, te ⚙️ vendos `gpt-realtime`.
- Te ⚙️ zgjedh shpejtësinë e reagimit (⚡ maksimale / 🚀 e shpejtë / 🎯 e saktë), zërin dhe shpejtësinë e të folurit.
- Mikrofoni: aplikacioni zgjedh vetë mikrofonin e iPhone-it, që AirPods të mbeten vetëm për dëgjim (si *Live Listen*). Mbaje telefonin afër folësit.
- Ekrani mbahet ndezur gjatë përkthimit: iOS e ndal mikrofonin e faqeve kur kyçet ekrani.
