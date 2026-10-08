import importlib.util, json, os, re, secrets, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from werkzeug.security import generate_password_hash
TMP=tempfile.TemporaryDirectory()
config=Path(TMP.name)/'config.json';config.write_text(json.dumps({'secret_key':secrets.token_hex(32),'password_hash':generate_password_hash('test-only-password')}))
os.environ['VW_DASHBOARD_CONFIG']=str(config)
os.environ['VW_DASHBOARD_DB']=str(Path(TMP.name)/'db.sqlite')
import app
app.app.config['TESTING']=True

class DashboardTests(unittest.TestCase):
 def setUp(self):self.client=app.app.test_client()
 def token(self):
  r=self.client.get('/login',base_url='https://localhost')
  return re.search(r'name="csrf_token" value="([^"]+)"',r.text).group(1)
 def login(self):
  return self.client.post('/login',base_url='https://localhost',headers={'Referer':'https://localhost/login'},data={'username':'admin','password':'test-only-password','csrf_token':self.token()})
 def test_requires_login(self):
  with patch.object(app,'broker') as broker:
   r=self.client.get('/',base_url='https://localhost');self.assertEqual(r.status_code,302);broker.assert_not_called()
 def test_csrf_rejects_mutation(self):
  self.login()
  with patch.object(app,'broker') as broker:
   r=self.client.post('/action/wordpress_run',base_url='https://localhost');self.assertEqual(r.status_code,400);broker.assert_not_called()
 def test_unknown_action_rejected(self):
  self.login();token=self.token()
  with patch.object(app,'broker') as broker:
   r=self.client.post('/action/execute_shell',base_url='https://localhost',headers={'Referer':'https://localhost/'},data={'csrf_token':token});self.assertEqual(r.status_code,404);broker.assert_not_called()
 def test_auth_cookie_is_protected(self):
  r=self.login();cookies=' '.join(r.headers.getlist('Set-Cookie'))
  self.assertIn('Secure',cookies);self.assertIn('HttpOnly',cookies);self.assertIn('SameSite=Strict',cookies)
 def test_logout_revokes_session(self):
  self.login();token=self.token()
  self.client.post('/logout',base_url='https://localhost',headers={'Referer':'https://localhost/'},data={'csrf_token':token})
  self.assertEqual(self.client.get('/',base_url='https://localhost').status_code,302)
 def test_rejects_foreign_host(self):self.assertEqual(self.client.get('/',base_url='https://evil.example').status_code,400)
 def test_autologin_is_fixed_destination(self):
  self.login();token=self.token()
  with patch.object(app,'broker',return_value={'token':'abc123'}):
   r=self.client.post('/cloudpanel',base_url='https://localhost',headers={'Referer':'https://localhost/'},data={'csrf_token':token})
   self.assertEqual(r.location,'https://2.31.25.249:8443/autologin?token=abc123')

if __name__=='__main__':unittest.main()
