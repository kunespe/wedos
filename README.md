# Vytvořit web — provozní dashboard

Interní správa hostingového serveru s CloudPanelem. Dashboard sdílí seznam webů
s CloudPanelem a doplňuje klienty, provozní automatizaci a propojení s Fakturorem.

## Co umí

- Přehled webů, WordPressů, služeb a dostupných aktualizací.
- Založení PHP, WordPress, statického webu, Node.js a Bun aplikace přes CloudPanel.
- Jednorázové přihlášení do CloudPanelu.
- Ruční pozastavení a obnovení podporovaných PHP/statických webů.
- Údržbu WordPressů se zálohou a ověřením dat před aktualizací.
- Šifrované zálohy přes Restic do S3.
- Čtení předplatných z Fakturoru každých 10 minut a přiřazení jejich ID k webům.

Fakturor je zdroj pravdy pro platnost služby. Nezaplacený doklad na další období
sám o sobě hosting nepozastavuje. Ochranná lhůta je 7 dní po konci platnosti,
počítaná v Europe/Prague včetně změn letního času.

**Současný stav:** Fakturor pouze sledujeme, automatické vypínání není
implementované v adaptéru ani aktivované. Historické expirace čekají na opravu.
WordPress aktualizace čekají na připojené a ověřené S3. Node/Bun aplikace je
nutné samostatně připojit k běžícím službám; jejich pozastavování zatím není
podporované. `billing-plan.py` je starší samostatný prototyp, není součástí
aktivní synchronizace Fakturoru.

## Struktura

| Adresář | Obsah |
| --- | --- |
| `dashboard/` | Flask web, šablony, CSS a JavaScript |
| `dashboard/broker.py` | Lokální privilegované operace přes Unix socket |
| `dashboard/fakturor.py` | Read-only API adaptér a vyhodnocení expirace |
| `dashboard/update-check.py` | Kontrola verzí bez instalace aktualizací |
| `operations/` | WordPress údržba, Restic/S3 nástroje, systemd služby a vzory konfigurace |
| `.github/workflows/` | Automatické testy; bez připojení k produkci |

## Testy

Python 3.12 na Linuxu (produkce používá Ubuntu a systemd):

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r dashboard/requirements.txt
.venv/bin/python -m unittest discover -s dashboard -p 'test_*.py' -v
.venv/bin/python -m unittest discover -s operations -p 'test_*.py' -v
```

Testy používají dočasnou konfiguraci a mocky; nepotřebují produkční hesla,
API klíč, CloudPanel ani přístup k serveru.

## Nasazení na stávající server

Tento repozitář zachycuje existující instalaci. Není univerzální instalační
skript CloudPanelu. Hostname/IP, důvěryhodné adresy a odkazy v konfiguraci jsou
nyní nastavené pro náš server; před nasazením jinam je upravte.

- Obsah `dashboard/` je nasazený do `/opt/vw-dashboard/`.
- Web běží jako `vw-dashboard.service` pod samostatným uživatelem.
- `vw-dashboard-broker.service` běží jako root a vystavuje omezené operace
  na `/run/vw-dashboard/broker.sock`. Socket je dostupný jen příslušné skupině.
- Nginx konfigurace je v `dashboard/nginx.conf`; web naslouchá přes Gunicorn
  pouze na `127.0.0.1:8765`.
- CloudPanel používá `/home/clp/htdocs/app/data/db.sq3`; dashboard jej čte.
- Konfigurace webu `/etc/vw-dashboard/web.json` obsahuje `secret_key` a
  `password_hash` vygenerovaný Werkzeugem. Nikdy ji necommitujte.
- Konfigurace automatizací patří do `/etc/vytvorit-web/`; JSON v `operations/`
  jsou výchozí vzory, nikoliv záloha živého nastavení.
- Fakturor klíč patří do `/etc/vytvorit-web/fakturor-key`, pouze root, režim 600.
- S3 přístupy se ukládají podle `operations/s3-backup.json.example` mimo webroot;
  Restic heslo je v samostatném chráněném souboru.
- Runtime stav, audit a výsledky kontrol jsou pod `/var/lib/vw-dashboard/`;
  přihlašovací relace pod `/var/lib/vw-dashboard-web/`.

Při aktualizaci přeneste pouze změněný zdrojový kód. Nepřepisujte existující
klíče, runtime stav ani konfiguraci z výchozích vzorů. Po úpravě brokeru
restartujte jeho službu, po úpravě webu `vw-dashboard.service`. Po změně
systemd jednotek použijte `systemctl daemon-reload`. Neaktivujte automatické
vypínání pouhou změnou příznaku v JSON; k tomu chybí napojení bezpečného
provedení změny s novým úspěšným dotazem před každým vypnutím.

## Co do Gitu nepatří

Hesla, SSH klíče, API klíče, certifikáty, databáze, exporty, zálohy ani klientské
migrace. Kořenový `.gitignore` povoluje jen zdroj dashboardu, provozní skripty,
README a CI. Ostatní obsah sdíleného pracovního adresáře zůstává lokální.
