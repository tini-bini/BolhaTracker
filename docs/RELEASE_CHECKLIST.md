# Kontrolni seznam izdaje

## Pred nalaganjem

1. Zaženite `python scripts/validate_release.py`.
2. Potrdite, da obstaja `dist/bolha-price-tracker-v1.0.0.zip`.
3. V Chromu naložite razpakirano razširitev in izvedite osnovni preizkus:
   - pojavno okno se odpre
   - zaznavanje oglasa na trenutni strani deluje na pravem oglasu na Bolhi
   - delujejo tokovi spremljanja, osvežitve, odstranitve ter shranjevanja opomb in oznak
   - gumb za podporo odpre stran PayPal.Me
   - stran z nastavitvami se odpre in gumbi za varnostno kopijo v oblaku se pravilno izrišejo
4. Potrdite, da se ikone razširitve pravilno prikazujejo v velikostih 16/32/48/128.

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
5. Po potrebi posodobite besedila vnosa in posnetke zaslona.
6. Oddajte v pregled.

## Še vedno potrebni ročni vnosi

- metapodatki vnosa v Chrome Web Store in posnetki zaslona
- lokalizacija opisa v trgovini, če želite poleg besedila v uporabniškem vmesniku upravljati tudi besedilo v nadzorni plošči
- končni pregled izdajatelja in potrditev oddaje v nadzorni plošči

## Ročno preverjanje PayPala

1. V Chromu naložite razširitev.
2. Na oglasu Bolha odprite pojavno okno, stran z nastavitvami in ploščo na strani.
3. Kliknite vsak gumb za podporo.
4. Potrdite, da brskalnik odpre `https://paypal.me/TiniFlegar`.
5. Potrdite, da je gumb onemogočen, če je nastavljena povezava odstranjena ali namenoma pokvarjena v `utils.js`.
