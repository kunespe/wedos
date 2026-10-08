#!/usr/bin/python3
"""Initialize/verify an S3 repository or restore into a NEW directory."""
import argparse,importlib.util,json,subprocess,tempfile
from importlib.machinery import SourceFileLoader
from pathlib import Path
spec=importlib.util.spec_from_loader('maintenance',SourceFileLoader('maintenance','/usr/local/sbin/vytvorit-web-wordpress'))
wp=importlib.util.module_from_spec(spec);spec.loader.exec_module(wp)
p=argparse.ArgumentParser();p.add_argument('action',choices=['init','verify','restore']);p.add_argument('--snapshot');p.add_argument('--target');args=p.parse_args()
config=Path('/etc/vytvorit-web/s3-backup.json');cfg=json.loads(config.read_text());env=wp.s3_environment(verified=False)
def run(*args):subprocess.run(['restic',*args],env=env,check=True,timeout=3600)
if args.action=='init':run('init')
if args.action in ['init','verify']:
    run('check')
    # Real encrypted upload and read-back before allowing production updates.
    with tempfile.TemporaryDirectory(prefix='vw-s3-test-') as tmp:
        path=Path(tmp);(path/'database.sql').write_text('S3 verification only\n');(path/'files.tar.gz').write_bytes(b'S3 read-back verification\n')
        snapshot=wp.upload_s3(path,{'path':'s3-connection-verification'},env)
    run('forget',snapshot)
    cfg['ready']=True;config.write_text(json.dumps(cfg,indent=2));config.chmod(0o600)
    print('S3 encrypted upload and read-back verified; WordPress backups enabled')
else:
    import re
    if not args.snapshot or not re.fullmatch('[a-f0-9]{8,64}',args.snapshot) or not args.target:p.error('Restore requires snapshot and target')
    target=Path(args.target)
    if not target.is_absolute() or target.exists():p.error('Target must be an absolute NEW directory; existing files will not be overwritten')
    run('restore',args.snapshot,'--target',str(target))
    print('Archive restored; database import and website restoration are a separate administrator step')
