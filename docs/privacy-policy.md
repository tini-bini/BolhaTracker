# Pravilnik o zasebnosti

Zadnja posodobitev: 5. april 2026

## BOLHA Sledilnik cen

BOLHA Sledilnik cen je razširitev za Google Chrome, namenjena lokalnemu spremljanju cen oglasov na spletnem mestu Bolha.

## Katere podatke razširitev uporablja

Razširitev lahko na straneh `https://www.bolha.com/*` prebere podatke oglasa, ki jih uporabnik želi spremljati, na primer:

- naslov oglasa
- ceno oglasa
- povezavo do oglasa
- sliko oglasa
- stanje razpoložljivosti oglasa
- ime prodajalca in povezane javno vidne podatke oglasa, če so prikazani na strani

Ti podatki se uporabljajo izključno za delovanje osnovne funkcije razširitve: spremljanje izbranih oglasov in zaznavanje sprememb cen.

## Kaj razširitev shranjuje

Razširitev podatke praviloma shranjuje lokalno v brskalniku uporabnika z uporabo Chrome Storage. To lahko vključuje:

- seznam spremljanih oglasov
- zgodovino cen
- uporabniške nastavitve
- opombe in oznake, ki jih doda uporabnik
- shranjene poglede in diagnostične nastavitve

Če uporabnik uporabi izbirno funkcijo varnostne kopije v Chrome Sync, se lahko izvoženi podatki seznama spremljanja shranijo v sinhronizirano shrambo istega prijavljenega Chrome profila.

Če uporabnik začne premium checkout ali obnovo dostopa, razširitev lahko z razvojnim oziroma produkcijskim payment backendom izmenja omejen nabor podatkov, potrebnih za preverjanje plačila in licence:

- kodo namestitve razširitve
- izbrani premium plan
- status checkout seje
- e-pošto nakupa in obnovitveno kodo, kadar uporabnik izrecno izvede obnovo dostopa
- podpisan entitlement odgovor, ki potrdi premium stanje za to napravo

## Česa razširitev ne počne

Razširitev:

- ne prodaja osebnih podatkov
- ne prenaša uporabniških podatkov tretjim osebam za oglaševanje
- ne uporablja podatkov za kreditno sposobnost ali posojanje
- ne zbira gesel, plačilnih podatkov ali podatkov za preverjanje pristnosti
- ne spremlja tipkanja, klikov ali zgodovine brskanja zunaj strani Bolha, potrebnih za delovanje razširitve

## Oddaljena koda in zunanji skripti

Razširitev ne uporablja oddaljene kode. Vsa JavaScript koda, potrebna za delovanje, je vključena neposredno v paket razširitve.

## Deljenje podatkov

Osnovni podatki seznama spremljanja se ne delijo z zunanjimi strežniki razvijalca. Izjema je premium checkout oziroma obnova dostopa, kjer se z backendom izmenjajo le podatki, potrebni za ustvarjanje checkout seje, potrditev plačila, podpis premium entitlementa in obnovo dostopa na novi napravi. Donacijska povezava PayPal.Me ostaja ločen, prostovoljen klik in ni del osnovnega delovanja razširitve.

## Hramba podatkov

Podatki ostanejo shranjeni v uporabnikovem brskalniku, dokler jih uporabnik ne izbriše, odstrani posameznih spremljanih oglasov, ponastavi razširitve ali odstrani razširitve.

## Otroci

Razširitev ni namenjena posebnemu zbiranju podatkov otrok.

## Spremembe pravilnika

Ta pravilnik se lahko posodobi, če se funkcionalnost razširitve spremeni. Na tej strani bo vedno objavljena najnovejša različica.

## Kontakt

Za vprašanja glede zasebnosti ali delovanja razširitve uporabite uradni kontakt ali podporni kanal, povezan z repozitorijem projekta:

`https://github.com/tini-bini/BolhaTracker`
