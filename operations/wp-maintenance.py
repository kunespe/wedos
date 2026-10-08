#!/usr/bin/python3
"""Update discovered CloudPanel WordPress sites after a verified backup."""
import argparse
import fcntl
import hashlib
import json
import logging
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import time
import tempfile

CONFIG = Path('/etc/vytvorit-web/wordpress.json')
LOG = logging.getLogger('wordpress-maintenance')


def discover(home=Path('/home')):
    sites = []
    for pattern in ('*/htdocs/*/wp-config.php', '*/htdocs/*/public/wp-config.php'):
        for config in sorted(home.glob(pattern)):
            path = config.parent
            if path.resolve() != path or not (path / 'wp-includes/version.php').is_file():
                continue
            account = pwd.getpwuid(config.stat().st_uid)
            if account.pw_uid < 1000 or account.pw_name == 'clp':
                continue
            if not path.is_relative_to(Path(account.pw_dir)):
                continue
            sites.append({'path': str(path), 'user': account.pw_name})
    return sites


def wp(site, *args, output=None):
    command = ['runuser', '-u', site['user'], '--', '/usr/bin/wp',
               '--path=' + site['path'], *args]
    result = subprocess.run(command, stdout=output or subprocess.PIPE,
                            stderr=subprocess.PIPE, text=output is None, timeout=900)
    if result.returncode:
        error = result.stderr if isinstance(result.stderr, str) else result.stderr.decode(errors='replace')
        raise RuntimeError('WP-CLI failed: ' + error[-1000:])
    return result.stdout.strip() if output is None else None


def s3_environment(config=Path('/etc/vytvorit-web/s3-backup.json'), verified=True):
    cfg = json.loads(config.read_text())
    if (verified and not cfg.get('ready')) or not re.fullmatch(r's3:https://[A-Za-z0-9.-]+(?::[0-9]+)?/[A-Za-z0-9._/-]+', cfg.get('repository', '')):
        raise RuntimeError('S3 backup is not configured and verified')
    if not cfg.get('access_key_id') or not cfg.get('secret_access_key'):
        raise RuntimeError('S3 credentials are missing')
    password = Path(cfg.get('password_file', ''))
    if not password.is_file() or not password.read_text().strip():
        raise RuntimeError('Backup encryption password is missing')
    env = os.environ.copy()
    env.update(RESTIC_REPOSITORY=cfg['repository'], RESTIC_PASSWORD_FILE=str(password),
               AWS_ACCESS_KEY_ID=cfg['access_key_id'], AWS_SECRET_ACCESS_KEY=cfg['secret_access_key'],
               AWS_DEFAULT_REGION=cfg.get('region', ''), RESTIC_CACHE_DIR='/var/cache/vytvorit-web-restic')
    return env


