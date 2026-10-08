"""Read-only Fakturor adapter. Billing never changes hosting in this module."""
from datetime import datetime, time, timedelta, timezone
import json
from pathlib import Path
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

BASE = 'https://fakturor.cz/api/v1'
PRAGUE = ZoneInfo('Europe/Prague')
KEY = Path('/etc/vytvorit-web/fakturor-key')
STATUS = Path('/var/lib/vw-dashboard/billing-status.json')


class ApiError(RuntimeError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ApiError('Fakturor vrátil přesměrování; požadavek nebyl opakován.')


def get(path):
    key = KEY.read_text().strip()
    if not key.startswith('fak_') or any(c.isspace() for c in key):
        raise ApiError('API klíč není správně nastavený.')
    req = urllib.request.Request(BASE + path, headers={
        'Authorization': 'Bearer ' + key, 'Accept': 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=15) as response:
            raw = response.read(4_000_001)
            if len(raw) > 4_000_000:
                raise ApiError('Odpověď Fakturoru je příliš velká.')
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        suffix = ' Klíč je neplatný nebo vypršel.' if e.code == 401 else ''
        if e.code == 429:
            suffix = ' Další kontrola proběhne v příštím intervalu.'
        raise ApiError('Fakturor HTTP ' + str(e.code) + '.' + suffix) from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise ApiError('Fakturor je nedostupný nebo vrátil neplatnou odpověď.') from None


def moment(value):
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        raise ValueError('Čas bez časového pásma')
    return dt


def normalize(item, now, grace_days=7):
    if type(item['id']) is not int or item['id'] < 1:
        raise ValueError('Neplatné ID předplatného')
    if type(item['is_expired']) is not bool or type(item['active']) is not bool:
        raise ValueError('Neplatný stav předplatného')
    end = moment(item['expires_at'])
    checked = moment(item['checked_at'])
    if not -60 <= (now - checked).total_seconds() <= 300:
        raise ValueError('Stav předplatného není čerstvý')
    last_day = datetime.strptime(item['expires_on'], '%Y-%m-%d').date()
    expected = datetime.combine(last_day + timedelta(days=1), time(), PRAGUE)
    if end != expected or item['is_expired'] != (checked >= end):
        raise ValueError('Nesouhlasí datum a stav expirace')
    if type(grace_days) is not int or not 0 <= grace_days <= 365:
        raise ValueError('Neplatná ochranná lhůta')
    suspend_at = end.astimezone(PRAGUE) + timedelta(days=grace_days)
    return {'id': item['id'], 'name': str(item['name'])[:255],
            'expires_on': item['expires_on'], 'expires_at': end.isoformat(),
            'checked_at': checked.isoformat(), 'active': item['active'],
            'is_expired': item['is_expired'], 'suspend_at': suspend_at.isoformat(),
            'suspend_timestamp': suspend_at.timestamp(),
            'past_grace': item['is_expired'] and now >= suspend_at}


def subscriptions(now, grace_days):
    result = []
    seen = set()
    for page in range(1, 101):
        body = get('/subscriptions?per_page=100&page=' + str(page))
        if not isinstance(body.get('data'), list):
            raise ValueError('Chybí seznam předplatných')
        for item in body['data']:
            row = normalize(item, now, grace_days)
            if row['id'] in seen:
                raise ValueError('Duplicitní ID předplatného')
            seen.add(row['id']); result.append(row)
        last = body['meta']['last_page']
        if type(last) is not int or not page <= last <= 100:
            raise ValueError('Neplatné stránkování')
        if page == last:
            return result
    raise ValueError('Příliš mnoho předplatných')


def decision(subscription, hosting):
    if hosting.get('manual_hold'):
        return 'keep', 'Ruční výjimka z automatického vypínání'
    if not subscription:
        return 'unknown', 'Předplatné nebylo nalezeno; provoz zachován'
    if subscription['past_grace'] and not hosting.get('suspended'):
        return 'suspend', 'Platnost vypršela a uplynula ochranná lhůta'
    if not subscription['is_expired'] and hosting.get('suspended_by_billing') and hosting.get('suspended'):
        return 'resume', 'Fakturor potvrdil obnovenou platnost'
    return 'keep', 'Současný provozní stav zůstává'


def sync(hostings, config):
    now = datetime.now(timezone.utc)
    previous = json.loads(STATUS.read_text()) if STATUS.exists() else {}
    report = {**previous, 'attempted_at': now.timestamp(), 'error': '', 'dry_run': True}
    try:
        rows = subscriptions(now, config.get('grace_days', 7))
        by_id = {row['id']: row for row in rows}
        plans = {}
        for domain, hosting in hostings.items():
            service_id = hosting.get('subscription_id')
            if not service_id:
                continue
            sub = by_id.get(service_id)
            action, reason = decision(sub, hosting)
            plans[domain] = {'subscription_id': service_id, 'subscription': sub,
                             'proposed_action': action, 'reason': reason}
        report.update(subscriptions=rows, plans=plans, checked_at=now.timestamp())
    except (ApiError, ValueError, KeyError, TypeError, OSError) as error:
        # Keep last successful data for display only. No hosting changes on errors.
        report['error'] = (str(error) + ' ' if isinstance(error, ApiError) else 'Neplatná odpověď nebo nedostupná konfigurace. ') + 'Provoz webů zůstává beze změny; poslední úspěšná data jsou pouze informativní.'
    temporary = STATUS.with_suffix('.tmp')
    temporary.write_text(json.dumps(report, ensure_ascii=False))
    temporary.chmod(0o600); temporary.replace(STATUS)
    return report
