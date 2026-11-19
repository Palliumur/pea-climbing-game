"""Generate the repository-root entry point for GitHub Pages."""

from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = (root / "dist/index.html").read_text(encoding="utf-8")
marker = '<meta charset="utf-8">'
assert source.count(marker) == 1, "Expected one charset declaration"
page = source.replace(marker, marker + '\n  <base href="./dist/">', 1)
(root / "index.html").write_text(page, encoding="utf-8")
(root / ".nojekyll").touch()
print("GitHub Pages entry point ready: index.html")
