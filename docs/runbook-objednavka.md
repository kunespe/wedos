# Runbook: ruční vyřízení objednávky

> Platí pro všechny objednávky z serveros.cz. Objednávky zpracovává člověk, ne automat.
> Ceny a kódy tarifů: `catalog/plans.json`. Obchodní kontext: `business-case.md`. Závazky vůči zákazníkovi: `legal/sla.md`.

## 0. Životní cyklus objednávky

```
new ──> contacted ──> provisioning ──> done
  └──────────┴─────────────┴──────> cancelled
```

| Stav | Kdy přepnout | Kdo |
|---|---|---|
| `new` | Automaticky po odeslání formuláře na serveros.cz | systém |
| `contacted` | Zákazníkovi jsme napsali nebo volali, údaje jsou kompletní | Petr (zástup Vojtěch) |
| `provisioning` | Začali jsme zakládat službu | ten, kdo zakládá |
| `done` | Služba běží, zákazník a služba jsou v panelu, pozvánka odeslána | ten, kdo zakládal |
| `cancelled` | Zákazník odstoupil, neověřitelný, podvod, nebo nelze zřídit | kdokoli, vždy s poznámkou proč |

## 1. SLA časovače (pracovní doba Po až Pá 9:00 až 17:00)

| Časovač | Cíl | Hraniční mez | Měří se od |
|---|---|---|---|
| T1: první kontakt (`new` → `contacted`) | 30 min | 1 h | vytvoření objednávky |
| T2: zprovoznění web, wp, app (`contacted` → `done`) | 2 h | 4 h | kompletních údajů od zákazníka |
| T2: zprovoznění vps | 2 h | 4 h | kompletních údajů |
| T2: doména (registrace) | 1 h | 4 h | úhrady nebo potvrzení objednávky |
| T2: doména (převod) | podle AUTH-ID | 5 pracovních dnů | obdržení AUTH-ID |
| T2: management (kick-off) | 1 pracovní den | 2 pracovní dny | `contacted` |
| T3: migrace webu | stejný den | 1 pracovní den | zprovoznění a přístupů ke starému hostingu |

Objednávka mimo pracovní dobu: časovač běží od 9:00 dalšího pracovního dne. Hrozí překročení meze: napsat zákazníkovi dřív, než mez uplyne, s novým termínem.

## 2. Společné kroky pro každou objednávku

### 2.1 Příjem (`new`)

- [ ] Otevřít objednávku v panelu (admin, inbox objednávek).
- [ ] Zkontrolovat úplnost: jméno, e-mail, telefon, fakturační údaje (IČO, DIČ, adresa), tarif, období (měsíc / rok), doména.
- [ ] Ověřit IČO v ARES. Firma neexistuje nebo údaje nesedí: doptat se.
- [ ] Rozpoznat podezřelou objednávku (nesmyslné údaje, freemail + neexistující firma, žádost o rozesílání e-mailů): `cancelled` s poznámkou, případně ověřit telefonem.
- [ ] Kapacita: u web, wp, app zkontrolovat v monitor.serveros.cz RAM a disk nodu. Nad 70 %: nahlásit Vojtěchovi (spouštěč nákupu dalšího nodu), objednávku založit na nodu s kapacitou.

### 2.2 Kontakt (`contacted`)

- [ ] Napsat nebo zavolat zákazníkovi (šablona 5.1). Domluvit: migrace ano/ne, přístupy ke starému hostingu, DNS, e-mail (Seznam Email Profi, Google Workspace, M365).
- [ ] Do poznámky v objednávce zapsat, co bylo domluveno a co chybí.
- [ ] Přepnout na `contacted`.

### 2.3 Zápis do panelu (před `done`)

| Co | Kde v panelu | Poznámka |
|---|---|---|
| Zákazník | Zákazníci → nový | Název / jméno, IČO, DIČ, fakturační adresa, kontaktní e-mail a telefon, typ: firma / spotřebitel |
| Služba | Zákazník → Služby → nová | Kód tarifu (`plans.json`), období, datum zahájení, cena, node / server, primární doména |
| Technické údaje | Služba → detail | Node (hostname, IP), CloudPanel uživatel / Hetzner ID serveru, cesta k webu, název DB. **Ne hesla.** |
| Hesla | Správce hesel | V panelu jen odkaz na položku ve správci hesel |
| Fakturace | Služba → Fakturor | ID předplatného ve Fakturoru, ověřit, že synchronizace vidí službu |
| Objednávka | Inbox | Propojit objednávku se zákazníkem a službou |
| Historie | Služba → poznámky | Kdo, kdy, co zakládal, odchylky od standardu |

