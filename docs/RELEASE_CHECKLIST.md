# Kontrolni seznam izdaje

## Pred nalaganjem

1. Zaženite `python scripts/validate_release.py`.
2. Za javni release nastavite `BOLHA_RELEASE_CHANNEL=production` in `BOLHA_EXTENSION_API_ORIGIN=https://vas-backend.example`, nato zaženite `python scripts/build_release.py`.
3. Potrdite, da obstaja produkcijski artefakt `dist/bolha-price-tracker-v1.0.0.zip`.
4. V Chromu naložite razpakirano razširitev in izvedite osnovni preizkus:
   - pojavno okno se odpre
   - zaznavanje oglasa na trenutni strani deluje na pravem oglasu na Bolhi
   - delujejo tokovi spremljanja, osvežitve, odstranitve ter shranjevanja opomb in oznak
   - premium checkout odpre mock ali produkcijski checkout in se po sinhronizaciji pravilno odklene
   - restore premium dostopa z e-pošto in obnovitveno kodo deluje na novi napravi
   - gumb za podporo odpre stran PayPal.Me
   - stran z nastavitvami se odpre in gumbi za varnostno kopijo v oblaku se pravilno izrišejo
5. Potrdite, da se ikone razširitve pravilno prikazujejo v velikostih 16/32/48/128.

## Nalaganje v nadzorno ploščo Chrome Web Store

1. Odprite Chrome Web Store Developer Dashboard.
2. Izberite obstoječi vnos ali ustvarite novega.
3. Naložite `dist/bolha-price-tracker-v1.0.0.zip`.
4. Preverite samodejno zaznana dovoljenja:
   - `storage`
   - `notifications`
   - `alarms`
   - `tabs`
   - dovoljenje gostitelja za `https://www.bolha.com/*`
   - lokalni razvojni dostop do `http://127.0.0.1/*` in `http://localhost/*`, če pakirate razvojno/testno izdajo
5. Po potrebi posodobite besedila vnosa in posnetke zaslona.
6. Oddajte v pregled.

## Še vedno potrebni ročni vnosi

- metapodatki vnosa v Chrome Web Store in posnetki zaslona
- lokalizacija opisa v trgovini, če želite poleg besedila v uporabniškem vmesniku upravljati tudi besedilo v nadzorni plošči
- končni pregled izdajatelja in potrditev oddaje v nadzorni plošči

## Ročno preverjanje premium toka

1. V Chromu naložite razširitev.
2. Na oglasu Bolha odprite pojavno okno, stran z nastavitvami in ploščo na strani.
3. Zaženite premium checkout in v mock checkoutu zaključite uspešno plačilo.
4. Potrdite, da klik na preverjanje stanja odklene Premium in pokaže obnovitveno kodo.
5. Na drugi razvojni namestitvi izvedite restore z e-pošto in obnovitveno kodo.
6. Ločeno kliknite vsak gumb za podporo in potrdite, da odpre `https://paypal.me/TiniFlegar`.
