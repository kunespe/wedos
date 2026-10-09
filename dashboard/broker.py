#!/usr/bin/python3
"""Privileged, local-only operations. No arbitrary commands or paths accepted."""
import hashlib, grp, json, os, pwd, re, secrets, shutil, socketserver, sqlite3, subprocess, time
from pathlib import Path
SOCKET='/run/vw-dashboard/broker.sock'
DB='/home/clp/htdocs/app/data/db.sq3'
STATE=Path('/var/lib/vw-dashboard/state.json')
AUDIT=Path('/var/lib/vw-dashboard/audit.jsonl')
DOMAIN=re.compile(r'(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}')
SERVICES=['mysql','nginx','clp-nginx','clp-php-fpm','varnish','redis-server','php8.2-fpm','php8.3-fpm','php8.4-fpm','php8.5-fpm','memcached','ssh','fail2ban','cron','clp-agent','vw-dashboard-broker','servero-panel','grafana-server','prometheus','loki','alloy','alertmanager','vytvorit-web-wordpress.timer','vw-update-check.timer','vw-billing-check.timer']

def command(args, timeout=30):
    r=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
    if r.returncode:
        error=r.stderr+'\n'+r.stdout
        for arg in args:
            if any(key in arg.lower() for key in ['password','dbpass','secret']) and '=' in arg:error=error.replace(arg.split('=',1)[1],'[redacted]')
        Path('/var/lib/vw-dashboard/last_error.txt').write_text(error[-8000:])
        raise RuntimeError('Operace selhala. Zkontrolujte historii nebo CloudPanel.')
    return r.stdout.strip()

def sites():
    with sqlite3.connect('file:'+DB+'?mode=ro',uri=True) as c:
        c.row_factory=sqlite3.Row
        return [dict(r) for r in c.execute('SELECT id,domain_name,type,root_directory,user,application FROM site ORDER BY domain_name')]

def state():
    return json.loads(STATE.read_text()) if STATE.exists() else {}

def save(data):
    tmp=STATE.with_suffix('.tmp');tmp.write_text(json.dumps(data));os.chmod(tmp,0o600);tmp.replace(STATE)

def audit(action,details):
    with AUDIT.open('a') as f:f.write(json.dumps({'time':time.time(),'action':action,'details':details},ensure_ascii=False)+'\n')

def runtime_versions():
    result=[]
    for name,path in [('Node.js','/usr/local/bin/node'),('Bun','/usr/local/bin/bun')]:
        try:
            version=command([path,'--version'],timeout=5)
            result.append({'name':name,'version':version,'installed':True})
        except (OSError,RuntimeError,subprocess.TimeoutExpired):
            result.append({'name':name,'version':'Nelze ověřit','installed':False})
    return result

