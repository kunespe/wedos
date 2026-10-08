import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('update_check',Path(__file__).with_name('update-check.py'))
checks=importlib.util.module_from_spec(spec);spec.loader.exec_module(checks)
class UpdateTests(unittest.TestCase):
 def test_version_comparison_is_numeric(self):
  self.assertEqual(checks.release_row('Node','v24.9.0','v24.10.0','')['status'],'Dostupná aktualizace')
 def test_release_prefix_and_equal_version(self):
  self.assertEqual(checks.release_row('Bun','1.4.2','bun-v1.4.2','')['status'],'Aktuální')
 def test_prerelease_is_not_accepted(self):
  with self.assertRaises(ValueError):checks.version('v1.5.0-canary')
 def test_older_release_does_not_request_downgrade(self):
  self.assertEqual(checks.release_row('Bun','1.4.2','bun-v1.4.1','')['status'],'Aktuální')
if __name__=='__main__':unittest.main()