### 2.4 Předání (`done`)

- [ ] Vytvořit pozvánku do panelu (odkaz pro nastavení hesla) a zkopírovat ji.
- [ ] Odeslat ručně e-mail podle šablony 5.2 (nebo 5.3 až 5.5 podle druhu).
- [ ] Přepnout na `done`. Zkontrolovat, že časovače byly splněny, jinak do poznámky důvod.
- [ ] Za 24 h: kontrolní e-mail nebo telefonát (běží web, dorazila faktura, funguje přihlášení do panelu).

## 3. Postup podle druhu produktu

### 3.1 `web`: Web Start, Web Plus

- [ ] CloudPanel na zvoleném nodu: Add Site → PHP Site (verze podle požadavku, výchozí nejnovější podporovaná).
- [ ] Vytvořit site user, nastavit limity podle tarifu (Start: 1 web, 5 GB, 1 DB; Plus: až 5 webů, 20 GB, 10 DB).
- [ ] Vytvořit databázi (MySQL 8.4), přístup jen z localhost.
- [ ] Web Plus: zapnout Redis (samostatná DB nebo prefix), připravit testovací prostředí (subdoména `test.` s heslem).
- [ ] SSL: Let's Encrypt po nasměrování DNS. Do té doby dočasná adresa pro náhled.
- [ ] Zálohy: ověřit, že nový web je v denním zálohovacím jobu (14 dní) a offsite kopii.
- [ ] Monitoring: přidat HTTP kontrolu a expiraci SSL do monitor.serveros.cz.
- [ ] Migrace (pokud chce): stáhnout soubory a DB, nahrát, upravit konfiguraci, ověřit na dočasné adrese, teprve pak přepnout DNS. Starý hosting nechat běžet do ověření.
- [ ] DNS: A/AAAA na node, MX a SPF/DKIM/DMARC podle zvoleného mailového poskytovatele.
- [ ] Zapsat do panelu (2.3), předat (2.4, šablona 5.2).

### 3.2 `wp`: WP Provoz

Kroky jako `web`, navíc:

- [ ] CloudPanel: Add Site → WordPress (nebo PHP site + migrace stávajícího WP).
- [ ] Nastavit Varnish / Redis object cache, ověřit, že přihlášení a košík (pokud WooCommerce) se nekešují.
- [ ] Zařadit web do skriptu týdenních aktualizací (`operations/wordpress.json`, `operations/wp-maintenance.py`): záloha před aktualizací, ověření zálohy, aktualizace, kontrola HTTP 200 a vizuální kontrola.
- [ ] Udělat první ruční běh aktualizace a zapsat výsledek.
- [ ] Monitoring: dostupnost, SSL, odezva.
- [ ] Zjistit, zda zákazník chce administrátorský účet WP pro nás (doporučeno samostatný účet `serveros`).
- [ ] Zapsat do panelu, předat (šablona 5.2 + doplněk WP).

### 3.3 `app`: Aplikace Node / Bun

- [ ] Získat: repozitář (Git URL a deploy klíč s právem jen ke čtení), runtime (Node / Bun, verze), příkaz build a start, port, proměnné prostředí, potřeba DB.
- [ ] CloudPanel: Add Site → Node.js (nebo reverse proxy na port).
- [ ] Systemd služba podle `operations/bun-app.service.example`: `Restart=always`, limit paměti 1 GB (`MemoryMax=1G`).
- [ ] Nasazení z Gitu: nastavit pipeline nebo deploy skript (pull, install, build, restart). Ověřit jedno nasazení naostro.
- [ ] Reverse proxy a SSL, ověřit WebSockety, pokud je aplikace používá.
- [ ] Logy: napojit do Loki (Alloy), zkontrolovat v Grafaně.
- [ ] Proměnné prostředí uložit do správce hesel, ne do panelu.
- [ ] Monitoring: HTTP health endpoint, alert při restartech ve smyčce.
- [ ] Zapsat do panelu, předat (šablona 5.3).

### 3.4 `vps`: VPS S, VPS M, VPS L

| Tarif | Typ Hetzner |
|---|---|
| VPS S | CPX22 (2 vCPU, 4 GB) |
| VPS M | CPX32 (4 vCPU, 8 GB) |
| VPS L | CCX13 nebo větší podle zátěže, domluvit se zákazníkem |