def file_digest(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def restic_dump_digest(env, snapshot, path):
    digest = hashlib.sha256()
    # Download and decrypt each new archive without saving another plaintext copy.
    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(['restic', 'dump', snapshot, str(path)], env=env,
                                   stdout=subprocess.PIPE, stderr=errors)
        try:
            for block in iter(lambda: process.stdout.read(1024 * 1024), b''):
                digest.update(block)
            if process.wait(timeout=30):
                raise RuntimeError('S3 backup read-back verification failed')
        finally:
            if process.poll() is None:
                process.kill();process.wait()
    return digest.hexdigest()


def upload_s3(backup, site, env):
    tag = 'site-' + hashlib.sha256(site['path'].encode()).hexdigest()[:24]
    completed = subprocess.run(['restic', 'backup', '--json', '--tag', 'vytvorit-web',
                                '--tag', tag, str(backup)], env=env,
                               capture_output=True, text=True, timeout=3600)
    if completed.returncode:
        raise RuntimeError('S3 backup upload failed; WordPress was not updated')
    summaries = [json.loads(line) for line in completed.stdout.splitlines() if line.strip()]
    summary = next((row for row in reversed(summaries) if row.get('message_type') == 'summary'), None)
    snapshot = summary.get('snapshot_id', '') if summary else ''
    if not re.fullmatch('[a-f0-9]{8,64}', snapshot):
        raise RuntimeError('S3 backup did not return a valid snapshot')
    for name in ('database.sql', 'files.tar.gz'):
        path = backup / name
        if restic_dump_digest(env, snapshot, path) != file_digest(path):
            raise RuntimeError('S3 backup checksum mismatch; WordPress was not updated')
    (backup / 'remote.json').write_text(json.dumps({'backend': 's3', 'snapshot': snapshot,
                                                  'verified_at': time.time(), 'tag': tag, 'size': sum((backup / n).stat().st_size for n in ('database.sql','files.tar.gz'))}))
    return snapshot


def update(site, settings):
    env = s3_environment() if settings.get('backup_backend') == 's3' else None
    if settings.get('require_offsite_backup') and env is None and not settings.get('backup_destination'):
        raise RuntimeError('Offsite backup is required before WordPress updates')
    path = Path(site['path'])
    wp(site, 'core', 'is-installed', '--skip-plugins', '--skip-themes')
    free = shutil.disk_usage('/').free
    size = sum(p.stat().st_size for p in path.rglob('*') if p.is_file() and not p.is_symlink())
    if free < max(5 * 1024**3, size * 3):
        raise RuntimeError('Not enough free disk space for a safe backup')
    backup = Path('/var/backups/vytvorit-web') / (site['user'] + '-' + path.parent.name + '-' + str(time.time_ns()))
    backup.mkdir(parents=True, mode=0o700)
    with (backup / 'database.sql').open('wb') as target:
        wp(site, 'db', 'export', '-', '--skip-plugins', '--skip-themes', output=target)
    with (backup / 'files.tar.gz').open('wb') as target:
        subprocess.run(['runuser', '-u', site['user'], '--', 'tar', '-czf', '-',
                        '-C', str(path), '.'], stdout=target, check=True, timeout=1800)
    # Check the archive before transferring it. Database export must also be nonempty.
    subprocess.run(['tar', '-tzf', str(backup / 'files.tar.gz')], stdout=subprocess.DEVNULL,
                   check=True, timeout=600)
    if not (backup / 'database.sql').stat().st_size:
        raise RuntimeError('Database backup is empty')
    (backup / 'manifest.json').write_text(json.dumps(site, indent=2))
    destination = str(backup)
    if env is not None:
        destination = 'S3 snapshot ' + upload_s3(backup, site, env)
    elif settings.get('backup_destination'):
        key = settings['backup_ssh_key']
        destination = settings['backup_destination'].rstrip('/') + '/' + backup.name + '/'
        # Remote root directory must exist. Checksum comparison verifies transferred content.
        ssh = 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -i ' + key
        subprocess.run(['rsync', '-az', '--checksum', '-e', ssh, str(backup) + '/', destination],
                       check=True, timeout=1800)
        verification = subprocess.run(['rsync', '-azn', '--checksum', '--itemize-changes', '-e', ssh,
                                       str(backup) + '/', destination], capture_output=True,
                                      text=True, check=True, timeout=1800)
        if verification.stdout.strip():
            raise RuntimeError('Remote backup differs from local backup')
    else:
        LOG.warning('Backup is local only; server loss is not covered')
    wp(site, 'core', 'update', '--minor')
    wp(site, 'core', 'update-db')
    wp(site, 'plugin', 'update', '--all')
    wp(site, 'theme', 'update', '--all')
    wp(site, 'core', 'verify-checksums', '--skip-plugins', '--skip-themes')
    LOG.info('Updated %s; backup %s', path, destination)
    (backup / 'success').touch()
    if env is not None:
        # The remote archives were downloaded, decrypted and compared before updates.
        (backup / 'database.sql').unlink()
        (backup / 'files.tar.gz').unlink()
        try:
            tag = json.loads((backup / 'remote.json').read_text())['tag']
            subprocess.run(['restic', 'forget', '--tag', tag, '--group-by', 'tags',
                            '--keep-last', str(max(2, settings.get('s3_retention_count', 2))),
                            '--prune'], env=env, capture_output=True, check=True, timeout=3600)
        except Exception:
            LOG.warning('S3 retention cleanup failed; remote backups were preserved')
    # Preserve failed updates for manual recovery; rotate only our successful backups for this site.
    previous = []
    for candidate in backup.parent.iterdir():
        if candidate.is_symlink() or not (candidate / 'success').is_file():
            continue
        try:
            manifest = json.loads((candidate / 'manifest.json').read_text())
        except (OSError, ValueError):
            continue
        if manifest == site:
            previous.append(candidate)
    previous.sort(key=lambda p: p.stat().st_mtime_ns, reverse=True)
    for old in previous[max(1, settings.get('local_retention_count', 2)):]:
        shutil.rmtree(old)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    if args.discover:
        print(json.dumps(discover(), indent=2))
        return
    settings = json.loads(CONFIG.read_text())
    sites = discover()
    LOG.info('Discovered %d WordPress sites', len(sites))
    if args.dry_run:
        print(json.dumps(sites, indent=2))
        return
    if not settings.get('enabled'):
        LOG.info('Updates disabled in configuration')
        return
    if settings.get('backup_destination') and not re.fullmatch(r'[A-Za-z0-9_.-]+@[A-Za-z0-9.-]+:/[A-Za-z0-9_./-]+', settings['backup_destination']):
        raise RuntimeError('Invalid backup destination; expected user@host:/absolute/path')
    if settings.get('backup_destination') and not re.fullmatch(r'/[A-Za-z0-9_./-]+', settings.get('backup_ssh_key', '')):
        raise RuntimeError('Invalid backup SSH key path')
    lock = open('/run/vytvorit-web-wordpress.lock', 'w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    os.umask(0o077)
    failures = 0
    for site in sites:
        if site['path'] in settings.get('excluded_paths', []):
            continue
        try:
            update(site, settings)
        except Exception:
            LOG.exception('Update failed for %s; inspect backup and site before retrying', site['path'])
            failures += 1
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
