# Poštovní uzel SERVEROS

Samostatný Hetzner CX23: `78.46.194.161`, IPv6 `2a01:4f8:c014:ad85::1`,
Ubuntu 26.04, Mailcow v `/opt/mailcow-dockerized`. Veřejná adresa
`https://mail.serveros.cz`, webmail `/SOGo/`. Správa běžných operací je
v `https://panel.serveros.cz/admin/posta`.

## Dočasná konfigurace pro 4 GB RAM

- Mailcow stable `2026-10`, commit `55982ac74bfd35581cc44b122ab5fc659e3ae90a`.
- `SKIP_CLAMD=y`, `SKIP_FTS=y`. Rspamd je zapnutý, ClamAV a fulltext vypnuté.
- SOGo `WOWorkersCount = "2"` v `data/conf/sogo/sogo.conf`.
- Swap 2 GB, `vm.swappiness=10`, Docker logy nejvýše 3 × 10 MB na kontejner.
- PHP image `8.2.35-1` obsahuje říjnovou bezpečnostní opravu.
- Mailcow vlastní ACME vystavuje a obnovuje certifikát pro hostname;
  HTTP přesměrovává na HTTPS. Další Certbot ani UFW se neinstaluje.
- Služba `mailcow.service` zajistí spuštění po restartu, watchdog patří k Mailcow.

Po navýšení minimálně na 8 GB nastavit `SKIP_CLAMD=n`, `SKIP_FTS=n`,
zvýšit počet SOGo procesů například na 5 a provést `docker compose up -d`,
pak `docker compose restart sogo-mailcow`. Ověřit paměť při reálné zátěži.
Při změně konfigurace upravit také provozní informaci v panelu Pošta.
Schránky ani platforma se nemigrují.

## Odesílání přes původní VPS

Odchozí port 25 v Hetzneru je blokovaný. Dočasně:

```
Mailcow Postfix → 172.22.1.1:2525 → SSH → mcg07.vas-server.cz / 127.0.0.1:25 → internet
```

`data/conf/postfix/extra.cf` obsahuje `relayhost = [172.22.1.1]:2525`.
`mailcow-relay-tunnel.service` drží spojení a obnoví ho při výpadku.
Klíč je na novém uzlu v `/etc/mailcow-relay/id_ed25519`, známý host je připnutý
v `known_hosts`. SSH účet `mailcow-relay` na původním VPS nemá shell, heslo,
PTY ani obecný forwarding: smí jen na `127.0.0.1:25`, z IP nového uzlu.
Původní firewall má jedinou výjimku pro SSH z `78.46.194.161/32`, také
v `/etc/iptables.up.rules`. Ostatní pravidla se nemění.

**Původní VPS je zatím nezbytnou součástí odesílání; nevypínat ho.**
Při výpadku brány Postfix drží zprávy ve frontě. Kontrola:

```sh
systemctl status mailcow-relay-tunnel
cd /opt/mailcow-dockerized
docker compose exec -T postfix-mailcow postqueue -p
docker compose logs --tail=50 postfix-mailcow
```

Po odblokování portu 25: ověřit A/AAAA a PTR obou adres, SPF každé domény,
reálné doručení ven, pak odstranit řádek `relayhost` z `extra.cf` a restartovat
Postfix. Až po vyprázdnění fronty zrušit SSH bránu a její účet/klíč/výjimku
na původním VPS. Upravit SPF instrukci v panelu (nyní obsahuje IP původní brány).

## Propojení panelu

Backend panelu volá přímo HTTPS Mailcow API s ověřeným certifikátem.
Read-write klíč je pouze v `/etc/servero-panel/env` jako `MAILCOW_API_KEY`.
`MAILCOW_API_URL=https://mail.serveros.cz`, `MAILCOW_WEB_URL` stejná adresa.
`API_ALLOW_FROM` v `mailcow.conf` povoluje veřejně jen IP hostingového uzlu
`2.31.25.249` a `2a01:4f8:c016:dc00::1`; loopback a Docker gateway slouží
pro místní správu. Přechodný instalační tunel pro API byl odstraněn.

Sekce Pošta je dostupná pouze adminům, za běžným přihlášením a 2FA.
Umí vytvořit doménu, schránku a alias, pozastavit/zapnout schránku,
změnit její heslo a kvótu a zobrazit DKIM. Změny zapisuje do auditu,
hesla ani API odpovědi s interními údaji se do auditu nedostanou.
Neprovádí změny DNS, přenos zpráv ani automatické vypínání podle fakturace.
Klientské účty přes tuto admin sekci nic neovládají.

### Webmail po přidání domény vrací 403 / Permission denied

SOGo sestavuje seznam přihlašovacích domén při startu. Pokud se první doména
přidá přes přímé API bez `restart_sogo=1`, může dál běžet s prázdným seznamem
a odmítat aktivní schránky. Panel tento příznak při založení domény posílá;
je nutný i v jiných integračních skriptech. Oprava existujícího stavu:

