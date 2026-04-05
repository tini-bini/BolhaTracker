# BOLHA Sledilnik cen

Produkcijsko pripravljena razširitev Chrome MV3 za lokalno spremljanje cen oglasov na Bolhi, pregled trendov na seznamu spremljanja in prejemanje obvestil o padcih cen. Jedrni watchlist ostane lokalen, premium dostop pa uporablja strežniško preverjene entitemente in obnovo licence brez računa.

## Povzetek izdelka

- Vrsta izdelka: razširitev za brskalnik Chrome
- Ciljno okolje: Google Chrome 114+
- Ciljni uporabniki: kupci na Bolhi, preprodajalci in lovci na ugodne ponudbe, ki želijo lokalni seznam spremljanja
- Glavni poteki:
  1. Odprite oglas na Bolhi in ga dodajte na seznam spremljanja.
  2. V pojavnem oknu pregledujte, iščite, filtrirajte, označujte in osvežujte spremljane oglase.
  3. Na strani z nastavitvami upravljajte nastavitve, varnostne kopije v oblaku, diagnostiko, shranjene poglede in analitiko.

## Povzetek arhitekture

- `utils.js`: skupna domenska logika, normalizacija shrambe, podpisani entitlement cache, filtriranje, razvrščanje, analitika ter uvoz/izvoz
- `service-worker.js`: orkestracija v ozadju, načrtovano osveževanje, obvestila, varnostne kopije in obdelava izvajalnih sporočil
- `content.js`: most za izluščenje oglasa iz aktivnega zavihka
- `panel.js` + `panel.css`: vbrizgana plošča sledilnika na strani oglasa
- `popup.html` + `popup.js` + `popup.css`: glavno upravljalno središče seznama spremljanja
- `options.html` + `options.js` + `options.css`: nadzorna plošča za diagnostiko, kopije, poglede in analitiko
- `i18n.js`: lokalizirana besedila in pomočniki za oblikovanje uporabniških nizov
- `server/`: Express + SQLite zaledje za checkout, webhook/idempotency, signed entitlements in restore flow
- `scripts/`: orodja za validacijo izdaje, lint, preverjanje tipov in pakiranje
- `tests/`: unit, smoke in Playwright E2E testi kritičnih poti

## Lokalni razvoj

1. Klonirajte repozitorij.
2. V Chromu odprite `chrome://extensions`.
3. Omogočite način za razvijalce.
4. Kliknite `Load unpacked`.
5. Izberite korensko mapo repozitorija.

Za lokalni premium/mock checkout tok:

1. Zaženite `npm install`.
2. Za razvojni payment backend zaženite `npm run server:start`.
3. Po potrebi nastavite `BOLHA_PAYMENT_PROVIDER=stripe` ter Stripe okoljske spremenljivke za pravi checkout.

## Orodja za izdajo

Repo vsebuje samostojne skripte za validacijo in pakiranje, ki uporabljajo Python ter lokalni Node iz `.tools/`, kadar je na voljo.

- Lint: `python scripts/lint.py`
- Preverjanje tipov: `python scripts/typecheck.py`
- Unit testi: `npm run test:unit`
- Smoke testi: `npm run test:smoke`
- Playwright E2E: `npm run test:e2e`
- Izdelava ZIP paketa izdaje: `python scripts/build_release.py`
- Celovita validacija izdaje: `python scripts/validate_release.py`

Produkcijski extension build:

- nastavite `BOLHA_RELEASE_CHANNEL=production`
- nastavite `BOLHA_EXTENSION_API_ORIGIN=https://vas-backend.example`
- zaženite `python scripts/build_release.py`

Razvojni build ostane privzeto vezan na localhost in se shrani kot `-dev` artefakt.

## Pokritost preverjanja

- Preverjanje sintakse JavaScript za vsako vključeno datoteko `.js`
- Pokritost pogodb sporočil med `utils.js` in `service-worker.js`
- Preverjanje ujemanja DOM ID-jev za pojavno okno in nastavitve
- Pokritost signed entitlement verifikacije, restore tokov in webhook/idempotency pravil
- Ključni logični testi za:
  - validacijo podpornih PayPal.Me povezav za donacije
  - signed premium entitlement cache in varne downgrade poti
  - restore licence, checkout idempotency in max-install omejitve
  - normalizacijo shranjenih pogledov
  - filtriranje seznama spremljanja
  - izračune cenovne analitike

## Premium in plačila

- Premium checkout ustvari backend in se potrdi šele po strežniško verificiranem rezultatu.
- Razširitev lokalno hrani le podpisan entitlement cache, ne pa surovega premium flag-a brez verifikacije.
- Restore dostopa deluje brez računa: uporabnik vnese e-pošto nakupa in obnovitveno kodo.
- Donacije ostanejo ločene od premium unlock toka in še vedno uporabljajo preverjene PayPal.Me povezave.

Ročno ali avtomatizirano preverjanje plačil v razvoju uporablja lokalni mock checkout. Za pravi Stripe tok je treba nastaviti produkcijske okoljske spremenljivke in backend URL.

## Varnostna kopija v oblaku

- Izbirna varnostna kopija v Chrome Sync je na voljo na strani z nastavitvami.
- Kopija shrani izvožene podatke seznama spremljanja v deljeno shrambo po kosih.
- Obnova uporablja isto normalizirano pot uvoza kot ročni uvoz JSON.

## Koraki izdaje

1. Zaženite `python scripts/validate_release.py`.
2. Za javni release nastavite `BOLHA_RELEASE_CHANNEL=production` in `BOLHA_EXTENSION_API_ORIGIN=https://vas-backend.example`, nato ponovno zaženite `python scripts/build_release.py`.
3. Potrdite pot do artefakta, ki jo izpiše `build_release.py`.
4. Odprite ZIP paket v `dist/`.
5. Ročno naložite ZIP v Chrome Web Store Developer Dashboard.

## Ročni kontrolni seznam za nalaganje v Chrome Web Store

Glejte [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## Urejenost repozitorija

- Ustvarjeni ZIP paketi in lokalni predpomnilniki orodij so prezrti prek `.gitignore`
- V repozitoriju ni shranjenih skrivnosti ali poverilnic
- Trenutni artefakt izdaje se ustvari po potrebi in ni potrjen v repozitorij
