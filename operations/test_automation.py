import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


def module(filename):
    spec = importlib.util.spec_from_file_location(filename.replace('-', '_'), Path(__file__).parent / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


billing = module('billing-plan.py')
wordpress = module('wp-maintenance.py')


class BillingTests(unittest.TestCase):
    now = datetime(2026, 10, 5, 12, tzinfo=timezone.utc)

    def record(self, **changes):
        data = {'hosting_id': 'client-1', 'paid': False, 'expires_at': '2026-10-02T12:00:00Z'}
        data.update(changes)
        return data

    def test_grace_boundary(self):
        self.assertEqual(billing.plan([self.record()], 3, self.now)[0]['proposed_action'], 'suspend')
        self.assertEqual(billing.plan([self.record()], 4, self.now)[0]['proposed_action'], 'keep')

    def test_only_resume_billing_suspension_and_renewed_entitlement(self):
        renewed = self.record(paid=True, expires_at='2026-11-01T00:00:00Z')
        self.assertEqual(billing.plan([renewed], 0, self.now)[0]['proposed_action'], 'keep')
        renewed['suspended_by_billing'] = True
        self.assertEqual(billing.plan([renewed], 0, self.now)[0]['proposed_action'], 'resume')
        expired = self.record(paid=True, suspended_by_billing=True)
        self.assertEqual(billing.plan([expired], 0, self.now)[0]['proposed_action'], 'keep')

    def test_reject_ambiguous_or_duplicate_data(self):
        for records in ([self.record(paid='false')], [self.record(expires_at='2026-10-01')],
                        [self.record(), self.record()]):
            with self.assertRaises(ValueError):
                billing.plan(records, 3, self.now)

    def test_seven_days_and_manual_hold(self):
        record = self.record(expires_at='2026-09-28T12:00:00Z')
        self.assertEqual(billing.plan([record], 7, self.now)[0]['proposed_action'], 'suspend')
        record['expires_at'] = '2026-09-28T12:00:01Z'
        self.assertEqual(billing.plan([record], 7, self.now)[0]['proposed_action'], 'keep')
        record.update(expires_at='2026-09-01T00:00:00Z', manual_hold=True)
        self.assertEqual(billing.plan([record], 7, self.now)[0]['proposed_action'], 'keep')


class WordPressTests(unittest.TestCase):
    def test_offsite_requirement_blocks_local_only_updates(self):
        with patch.object(wordpress, 'wp') as wp:
            with self.assertRaises(RuntimeError):
                wordpress.update({'path':'/unused','user':'test'}, {'require_offsite_backup':True})
            wp.assert_not_called()

    def test_unconfigured_s3_prevents_database_access_and_updates(self):
        with patch.object(wordpress, 's3_environment', side_effect=RuntimeError('not configured')), patch.object(wordpress, 'wp') as wp:
            with self.assertRaises(RuntimeError):
                wordpress.update({'path':'/unused','user':'test'}, {'backup_backend':'s3'})
            wp.assert_not_called()

    def test_remote_checksum_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder);(path/'database.sql').write_text('database');(path/'files.tar.gz').write_text('archive')
            completed=type('Result',(),{'returncode':0,'stdout':'{"message_type":"summary","snapshot_id":"abcdef0123456789"}'})()
            with patch.object(wordpress.subprocess,'run',return_value=completed), patch.object(wordpress,'restic_dump_digest',return_value='wrong'):
                with self.assertRaises(RuntimeError):wordpress.upload_s3(path,{'path':'/test'},{})
            self.assertFalse((path/'remote.json').exists())

    def test_failed_database_backup_prevents_updates(self):
        calls = []

        def fake_wp(site, *args, **kwargs):
            calls.append(args)
            if args[:2] == ('db', 'export'):
                raise RuntimeError('database unavailable')
            return ''

        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            site_dir = root / 'site'
            site_dir.mkdir()
            original_path = wordpress.Path

            def remap(path):
                return root / 'backups' if str(path) == '/var/backups/vytvorit-web' else original_path(path)

            with patch.object(wordpress, 'wp', fake_wp), patch.object(wordpress, 'Path', remap), \
                 patch.object(wordpress.shutil, 'disk_usage', return_value=type('Disk', (), {'free': 10 * 1024**3})()):
                with self.assertRaises(RuntimeError):
                    wordpress.update({'path': str(site_dir), 'user': 'test'}, {})
            self.assertFalse(any('update' in args for args in calls))


if __name__ == '__main__':
    unittest.main()