- [ ] Hetzner Cloud: vytvořit server v projektu SERVEROS, lokalita Falkenstein / Norimberk (EU), Ubuntu LTS, náš SSH klíč, zapnout Hetzner Backups.
- [ ] Pojmenovat `zakaznik-tarif-01`, štítky `customer=<id z panelu>`, `plan=<kód>`.
- [ ] Hardening: nový admin uživatel, SSH jen klíčem, zakázat root login heslem, firewall (Hetzner Firewall + ufw), unattended-upgrades, fail2ban.
- [ ] Monitoring: Alloy agent (metriky, logy) do monitor.serveros.cz, alerty CPU, RAM, disk, dostupnost.
- [ ] Zálohy: Hetzner Backups + offsite záloha dat na Storage Box. Udělat zkušební obnovu jednoho souboru.
- [ ] Software podle domluvy (CloudPanel, Docker, databáze, ...).
- [ ] Root na vyžádání: jen po písemné žádosti, SSH klíč zákazníka, zapsat do poznámky, upozornit na omezení odpovědnosti (`legal/sla.md`).
- [ ] Zapsat do panelu (Hetzner ID serveru, IP, typ), předat (šablona 5.4).

### 3.5 `management`: 1U Start, 2U Provoz, 4U Na míru

Nejde o rychlé zřízení, ale o onboarding projekt. Vede Vojtěch.

- [ ] Kick-off hovor (do 2 pracovních dnů): rozsah serverů, kritické služby, kontaktní osoby, okna údržby, eskalace.
- [ ] Nabídnout audit infrastruktury (4 900 Kč, odečte se z první faktury).
- [ ] Podepsat smlouvu a zpracovatelskou smlouvu (GDPR), předat přístupy přes správce hesel nebo šifrovaně.
- [ ] Inventura: seznam serverů, OS, služby, zálohy, certifikáty, domény. Zapsat do panelu jako služby nebo poznámky.
- [ ] Monitoring 24/7: Alloy agent na každý server, alerty do Alertmanageru, zařadit do on-call.
- [ ] Zálohy každou noc: nastavit nebo převzít, udělat zkušební obnovu.
- [ ] 2U Provoz: CI/CD pipeline (v ceně), měsíční report (šablona v Grafaně), reakce do 30 min podle SLA.
- [ ] 4U Na míru: SLA podle dohody zapsat do panelu ke službě.
- [ ] Stanovit cenu „od" podle rozsahu, zapsat skutečnou cenu ke službě a do Fakturoru.
- [ ] Předat (šablona 5.5).

### 3.6 `domain`: doména .cz (249 Kč/rok)

Registrujeme přes reseller program Subreg (Gransy), do roku 2027 ručně, pak přes Subreg API.

**Registrace**
- [ ] Ověřit dostupnost (whois / Subreg).
- [ ] Založit nebo použít kontakt držitele: **držitelem je vždy zákazník**, ne SERVEROS.
- [ ] Zaregistrovat na 1 rok, NSSET na naše DNS (nebo podle požadavku), zapnout automatické prodloužení u nás v panelu.
- [ ] Zapsat do panelu: doména, datum expirace, ID v Subregu.

**Převod k nám**
- [ ] Vyžádat AUTH-ID od zákazníka (ten si ho nechá poslat od stávajícího registrátora).
- [ ] Zadat převod v Subregu, sledovat stav.
- [ ] Po převodu zkontrolovat DNS a expiraci, zapsat do panelu.

## 4. Kontrolní seznam před přepnutím na `done`

- [ ] Služba běží a je ověřená z venku (web, SSL, SSH u VPS).
- [ ] Zálohy jsou v jobu, monitoring hlásí zeleně.
- [ ] Zákazník a služba jsou v panelu, objednávka je propojená.
- [ ] Předplatné je ve Fakturoru a synchronizace ho vidí.
- [ ] Hesla jsou ve správci hesel, v panelu ani v e-mailu nejsou.
- [ ] Pozvánka odeslána.
- [ ] Poznámka v objednávce: kdo a kdy.

## 5. Šablony zpráv

Hesla nikdy neposíláme e-mailem. Zákazník si heslo nastaví přes pozvánku. Technické přístupy (SFTP, DB) najde v panelu nebo je předáme jednorázovým odkazem.

### 5.1 První kontakt

