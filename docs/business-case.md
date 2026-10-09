# SERVEROS.CZ: business case

> Stav k 9. 10. 2026. Ceny bez DPH. Kurz 1 EUR ≈ 24,27 Kč.
> Řádky označené **[P]** jsou předpoklady, ne ověřená fakta. Před rozhodnutím je potvrdit nebo přepočítat.
> Zdroj ceníku: `catalog/plans.json` (jediný zdroj pravdy pro ceny).

## 1. Shrnutí

- **Co:** SERVEROS.CZ je hosting a správa serverů z Plzně, s člověkem na druhé straně. Webhosting, spravovaný WordPress, aplikace (Node/Bun), spravované VPS a správa cizích serverů.
- **Kdo:** Vojtěch Kotrč (infrastruktura, CI/CD, webzi.cz) a Petr Kuneš (klienti, plánování, provoz, digitality.marketing).
- **Odkud:** SERVEROS přebírá hostingovou část značky Vytvořit web (klienti centrumarete.cz a jrmontaze.cz na Hetzner Cloud, 2.31.25.249). Vytvořit web zůstává webovým studiem a hosting SERVEROS přeprodává.
- **Proč to vyjde:** trh se drží modelu „akce na první rok, pak 2 až 3x dráž". My nabízíme stejnou cenu i po prvním roce, onboarding člověkem a migraci zdarma do pár hodin. Nesoutěžíme s VEDOS za 39 Kč, vyhráváme na spravovaném WordPressu, aplikacích, VPS a správě serverů, kde chybí transparentní nabídka mezi ~500 a 1 500+ Kč.
- **Cíl roku 1:** 30 hostingů/WP, 5 VPS, 3 smlouvy na správu, **MRR ~28 000 Kč**. Provozní bod zvratu (bez mezd zakladatelů) je ~5 300 Kč měsíčně, tedy např. 2 smlouvy 1U Start.
- **Infrastruktura:** serveros.cz (výloha a objednávky), panel.serveros.cz (SvelteKit klientský portál a administrace, „jednodušší WEDOS"), monitor.serveros.cz (Grafana, Prometheus, Loki, Alloy, Alertmanager). Fakturace přes Fakturor.

## 2. Trh a konkurence

Vzorec trhu: první rok sleva 40 až 60 %, prodloužení 2 až 3x dráž. Zákazník to zjistí až po roce.

### 2.1 Sdílený webhosting (Kč/měs bez DPH)

| Poskytovatel | Tarif | Akční cena | Běžná cena / prodloužení | Zdroj |
|---|---|---|---|---|
| VEDOS (dříve WEDOS, přejmenováno 2/2025) | LowCost | 33 | 53,51 | vedos.cz, ověřeno 9. 10. 2026 |
| VEDOS | NoLimit | 39 | 100 | vedos.cz, ověřeno 9. 10. 2026 |
| VEDOS | Extra | 99 | 200 | vedos.cz, ověřeno 9. 10. 2026 |
| VEDOS | WMS (spravovaný WordPress) | od 617 | od 617 | vedos.cz, ověřeno 9. 10. 2026 |
| Forpsi | Easy | 32,50 | 65 | forpsi.com, ověřeno 9. 10. 2026 |
| Forpsi | Advanced | 55 | 150 | forpsi.com, ověřeno 9. 10. 2026 |
| Webglobe | Start | 57 | 69 | webglobe.cz, ověřeno 9. 10. 2026 |
| Webglobe | Plus | 131 | 165 | webglobe.cz, ověřeno 9. 10. 2026 |
| Websupport | základ | od 49 | n/a | websupport.cz, ověřeno 9. 10. 2026 |
| Český hosting | základ | 59 | 125 | cesky-hosting.cz, ověřeno 9. 10. 2026 |
| Endora | free / placené | 0 nebo 19 až 59 akce | n/a | endora.cz, ověřeno 9. 10. 2026 |
| Hostinger | základ | ~102 | n/a | hostinger.cz, ověřeno 9. 10. 2026 |

Ostatní služby VEDOS: e-mail 50 až 1 000 Kč/měs, doména .cz 160 Kč/rok (= velkoobchodní cena CZ.NIC).

### 2.2 Spravované servery a služby

| Poskytovatel | Nabídka | Cena (Kč/měs) | Zdroj |
|---|---|---|---|
| zserver | Basic Managed VPS | 1 500 | zserver.cz, ověřeno 9. 10. 2026 |
| Český hosting | VMS | 250 / 500 / 1 000 / 2 000 | cesky-hosting.cz, ověřeno 9. 10. 2026 |
| ZonerCloud | managed | od 769 | zonercloud.cz, ověřeno 9. 10. 2026 |
| VSHosting | správa | 990 až 2 500 za službu + ~4 100 Kč/h práce | vshosting.cz, ověřeno 9. 10. 2026 |
| MasterDC | VPS bez správy | od 271 | masterdc.com, ověřeno 9. 10. 2026 |

### 2.3 Naše vstupní náklady (Hetzner, po zdražení 15. 6. 2026)

| Produkt | Parametry | EUR/měs | Kč/měs | Zdroj |
|---|---|---|---|---|
| CPX22 | 2 vCPU, 4 GB | 19,49 | ~473 | hetzner.com, ověřeno 9. 10. 2026 |
| CPX32 | 4 vCPU, 8 GB | 35,49 | ~861 | hetzner.com, ověřeno 9. 10. 2026 |
| CCX13 | 2 dedikované vCPU, 8 GB | 42,99 | ~1 043 | hetzner.com, ověřeno 9. 10. 2026 |
| AX42 | dedikovaný server | 97,30 | ~2 361 | hetzner.com, ověřeno 9. 10. 2026 |
| Storage Box 1 TB | zálohy | ~3,20 | ~78 **[P]** cena nejistá | hetzner.com, ověřeno 9. 10. 2026 |

Řady CX a CAX teď nejdou objednat.

### 2.4 Domény a platby

| Položka | Cena | Poznámka |
|---|---|---|
| CZ.NIC velkoobchod .cz | 160 Kč/rok | zdroj nic.cz, ověřeno 9. 10. 2026 |
| Vlastní akreditace CZ.NIC | 60 000 Kč/rok + 140 000 Kč záloha | nevyplatí se, prodáváme přes reseller program Subreg (Gransy) |
| Fakturoid | 151 až 393 Kč/měs | srovnání, fakturujeme přes Fakturor |
| iDoklad | 187 až 625 Kč/měs | srovnání |
| Stripe | 1,5 % + 6,50 Kč za platbu | pro karty, pokud zavedeme |
| QR platba | zdarma | výchozí způsob platby |
| Comgate / GoPay | ~1 až 2 % | alternativa ke Stripe |

## 3. Pozicování

**„Hosting a servery s člověkem na druhé straně."**

| Slibujeme | Co to znamená v praxi |
|---|---|
| Žádné akční ceny | Stejná cena v 1. i 5. roce. Roční platba = 10 měsíců (sleva 16,7 %). |
| Člověk při onboardingu | Každou objednávku zpracuje člověk, do pár hodin v pracovní době. |
| Migrace zdarma | Přestěhujeme web nebo aplikaci za zákazníka. |
| Ověřené zálohy | Zálohu nejen děláme, ale pravidelně z ní zkoušíme obnovu. |
| Transparentní správa | Spravované VPS a správa serverů s veřejným ceníkem od 1 290 Kč. Konkurence má mezi ~500 a 1 500+ Kč díru nebo „cenu na dotaz". |

Kde **nesoutěžíme:** nejlevnější sdílený hosting (VEDOS 39 Kč, Endora zdarma). Web Start za 79 Kč je vstupní produkt pro klienty, kteří chtějí jistotu, ne nejnižší cenu.

E-mail: při spuštění **neprovozujeme vlastní poštu** (doručitelnost, RAM na sdíleném nodu). DNS nastavíme pro Seznam Email Profi, Google Workspace nebo Microsoft 365. Vlastní mail je fáze 2 na samostatném nodu.

## 4. Cíloví zákazníci

| Persona | Kdo to je | Bolest | Náš produkt | Kde ho najdeme |
|---|---|---|---|---|
| **Malá firma s WordPressem** | Řemeslník, služby, lokální firma, 1 web | Web jim „někdo kdysi udělal", aktualizace nikdo nedělá, bojí se hacku, po roce jim zdražil hosting | WP Provoz, Web Start/Plus | Vytvořit web, digitality.marketing, doporučení |
| **E-shop / startup s aplikací** | Malý tým, Node/Bun aplikace, e-shop | Nechtějí řešit server, reverse proxy, SSL, nasazení, pády | Aplikace Node/Bun, VPS S/M, CI/CD pipeline | webzi.cz, SEO, doporučení |
| **Firma s vlastními servery** | Firma s 1 až 6 servery (cloud i vlastní železo), bez admina nebo s přetíženým IT | Neaktualizované systémy, žádný monitoring, zálohy „asi fungují" | Audit infrastruktury, 1U Start, 2U Provoz, 4U Na míru | webzi.cz, osobní síť, LinkedIn |
| **Webové studio / reseller** | Studio, freelancer, agentura (včetně Vytvořit web) | Hosting klientů je otrava a riziko | Web Plus, WP Provoz pro jejich klienty, hodiny technika | Přímý kontakt, Vytvořit web jako vzor |

## 5. Produktové řady a ceník

Ceny z `catalog/plans.json`, Kč/měs bez DPH. Roční platba = 10 měsíců. „Od" = cena podle rozsahu.

| Řada | Tarif | Kód | Kč/měs | Kč/rok (10 měs.) | Obsah | Benchmark (Kč/měs) |
|---|---|---|---|---|---|---|
| Webhosting | Web Start | web-start | 79 | 790 | 1 web, 5 GB NVMe, 1 DB, SSL, denní záloha 14 dní, migrace zdarma | VEDOS NoLimit 39 → 100; Forpsi Easy 32,50 → 65; Webglobe Start 57 → 69; Český hosting 59 → 125 |
| Webhosting | Web Plus ★ | web-plus | 149 | 1 490 | 5 webů, 20 GB NVMe, 10 DB, Redis, testovací prostředí, migrace zdarma | VEDOS Extra 99 → 200; Forpsi Advanced 55 → 150; Webglobe Plus 131 → 165 |
| WordPress a aplikace | WP Provoz ★ | wp-provoz | 349 | 3 490 | 1 WP 10 GB, ověřená záloha před každou aktualizací, týdenní aktualizace, hlídání dostupnosti a SSL | VEDOS WMS od 617 |
| WordPress a aplikace | Aplikace Node / Bun | app-node | 399 | 3 990 | 1 aplikace 1 GB RAM, nasazení z Gitu, reverse proxy, SSL, logy, restart při pádu | Český hosting VMS 250 až 500 (bez nasazení); ZonerCloud managed od 769 |
| Spravované VPS | VPS S | vps-s | 1 290 | 12 900 | 2 vCPU, 4 GB, 80 GB, root na vyžádání, aktualizace, monitoring, zálohy | Hetzner CPX22 473 (bez správy); ZonerCloud od 769; zserver Basic Managed 1 500 |
| Spravované VPS | VPS M ★ | vps-m | 2 190 | 21 900 | 4 vCPU, 8 GB, 160 GB, jinak jako VPS S | Hetzner CPX32 861 (bez správy); Český hosting VMS 2 000 |
| Spravované VPS | VPS L | vps-l | od 3 990 | od 39 900 | Dedikovaná vCPU, velikost podle zátěže | Hetzner CCX13 1 043 (bez správy); VSHosting 990 až 2 500 + práce |
| Správa serverů | 1U Start | sprava-start | od 2 990 | od 29 900 | 1 až 2 servery, aktualizace, monitoring 24/7, noční zálohy | VSHosting 990 až 2 500 za službu + ~4 100 Kč/h |
| Správa serverů | 2U Provoz ★ | sprava-provoz | od 7 900 | od 79 000 | Až 6 serverů nebo cluster, CI/CD v ceně, reakce do 30 min, měsíční report | VSHosting (stejný model, práce zvlášť) |
| Správa serverů | 4U Na míru | sprava-na-miru | individuálně | individuálně | Celá infrastruktura, cloud i železo, SLA podle dohody, vyhrazený technik | na dotaz u všech |

★ = doporučený tarif na webu.

**Doplňky**

| Položka | Kód | Cena | Poznámka | Benchmark |
|---|---|---|---|---|
| Doména .cz | domena-cz | 249 Kč/rok | Stejná cena i při prodloužení | velkoobchod CZ.NIC 160; VEDOS 160 |
| Audit infrastruktury | audit | 4 900 Kč jednorázově | Odečteme z první faktury, když zákazník zůstane | n/a |
| CI/CD pipeline | cicd | od 9 900 Kč jednorázově | V tarifu 2U Provoz v ceně | n/a |
| Práce technika | hodina | 1 290 Kč/h | | VSHosting ~4 100 Kč/h |

## 6. Jednotková ekonomika

### 6.1 Předpoklady

- **[P] Vnitřní cena hodiny práce:** 500 Kč (hodnota času zakladatelů, ne skutečná mzda).
- **[P] Kapacita sdíleného nodu:** CPX22 (4 GB RAM) unese ~30 „slotů" do spouštěče 70 % RAM nebo disku. 1 slot ≈ 95 MB RAM. Náklad nodu ~568 Kč (473 + 20 % Hetzner zálohy) / 30 = **~19 Kč za slot**, počítáme 22 Kč s rezervou.
- **[P] Sloty:** Web Start = 1, Web Plus = 2, WP Provoz = 2, Aplikace = 5 (limit 1 GB, průměrná reálná spotřeba ~0,5 GB).
- **[P] VPS:** server Hetzner + 20 % zálohy + ~30 Kč monitoring a offsite záloha.
- **[P] Čas na údržbu měsíčně:** průměr přes všechny zákazníky dané řady, včetně tiketů. U WP Provoz předpokládáme **skriptované aktualizace** (WP-CLI, automatická záloha, ověření a vizuální kontrola, ~5 min týdně). Při ruční práci (~40 min/měs) je WP Provoz ve ztrátě, viz 6.3.
- Platby QR kódem (zdarma). Fakturor a účetní jsou ve fixních nákladech.

### 6.2 Marže na jednotku (Kč/měs)

| Tarif | Cena | Přímý náklad | Hrubá marže | Marže % | Čas/měs **[P]** | Cena času | Marže po času | % po času |
|---|---|---|---|---|---|---|---|---|
| Web Start | 79 | 22 | 57 | 72 % | 3 min | 25 | 32 | 41 % |
| Web Plus | 149 | 44 | 105 | 70 % | 6 min | 50 | 55 | 37 % |
| WP Provoz | 349 | 54 | 295 | 85 % | 20 min | 167 | 128 | 37 % |
| Aplikace Node/Bun | 399 | 110 | 289 | 72 % | 15 min | 125 | 164 | 41 % |
| VPS S | 1 290 | 598 (473 + 95 + 30) | 692 | 54 % | 45 min | 375 | 317 | 25 % |
| VPS M | 2 190 | 1 063 (861 + 172 + 30) | 1 127 | 51 % | 45 min | 375 | 752 | 34 % |
| VPS L (od) | 3 990 | 1 282 (1 043 + 209 + 30) | 2 708 | 68 % | 60 min | 500 | 2 208 | 55 % |
| 1U Start (od) | 2 990 | 100 (monitoring, zálohy) | 2 890 | 97 % | 150 min | 1 250 | 1 640 | 55 % |
| 2U Provoz (od) | 7 900 | 300 (monitoring, CI runnery, zálohy) | 7 600 | 96 % | 360 min | 3 000 | 4 600 | 58 % |
| Doména .cz | 249/rok | ~170/rok **[P]** cena Subreg | 79/rok | 32 % | 5 min/rok | 42 | 37/rok | 15 % |
| Práce technika | 1 290/h | 0 | 1 290 | 100 % | 60 min | 500 | 790 | 61 % |
| Audit | 4 900 | 0 | 4 900 | 100 % | 6 h **[P]** | 3 000 | 1 900 | 39 % |

U správy serverů hradí zákazník svou infrastrukturu sám. Pokud ji provozujeme my, přičte se náklad serveru jako u VPS.

### 6.3 Co z toho plyne

- **Web Start** je vstupní produkt. Při 10 minutách podpory měsíčně jde do ztráty. Hlídat počet tiketů, případně zvážit 99 Kč.
- **WP Provoz** je ziskový jen se skriptovanými aktualizacemi. **Skript musí být hotový dřív, než prodáme 10. kus** (základ existuje v `operations/wp-maintenance.py`).
- **VPS S** má nejnižší marži po času (25 %). Prodávat hlavně VPS M, VPS S jako vstup.
- **Správa serverů** nese většinu zisku. Je to hlavní obchodní priorita.
- Roční platba snižuje efektivní cenu o 16,7 %. Marže výše počítají s měsíční platbou.

## 7. Fixní náklady

| Položka | Kč/měs | Poznámka |
|---|---|---|
| Storage Box 1 TB (offsite zálohy) | 78 | **[P]** cena nejistá |
| Node pro panel a monitoring (CPX22) | 473 | **[P]** odpadá, pokud poběží na stávající infrastruktuře webzi |
| Fakturor | 200 | **[P]** doplnit skutečnou cenu |
| Transakční e-maily (pozvánky, upozornění) | 250 | **[P]** |
| Účetní | 1 500 | **[P]** |
| Pojištění odpovědnosti (IT služby) | 500 | **[P]** ~6 000 Kč/rok |
| Nástroje (správce hesel, status page, apod.) | 300 | **[P]** |
| Marketing (SEO obsah, drobné kampaně) | 2 000 | **[P]** |
| Vlastní domény | 30 | serveros.cz a varianty |
| **Celkem** | **~5 300** | bez mezd zakladatelů |

Sdílené nody nejsou ve fixních nákladech, protože jsou rozpočítány do slotů (6.1). Pozor: jsou to skokové náklady. První node už platíme. Každý další node (CPX32, 861 + 172 Kč zálohy = ~1 030 Kč) přidá kapacitu ~60 slotů.

## 8. Bod zvratu

Provozní bod zvratu (hrubá marže pokryje fixní náklady ~5 300 Kč, bez ohodnocení vlastního času):

| Pouze z jedné řady | Potřeba |
|---|---|
| Web Plus | 51 zákazníků |
| WP Provoz | 18 zákazníků |
| VPS M | 5 zákazníků |
| 1U Start | 2 smlouvy |

Bod zvratu včetně ohodnocení času (500 Kč/h) v základním mixu (marže po času ~45 % z MRR): ~12 000 Kč MRR **[P]**.

## 9. Scénář roku 1 (říjen 2026 až září 2027)

### 9.1 Mix zákazníků v 12. měsíci

| | Konzervativní | Základní | Optimistický |
|---|---|---|---|
| Web Start | 8 | 12 | 20 |
| Web Plus | 4 | 8 | 15 |
| WP Provoz | 3 | 10 | 15 |
| Aplikace Node/Bun | 0 | 0 | 3 |
| VPS S / M / L | 2 / 0 / 0 | 3 / 2 / 0 | 4 / 3 / 1 |
| 1U Start / 2U Provoz | 1 / 0 | 2 / 1 | 3 / 2 |

### 9.2 MRR a zisk (Kč/měs)

| | Konzervativní | Základní | Optimistický |
|---|---|---|---|
| MRR v 3. měsíci | 2 000 | 6 000 | 10 000 |
| MRR v 6. měsíci | 4 500 | 14 000 | 25 000 |
| **MRR v 12. měsíci** | **7 800** | **27 800** | **50 700** |
| z toho hosting a WP | 2 300 | 5 600 | 9 100 |
| z toho aplikace | 0 | 0 | 1 200 |
| z toho VPS | 2 600 | 8 300 | 15 700 |
| z toho správa | 3 000 | 13 900 | 24 800 |
| Hrubá marže (12. měsíc) | 6 000 | 22 200 | 40 700 |
| Fixní náklady + další nody | 5 300 | 6 300 (2. node) | 6 300 (2. node) |
| **Provozní zisk (12. měsíc)** | **~700** | **~15 900** | **~34 400** |
| Hodin údržby měsíčně | ~6 h | ~20 h | ~34 h |
| Sloty na sdíleném nodu | 22 | 48 | 95 |

Poznámky:
- Základní a optimistický scénář přesáhnou kapacitu prvního nodu (~30 slotů), druhý node je nutný v průběhu roku.
- Čísla nezahrnují stávající klienty Vytvořit web (centrumarete.cz, jrmontaze.cz). Ti se převedou na tarify SERVEROS a jsou bonus nad scénářem.
- Jednorázové příjmy (audity, CI/CD, hodiny, domény) nejsou v MRR. **[P]** Základ: 3 audity + 2 CI/CD + 20 h práce za rok ≈ 59 000 Kč.

## 10. Obchodní kanály

| Kanál | Co uděláme | Očekávání v roce 1 **[P]** |
|---|---|---|
| Klienti Vytvořit web | Převod hostingu na SERVEROS, studio přeprodává hosting dalším klientům | 10 až 15 hostingů/WP |
| webzi.cz (Vojtěch) | Nabídka VPS, CI/CD a správy stávajícím klientům a kontaktům | 2 až 3 VPS, 1 až 2 smlouvy na správu |
| digitality.marketing (Petr) | WP Provoz k marketingovým zakázkám, klienti potřebují rychlý a hlídaný web | 5 až 10 WP Provoz |
| Doporučení | Odměna doporučiteli: 1 měsíc zdarma za každého nového platícího klienta | 3 až 5 zákazníků |
| SEO a obsah | Články: „hosting bez zdražení po roce", „migrace z VEDOS", srovnání spravovaných VPS, správa serverů Plzeň | výsledky až v roce 2, start ihned |

## 11. Provozní model

| Oblast | Nastavení |
|---|---|
| Objednávka | Ruční. Objednávka z serveros.cz padá do inboxu v panelu (stavy `new`, `contacted`, `provisioning`, `done`, `cancelled`). Postup: `runbook-objednavka.md`. |
| SLA onboardingu | Kontakt do 1 h, zprovoznění **do pár hodin v pracovní době** (cíl do 4 pracovních hodin). VPS do 4 h, správa serverů kick-off do 2 pracovních dnů. |
| Pracovní doba podpory | Po až Pá 9:00 až 17:00 **[P]**, e-mail a telefon, odpověď podle `legal/sla.md` (4 pracovní hodiny až 1 pracovní den podle tarifu). |
| Pohotovost (on-call) | Alertmanager posílá kritické alerty (výpadek nodu, disk nad 90 %, selhaná záloha) na telefon. Týdenní střídání Vojtěch / Petr, eskalace vždy na Vojtěcha (infrastruktura). Mimo pracovní dobu: best-effort pro hosting, garantovaná reakce jen podle `legal/sla.md` (2U Provoz, 4U Na míru). |
| Fakturace | Fakturor, synchronizace předplatných. Po splatnosti 7 dní tolerance, ruční pozastavení (hold) má vždy přednost, suspendace se jen navrhuje, nikdy neproběhne automaticky. |
| Zálohy | Denně, 14 dní zpět (hosting), offsite na Storage Box. Test obnovy namátkou 1x měsíčně. |
| Rozdělení rolí | Vojtěch: nody, VPS, CI/CD, správa serverů, eskalace. Petr: inbox objednávek, komunikace, onboarding hostingu a WP, fakturace. |

## 12. Rizika a opatření

| Riziko | Dopad | Opatření |
|---|---|---|
| Jeden sdílený node (single point of failure) | Výpadek všech hostingových klientů | Denní offsite zálohy a ověřená obnova, runbook obnovy na nový node do 2 h, druhý node při 70 % kapacity, datový model panelu počítá s více nody. |
| Závislost na klíčové osobě (Vojtěch) | Při nemoci nikdo neopraví infrastrukturu | Runbooky v `docs/`, sdílený správce hesel, Petr zaškolen na obnovu ze zálohy a restart služeb, externí záložní admin na hodinovou sazbu **[P]**. |
| Zdražení Hetzneru (už proběhlo 6/2026) | Pokles marže VPS | Ceny VPS mají rezervu ~50 %. V OP právo upravit cenu s 60denním předstihem. Alternativy: Hetzner dedikované (AX42), jiný poskytovatel v EU. |
| Právní a regulace (GDPR, NIS2, spotřebitelé) | Pokuty, spory | Šablony OP, GDPR a SLA nechat zkontrolovat právníkem, zpracovatelská smlouva pro firmy, pojištění odpovědnosti. |
| Cenový tlak (VEDOS 39 Kč) | Hosting nevyroste | Nesoutěžit cenou, prodávat správu a jistotu. Hosting je vstup, ne zisk. |
| Ruční procesy nestačí růstu | Pomalý onboarding, chyby | Checklisty, SLA časovače v panelu, postupná automatizace v roce 2027. |
| Bezpečnostní incident na sdíleném nodu | Únik dat více klientů | Izolace uživatelů v CloudPanel, aktualizace, WAF, monitoring Loki, postup hlášení incidentu podle GDPR (72 h). |

## 13. Roadmapa

| Období | Milník |
|---|---|
| **Q4 2026** | Spuštění serveros.cz a panel.serveros.cz (objednávky, inbox, zákazníci, služby, pozvánky). Převod klientů Vytvořit web. Fakturor napojení. Monitor.serveros.cz v provozu. Právní dokumenty po kontrole právníkem. |
| **Q1 2027** | Skriptované WP aktualizace s ověřenou zálohou. Reseller Subreg pro domény (ruční). Prvních 10 zákazníků mimo Vytvořit web. |
| **Q2 2027** | Druhý node (CPX32, ~861 Kč) při 70 % RAM nebo disku. Částečná automatizace: založení webu v CloudPanel z panelu, odeslání pozvánky. |
| **Q3 2027** | Subreg API: registrace a prodloužení domén z panelu. Status page. Vyhodnocení roku 1 proti scénářům. |
| **Q4 2027** | Mailový node (fáze 2) na samostatném serveru: vlastní e-mail s hlídanou doručitelností (SPF, DKIM, DMARC). Platby kartou (Stripe nebo Comgate), pokud o ně zákazníci stojí. |
