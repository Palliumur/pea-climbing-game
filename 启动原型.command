#!/bin/zsh
cd -- "$(dirname "$0")" || exit 1
exec python3 - <<'PY'
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import errno
import webbrowser

handler = partial(SimpleHTTPRequestHandler, directory=str(Path.cwd() / "dist"))
try:
    server = ThreadingHTTPServer(("127.0.0.1", 4173), handler)
except OSError as error:
    if error.errno != errno.EADDRINUSE:
        raise
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
with server:
    address = f"http://127.0.0.1:{server.server_port}/"
    print(f"豌豆攀援观察\n{address}\n关闭本窗口即可结束体验。", flush=True)
    webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
PY
