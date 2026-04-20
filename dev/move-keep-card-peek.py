"""Move .keep-card__peek after .keep-card__inner (sibling) so peek doesn't affect grid row height."""
import re
from pathlib import Path

PAT = re.compile(
    r"(\s*)<div class=\"keep-card__peek\">([\s\S]*?)</div>\s*"
    r"(<span class=\"keep-card__cta\">[\s\S]*?</span>)\s*"
    r"</div>\s*</span>\s*</div>",
)


def repl(m):
    indent, peek_inner, cta = m.group(1), m.group(2), m.group(3)
    # CTA stays in body; close body + inner; peek as sibling before card closes
    return (
        f"{indent}{cta}\n"
        f"          </div>\n"
        f"        </span>\n"
        f"{indent}  <div class=\"keep-card__peek\">{peek_inner}</div>\n"
        f"      </div>"
    )


def main():
    for rel in ("The Setup/the-setup.html", "Gaming/gaming.html"):
        p = Path(__file__).resolve().parent.parent / rel
        text = p.read_text(encoding="utf-8")
        new, n = PAT.subn(repl, text)
        print(f"{rel}: {n} replacements")
        p.write_text(new, encoding="utf-8")


if __name__ == "__main__":
    main()