def snapshot():
    billing_path=Path('/var/lib/vw-dashboard/billing-status.json')
    billing_status=json.loads(billing_path.read_text()) if billing_path.exists() else {}
    mem=dict((x.split(':')[0],int(x.split()[1])*1024) for x in Path('/proc/meminfo').read_text().splitlines() if x.split()[1].isdigit())
    disk=shutil.disk_usage('/');data=state();rows=sites();wps=[]
    for row in rows:
        root=Path(row['root_directory'])
        if not root.is_absolute():root=Path('/home')/row['user']/'htdocs'/root
        version=root/'wp-includes/version.php'
        row['management']=dict(data.get(row['domain_name'],{}))
        row['billing_status']=billing_status.get('plans',{}).get(row['domain_name'],{})
        sub=row['billing_status'].get('subscription')
        if sub:row['management']['expires_at']=sub['expires_on']
        if version.exists():
            match=re.search(r"\$wp_version\s*=\s*['\"]([^'\"]+)",version.read_text())
            wps.append({'domain':row['domain_name'],'path':str(root),'version':match.group(1) if match else '?', 'excluded':str(root) in json.loads(Path('/etc/vytvorit-web/wordpress.json').read_text()).get('excluded_paths',[])})
    s3path=Path('/etc/vytvorit-web/s3-backup.json')
    s3cfg=json.loads(s3path.read_text()) if s3path.exists() else {}
    s3_ready=bool(s3cfg.get('ready'))
    backups=[]
    for p in sorted(Path('/var/backups/vytvorit-web').glob('*/manifest.json'),key=lambda x:x.stat().st_mtime,reverse=True):
        m=json.loads(p.read_text());remote=json.loads((p.parent/'remote.json').read_text()) if (p.parent/'remote.json').exists() else {};backups.append({'name':p.parent.name,'storage':'S3' if remote else 'Lokální','snapshot':remote.get('snapshot',''),'path':m['path'],'time':p.stat().st_mtime,'success':(p.parent/'success').exists(),'size':remote.get('size',sum(x.stat().st_size for x in p.parent.iterdir() if x.is_file()))})
    svc={name:subprocess.run(['systemctl','is-active',name],capture_output=True,text=True).stdout.strip() for name in SERVICES}
    logs=command(['journalctl','-u','vytvorit-web-wordpress.service','-n','35','--no-pager','-o','short-iso'])
    events=[]
    if AUDIT.exists():events=[json.loads(l) for l in AUDIT.read_text().splitlines()[-60:]][::-1]
    return {'sites':rows,'wordpress':wps,'backups':backups,'services':svc,'runtimes':runtime_versions(),'logs':logs,'events':events,'memory_total':mem['MemTotal'],'memory_used':mem['MemTotal']-mem['MemAvailable'],'disk_total':disk.total,'disk_used':disk.used,'load':os.getloadavg(),'uptime':float(Path('/proc/uptime').read_text().split()[0]),'billing_status':billing_status,'billing':json.loads(Path('/etc/vytvorit-web/billing.json').read_text()),'s3_ready':s3_ready,'wp_config':json.loads(Path('/etc/vytvorit-web/wordpress.json').read_text()),'updates':json.loads(Path('/var/lib/vw-dashboard/updates.json').read_text()) if Path('/var/lib/vw-dashboard/updates.json').exists() else None,'update_check_running':subprocess.run(['systemctl','is-active','vw-update-check.service'],capture_output=True,text=True).stdout.strip() in ['active','activating'],'timestamp':time.time()}

def autologin():
    # CloudPanel's native expiring token file is consumed and removed by its authenticator.
    with sqlite3.connect('file:'+DB+'?mode=ro',uri=True) as c:
        row=c.execute('SELECT status,mfa FROM user WHERE user_name=?',('admin',)).fetchone()
    if not row or not row[0]:raise ValueError('CloudPanel účet není aktivní')
    if row[1]:raise ValueError('CloudPanel má vlastní dvoufázové ověření; použijte přímé přihlášení')
    folder=Path('/home/clp/htdocs/app/files/var')
    for p in folder.glob('.token_*'):
        if p.stat().st_mtime<time.time()-120:p.unlink()
    token=secrets.token_hex(32);p=folder/('.token_'+token)
    with p.open('x') as f:json.dump({'userName':'admin','expiration':int(time.time())+30},f)
    account=pwd.getpwnam('clp');os.chown(p,account.pw_uid,account.pw_gid);os.chmod(p,0o600)
    audit('cloudpanel_login','Jednorázový vstup do CloudPanelu')
    return {'token':token}

