import re
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
TWITCH_UTILS = ROOT / "netlify" / "functions" / "_twitch-utils.js"


def read_source():
    return TWITCH_UTILS.read_text(encoding="utf-8")


class TwitchUtilsContractTest(unittest.TestCase):
    def setUp(self):
        self.source = read_source()

    def test_signature_verification_uses_exact_eventsub_message_order(self):
        verify_body = self._function_body("verifyTwitchSignature")
        signature_body = self._function_body("twitchSignature")

        self.assertIn(
            "const message = `${messageId}${timestamp}${rawBody}`;",
            verify_body,
            "Twitch EventSub signatures must be computed over id + timestamp + raw body",
        )
        self.assertIn("crypto.createHmac('sha256', secret)", signature_body)
        self.assertIn(".update(message)", signature_body)
        self.assertIn("`sha256=${", signature_body)

    def test_signature_verification_fails_closed_for_missing_or_malformed_inputs(self):
        verify_body = self._function_body("verifyTwitchSignature")

        self.assertRegex(
            verify_body,
            r"if \(!secret \|\| !messageId \|\| !timestamp \|\| !rawBody \|\| !signature\)\s*\{\s*return false;",
            "missing EventSub signature inputs should fail closed",
        )
        self.assertIn("crypto.timingSafeEqual", verify_body)
        self.assertRegex(
            verify_body,
            r"catch\s*\{\s*return false;\s*\}",
            "timingSafeEqual length/type errors should fail closed",
        )

    def test_normalized_event_contract_covers_counted_twitch_activity_types(self):
        body = self._function_body("normalizeTwitchEvent")

        expected_cases = {
            "channel.follow": ["type: eventTypeToLabel(subscriptionType)", "displayText: `${event.user_name || 'Someone'} followed`"],
            "channel.subscribe": ["tier,", "months,", "displayText: `${event.user_name || 'Someone'} subscribed (Tier ${tier})`"],
            "channel.subscription.gift": ["total,", "displayText: `${event.user_name || 'Someone'} gifted ${total} sub${total === 1 ? '' : 's'}`"],
            "channel.cheer": ["bits,", "displayText: `${event.user_name || 'Someone'} cheered ${bits} bits`"],
        }

        for event_type, snippets in expected_cases.items():
            self.assertIn(event_type, body)
            for snippet in snippets:
                self.assertIn(snippet, body)

        self.assertIn("userName: event.user_name || event.user_login || 'Unknown'", body)
        self.assertIn("raw: event", body)
        self.assertIn("displayText: 'New Twitch activity'", body)

    def test_exports_keep_reusable_security_and_normalization_helpers_available(self):
        exports_match = re.search(r"module\.exports\s*=\s*\{(?P<body>.*?)\};", self.source, re.S)
        self.assertIsNotNone(exports_match, "module.exports block not found")
        exports_body = exports_match.group("body")

        for name in [
            "json",
            "normalizeTwitchEvent",
            "requireEnv",
            "safeJsonParse",
            "upstashCommand",
            "upstashPipeline",
            "verifyTwitchSignature",
        ]:
            self.assertRegex(exports_body, rf"\b{re.escape(name)}\b")

    def _function_body(self, name):
        match = re.search(rf"function {re.escape(name)}\([^)]*\)\s*\{{", self.source)
        self.assertIsNotNone(match, f"{name} function not found")
        start = match.end()
        depth = 1
        i = start
        while i < len(self.source) and depth:
            if self.source[i] == "{":
                depth += 1
            elif self.source[i] == "}":
                depth -= 1
            i += 1
        self.assertEqual(depth, 0, f"{name} function body did not parse")
        return self.source[start : i - 1]


if __name__ == "__main__":
    unittest.main()
