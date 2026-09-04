import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from loopctl.doctor import _quota_pair


NOW = 200000


def pool(window, value=10, age=0):
    return {"source_ts": NOW - age, window: {"used_pct": value}, "five_hour": None}


class QuotaTests(unittest.TestCase):
    def pair(self, doc):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "quota.json"
            path.write_text(json.dumps(doc))
            with patch("loopctl.doctor.usage_path", return_value=path):
                return _quota_pair("test", NOW)

    def test_fresh_sibling_does_not_hide_stale_pool(self):
        pair = self.pair({"claude": pool("weekly_all", age=41 * 3600), "codex": pool("weekly")})
        self.assertEqual(pair["state"], "stale")
        self.assertEqual(pair["age_seconds"], 41 * 3600)
        self.assertEqual(pair["pools"]["codex"]["state"], "ok")

    def test_fresh_timestamp_without_reading_is_unknown(self):
        for bad in (None, True, "10", -1, 101, float("nan")):
            with self.subTest(bad=bad):
                self.assertEqual(self.pair({"claude": pool("weekly_all", bad), "codex": pool("weekly")})["state"], "unknown")

    def test_null_optional_window_is_supported(self):
        pair = self.pair({"claude": pool("weekly_all", 0), "codex": pool("weekly"), "agy": None})
        self.assertEqual(pair["state"], "ok")
        self.assertEqual(pair["pools"]["claude"]["readings"], {"weekly_all": 0})

    def test_one_valid_window_does_not_hide_an_invalid_one(self):
        reading = pool("weekly")
        reading["five_hour"] = {"used_pct": None}
        self.assertEqual(self.pair({"codex": reading})["state"], "unknown")

    def test_absent_provider_is_not_a_configured_pool(self):
        self.assertEqual(self.pair({"claude": None, "codex": pool("weekly")})["state"], "ok")
        self.assertEqual(self.pair({"claude": None, "codex": None})["state"], "missing")

    def test_invalid_provider_or_timestamp_does_not_crash(self):
        for value in ([], "bad", {}, {"source_ts": NOW}, pool("weekly", age=-1)):
            with self.subTest(value=value):
                self.assertEqual(self.pair({"codex": value})["state"], "unknown")

    def test_sla_boundary(self):
        self.assertEqual(self.pair({"codex": pool("weekly", age=10800)})["state"], "ok")
        self.assertEqual(self.pair({"codex": pool("weekly", age=10801)})["state"], "stale")


if __name__ == "__main__":
    unittest.main()
