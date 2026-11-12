"""Gera o script clássico para uso offline (file://) a partir dos módulos MVC."""
from pathlib import Path
import re
root = Path(__file__).parent
files = [
 'assets/js/utils/sanitize.js',
 'assets/js/models/Notebook.js',
 'assets/js/services/StorageService.js',
 'assets/js/services/ExportService.js',
 'assets/js/views/NotebookView.js',
 'assets/js/controllers/NotebookController.js',
 'assets/js/main.js',
]
parts = ['/* Message-on-paper — build offline, gerado por build.py. Edite os módulos MVC. */', '(function () {', "'use strict';"]
for file in files:
    source = (root / file).read_text(encoding='utf-8')
    source = re.sub(r'^import\s+.*?;\s*$', '', source, flags=re.M)
    source = re.sub(r'^export\s+(?=(?:class|function|const|let)\b)', '', source, flags=re.M)
    parts.extend([f'\n/* {file} */', source])
parts.append('})();\n')
out = root / 'assets/js/app.offline.js'
out.write_text('\n'.join(parts), encoding='utf-8')
print(f'Gerado {out.relative_to(root)} ({out.stat().st_size} bytes)')
