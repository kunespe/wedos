# SLA: smlouva o úrovni služeb SERVEROS.CZ

> **⚠ Šablona, před zveřejněním nechat zkontrolovat právníkem.**
> Před zveřejněním ověřit, že cílové hodnoty odpovídají reálné kapacitě týmu (2 lidé) a infrastruktury (jeden sdílený node v prvním roce).

Účinnost od: [DATUM]. Součást [obchodních podmínek](obchodni-podminky.md).

## 1. Pojmy

| Pojem | Význam |
|---|---|
| Pracovní doba | Po až Pá 9:00 až 17:00, mimo státní svátky ČR |
| Dostupnost | Služba odpovídá z internetu (HTTP u webu, SSH/ping u VPS), měřeno monitoringem poskytovatele v intervalu 1 minuty |
| Měsíční dostupnost | (minuty v měsíci minus minuty nedostupnosti) / minuty v měsíci |
| Reakce | První odpověď člověka s potvrzením, že na problému pracujeme (ne automatická odpověď) |
| Kritický incident | Služba je nedostupná nebo hrozí ztráta dat |
| Běžný požadavek | Dotaz, změna nastavení, drobná chyba bez výpadku |

## 2. Garantovaná dostupnost

| Tarif | Měsíční dostupnost | Max. výpadek za měsíc (přibližně) |
|---|---|---|
| Web Start, Web Plus | 99,5 % | 3 h 39 min |
| WP Provoz, Aplikace Node/Bun | 99,5 % | 3 h 39 min |
| VPS S, M, L | 99,7 % | 2 h 11 min |
| 1U Start, 2U Provoz | podle infrastruktury zákazníka, viz čl. 4 | |
| 4U Na míru | podle individuální smlouvy | |

Do nedostupnosti se nepočítá:
- plánovaná údržba oznámená nejméně 48 h předem (max. [4 h] měsíčně, přednostně 22:00 až 6:00),
- výpadek způsobený zákazníkem (obsah, kód, nastavení, zásah s root přístupem),
- útoky DDoS přesahující běžnou ochranu, vyšší moc,
- výpadky služeb třetích stran, které poskytovatel nespravuje (DNS registrátora zákazníka, e-mailový poskytovatel zákazníka),
- pozastavení služby podle OP (neuhrazení, porušení pravidel).

## 3. Reakční doby

| Tarif | Kritický incident v pracovní době | Kritický incident mimo pracovní dobu | Běžný požadavek |
|---|---|---|---|
| Web Start, Web Plus | 2 h | best-effort, nejpozději další pracovní den 10:00 | 1 pracovní den |
| WP Provoz, Aplikace | 1 h | best-effort, nejpozději další pracovní den 10:00 | 4 pracovní hodiny |
| VPS S, M, L | 1 h | 4 h | 4 pracovní hodiny |
| 1U Start | 1 h | 4 h | 1 pracovní den |
| 2U Provoz | **30 min** | **30 min** (24/7) | 4 pracovní hodiny |
| 4U Na míru | podle smlouvy | podle smlouvy | podle smlouvy |

Poskytovatel o většině incidentů ví dřív než zákazník (monitoring 24/7). Kritické incidenty hlaste telefonem na [TELEFON POHOTOVOSTI], běžné požadavky na podpora@serveros.cz.

## 4. Správa serverů (1U, 2U, 4U)

- Poskytovatel garantuje reakci, monitoring, zálohy a aktualizace. Dostupnost serverů závisí i na hardwaru a poskytovateli, kterého si zákazník zvolil, proto ji SLA negarantuje, pokud servery neprovozuje poskytovatel.
- Pokud servery provozuje poskytovatel (u Hetzneru v rámci SERVEROS), platí dostupnost jako u VPS.
- Bezpečnostní aktualizace: kritické do [48 h] od vydání, ostatní v pravidelném okně [1x týdně].
- 2U Provoz: měsíční report (dostupnost, incidenty, aktualizace, zálohy, doporučení).

## 5. Zálohy

| Tarif | Frekvence | Uchování | Kde |
|---|---|---|---|
| Web Start, Web Plus | denně | 14 dní | node + offsite (EU) |
| WP Provoz | denně + před každou aktualizací (ověřená) | 14 dní | node + offsite (EU) |
| Aplikace | denně (data a DB) | 14 dní | offsite (EU) |
| VPS | denně | [7 snímků] + offsite data [14 dní] | Hetzner Backups + offsite (EU) |
| 1U, 2U | každou noc | [14 dní] nebo podle dohody | podle dohody |

- Obnovu z nich poskytovatel pravidelně testuje (namátkou nejméně 1x měsíčně).
- Cílová doba obnovy jednoho webu: do 4 pracovních hodin od žádosti.
- Cílová doba obnovy celého sdíleného nodu po havárii: [8 h].

## 6. Kompenzace

Při nedodržení garantované měsíční dostupnosti:

| Měsíční dostupnost | Kredit z měsíční ceny služby |
|---|---|
| pod garantovanou hodnotou, nad 99,0 % | 10 % |
| 98,0 až 99,0 % | 25 % |
| 95,0 až 98,0 % | 50 % |
| pod 95,0 % | 100 % |

- Při nedodržení reakční doby u kritického incidentu (2U Provoz): kredit [10 %] za každý případ, max. 50 % měsíční ceny.
- Kredit se uplatňuje písemně do 30 dnů od konce měsíce a odečte se z další faktury. Nevyplácí se v penězích.
- Celková kompenzace za měsíc nepřekročí 100 % měsíční ceny dotčené služby.
- Kompenzace podle SLA je výlučná náhrada za nedostupnost (OP čl. 10).

## 7. Zřízení služby

| Druh | Cíl zřízení od obdržení kompletních údajů |
|---|---|
| Webhosting, WordPress, aplikace | do 4 pracovních hodin |
| VPS | do 4 pracovních hodin |
| Doména (registrace) | do 4 pracovních hodin |
| Doména (převod) | podle AUTH-ID a registrátora, obvykle do 5 pracovních dnů |
| Správa serverů | kick-off do 2 pracovních dnů, převzetí podle rozsahu |
| Migrace webu | do 1 pracovního dne od zřízení a dodání přístupů |

Cíle zřízení nejsou podkladem pro kompenzaci.

## 8. Komunikace incidentů

- Plánovaná údržba: e-mail nejméně 48 h předem.
- Neplánovaný výpadek delší než 15 min: informace na [status.serveros.cz / e-mailem] do 30 min.
- Po kritickém incidentu delším než 1 h: krátká zpráva o příčině a opatřeních do 3 pracovních dnů.
