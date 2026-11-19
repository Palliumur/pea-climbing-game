"""Build the double-clickable game from the same assets as the hosted page."""
import base64
import json
import re
from pathlib import Path

project = Path(__file__).resolve().parents[1]
dist = project / 'dist'


def data_url(mime, data):
    return 'data:' + mime + ';base64,' + base64.b64encode(data).decode('ascii')


def asset_url(match):
    path = dist / match[1]
    mime = {'.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png'}[path.suffix]
    return data_url(mime, path.read_bytes())


html = (dist / 'index.html').read_text()
# The fonts are embedded in the stylesheet and need no separate preload.
html = re.sub(r'  <link rel="preload"[^>]+>\n', '', html)
css = (dist / 'style.css').read_text()
html = re.sub(r'<link rel="stylesheet"[^>]+>', lambda _: '<style>' + css + '</style>', html)
html = re.sub(r'(\./(?:assets/[\w./-]+|favicon\.svg))', asset_url, html)

imports = {}
for path in [*dist.glob('*.js'), dist / 'vendor/three/three.module.js',
             dist / 'vendor/mediapipe/vision_bundle.mjs']:
    source = path.read_text()
    name = 'three' if path.name == 'three.module.js' else 'pea/' + path.name
    if path.parent == dist:
        source = re.sub(r"""(['"])\./(?:vendor/mediapipe/)?([\w.-]+\.m?js)(?:\?[^'"]*)?\1""",
                        r"'pea/\2'", source)
    if path.name == 'app.js':
        # FilesetResolver chooses the browser's SIMD or non-SIMD binary before
        # we resolve that filename to its matching embedded resource.
        wasm = "new URL('./vendor/mediapipe/wasm', import.meta.url).href"
        model = "new URL('./models/pose_landmarker_lite.task', import.meta.url).href"
        assert wasm in source and model in source
        source = source.replace('FilesetResolver.forVisionTasks(' + wasm + ')',
                                "embeddedPoseFiles(FilesetResolver)")
        source = source.replace(model, "embeddedAsset('pose_landmarker_lite.task')")
    imports[name] = data_url('text/javascript', source.encode())

resources = []
for path in [*sorted((dist / 'vendor/mediapipe/wasm').glob('*')),
             dist / 'models/pose_landmarker_lite.task']:
    mime = {'.js': 'text/javascript', '.wasm': 'application/wasm', '.task': 'application/octet-stream'}[path.suffix]
    payload = base64.b64encode(path.read_bytes()).decode('ascii')
    resources.append(f'<script type="application/octet-stream" id="{path.name}" data-mime="{mime}">{payload}</script>')

loader = """<script>
const poseUrls = new Map();
function embeddedAsset(name) {
  if (!poseUrls.has(name)) {
    const asset = document.getElementById(name);
    const bytes = Uint8Array.from(atob(asset.textContent), c => c.charCodeAt(0));
    poseUrls.set(name, URL.createObjectURL(new Blob([bytes], {type: asset.dataset.mime})));
  }
  return poseUrls.get(name);
}
async function embeddedPoseFiles(resolver) {
  const files = await resolver.forVisionTasks('');
  return {
    wasmLoaderPath: embeddedAsset(files.wasmLoaderPath.split('/').pop()),
    wasmBinaryPath: embeddedAsset(files.wasmBinaryPath.split('/').pop())
  };
}
</script>"""

html = re.sub(r'<script type="importmap">.*?</script>',
              lambda _: '<script type="importmap">' + json.dumps({'imports': imports}) + '</script>', html)
html = re.sub(r'<script type="module" src="[^"]+"></script>',
              lambda _: '\n'.join(resources + [loader, """<script type="module">import 'pea/app.js';</script>"""]), html)
(project / 'play.html').write_text(html)
