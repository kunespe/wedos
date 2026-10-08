# Obchodní podmínky SERVERO.CZ

> **⚠ Šablona, před zveřejněním nechat zkontrolovat právníkem.**
> Údaje v hranatých závorkách doplnit. Rozhodnout, zda provozovatelem bude s.r.o. nebo OSVČ, a podle toho upravit článek 1.

Účinnost od: [DATUM]

## 1. Poskytovatel

| | |
|---|---|
| Obchodní firma / jméno | [NÁZEV s.r.o. / JMÉNO A PŘÍJMENÍ] |
| Sídlo / místo podnikání | [ADRESA], Plzeň |
| IČO | [IČO] |
| DIČ | [DIČ / neplátce DPH] |
| Zápis | [Obchodní rejstřík vedený Krajským soudem v Plzni, oddíl C, vložka XXXX / živnostenský rejstřík] |
| E-mail | podpora@servero.cz |
| Telefon | [TELEFON] |
| Web | servero.cz |

(dále „poskytovatel")

## 2. Úvodní ustanovení

2.1 Tyto obchodní podmínky (dále „OP") upravují práva a povinnosti mezi poskytovatelem a zákazníkem při poskytování služeb webhostingu, spravovaných aplikací, virtuálních serverů (VPS), správy serverů, registrace domén a souvisejících služeb (dále „služby").

2.2 Zákazníkem může být podnikatel nebo spotřebitel. Ustanovení označená „jen pro spotřebitele" platí pouze pro spotřebitele ve smyslu § 419 občanského zákoníku.

2.3 Nedílnou součástí smlouvy jsou: tyto OP, aktuální ceník na servero.cz, dokument [SLA](sla.md) a [Zásady ochrany osobních údajů](ochrana-osobnich-udaju.md). U smluv na správu serverů může být uzavřena individuální smlouva, která má před OP přednost.

## 3. Uzavření smlouvy

3.1 Zákazník odešle objednávku formulářem na servero.cz. Objednávka je návrh na uzavření smlouvy.

3.2 Objednávku zpracovává člověk. Poskytovatel zákazníka kontaktuje, může si vyžádat doplnění nebo ověření údajů.

3.3 Smlouva je uzavřena okamžikem zřízení služby a odesláním přístupových údajů (pozvánky do klientského panelu) zákazníkovi.

3.4 Poskytovatel může objednávku odmítnout zejména při neúplných nebo nepravdivých údajích, podezření na zneužití služby nebo nedostatku kapacity.

## 4. Cena a platební podmínky

4.1 Ceny jsou uvedeny v ceníku na servero.cz, v Kč, [bez DPH / poskytovatel není plátcem DPH].

4.2 Služby se platí předem na zvolené období (měsíc nebo rok). Při roční platbě zákazník platí 10 měsíců.

4.3 **Cena se po prvním období nezvyšuje automaticky.** Poskytovatel nepoužívá akční ceny na první rok. Změnu ceníku lze provést jen postupem podle článku 11.

4.4 Faktura je zasílána e-mailem. Úhrada bankovním převodem (QR platba) nebo dalším uvedeným způsobem. Splatnost [14] dní.

4.5 Při prodlení s úhradou:
- poskytovatel zákazníka upozorní e-mailem,
- služba běží ještě nejméně **7 dní po konci zaplaceného období**,
- poté může poskytovatel službu omezit nebo pozastavit, vždy po předchozím upozornění. O pozastavení rozhoduje člověk, ne automat,
- data pozastavené služby uchovává poskytovatel nejméně [30] dní, pak je může smazat.

4.6 Jednorázové práce (audit, CI/CD pipeline, práce technika) se účtují podle ceníku nebo podle odsouhlasené nabídky. Práce technika se účtuje po započatých [15] minutách.

## 5. Zřízení služby a migrace

5.1 Poskytovatel zřizuje služby zpravidla do několika hodin v pracovní době (Po až Pá 9:00 až 17:00) od obdržení kompletních údajů. Cílové časy stanoví SLA.

5.2 Migrace webu ze stávajícího hostingu je u tarifů s označením „Migrace zdarma" v ceně. Zákazník poskytne přístupy ke stávajícímu hostingu. Poskytovatel neodpovídá za vady, které existovaly ve webu již před migrací.

## 6. Práva a povinnosti poskytovatele

6.1 Poskytovatel se zavazuje:
- poskytovat služby v rozsahu objednaného tarifu a SLA,
- zálohovat data v rozsahu tarifu,
- provádět aktualizace a bezpečnostní opatření v rozsahu tarifu,
- informovat o plánované údržbě nejméně [48 hodin] předem.

6.2 Poskytovatel může:
- provádět nezbytnou údržbu infrastruktury,
- dočasně omezit službu, která ohrožuje provoz ostatních zákazníků nebo bezpečnost (útok, malware, extrémní zátěž), a to i bez předchozího upozornění; zákazníka informuje bez zbytečného odkladu,
- využívat subdodavatele (zejména Hetzner Online GmbH, Německo, pro datová centra, a registrátora domén [Subreg / Gransy s.r.o.]).

## 7. Práva a povinnosti zákazníka

7.1 Zákazník se zavazuje:
- uvádět pravdivé a aktuální údaje,
- chránit přístupové údaje a neprodleně hlásit jejich zneužití,
- nepoužívat služby v rozporu s právními předpisy ani dobrými mravy.

7.2 Zakázáno je zejména:
- rozesílání nevyžádané pošty (spam),
- šíření malwaru, phishing, útoky na jiné systémy,
- obsah porušující práva třetích osob (autorská práva, ochranné známky),
- těžba kryptoměn a jiná trvalá extrémní zátěž sdílených prostředků,
- obsah, jehož šíření je trestné.

7.3 Při porušení článku 7.2 může poskytovatel službu okamžitě pozastavit a při závažném nebo opakovaném porušení smlouvu vypovědět bez výpovědní doby. Na vrácení zaplacené ceny pak zákazník nemá nárok.

7.4 Zákazník s root přístupem k VPS odpovídá za změny, které sám provede. Na škody způsobené těmito změnami se nevztahuje SLA.

## 8. Domény

8.1 Domény registruje poskytovatel jménem a na účet zákazníka prostřednictvím akreditovaného registrátora. **Držitelem domény je vždy zákazník.**

8.2 Na registraci se vztahují i pravidla příslušného správce domény (pro .cz pravidla CZ.NIC).

8.3 Prodloužení domény provede poskytovatel jen po úhradě. Za zánik domény z důvodu neuhrazení odpovídá zákazník.

8.4 Zákazník může kdykoli požádat o AUTH-ID a převést doménu k jinému registrátorovi.

## 9. Zálohy a data

9.1 Zálohy provádí poskytovatel v rozsahu tarifu. Zálohy slouží k obnově provozu, nenahrazují zákazníkovu vlastní archivaci.

9.2 Obnovu ze zálohy na žádost zákazníka provede poskytovatel [jednou měsíčně zdarma], další obnovy podle ceníku práce technika.

9.3 Po skončení smlouvy poskytovatel na žádost zákazníka předá data ve standardním formátu (soubory, export databáze) do [30] dnů. Poté data smaže včetně záloh v souladu s rotací záloh.

## 10. Odpovědnost

10.1 Dostupnost a kompenzace za její nedodržení stanoví SLA. Kompenzace podle SLA je výlučná náhrada za nedostupnost služby.

10.2 Poskytovatel neodpovídá za:
- obsah ukládaný zákazníkem,
- škody způsobené zákazníkem, třetími stranami s přístupem od zákazníka nebo zásahem vyšší moci,
- ušlý zisk a nepřímé škody (jen pro podnikatele).

10.3 Celková odpovědnost poskytovatele vůči podnikateli za škodu je omezena na [výši ceny zaplacené za službu za posledních 12 měsíců]. Toto omezení neplatí pro škody způsobené úmyslně nebo hrubou nedbalostí a pro škody na zdraví.

## 11. Změna OP a ceníku

11.1 Poskytovatel může OP nebo ceník změnit. Změnu oznámí e-mailem nejméně **60 dní** před účinností.

11.2 Nesouhlasí-li zákazník se změnou, může smlouvu vypovědět ke dni účinnosti změny bez sankce. Nepoměrnou část zaplacené ceny poskytovatel vrátí.

## 12. Trvání a ukončení smlouvy

12.1 Smlouva se uzavírá na dobu neurčitou s předplacenými obdobími.

12.2 Zákazník může službu kdykoli zrušit v klientském panelu nebo e-mailem. Služba běží do konce zaplaceného období. [Při ročním předplatném se nevyčerpané celé měsíce vracejí / nevracejí.]

12.3 Poskytovatel může smlouvu vypovědět s výpovědní dobou [3 měsíce], nebo okamžitě podle článku 7.3.

12.4 Smlouvy o správě serverů mohou mít individuální výpovědní dobu.

## 13. Jen pro spotřebitele

13.1 **Odstoupení do 14 dnů.** Spotřebitel může od smlouvy uzavřené distančně odstoupit do 14 dnů od uzavření bez udání důvodu, e-mailem na podpora@servero.cz. Vzorový formulář: [ODKAZ].

13.2 Pokud spotřebitel výslovně požádá o zahájení služby před uplynutím lhůty k odstoupení (např. o okamžité zřízení a migraci), uhradí poměrnou část ceny za služby poskytnuté do odstoupení. U registrace domény nelze po jejím provedení odstoupit (§ 1837 občanského zákoníku, služba plně poskytnutá / zboží upravené na přání).

13.3 **Mimosoudní řešení sporů.** Příslušným subjektem je Česká obchodní inspekce, www.coi.cz. Spotřebitel může využít i platformu ODR: ec.europa.eu/consumers/odr.

13.4 Reklamace vad služby uplatní spotřebitel e-mailem. Poskytovatel ji vyřídí do 30 dnů.

## 14. Závěrečná ustanovení

14.1 Smlouva se řídí právem České republiky, zejména zákonem č. 89/2012 Sb., občanský zákoník.

14.2 Komunikace probíhá v češtině, elektronicky (e-mail, klientský panel).

14.3 Je-li některé ustanovení neplatné, ostatní ustanovení zůstávají v platnosti.

14.4 Tyto OP nabývají účinnosti dne [DATUM].
