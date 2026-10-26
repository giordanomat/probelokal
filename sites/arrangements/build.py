# Baut die Landingpage arrangements.giordanomat.de als eine einzige HTML-Datei:
# Schriften als base64 eingebettet, 3D-Szene (three.js) als Bundle inline, keine fremden Ressourcen.
# Aufruf aus diesem Ordner: npm ci && npm run build   (schreibt ../../src/lib/sites/arrangements.html)
import base64, pathlib
here = pathlib.Path(__file__).parent
fonts = here / 'node_modules' / '@fontsource'
def b64(p): return base64.b64encode((fonts / p).read_bytes()).decode()
src = (here / 'index.src.html').read_text(encoding='utf-8')
out = (src.replace('{{FIG400}}', b64('figtree/files/figtree-latin-400-normal.woff2'))
          .replace('{{FIG700}}', b64('figtree/files/figtree-latin-700-normal.woff2'))
          .replace('{{PLEX500}}', b64('ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2'))
          .replace('{{ORCH}}', (here / 'scene' / 'orch.js').read_text(encoding='utf-8'))
          .replace('{{FALLBACK}}', (here / 'fallback.svg.txt').read_text(encoding='utf-8')))
target = here.parent.parent / 'src' / 'lib' / 'sites' / 'arrangements.html'
target.write_text(out, encoding='utf-8')
print(target, len(out) // 1024, 'KB')
