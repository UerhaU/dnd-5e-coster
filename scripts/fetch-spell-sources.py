import concurrent.futures
import json
from pathlib import Path
import importlib.util
import shutil

ROOT = Path(__file__).resolve().parent.parent
module = importlib.util.spec_from_file_location('catalog_source_reader', ROOT / 'scripts/audit-catalog-sources.py')
reader = importlib.util.module_from_spec(module)
module.loader.exec_module(reader)
reader.CACHE = ROOT / 'storage/spell-fill/pages'
reader.CACHE.mkdir(parents=True, exist_ok=True)
for site_id in [9, 145, 205, 210]:
    target = reader.CACHE / f'spell-{site_id}.html'
    if not target.exists():
        shutil.copyfile(ROOT / f'storage/catalog-audit/2026-10-16/spell-{site_id}.html', target)
data = json.loads((ROOT / 'storage/spell-fill/index.json').read_text(encoding='utf8'))
results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for result in pool.map(reader.fetch, [(c['url'], f"spell-{c['siteId']}") for c in data['cards']]):
        results.append(result)
        if len(results) % 50 == 0:
            print(json.dumps({'fetched': len(results), 'total': len(data['cards'])}), flush=True)
(ROOT / 'storage/spell-fill/sources.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps({'fetched': len(results), 'errors': [r for r in results if 'error' in r]}, ensure_ascii=False), flush=True)
