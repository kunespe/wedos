#!/usr/bin/python3
"""Read update metadata; never install packages or run downloaded code."""
import fcntl,json,re,subprocess,time,urllib.request
from pathlib import Path
STATE=Path('/var/lib/vw-dashboard/updates.json')

def run(args,timeout=30):
    return subprocess.run(args,capture_output=True,text=True,check=True,timeout=timeout).stdout.strip()

def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Vytvorit-web-update-check','Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r:
        data=r.read(4_000_001)
    if len(data)>4_000_000:raise ValueError('Metadata too large')
    return json.loads(data)

def version(value):
    m=re.fullmatch(r'(?:bun-)?v?(\d+)\.(\d+)\.(\d+)',value)
    if not m:raise ValueError('Invalid release version')
    return tuple(map(int,m.groups()))

def release_row(name,current,latest,note):
    return {'name':name,'current':current,'latest':latest,'status':'Dostupná aktualizace' if version(latest)>version(current) else 'Aktuální','note':note}

def main():
    lock=open('/run/vw-update-check.lock','w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    result={'time':time.time(),'components':[],'packages':None,'wordpress':[],'errors':[],'reboot_required':Path('/var/run/reboot-required').exists()}
    rows=result['components']
    try:
        run(['apt-get','update','-o','APT::Update::Error-Mode=any'],timeout=240)
        import apt
        cache=apt.Cache()
        result['packages']=[{'name':p.name,'current':p.installed.version,'latest':p.candidate.version} for p in cache if p.is_installed and p.is_upgradable]
        for name in ['cloudpanel','nginx','mysql-server','php8.2-fpm','php8.3-fpm','php8.4-fpm','php8.5-fpm','redis-server','memcached','varnish','openssh-server']:
            if name not in cache or not cache[name].is_installed:continue
            p=cache[name]
            rows.append({'name':name,'current':p.installed.version,'latest':p.candidate.version,'status':'Dostupná aktualizace' if p.is_upgradable else 'Aktuální','note':'Podle nakonfigurovaných APT repozitářů'})
    except Exception:
        result['errors'].append('Nepodařilo se obnovit seznam systémových balíčků. Aktuálnost Ubuntu/PHP/CloudPanelu nebyla ověřena.')
    for name,path in [('Node.js','/usr/local/bin/node'),('Bun','/usr/local/bin/bun')]:
        try:
            current=run([path,'--version']);v=version(current)
            if name=='Node.js':
                releases=fetch('https://nodejs.org/dist/index.json')
                matches=[r for r in releases if version(r['version'])[0]==v[0]]
                latest=max(matches,key=lambda r:version(r['version']))['version']
                note='Nejnovější vydání v používané hlavní řadě '+str(v[0])
            else:
                latest=fetch('https://api.github.com/repos/oven-sh/bun/releases/latest')['tag_name']
                note='Nejnovější stabilní vydání Bunu'
            rows.append(release_row(name,current,latest,note))
        except Exception:
            rows.append({'name':name,'current':'Nelze ověřit','latest':'Nelze ověřit','status':'Kontrola selhala','note':'Zkuste kontrolu později'})
            result['errors'].append('Kontrola '+name+' selhala.')
    import importlib.util
    from importlib.machinery import SourceFileLoader
    spec=importlib.util.spec_from_loader('maintenance',SourceFileLoader('maintenance','/usr/local/sbin/vytvorit-web-wordpress'));maintenance=importlib.util.module_from_spec(spec);spec.loader.exec_module(maintenance)
    excluded=json.loads(Path('/etc/vytvorit-web/wordpress.json').read_text()).get('excluded_paths',[])
    for site in maintenance.discover():
        entry={'path':site['path'],'status':'Ověřeno','core':[],'plugins':[],'themes':[]}
        if site['path'] in excluded:
            entry['status']='Vynecháno: pozastavený web nebo výjimka';result['wordpress'].append(entry);continue
        try:
            base=['runuser','-u',site['user'],'--','/usr/bin/wp','--path='+site['path'],'--skip-plugins','--skip-themes']
            entry['core']=json.loads(run(base+['core','check-update','--format=json'],timeout=60))
            for kind in ['plugin','theme']:
                entry[kind+'s']=json.loads(run(base+[kind,'list','--update=available','--fields=name,version,update_version','--format=json'],timeout=60))
        except Exception:
            entry['status']='Kontrola selhala';result['errors'].append('Nelze ověřit aktualizace WordPressu: '+site['path'])
        result['wordpress'].append(entry)
    result['time']=time.time()
    tmp=STATE.with_suffix('.tmp');tmp.write_text(json.dumps(result));tmp.chmod(0o600);tmp.replace(STATE)
    print('Update check finished:',len(result['packages'] or []),'package updates;',len(result['errors']),'check errors')

if __name__=='__main__':main()
