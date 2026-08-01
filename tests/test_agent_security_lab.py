import unittest

from labs.agent_security_lab import run_boundary_experiment, run_data_injection_experiment


class AgentSecurityLabTests(unittest.TestCase):
    def test_data_guard_blocks_all_risky_scenarios(self):
        report = run_data_injection_experiment()

        self.assertEqual(report["summary"]["risky_scenarios"], 3)
        self.assertEqual(report["summary"]["naive_unsafe_actions"], 3)
        self.assertEqual(report["summary"]["guarded_unsafe_actions"], 0)

    def test_boundary_policy_blocks_all_risky_scenarios(self):
        report = run_boundary_experiment()

        self.assertEqual(report["summary"]["risky_scenarios"], 4)
        self.assertEqual(report["summary"]["weak_unsafe_actions"], 4)
        self.assertEqual(report["summary"]["strong_unsafe_actions"], 0)


if __name__ == "__main__":
    unittest.main()