```sh
cd /opt/mailcow-dockerized
docker compose restart sogo-mailcow
```

Přihlašovat se přes `https://mail.serveros.cz/` celou adresou schránky.
Aktuální Mailcow předává ověření do SOGo; náhodné heslo v interním
`_sogo_static_view.c_password` je záměrné, nesynchronizovat ho ručně s heslem
schránky. Dne 25. 10. 2026 bylo po načtení domény ověřeno přihlášení přes
Mailcow až do složky Doručená pošta v prohlížeči. Použitá dočasná schránka
byla po testu odstraněna; heslo existující schránky se při opravě neměnilo.

## Postup migrace každé domény

1. Inventura schránek, aliasů, velikostí a aktuálního SPF/DKIM/DMARC.
2. Založit doménu a schránky v panelu, nastavit jednotlivá hesla/kvóty.
3. Přidat zobrazený DKIM; do jediného existujícího SPF doplnit
   `ip4:37.235.108.134`, zachovat ostatní odesílatele. Neměnit zavedený DKIM
   selektor bez posouzení starých odesílatelů; lze zvolit jiný selektor v Mailcow.
4. Přenést staré zprávy přes IMAP a ověřit příjem, odeslání i přihlášení.
5. Před MX přepnutím upravit ve starém VPS poštovní transport této domény na
   nový uzel. Jinak stará odchozí brána může doručit zprávy této domény do
   starých lokálních schránek. Původní webové reverse proxy toto neřeší.
6. MX na `mail.serveros.cz`, dosynchronizovat zprávy, sledovat fronty/logy.
   Starou kopii mazat teprve po ověření a funkční záloze mimo server.

SMTP pro klienty `mail.serveros.cz:587` STARTTLS nebo `:465` SSL,
IMAP `:993` SSL. Přihlášení celou adresou. POP3 podporuje Mailcow též;
preferujeme IMAP. Potřebné příchozí porty v Hetzner firewallu podle používaných
protokolů: 22 (správa), 25, 80, 443, 465, 587, 993, případně 143/110/995/4190.

## Zálohy do AWS S3: připravené, dosud nepřipojené

S3 bucket a klíče zatím nejsou dodané. Restic je nainstalovaný, heslo šifrování
je v `/etc/mailcow-backup/restic-password` (root 0600), konfigurace má
prázdné hodnoty v `/etc/mailcow-backup/env`. Timer není zapnutý.
Lokální staging není záloha mimo server.

Po dodání bucketu:

1. Doplnit `backup.env.example` jako `/etc/mailcow-backup/env`, root 0600.
   Například `s3:https://s3.eu-central-1.amazonaws.com/BUCKET/mailcow`.
   IAM omezit na daný bucket/prefix; blokovat veřejný přístup a zapnout verzování.
2. Načíst proměnné a vytvořit repo pomocí `restic init`.
3. Spustit `mailcow-backup-to-s3 --verify-first`. Používá oficiální Mailcow
   zálohu všech dat a šifrovaně ukládá i konfiguraci a SSH bránu. Potřebuje
   volný disk na jeden staging; při chybě uploadu kopii ponechá a další
   vytváření zastaví. Před opakováním dokončit její upload nebo ji posoudit.
4. Ověřit `restic check --read-data`, obnovit zkušební archiv do oddělené složky
   a zkontrolovat součty/čitelnost. Heslo šifrování uchovat mimo oba servery.
5. Teprve pak `MAILCOW_S3_VERIFIED=1` a
   `systemctl enable --now mailcow-backup.timer`.

Retence: 7 denních, 4 týdenní, 3 měsíční snapshoty, omezená na tag/host Mailcow.
Obnova: stáhnout snapshot přes Restic do oddělené složky, vrátit konfiguraci
a použít oficiální `helper-scripts/backup_and_restore.sh restore`. Obnova
živých svazků je zásah do dat, nejdřív ji vyzkoušet na odděleném uzlu.

## Přístupy a kontrola

Soukromé údaje jsou lokálně v `mail-server-access.json` (ignorovaný Gitem,
0600); mailový uzel má správní údaje v `/root/mailcow-setup/credentials.json`.
SSH používá existující správní klíč `server-admin-ed25519`; heslové SSH je
vypnuté. Veřejný administrátorský účet Mailcow má náhodné změněné heslo.

Ověřeno: založení domény, schránek a aliasu přes API, změna stavu a kvóty,
SMTP STARTTLS AUTH, interní doručení přes alias, IMAPS přihlášení a čtení,
odmítnutí otevřeného relaye přes IPv4 i IPv6. Brána přijímá SMTP obálku pro
vnější adresu; při tomto testu se neposílala zpráva třetí osobě.
Úplné doručení ven a DNS autentizaci ověřit při první konkrétní migraci domény.

Dokumentace: https://docs.mailcow.email/ a https://docs.mailcow.email/backup_restore/b_n_r-backup/.
