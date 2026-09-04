import json
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

from loopctl import doctor


LABEL = "tools.rainforest.loop-ralph"
PLIST = {"ProgramArguments": ["/runner", "1", "10"], "EnvironmentVariables": {"PATH": "/bin", "ENDPOINT": "host-a"}}


def printed(args=("/runner", "1", "10"), env=None):
    if env is None:
        env = PLIST["EnvironmentVariables"]
    arguments = "" if args is None else "arguments = {\n" + "\n".join(args) + "\n}\n"
    return "program = /runner\n" + arguments + "default environment = {\nPATH => /default\n}\nenvironment = {\n" + "\n".join(f"{k} => {v}" for k, v in env.items()) + "\n}\n"


def result(stdout="", code=0, stderr=""):
    return subprocess.CompletedProcess([], code, stdout, stderr)


class LoadedDefinitionTests(unittest.TestCase):
    def pair(self, declared=None, observed=None):
        def run(argv, **kwargs):
            if argv[0] == "plutil":
                reading = declared
                if reading is None:
                    doc = PLIST["ProgramArguments"] if "-extract" in argv else PLIST
                    reading = result(json.dumps(doc))
            else:
                reading = observed or result(printed())
            if isinstance(reading, Exception):
                raise reading
            return reading

        with patch("subprocess.run", side_effect=run):
            return doctor._loaded_definition_pair(Path("/unused"))

    def test_matching_values_are_observed(self):
        pair = self.pair()
        self.assertTrue(pair["declared"])
        self.assertTrue(pair["observed"])
        self.assertEqual(pair["declared"], pair["observed"])
        self.assertEqual(pair["state"], "ok")

    def test_argument_boundaries_count(self):
        self.assertEqual(self.pair(observed=result(printed(("/runner", "1 10"))))["state"], "differs")

    def test_program_only(self):
        pair = self.pair(result(json.dumps({"Program": "/runner"})), result(printed(None, {})))
        self.assertEqual(pair["declared"]["arguments"], ["/runner"])
        self.assertEqual(pair["state"], "ok")

    def test_changed_removed_and_added_environment(self):
        for env in ({"PATH": "/bin", "ENDPOINT": "host-b"}, {"PATH": "/bin"}, {**PLIST["EnvironmentVariables"], "EXTRA": "1"}):
            with self.subTest(env=env):
                self.assertEqual(self.pair(observed=result(printed(env=env)))["state"], "differs")

    def test_system_environment_is_not_plist_drift(self):
        env = {**PLIST["EnvironmentVariables"], "OSLogRateLimit": "64", "XPC_SERVICE_NAME": LABEL}
        self.assertEqual(self.pair(observed=result(printed(env=env)))["state"], "ok")

    def test_read_failures_are_graded_unknown(self):
        errors = [FileNotFoundError(), result(code=1), result("not json")]
        for error in errors:
            with self.subTest(error=error):
                pair = self.pair(declared=error)
                self.assertEqual(pair["state"], "unknown")
                self.assertTrue(pair["observed"])
        for error in [subprocess.TimeoutExpired("launchctl", 10), FileNotFoundError(), result(code=1), result("program = /runner\narguments = {\n/runner")]:
            with self.subTest(error=error):
                self.assertEqual(self.pair(observed=error)["state"], "unknown")

    def test_only_explicit_service_absence_is_not_applicable(self):
        absent = result(code=113, stderr=f'Could not find service "{LABEL}" in domain for user gui: 501')
        self.assertEqual(self.pair(observed=absent)["state"], "not_applicable")
        self.assertEqual(self.pair(declared=result(code=1), observed=absent)["state"], "unknown")

    def test_report_does_not_hide_probe_failure(self):
        ok = {"id": "other", "state": "ok"}
        names = ("_engine_version_pair", "_ledger_pair", "_projects_pair", "_quota_pair", "_runner_pair")
        patches = [patch.object(doctor, name, return_value=ok) for name in names]
        for mock in patches:
            mock.start()
            self.addCleanup(mock.stop)
        with patch("subprocess.run", side_effect=[result(code=1), result(printed())]):
            self.assertEqual(doctor.report("test", now=1)["state"], "unknown")


if __name__ == "__main__":
    unittest.main()
