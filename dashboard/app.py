import functools, hashlib, json, os, secrets, socket, sqlite3, time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from flask import Flask, abort, flash, redirect, render_template, request, session, url_for
from flask_wtf.csrf import CSRFProtect, CSRFError
from werkzeug.security import check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
CONFIG=json.loads(Path(os.environ.get('VW_DASHBOARD_CONFIG','/etc/vw-dashboard/web.json')).read_text())
app=Flask(__name__)
app.config.update(SECRET_KEY=CONFIG['secret_key'],SESSION_COOKIE_NAME='__Host-vw_csrf',SESSION_COOKIE_SECURE=True,SESSION_COOKIE_HTTPONLY=True,SESSION_COOKIE_SAMESITE='Strict',MAX_CONTENT_LENGTH=16384,MAX_FORM_MEMORY_SIZE=16384,MAX_FORM_PARTS=20,TRUSTED_HOSTS=['2.31.25.249','127.0.0.1','localhost'],WTF_CSRF_SSL_STRICT=True)
app.wsgi_app=ProxyFix(app.wsgi_app,x_for=1,x_proto=1)
CSRFProtect(app)
DB=os.environ.get('VW_DASHBOARD_DB','/var/lib/vw-dashboard-web/web.sqlite')
COOKIE='__Host-vw_auth'
NAV=[('overview','Přehled'),('sites','Weby a aplikace'),('wordpress','WordPress'),('backups','Zálohy'),('billing','Klienti a expirace'),('server','Server'),('activity','Historie')]

def db():
    c=sqlite3.connect(DB);c.execute('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires REAL)');c.execute('CREATE TABLE IF NOT EXISTS failures (ip TEXT, at REAL)');c.commit();return c

def broker(op,data=None):
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as s:
        s.settimeout(300 if op=='create_site' else 30);s.connect('/run/vw-dashboard/broker.sock');s.sendall((json.dumps({'op':op,'data':data or {}})+'\n').encode())
        result=b''
        while not result.endswith(b'\n'):
            block=s.recv(65536)
            if not block:raise RuntimeError('Provozní služba neodpovídá')
            result+=block
            if len(result)>4_000_000:raise RuntimeError('Odpověď je příliš velká')
    r=json.loads(result)
    if not r['ok']:raise RuntimeError(r['error'])
    return r['data']

def authenticated():
    token=request.cookies.get(COOKIE,'')
    if not token:return False
    with db() as c:
        return c.execute('SELECT 1 FROM sessions WHERE token=? AND expires>?',(hashlib.sha256(token.encode()).hexdigest(),time.time())).fetchone() is not None

def login_required(fn):
    @functools.wraps(fn)
    def wrapped(*args,**kwargs):
        if not authenticated():return redirect(url_for('login'))
        return fn(*args,**kwargs)
    return wrapped

@app.after_request
def headers(response):
    response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; form-action 'self' https://2.31.25.249:8443; frame-ancestors 'none'; base-uri 'none'"
    response.headers['X-Content-Type-Options']='nosniff';response.headers['X-Frame-Options']='DENY';response.headers['Referrer-Policy']='same-origin';response.headers['Cache-Control']='no-store'
    return response

@app.template_filter('size')
def size(n):return f'{n/1024**3:.1f} GB' if n>=1024**3 else f'{n/1024**2:.0f} MB'
@app.template_filter('date')
def date(n):return datetime.fromtimestamp(n,ZoneInfo('Europe/Prague')).strftime('%d. %m. %Y %H:%M')

@app.route('/login',methods=['GET','POST'])
def login():
    error=None
    if request.method=='POST':
        now=time.time();ip=request.remote_addr
        with db() as c:
            c.execute('DELETE FROM failures WHERE at<?',(now-3600,));c.execute('DELETE FROM sessions WHERE expires<?',(now,))
            count=c.execute('SELECT COUNT(*) FROM failures WHERE ip=? AND at>?',(ip,now-300)).fetchone()[0]
            if count>=5:return render_template('login.html',error='Příliš mnoho pokusů. Zkuste to za pět minut.'),429
            if request.form.get('username')=='admin' and check_password_hash(CONFIG['password_hash'],request.form.get('password','')):
                token=secrets.token_urlsafe(32);c.execute('INSERT INTO sessions VALUES (?,?)',(hashlib.sha256(token.encode()).hexdigest(),now+8*3600));c.execute('DELETE FROM failures WHERE ip=?',(ip,));session.clear()
                response=redirect('/');response.set_cookie(COOKIE,token,secure=True,httponly=True,samesite='Strict',max_age=8*3600,path='/');return response
            c.execute('INSERT INTO failures VALUES (?,?)',(ip,now));error='Nesprávné přihlašovací údaje.'
    return render_template('login.html',error=error)

@app.post('/logout')
@login_required
def logout():
    with db() as c:c.execute('DELETE FROM sessions WHERE token=?',(hashlib.sha256(request.cookies[COOKIE].encode()).hexdigest(),))
    session.clear();response=redirect('/login');response.delete_cookie(COOKIE,secure=True,httponly=True,samesite='Strict');return response

@app.route('/')
@app.route('/<section>')
@login_required
def page(section='overview'):
    if section not in dict(NAV):abort(404)
    try:data=broker('snapshot');error=None
    except Exception:data=None;error='Provozní data se nepodařilo načíst. Obnovte stránku; pokud problém trvá, ověřte službu dashboardu.'
    return render_template('dashboard.html',section=section,title=dict(NAV)[section],nav=NAV,data=data,error=error,credentials=None)

@app.post('/cloudpanel')
@login_required
def cloudpanel():
    try:
        token=broker('autologin')['token']
        return redirect('https://2.31.25.249:8443/autologin?token='+token,303)
    except Exception as e:flash(str(e),'error');return redirect('/')

@app.post('/action/<action>')
@login_required
def action(action):
    allowed={'wordpress_run':'wordpress','wordpress_settings':'wordpress','hosting_settings':'billing','create_site':'sites','web_state':'sites','update_check':'server'}
    if action not in allowed:abort(404)
    data=dict(request.form);data.pop('csrf_token',None)
    for k in ['enabled','manual_hold','suspend']:data[k]=data.get(k)=='on'
    try:
        result=broker(action,data)
        if action=='create_site':
            return render_template('dashboard.html',section='sites',title='Weby a aplikace',nav=NAV,data=broker('snapshot'),error=None,credentials=result)
        flash({'wordpress_run':'Údržba byla spuštěna. Výsledek najdete v historii WordPressu.','update_check':'Kontrola byla spuštěna. Za chvíli obnovte stránku pro výsledky.'}.get(action,'Změna byla uložena.'),'success')
    except Exception as e:flash(str(e),'error')
    return redirect('/'+allowed[action])

@app.errorhandler(CSRFError)
def csrf_error(error):
    return render_template("login.html",error="Platnost formuláře vypršela. Obnovte stránku a zkuste akci znovu."),400
