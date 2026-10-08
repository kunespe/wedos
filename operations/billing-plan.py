#!/usr/bin/python3
"""Read normalized billing records and produce a plan. Never mutate hosting."""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path


def plan(records, grace_days, now):
    if grace_days < 0:
        raise ValueError('Grace period must be nonnegative')
    seen = set()
    output = []
    for record in records:
        identity = record['hosting_id']
        if not isinstance(identity, str) or not identity or identity in seen:
            raise ValueError('Missing or duplicate hosting ID')
        seen.add(identity)
        expires = datetime.fromisoformat(record['expires_at'].replace('Z', '+00:00'))
        if expires.tzinfo is None:
            raise ValueError('Expiration must include timezone')
        paid = record['paid']
        if type(paid) is not bool:
            raise ValueError('paid must be a boolean')
        # A paid record must not accidentally renew an expired entitlement.
        expired = now >= expires + timedelta(days=grace_days)
        action = 'suspend' if expired and not paid else 'keep'
        if record.get('manual_hold') is True:
            output.append({'hosting_id': identity, 'proposed_action': 'keep'})
            continue
        if paid and now < expires and record.get('suspended_by_billing') is True:
            action = 'resume'
        output.append({'hosting_id': identity, 'proposed_action': action})
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('records', help='Normalized records JSON file; API adapter pending')
    parser.add_argument('--grace-days', type=int)
    args = parser.parse_args()
    config = json.loads(Path('/etc/vytvorit-web/billing.json').read_text()) if args.grace_days is None else {}
    grace = args.grace_days if args.grace_days is not None else config['grace_days']
    records = json.load(open(args.records))
    print(json.dumps({'dry_run': True, 'grace_days': grace, 'plan': plan(records, grace,
                    datetime.now(timezone.utc))}, indent=2))


if __name__ == '__main__':
    main()