def create(data):
    domain=str(data.get('domain','')).strip().lower()
    kind=data.get('kind')
    if not DOMAIN.fullmatch(domain) or kind not in ['static','php','wordpress','nodejs','bun']:raise ValueError('Zadejte platnou doménu a typ webu')
    if domain in [x['domain_name'] for x in sites()]:raise ValueError('Doména už existuje')
    user='vw'+secrets.token_hex(5);password=secrets.token_urlsafe(24)
    args=['clpctl','site:add:'+('php' if kind=='wordpress' else 'reverse-proxy' if kind=='bun' else kind),'--domainName='+domain,'--siteUser='+user,'--siteUserPassword='+password]
    if kind in ['php','wordpress']:args+=['--phpVersion=8.4','--vhostTemplate='+('WordPress' if kind=='wordpress' else 'Generic')]
    if kind in ['nodejs','bun']:
        port=int(data.get('port',3000))
        if not 3000<=port<=9999:raise ValueError('Port musí být mezi 3000 a 9999')
        if kind=='nodejs':args+=['--nodejsVersion=24','--appPort='+str(port)]
        else:args+=['--reverseProxyUrl=http://127.0.0.1:'+str(port)]
    command(args,180)
    credentials={'user':user,'sftp_password':password}
    save({**state(),domain:{'client':'','expires_at':'','manual_hold':False,'kind':kind,'suspended':False}})
    try:
        if kind=='wordpress':
            rows=sites();row=next(x for x in rows if x['domain_name']==domain)
            root=Path(row['root_directory'])
            if not root.is_absolute():root=Path('/home')/user/'htdocs'/root
            dbname='wp'+secrets.token_hex(5);dbpass=secrets.token_urlsafe(24);wppass=secrets.token_urlsafe(24)
            command(['clpctl','db:add','--domainName='+domain,'--databaseName='+dbname,'--databaseUserName='+dbname,'--databaseUserPassword='+dbpass],90)
            base=['runuser','-u',user,'--','/usr/bin/wp','--path='+str(root)]
            command(base+['core','download','--locale=cs_CZ'],180)
            command(base+['config','create','--dbname='+dbname,'--dbuser='+dbname,'--dbpass='+dbpass,'--dbhost=127.0.0.1'],90)
            command(base+['core','install','--url=https://'+domain,'--title='+domain,'--admin_user=admin','--admin_password='+wppass,'--admin_email=info@vytvorit-web.cz','--skip-email'],90)
            credentials['wordpress_password']=wppass
    except Exception:
        # This resource was created by this request and contains no customer data yet.
        try:command(['clpctl','site:delete','--domainName='+domain,'--force'],120)
        except Exception:pass
        audit('site_create_failed',domain)
        raise
    audit('site_create',domain+' ('+kind+')')
    return credentials

def web_state(data):
    domain=data.get('domain','')
    row=next((x for x in sites() if x['domain_name']==domain),None)
    if not row or not DOMAIN.fullmatch(domain):raise ValueError('Web nebyl nalezen')
    kind=state().get(domain,{}).get('kind',row['type']).lower()
    if kind in ['bun','nodejs','node.js','reverse proxy','reverse-proxy']:
        raise ValueError('Pozastavení aplikace vyžaduje nejdřív připojení její běžící služby. Použijte pokročilou správu v CloudPanelu.')
    target=Path('/etc/nginx/sites-enabled')/(domain+'.conf')
    if not target.is_file() or target.is_symlink():raise ValueError('Konfigurace webu vyžaduje kontrolu správce')
    state_data=state();item=state_data.setdefault(domain,{})
    suspend=data.get('suspend') is True
    if suspend==bool(item.get('suspended')):return {}
    savedir=Path('/var/lib/vw-dashboard/vhosts');savedir.mkdir(mode=0o700,exist_ok=True)
    backup=savedir/(domain+'.conf');old=target.read_text()
    if suspend:
        backup.write_text(old)
        modified=re.sub(r'\bserver\s*\{', 'server {\n  # vw-dashboard suspension\n  return 503;',old)
        if modified==old:raise ValueError('Konfigurace webu není podporovaná')
    else:
        if not backup.exists() or hashlib.sha256(old.encode()).hexdigest()!=item.get('suspension_hash'):
            raise ValueError('Nastavení webu bylo změněné mimo dashboard. Obnovení musí zkontrolovat správce.')
        modified=backup.read_text()
    target.write_text(modified)
    try:
        command(['nginx','-t']);command(['systemctl','reload','nginx'])
    except Exception:
        target.write_text(old);raise
    item['suspended']=suspend
    item['suspension_hash']=hashlib.sha256(modified.encode()).hexdigest() if suspend else ''
    save(state_data)
    # Keep scheduled WordPress maintenance from modifying a paused site.
    cfgpath=Path('/etc/vytvorit-web/wordpress.json');cfg=json.loads(cfgpath.read_text())
    root=Path(row['root_directory'])
    if not root.is_absolute():root=Path('/home')/row['user']/'htdocs'/root
    excluded=cfg.setdefault('excluded_paths',[])
    if suspend and str(root) not in excluded:excluded.append(str(root));item['wp_excluded_by_suspension']=True
    if not suspend and item.get('wp_excluded_by_suspension') and str(root) in excluded:excluded.remove(str(root));item['wp_excluded_by_suspension']=False
    cfgpath.write_text(json.dumps(cfg,indent=2));save(state_data)
    audit('web_suspend' if suspend else 'web_resume',domain)
    return {}

