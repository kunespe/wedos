# SERVEROS panel

Klientská zóna a administrace SERVEROS na `panel.serveros.cz`. SvelteKit 3 (Svelte 5), TypeScript, Tailwind 4, Drizzle nad MySQL 8.4.

- **Zákazník** (`/app`) vidí své služby, jejich dostupnost, domény, předplatné a podporu.
- **Správce** (`/admin`) vyřizuje objednávky, zakládá zákazníky a služby a obsluhuje server přes stávající broker.

Zřizování je ruční: objednávka ze serveros.cz přijde do `/admin/objednavky`. Správce ji převede na zákazníka a službu ve stavu „Zřizujeme“, server připraví podle `docs/runbook-objednavka.md` a pak službu přepne na „Běží“. Panel sám nic na serveru nespouští, kromě akcí, které správce výslovně klikne. Ty jdou přes `dashboard/broker.py` (Unix socket, pevný seznam operací).

## Lokální vývoj

```sh
docker run -d --name servero-mysql -e MYSQL_ROOT_PASSWORD=devroot -e MYSQL_DATABASE=servero_panel \
  -e MYSQL_USER=servero -e MYSQL_PASSWORD=devpass -p 127.0.0.1:3317:3306 mysql:8.4
cp .env.example .env.local          # upravte DATABASE_URL, ORIGIN, PUBLIC_WEB_ORIGIN pro localhost
pnpm install
pnpm db:migrate && pnpm db:seed     # schéma a ceník z ../../catalog/plans.json
pnpm db:fixtures                    # testovací účty a data (jen proti lokální DB)
node scripts/fake-broker.ts /tmp/servero-broker.sock &   # BROKER_SOCKET=/tmp/servero-broker.sock
pnpm dev
```

Testovací účty z `db:fixtures`:

| Role | Účet | Druhý faktor |
| --- | --- | --- |
| Správce | `admin@servero.test` / `heslo-pro-vyvoj-12` | kód z `node scripts/totp.ts` |
| Zákazník | `klient@servero.test` / `heslo-pro-vyvoj-12` | žádný |

Testy: `pnpm check`, `pnpm test`. Databázové testy potřebují `TEST_DATABASE_URL` (viz `.env.test`).

## Skripty

| Příkaz | K čemu |
| --- | --- |
| `pnpm db:generate --name <změna>` | Nová migrace po úpravě `src/lib/server/db/schema.ts` |
| `pnpm db:migrate` | Spustí čekající migrace, bezpečné při každém nasazení |
| `pnpm db:seed [plans.json]` | Nahraje ceník; tarify, které z katalogu zmizely, se jen deaktivují |
| `pnpm admin:create <email> "<jméno>"` | Založí správce a vypíše odkaz na nastavení hesla |
| `pnpm import:legacy [--apply]` | Převezme weby ze starého dashboardu (bez `--apply` jen vypíše) |

## Struktura

- `src/env.ts`: všechny proměnné prostředí s validací. Každá musí být i v `.env.example`.
- `src/lib/server/db/schema.ts`: datový model (zákazníci, uživatelé, objednávky, služby, uzly, domény, tikety, audit).
- `src/lib/server/auth/`: hesla (argon2id), session v DB (v cookie je jen token, uložený je jeho hash), TOTP, pozvánky.
- `src/lib/server/fulfilment.ts`: převod objednávky na zákazníka, účet a službu.
- `src/lib/server/broker.ts`: klient root brokeru; `snapshot.ts` načítá stav serveru.
- `src/lib/server/probes.ts`: zapisuje cíle pro monitoring (Alloy blackbox) z aktivních služeb.
- `src/lib/server/wedos.ts`: klient WEDOS WAPI (registrace, prodloužení, převody a kontakty domén).
- `src/routes/api/orders`: veřejné API objednávkového formuláře (CORS jen pro serveros.cz, honeypot, limit).
- `src/routes/internal/metrics`: obchodní metriky pro Prometheus, jen z loopbacku.

## WEDOS (registrace domén)

Domény registrujeme, prodlužujeme a převádíme přes WEDOS WAPI, ale vždy ručně: v detailu domény (`/admin/domeny/<id>`) je panel WEDOS a každá změna má potvrzovací krok. Nic se neděje automaticky. Každé volání, které něco mění, se zapíše do auditu (bez hesel a AUTH-ID).

1. **WAPI heslo:** v administraci WEDOS otevřete WAPI > Nastavení, zapněte WAPI a nastavte WAPI heslo. Je to jiné heslo než heslo k účtu.
2. **Povolená IP:** v WAPI > Povolené IP adresy přidejte IP serveru `2.31.25.249`. Bez toho WAPI vrací chybu 2051. Ověříte to tlačítkem **WAPI ping** na `/admin/domeny`.
3. **Proměnné na serveru** v `/etc/servero-panel/env`, pak restart panelu:

   ```sh
   WEDOS_WAPI_USER=prihlasovaci@email.cz   # login k účtu WEDOS; prázdné = integrace vypnutá
   WEDOS_WAPI_PASSWORD=...                  # WAPI heslo z kroku 1
   WEDOS_WAPI_LIVE=0                        # 0 = testovací režim, 1 = ostrý
   WEDOS_NSSET=                             # NSSET pro .cz; prázdné = použije se WEDOS_DNS
   WEDOS_DNS=                               # nameservery pro ostatní domény, oddělené čárkou; prázdné = výchozí WEDOS
   ```

**Testovací vs. ostrý režim.** Dokud není `WEDOS_WAPI_LIVE=1`, posílá panel změny (registrace, prodloužení, převod, kontakt, AUTH-ID) s příznakem `test`: WEDOS je jen ověří, nic nezaregistruje a nestrhne kredit. Režim je vidět u každého tlačítka i v hlavičce `/admin/domeny`. Čtecí příkazy (stav, dostupnost, seznam, ping) běží vždy naostro, nic nemění. Limit WAPI je 1000 požadavků za hodinu a 100 kontrol a registrací domén za hodinu.

Registrace potřebuje kontakt majitele pro danou koncovku. Panel ho založí z údajů zákazníka (IČO jako identifikátor) a handle uloží k zákazníkovi; existující handle z administrace WEDOS lze vložit ručně. Tlačítko **Porovnat s WEDOS** na `/admin/domeny` ukáže domény, které jsou u WEDOS a chybí v panelu, a naopak.

## Zabezpečení

- Správci musí mít zapnuté dvoufázové ověření, bez něj se do administrace nedostanou. Jejich session platí 12 hodin, zákaznická 14 dní.
- Neúspěšná přihlášení se počítají po IP (8 za 15 minut).
- Zákaznické stránky filtrují každý dotaz podle `customerId` přihlášeného uživatele. Cizí ID v URL vrací 404.
- Hesla a přístupy z `create_site` se zobrazí jednou a nikam se neukládají ani nelogují.
