#!/usr/bin/python3
"""Export WordPress backup freshness as Prometheus textfile metrics.

Reads the layout written by operations/wp-maintenance.py:
  /var/backups/vytvorit-web/<user>-<parent>-<ns>/
      manifest.json   {"path": "/home/<user>/htdocs/<domain>", "user": "<user>"}
      success         marker touched after a verified backup and update
      remote.json     {"backend": "s3", "verified_at": ..., "size": ...} (S3 only)
      database.sql, files.tar.gz   (removed after a verified S3 upload)

Writes /var/lib/node_exporter/textfile/servero_backups.prom atomically. Alloy's
unix exporter (textfile collector) picks the file up. Run by
servero-backup-metrics.timer every 5 minutes.
"""
import argparse
import json
import os
from pathlib import Path
import sys
import tempfile
import time

PREFIX = 'servero_backup'


def escape(value):
    return str(value).replace('\\', '\\\\').replace('\n', '\\n').replace('"', '\\"')


def site_label(path):
    """Return the domain directory for a WordPress path (handles .../public)."""
    p = Path(path)
    return p.parent.name if p.name == 'public' else p.name


def discover(home):
    """Same discovery globs as wp-maintenance.py, without the uid checks."""
    found = {}
    for pattern in ('*/htdocs/*/wp-config.php', '*/htdocs/*/public/wp-config.php'):
        for config in sorted(home.glob(pattern)):
            path = config.parent
            if path.parts[len(home.parts)] == 'clp':
                continue
            if not (path / 'wp-includes/version.php').is_file():
                continue
            found[str(path)] = {'path': str(path), 'user': path.parts[len(home.parts)]}
    return found


def backup_size(directory):
    total = 0
    for name in ('database.sql', 'files.tar.gz'):
        try:
            total += (directory / name).stat().st_size
        except OSError:
            pass
    if total:
        return total
    try:
        return int(json.loads((directory / 'remote.json').read_text()).get('size', 0))
    except (OSError, ValueError, TypeError, AttributeError):
        return 0


def collect(backup_root, home, config):
    excluded = set()
    enabled = 1
    try:
        settings = json.loads(config.read_text())
        excluded = set(settings.get('excluded_paths', []))
        enabled = 1 if settings.get('enabled') else 0
    except (OSError, ValueError):
        pass

    sites = {}
    for path, site in discover(home).items():
        if path not in excluded:
            sites[path] = {'user': site['user'], 'last': 0.0, 'size': 0, 'count': 0,
                           'incomplete': 0, 'offsite': 0}

    if backup_root.is_dir():
        for candidate in backup_root.iterdir():
            if candidate.is_symlink() or not candidate.is_dir():
                continue
            try:
                manifest = json.loads((candidate / 'manifest.json').read_text())
                path = manifest['path']
                user = manifest['user']
            except (OSError, ValueError, KeyError, TypeError):
                continue
            if path in excluded:
                continue
            entry = sites.setdefault(path, {'user': user, 'last': 0.0, 'size': 0, 'count': 0,
                                            'incomplete': 0, 'offsite': 0})
            marker = candidate / 'success'
            if not marker.is_file():
                entry['incomplete'] += 1
                continue
            entry['count'] += 1
            mtime = marker.stat().st_mtime
            if mtime >= entry['last']:
                entry['last'] = mtime
                entry['size'] = backup_size(candidate)
                entry['offsite'] = 1 if (candidate / 'remote.json').is_file() else 0
    return sites, enabled


def render(sites, enabled, now):
    lines = []

    def metric(name, kind, help_text, rows):
        lines.append(f'# HELP {PREFIX}_{name} {help_text}')
        lines.append(f'# TYPE {PREFIX}_{name} {kind}')
        lines.extend(rows)

    def rows(key, fmt=str):
        out = []
        for path, s in sorted(sites.items()):
            labels = (f'site="{escape(site_label(path))}",user="{escape(s["user"])}",'
                      f'path="{escape(path)}"')
            out.append(f'{PREFIX}_{name_of[key]}{{{labels}}} {fmt(s[key])}')
        return out

    name_of = {'last': 'last_success_timestamp_seconds', 'size': 'size_bytes',
               'count': 'successful', 'incomplete': 'incomplete', 'offsite': 'offsite_verified'}
    metric(name_of['last'], 'gauge',
           'Unix time of the newest successful backup (0 = none yet).',
           rows('last', lambda v: f'{v:.0f}'))
    metric(name_of['size'], 'gauge', 'Size of the newest successful backup in bytes.',
           rows('size'))
    metric(name_of['count'], 'gauge', 'Successful local backup directories retained.',
           rows('count'))
    metric(name_of['incomplete'], 'gauge',
           'Backup directories without a success marker (failed or running).',
           rows('incomplete'))
    metric(name_of['offsite'], 'gauge',
           '1 when the newest successful backup was verified in S3.', rows('offsite'))
    metric('maintenance_enabled', 'gauge',
           '1 when /etc/vytvorit-web/wordpress.json has enabled=true.',
           [f'{PREFIX}_maintenance_enabled {enabled}'])
    metric('metrics_generated_timestamp_seconds', 'gauge',
           'Unix time when this file was written.',
           [f'{PREFIX}_metrics_generated_timestamp_seconds {now:.0f}'])
    return '\n'.join(lines) + '\n'


def write_atomic(target, content):
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=target.parent, prefix='.servero_backups.', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w') as handle:
            handle.write(content)
        os.chmod(tmp, 0o644)
        os.replace(tmp, target)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--backup-root', type=Path, default=Path('/var/backups/vytvorit-web'))
    parser.add_argument('--home', type=Path, default=Path('/home'))
    parser.add_argument('--config', type=Path, default=Path('/etc/vytvorit-web/wordpress.json'))
    parser.add_argument('--output', type=Path,
                        default=Path('/var/lib/node_exporter/textfile/servero_backups.prom'))
    parser.add_argument('--stdout', action='store_true', help='print instead of writing')
    args = parser.parse_args(argv)
    sites, enabled = collect(args.backup_root, args.home, args.config)
    content = render(sites, enabled, time.time())
    if args.stdout:
        sys.stdout.write(content)
    else:
        write_atomic(args.output, content)


if __name__ == '__main__':
    main()
