# BOLHA Sledilnik cen

Produkcijsko pripravljena razširitev Chrome MV3 za lokalno spremljanje cen oglasov na Bolhi, pregled trendov na seznamu spremljanja in prejemanje obvestil o padcih cen brez pošiljanja uporabniških podatkov v zaledni sistem.

## Povzetek izdelka

- Vrsta izdelka: razširitev za brskalnik Chrome
- Ciljno okolje: Google Chrome 114+
- Ciljni uporabniki: kupci na Bolhi, preprodajalci in lovci na ugodne ponudbe, ki želijo lokalni seznam spremljanja
- Glavni poteki:
  1. Odprite oglas na Bolhi in ga dodajte na seznam spremljanja.
  2. V pojavnem oknu pregledujte, iščite, filtrirajte, označujte in osvežujte spremljane oglase.
  3. Na strani z nastavitvami upravljajte nastavitve, varnostne kopije v oblaku, diagnostiko, shranjene poglede in analitiko.

## Povzetek arhitekture

- `utils.js`: skupna domenska logika, normalizacija shrambe, varnost povezav PayPal, filtriranje, razvrščanje, analitika ter uvoz/izvoz
- `service-worker.js`: orkestracija v ozadju, načrtovano osveževanje, obvestila, varnostne kopije in obdelava izvajalnih sporočil
- `content.js`: most za izluščenje oglasa iz aktivnega zavihka
- `panel.js` + `panel.css`: vbrizgana plošča sledilnika na strani oglasa
- `popup.html` + `popup.js` + `popup.css`: glavno upravljalno središče seznama spremljanja
- `options.html` + `options.js` + `options.css`: nadzorna plošča za diagnostiko, kopije, poglede in analitiko
- `i18n.js`: lokalizirana besedila in pomočniki za oblikovanje uporabniških nizov
- `scripts/`: orodja za validacijo izdaje, lint, preverjanje tipov in pakiranje
- `tests/`: avtomatizirani testi kritičnih poti

## Lokalni razvoj

1. Klonirajte repozitorij.
2. V Chromu odprite `chrome://extensions`.
3. Omogočite način za razvijalce.
4. Kliknite `Load unpacked`.
5. Izberite korensko mapo repozitorija.

Za trenutno lokalno izdajo niso potrebne nobene okoljske spremenljivke.

## Orodja za izdajo

Repo vsebuje samostojne skripte za validacijo in pakiranje, ki uporabljajo Python ter lokalni Node iz `.tools/`, kadar je na voljo.

- Lint: `python scripts/lint.py`
- Preverjanje tipov: `python scripts/typecheck.py`
- Testi: `.\.tools\node-v22.15.0-win-x64\node.exe --test tests\utils.test.js`
- Izdelava ZIP paketa izdaje: `python scripts/build_release.py`
- Celovita validacija izdaje: `python scripts/validate_release.py`

## Pokritost preverjanja

- Preverjanje sintakse JavaScript za vsako vključeno datoteko `.js`
- Pokritost pogodb sporočil med `utils.js` in `service-worker.js`
- Preverjanje ujemanja DOM ID-jev za pojavno okno in nastavitve
- Pokritost pomožnih funkcij za validacijo PayPal.Me
- Ključni logični testi za:
  - validacijo in sestavljanje povezav PayPal.Me
  - normalizacijo shranjenih pogledov
  - filtriranje seznama spremljanja
  - izračune cenovne analitike

## Ravnanje s PayPal.Me

- Povezave za podporo se pred uporabo preverijo.
- Sprejete so le povezave `https://paypal.me/...` ali `https://www.paypal.me/...`.
- Povezave s parametri, fragmenti, napačnimi gostitelji ali nepravilnimi uporabniškimi imeni se zavrnejo.
- Gumbi za podporo v pojavnem oknu in nastavitvah so onemogočeni, če ni veljavne povezave.
- Trenutno nastavljena povezava za podporo: `https://paypal.me/TiniFlegar`

Ročno preverjanje plačila še vedno zahteva sejo brskalnika in razpoložljivost PayPala. Repo implementira generiranje povezav in navigacijske poti, ne vsebuje pa poverilnic računa PayPal ali avtomatizacije dejanskega plačila.

## Varnostna kopija v oblaku

- Izbirna varnostna kopija v Chrome Sync je na voljo na strani z nastavitvami.
- Kopija shrani izvožene podatke seznama spremljanja v deljeno shrambo po kosih.
- Obnova uporablja isto normalizirano pot uvoza kot ročni uvoz JSON.

## Koraki izdaje

1. Zaženite `python scripts/validate_release.py`.
2. Potrdite pot do artefakta, ki jo izpiše `build_release.py`.
3. Odprite ZIP paket v `dist/`.
4. Ročno naložite ZIP v Chrome Web Store Developer Dashboard.

## Ročni kontrolni seznam za nalaganje v Chrome Web Store

Glejte [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## Urejenost repozitorija

- Ustvarjeni ZIP paketi in lokalni predpomnilniki orodij so prezrti prek `.gitignore`
- V repozitoriju ni shranjenih skrivnosti ali poverilnic
- Trenutni artefakt izdaje se ustvari po potrebi in ni potrjen v repozitorij
