from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
COMPONENTS_PATH = ROOT / "scripts" / "components.js"
CSS_PATH = ROOT / "css" / "owenminercs.css"


def extract_function(source: str, name: str) -> str:
    start = source.find(f"function {name}(")
    if start == -1:
        raise AssertionError(f"Could not find {name}()")
    open_brace = source.find("{", start)
    if open_brace == -1:
        raise AssertionError(f"Could not find {name}() body")

    depth = 0
    for index in range(open_brace, len(source)):
        char = source[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[start : index + 1]

    raise AssertionError(f"Could not parse {name}() body")


class SocialDockDragLockRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.components_source = COMPONENTS_PATH.read_text(encoding="utf-8")
        cls.css_source = CSS_PATH.read_text(encoding="utf-8")
        cls.drag_function = extract_function(cls.components_source, "initSiteSupportDockDrag")

    def assertRegexMatches(self, text: str, pattern: str, message: str) -> None:
        self.assertIsNotNone(re.search(pattern, text, re.S), message)

    def test_first_drag_locks_horizontal_orientation_while_promoting_from_header(self):
        self.assertRegexMatches(
            self.drag_function,
            r"function setHeaderDragLock\(enabled\)\s*\{.*?"
            r"wrap\.classList\.add\(SOCIAL_DOCK_DRAG_LOCK_CLASS\);.*?"
            r"spin\?\.style\.setProperty\('--site-social-tilt', '0deg'\);.*?"
            r"wrap\.classList\.remove\(SOCIAL_DOCK_DRAG_LOCK_CLASS\);.*?"
            r"spin\?\.style\.removeProperty\('--site-social-tilt'\);.*?\}",
            "header drag lock should force zero tilt and restore the inline tilt override",
        )
        self.assertRegexMatches(
            self.drag_function,
            r"const promotedFromHeader = !wrap\.classList\.contains\('site-support-dock--placed'\);\s*"
            r"setHeaderDragLock\(promotedFromHeader\);",
            "pointerdown should only enable the horizontal lock when the dock starts in the header",
        )
        self.assertRegexMatches(
            self.drag_function,
            r"document\.body\.appendChild\(wrap\);.*?"
            r"wrap\.style\.left = `\$\{r\.left\}px`;.*?"
            r"wrap\.style\.top = `\$\{r\.top\}px`;.*?"
            r"wrap\.classList\.add\('site-support-dock--placed'\);",
            "header-mounted dock should be promoted to fixed placement at its current screen coordinates",
        )

    def test_first_drag_always_releases_the_temporary_orientation_lock(self):
        self.assertRegexMatches(
            self.drag_function,
            r"function endPointer\(e\) \{.*?drag = null;\s*setHeaderDragLock\(false\);.*?if \(wasActive\)",
            "normal pointer release should clear the lock before finalizing active or cancelled movement",
        )
        self.assertRegexMatches(
            self.drag_function,
            r"nav\.addEventListener\('lostpointercapture', \(e\) => \{.*?"
            r"drag = null;\s*setHeaderDragLock\(false\);.*?if \(wasActive\)",
            "lost pointer capture should clear the lock before finalizing active or cancelled movement",
        )

    def test_drag_lock_css_preserves_header_style_horizontal_geometry(self):
        self.assertRegexMatches(
            self.css_source,
            r"#site-support-dock\.site-support-dock--drag-lock-horizontal \.site-social-nav__spin\s*\{\s*"
            r"--site-social-tilt: 0deg;\s*\}",
            "drag-lock class should zero visual tilt in CSS",
        )
        self.assertRegexMatches(
            self.css_source,
            r"#site-support-dock\.site-support-dock--drag-lock-horizontal \.site-social-nav__chrome,\s*"
            r"#site-support-dock\.site-support-dock--drag-lock-horizontal \.site-social-nav__main,\s*"
            r"#site-support-dock\.site-support-dock--drag-lock-horizontal \.site-social-nav__links-level\s*\{\s*"
            r"flex-direction: row;\s*align-items: center;\s*\}",
            "drag-lock class should keep the promoted dock laid out horizontally during the first drag",
        )


if __name__ == "__main__":
    unittest.main()
