# Právní dokumenty SERVEROS

Platné znění je jen na webu. Zdrojem jsou tyto soubory v `apps/web/`, jiná kopie neexistuje, aby se znění nerozcházela.

| Dokument | Soubor | URL |
|---|---|---|
| Obchodní podmínky (vč. reklamací, spotřebitelů a DSA) | `apps/web/obchodni-podminky.html` | https://serveros.cz/obchodni-podminky.html |
| SLA: úroveň služeb | `apps/web/sla.html` | https://serveros.cz/sla.html |
| Ochrana osobních údajů (vč. cookies) | `apps/web/ochrana-osobnich-udaju.html` | https://serveros.cz/ochrana-osobnich-udaju.html |
| Smlouva o zpracování osobních údajů (čl. 28 GDPR) | `apps/web/zpracovatelska-smlouva.html` | https://serveros.cz/zpracovatelska-smlouva.html |
| Odstoupení od smlouvy a vzorový formulář | `apps/web/odstoupeni-od-smlouvy.html` | https://serveros.cz/odstoupeni-od-smlouvy.html |

Verze 1.0, účinnost od 19. 11. 2026. Provozovatel: Vojtěch Kotrč, IČO 17541859, Barákova 561/79, 326 00 Plzeň, neplátce DPH, živnostenský rejstřík (Magistrát města Plzně).

## Co je napojené na aplikace

- **Objednávka na webu** (`objednat.html`): povinný souhlas s OP a SLA, volitelné zaškrtnutí „Jen pro spotřebitele: zřídit hned“ (skryje se po vyplnění IČO).
- **Objednávka v klientské zóně** (`apps/panel/src/routes/app/objednat`): odkazy na OP, SLA a zásady; spotřebitel (účet bez IČO) má stejné zaškrtnutí.
- Žádost se ukládá do `orders.immediate_start` (migrace `0004`). Detail objednávky v administraci i e-mail týmu říká, jestli lze službu zřídit hned, nebo jestli jde o spotřebitele bez žádosti: takovému zřizujeme po 14 dnech, nebo až po jeho výslovné žádosti e-mailem.
- Potvrzovací e-mail zákazníkovi odkazuje na OP, zásady a odstoupení a uvádí provozovatele.

## Když se dokumenty mění

1. Upravte HTML v `apps/web/`, zvyšte verzi a datum účinnosti v hlavičce (`legal-meta`) a datum v závěrečných ustanoveních.
2. Změnu, která se týká uzavřených smluv (OP, SLA, ceník), oznamte zákazníkům e-mailem **nejméně 60 dní předem** (OP čl. 13.2). Nový dodavatel, který zpracovává data zákazníků, **30 dní předem** (zpracovatelská smlouva čl. 5.2).
3. Změnu ceny v `catalog/plans.json` dostanou jen nové objednávky. Stávající služby mají cenu uloženou u sebe (`services.price_monthly`) a mění se jen podle bodu 2.

## Fakta, na kterých dokumenty stojí

Když se změní, je potřeba upravit i dokumenty:

- Servery u Hetzner Online GmbH v Německu; registrátor WEDOS Internet, a.s.; fakturace přes Fakturor (Ravelor s.r.o.); pošta info@serveros.cz přes server WEBZI s.r.o.; komunikace v Google Workspace.
- Web serveros.cz nepoužívá cookies ani analytiku (jen `localStorage` pro košík domén). Panel používá cookies `__Host-servero_session` (14 dní / 12 h) a `servero_totp_setup` (15 min).
- Zálohy podle SLA: denně, 14 dní, šifrovaně mimo datové centrum (EU). Logy nejdéle 90 dní (Loki drží 7 dní).