> **Předmět:** Vaše objednávka {tarif} na SERVEROS.CZ
>
> Dobrý den, {jméno},
>
> děkujeme za objednávku {tarif}. Jmenuji se {jméno_technika} a postarám se o ni.
>
> Abychom mohli službu zprovoznit, potřebujeme ještě:
> - {chybějící_údaje}
> - Chcete přestěhovat stávající web? Migraci uděláme zdarma, stačí přístupy ke stávajícímu hostingu.
> - Jakou používáte e-mailovou službu (Seznam Email Profi, Google Workspace, Microsoft 365, jinou)? Nastavíme správné DNS záznamy.
>
> Jakmile budeme mít údaje, službu zprovozníme do pár hodin v pracovní době.
>
> S pozdravem
> {jméno_technika}, SERVEROS.CZ
> {telefon} | podpora@serveros.cz

### 5.2 Předání: web a WordPress

> **Předmět:** {tarif} je připraven: přístup do panelu SERVEROS
>
> Dobrý den, {jméno},
>
> služba {tarif} pro {doména} běží.
>
> **Přihlášení do panelu:** nastavte si heslo přes tento odkaz (platí 7 dní):
> {odkaz_pozvánky}
>
> V panelu najdete přehled služby, faktury a technické přístupy (SFTP, databáze).
>
> **Co jsme udělali:**
> - {seznam_kroků, např. migrace webu, SSL certifikát, DNS pro e-mail}
> - Denní zálohy jsou zapnuté (14 dní zpět).
> {jen WP Provoz: - Každý týden web aktualizujeme, vždy po ověřené záloze. O každé aktualizaci najdete záznam v panelu.}
>
> **Co je potřeba od vás:** {např. nasměrovat DNS u stávajícího registrátora, nebo „nic"}
>
> Fakturu vám pošleme e-mailem, platit můžete QR kódem. Cena se po prvním roce nemění.
>
> Kdyby cokoli nefungovalo, odpovězte na tento e-mail nebo volejte {telefon} (Po až Pá 9 až 17 h).
>
> S pozdravem
> {jméno_technika}, SERVEROS.CZ

### 5.3 Předání: aplikace

> **Předmět:** Aplikace {název} běží na SERVEROS
>
> Dobrý den, {jméno},
>
> aplikace {název} běží na {doména}.
>
> - Přihlášení do panelu: {odkaz_pozvánky} (platí 7 dní)
> - Nasazení: push do větve `{větev}` v {repozitář} spustí build a restart. První nasazení proběhlo {datum_čas}.
> - Logy: na požádání, nebo zjednodušeně v panelu.
> - Při pádu se aplikace sama restartuje, o opakovaných pádech víme dřív než vy.
>
> Proměnné prostředí máme uložené bezpečně mimo repozitář. Změny posílejte na podpora@serveros.cz.
>
> S pozdravem
> {jméno_technika}, SERVEROS.CZ

### 5.4 Předání: VPS

> **Předmět:** Váš server {tarif} je připraven
>
> Dobrý den, {jméno},
>
> server {hostname} ({IP}) běží.
>
> - Parametry: {vCPU} vCPU, {RAM} GB RAM, {disk} GB
> - Přihlášení do panelu: {odkaz_pozvánky} (platí 7 dní)
> - Aktualizace, zabezpečení, monitoring a zálohy řešíme my.
> - Root přístup vám zřídíme na vyžádání: pošlete nám veřejný SSH klíč. Upozorňujeme, že změny provedené s root přístupem jdou mimo naši odpovědnost (viz SLA).
>
> S pozdravem
> {jméno_technika}, SERVEROS.CZ

### 5.5 Předání: správa serverů

> **Předmět:** Správa infrastruktury {firma}: převzetí dokončeno
>
> Dobrý den, {jméno},
>
> převzetí správy je hotové. Spravujeme: {seznam_serverů}.
>
> - Monitoring 24/7 a noční zálohy běží, zkušební obnova proběhla {datum}.
> - Kontakt pro incidenty: {telefon_pohotovost}, běžné požadavky: podpora@serveros.cz
> - Reakční doby podle tarifu {tarif}: {reakční_doby}
> - Přístup do panelu (přehled, reporty, faktury): {odkaz_pozvánky}
> {jen 2U: - První měsíční report pošleme {datum}.}
>
> S pozdravem
> Vojtěch Kotrč, SERVEROS.CZ

## 6. Zrušení objednávky (`cancelled`)

- [ ] Do poznámky důvod (zákazník odstoupil, neověřeno, nelze zřídit, duplicitní).
- [ ] Pokud už něco vzniklo (site, server, doména), smazat nebo zaznamenat. Doménu registrovanou na zákazníka nemazat.
- [ ] Pokud byla vystavena faktura, stornovat ve Fakturoru.
- [ ] Krátce informovat zákazníka (kromě zjevného spamu).
