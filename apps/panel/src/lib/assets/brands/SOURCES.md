# Brand marks

Official logos of the technologies and providers the panel shows, rendered by
`src/lib/components/BrandIcon.svelte` (registry and colours in `src/lib/brands.ts`).
Nothing here is redrawn. Files were only trimmed: titles, ids, metadata and fixed sizes removed, the
`viewBox` kept; where a source is a full logo (symbol plus wordmark) only the symbol was kept.

All names and marks are trademarks of their owners and are used only to identify the product or
service next to its name. Using them does not imply endorsement. Follow each owner's guidelines.

Retrieved 2026-10-09.

## Simple Icons (simple-icons@16.32.0)

SVG path data from <https://github.com/simple-icons/simple-icons>, released under CC0 1.0 (the path
data; the marks themselves remain trademarks). Downloaded from the npm tarball
`simple-icons@16.32.0` (also at `https://cdn.jsdelivr.net/npm/simple-icons@16.32.0/icons/<slug>.svg`).
Brand colour is the `hex` from Simple Icons' data file.

| File | Slug | Hex | Brand source / guidelines |
| --- | --- | --- | --- |
| `wordpress.svg` | `wordpress` | `#21759B` | <https://wordpress.org/about/logos>, <https://wordpressfoundation.org/trademark-policy> |
| `php.svg` | `php` | `#777BB4` | <https://php.net/download-logos.php> |
| `nodejs.svg` | `nodedotjs` | `#5FA04E` | <https://nodejs.org/en/about/branding> |
| `bun.svg` | `bun` | `#000000` | <https://bun.sh/press-kit> |
| `mysql.svg` | `mysql` | `#4479A1` | <https://www.mysql.com/about/legal/logos.html> |
| `redis.svg` | `redis` | `#FF4438` | <https://redis.io/brand-guidelines> |
| `nginx.svg` | `nginx` | `#009639` | <https://www.nginx.com/press/> |
| `grafana.svg` | `grafana` | `#F46800` | <https://grafana.com> (also used for Grafana Alloy) |
| `prometheus.svg` | `prometheus` | `#E6522C` | <https://prometheus.io> (also used for Alertmanager) |
| `letsencrypt.svg` | `letsencrypt` | `#003A70` | <https://letsencrypt.org/trademarks/> |
| `hetzner.svg` | `hetzner` | `#D50C2D` | <https://www.hetzner.com> |
| `ubuntu.svg` | `ubuntu` | `#E95420` | <https://design.ubuntu.com/resources>, <https://design.ubuntu.com/brand> |

## Not in Simple Icons: taken from the brand's own site or Wikimedia Commons

| File | Source URL | Notes |
| --- | --- | --- |
| `cloudpanel.svg` | <https://www.cloudpanel.io/assets/images/logo.svg> | Official CloudPanel logo from cloudpanel.io; only the cloud symbol (`#1E7AE0`) kept, wordmark removed. Trademark of CloudPanel (MGT-Commerce GmbH). |
| `varnish.svg` | <https://www.varnish.org/images/varnish-cache-logo.svg> (logo of <https://varnish-cache.org>) | Official Varnish Cache logo; only the three-dot symbol (`#0072CE`) kept, wordmark removed. Trademark of Varnish Software. |
| `loki.svg` | <https://grafana.com/static/img/logos/logo-loki.svg> | Official Grafana Loki logo from grafana.com, unchanged except gradient ids namespaced (`loki-g*`). Trademark of Grafana Labs. |
| `amazons3.svg` | <https://commons.wikimedia.org/wiki/File:Amazon-S3-Logo.svg> | Amazon S3 service icon as published on aws.amazon.com (Commons copy, marked public domain there); CSS classes inlined as `fill`. Trademark of Amazon.com, Inc.; see <https://aws.amazon.com/trademark-guidelines/>. Used for the S3 backups. |
| `fakturor.svg` | <https://fakturor.cz/favicon.svg> | Official Fakturor mark, the site's own SVG favicon, unchanged. |
| `wedos.png` | <https://wedos.com/assets/logo-platform/favicon_WEDOS.png> | Official WEDOS mark from wedos.com (512 px PNG, resized to 64 px). WEDOS publishes no vector mark on its sites. Note: wedos.cz now redirects to vedos.cz (VEDOS brand for Czech hosting); the panel talks to the WEDOS registrar/WAPI, so the WEDOS mark is kept. |
| `subreg.png` | <https://subreg.cz/img/subreg-logo.png> | Official Subreg logo (174 x 60 PNG, no vector published); the blue butterfly symbol isolated by colour (wordmark pixels dropped) and padded to a 44 px square. |
| `restic.png` | <https://raw.githubusercontent.com/restic/restic/master/doc/logo/logo.png> | Official restic logo from the project repository (400 px PNG, resized to 64 px). The repository is BSD 2-Clause; the logo folder states no separate terms. |

## Skipped

- Memcached: no official vector or symbol published (memcached.org only has a JPEG banner), so the
  unit is listed without a mark.
- Fail2ban: no official logo.
- Telegram, Cloudflare (Turnstile), Docker: not shown anywhere in the panel UI, so not vendored. Simple
  Icons has all three (`telegram`, `cloudflare`, `docker`) if they are needed later.