def dispatch(req):
    op=req.get('op');data=req.get('data',{})
    if op=='snapshot':return snapshot()
    if op=='billing_sync':
        from fakturor import sync
        report=sync(state(),json.loads(Path('/etc/vytvorit-web/billing.json').read_text()))
        audit(op,'Kontrola selhala; weby beze změny' if report.get('error') else 'Fakturor synchronizován; pouze sledování')
        return {'error':report.get('error','')}
    if op=='update_check':
        command(['systemctl','start','--no-block','vw-update-check.service']);audit(op,'Spuštěna kontrola dostupných aktualizací');return {}
    if op=='web_state':return web_state(data)
    if op=='autologin':return autologin()
    if op=='create_site':return create(data)
    if op=='wordpress_run':
        command(['systemctl','start','--no-block','vytvorit-web-wordpress.service']);audit(op,'Spuštěna údržba WordPressů');return {}
    if op=='wordpress_settings':
        p=Path('/etc/vytvorit-web/wordpress.json');cfg=json.loads(p.read_text());cfg['enabled']=data.get('enabled') is True;p.write_text(json.dumps(cfg,indent=2));audit(op,'Automatizace '+('zapnuta' if cfg['enabled'] else 'vypnuta'));return {}
    if op=='hosting_settings':
        domain=data.get('domain');found=next((x for x in sites() if x['domain_name']==domain),None)
        if not found:raise ValueError('Web nebyl nalezen')
        expiry=data.get('expires_at','')
        if expiry:
            from datetime import date
            date.fromisoformat(expiry)
        client=str(data.get('client','')).strip()
        if len(client)>120:raise ValueError('Název klienta je příliš dlouhý')
        raw_id=str(data.get('subscription_id','')).strip()
        subscription_id=int(raw_id) if raw_id.isdigit() and int(raw_id)>0 else None
        if raw_id and subscription_id is None:raise ValueError('Neplatné ID předplatného')
        if subscription_id:
            statuspath=Path('/var/lib/vw-dashboard/billing-status.json')
            known=json.loads(statuspath.read_text()).get('subscriptions',[]) if statuspath.exists() else []
            if not any(x['id']==subscription_id for x in known):raise ValueError('Předplatné není v seznamu Fakturoru')
            existing=state()
            if any(k!=domain and v.get('subscription_id')==subscription_id for k,v in existing.items()):raise ValueError('Předplatné je již přiřazené jinému webu')
        s=state();s.setdefault(domain,{}).update(client=client,expires_at=expiry,subscription_id=subscription_id,manual_hold=data.get('manual_hold') is True);save(s);audit(op,domain);return {}
    raise ValueError('Nepovolená operace')

class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        self.request.settimeout(15)
        try:
            raw=self.rfile.readline(32769)
            if len(raw)>32768:raise ValueError('Požadavek je příliš velký')
            result={'ok':True,'data':dispatch(json.loads(raw))}
        except Exception as e:
            audit('error',type(e).__name__)
            result={'ok':False,'error':str(e) if isinstance(e,ValueError) else 'Operace selhala; zkontrolujte CloudPanel a historii.'}
        self.wfile.write((json.dumps(result)+'\n').encode())

if __name__=='__main__':
    os.umask(0o077);Path(SOCKET).unlink(missing_ok=True)
    with socketserver.UnixStreamServer(SOCKET,Handler) as server:
        os.chown(SOCKET,0,grp.getgrnam('vw-dashboard').gr_gid);os.chmod(SOCKET,0o660);server.serve_forever()
