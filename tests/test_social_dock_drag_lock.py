import re
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
COMPONENTS_JS = ROOT / "scripts" / "components.js"
SITE_CSS = ROOT / "css" / "owenminercs.css"


def read(path):
    return path.read_text(encoding="utf-8")


class SocialDockDragLockRegressionTest(unittest.TestCase):
    def setUp(self):
        self.components = read(COMPONENTS_JS)
        self.css = read(SITE_CSS)

    def test_first_header_drag_applies_horizontal_lock_before_measuring(self):
        drag_fn = self._function_body("initSiteSupportDockDrag")
        pointerdown = re.search(
            r"nav\.addEventListener\(\s*['\"]pointerdown['\"],\s*\(e\)\s*=>\s*\{(?P<body>.*?)\},\s*\{\s*passive:\s*false\s*\}\s*\);",
            drag_fn,
            re.S,
        )
        self.assertIsNotNone(pointerdown, "pointerdown handler not found")
        body = pointerdown.group("body")

        promoted_idx = body.find(
            "const promotedFromHeader = !wrap.classList.contains('site-support-dock--placed');"
        )
        lock_idx = body.find("setHeaderDragLock(promotedFromHeader);")
        measure_idx = body.find("const r = wrap.getBoundingClientRect();")
        append_idx = body.find("document.body.appendChild(wrap);")

        self.assertGreaterEqual(promoted_idx, 0, "drag must record whether it starts in the header")
        self.assertGreater(lock_idx, promoted_idx, "drag lock should be driven by promotedFromHeader")
        self.assertGreater(measure_idx, lock_idx, "lock must be applied before measuring the dock")
        self.assertGreater(append_idx, measure_idx, "dock should be measured before body promotion")

    def test_drag_lock_is_removed_on_all_drag_end_paths(self):
        drag_fn = self._function_body("initSiteSupportDockDrag")
        end_pointer = self._function_body("endPointer", source=drag_fn)
        lost_capture = re.search(
            r"nav\.addEventListener\(\s*['\"]lostpointercapture['\"],\s*\(e\)\s*=>\s*\{(?P<body>.*?)\}\s*\);",
            drag_fn,
            re.S,
        )
        self.assertIsNotNone(lost_capture, "lostpointercapture handler not found")

        for name, body in {
            "pointerup/pointercancel": end_pointer,
            "lostpointercapture": lost_capture.group("body"),
        }.items():
            drag_clear_idx = body.find("drag = null;")
            unlock_idx = body.find("setHeaderDragLock(false);")
            self.assertGreaterEqual(unlock_idx, 0, f"{name} path must clear horizontal drag lock")
            self.assertGreater(unlock_idx, drag_clear_idx, f"{name} path clears lock after drag state")

    def test_drag_lock_class_has_horizontal_css_geometry(self):
        self.assertIn(
            "const SOCIAL_DOCK_DRAG_LOCK_CLASS = 'site-support-dock--drag-lock-horizontal';",
            self.components,
        )
        self.assertIn(
            "#site-support-dock.site-support-dock--drag-lock-horizontal .site-social-nav__spin",
            self.css,
        )
        self.assertRegex(
            self.css,
            r"(?s)site-support-dock--drag-lock-horizontal .*?\.site-social-nav__links-level\s*\{[^}]*flex-direction:\s*row;",
            "drag lock CSS should keep link rows horizontal during the header-to-floating move",
        )
        self.assertRegex(
            self.css,
            r"(?s)site-support-dock--drag-lock-horizontal .*?\.site-social-nav__link \.site-social-nav__icon\s*\{[^}]*width:\s*19px;[^}]*height:\s*19px;",
            "drag lock CSS should preserve compact header icon geometry",
        )

    def _function_body(self, name, source=None):
        source = self.components if source is None else source
        match = re.search(rf"function {re.escape(name)}\([^)]*\)\s*\{{", source)
        self.assertIsNotNone(match, f"{name} function not found")
        start = match.end()
        depth = 1
        i = start
        while i < len(source) and depth:
            if source[i] == "{":
                depth += 1
            elif source[i] == "}":
                depth -= 1
            i += 1
        self.assertEqual(depth, 0, f"{name} function body did not parse")
        return source[start : i - 1]


if __name__ == "__main__":
    unittest.main()
