import json
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch
import fakturor

class FakturorTests(unittest.TestCase):
    now = datetime(2026, 10, 6, 12, tzinfo=timezone.utc)

    def record(self, **changes):
        item = {'id':45,'name':'Hosting example.cz','active':True,
                'expires_on':'2026-09-28','expires_at':'2026-09-29T00:00:00+02:00',
                'is_expired':True,'checked_at':self.now.isoformat()}
        item.update(changes)
        return item

    def test_grace_boundary(self):
        before=datetime(2026,10,5,21,59,59,tzinfo=timezone.utc)
        at=datetime(2026,10,5,22,tzinfo=timezone.utc)
        self.assertFalse(fakturor.normalize(self.record(checked_at=before.isoformat()),before)['past_grace'])
        self.assertTrue(fakturor.normalize(self.record(checked_at=at.isoformat()),at)['past_grace'])

    def test_prague_calendar_grace_across_dst(self):
        now=datetime(2026,10,27,12,tzinfo=timezone.utc)
        sub=fakturor.normalize(self.record(expires_on='2026-10-23',expires_at='2026-10-24T00:00:00+02:00',checked_at=now.isoformat()),now)
        self.assertEqual(sub['suspend_at'],'2026-10-31T00:00:00+01:00')

    def test_reject_stale_inconsistent_and_naive_data(self):
        for changes in [{'checked_at':'2026-10-06T11:54:00Z'}, {'is_expired':False},
                        {'expires_at':'2026-09-29T00:00:00'}, {'expires_on':'2026-09-27'}]:
            with self.assertRaises(ValueError):fakturor.normalize(self.record(**changes),self.now)

    def test_valid_entitlement_does_not_require_payment_history_or_active_flag(self):
        sub=fakturor.normalize(self.record(expires_on='2026-11-01',expires_at='2026-11-02T00:00:00+01:00',is_expired=False,active=False),self.now)
        self.assertEqual(fakturor.decision(sub,{'suspended':False})[0],'keep')
        self.assertEqual(fakturor.decision(sub,{'suspended':True,'suspended_by_billing':True})[0],'resume')
        self.assertEqual(fakturor.decision(sub,{'suspended':True})[0],'keep')

    def test_manual_hold_prevents_suspension(self):
        sub=fakturor.normalize(self.record(),self.now)
        self.assertEqual(fakturor.decision(sub,{'manual_hold':True})[0],'keep')
        self.assertEqual(fakturor.decision(sub,{})[0],'suspend')
        self.assertEqual(fakturor.decision(None,{})[0],'unknown')

    def test_pagination_and_duplicates(self):
        pages=[{'data':[self.record()],'meta':{'last_page':2}},
               {'data':[self.record(id=46)],'meta':{'last_page':2}}]
        with patch.object(fakturor,'get',side_effect=pages):
            self.assertEqual(len(fakturor.subscriptions(self.now,7)),2)
        pages[1]['data'][0]['id']=45
        with patch.object(fakturor,'get',side_effect=pages),self.assertRaises(ValueError):
            fakturor.subscriptions(self.now,7)

    def test_api_failure_retains_last_good_snapshot_without_new_decisions(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'status.json'
            p.write_text(json.dumps({'checked_at':123,'plans':{'example.cz':{'proposed_action':'keep'}}}))
            with patch.object(fakturor,'STATUS',p),patch.object(fakturor,'subscriptions',side_effect=fakturor.ApiError('HTTP 401')):
                result=fakturor.sync({}, {'grace_days':7})
            self.assertTrue(result['error']);self.assertEqual(result['checked_at'],123)
            self.assertEqual(result['plans']['example.cz']['proposed_action'],'keep')
            self.assertTrue(result['dry_run'])

if __name__=='__main__':unittest.main()
