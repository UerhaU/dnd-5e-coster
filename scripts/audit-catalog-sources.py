import argparse
import concurrent.futures
import hashlib
import json
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'storage/catalog-audit/2026-10-16'


class DescriptionParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.parts = []
        self.header = []
        self.in_type = False
        self.links = []
        self.link = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'li' and 'size-type-alignment' in attrs.get('class', ''):
            self.in_type = True
        if tag == 'div' and attrs.get('itemprop') == 'description' and not self.depth:
            self.depth = 1
        elif self.depth:
            if tag == 'a' and attrs.get('href', '').startswith('/spells/'):
                self.link = {'url': 'https://5e14.dnd.su' + attrs['href'], 'text': ''}
            if tag == 'div':
                self.depth += 1
            if tag in ('p', 'li', 'tr', 'h3', 'h4'):
                self.parts.append('\n\n')
            elif tag in ('td', 'th'):
                self.parts.append(' | ')
            elif tag == 'br':
                self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag == 'a' and self.link is not None:
            self.links.append(self.link)
            self.link = None
        if tag == 'li':
            self.in_type = False
        if self.depth:
            if tag == 'div':
                self.depth -= 1
            elif tag in ('p', 'li', 'tr'):
                self.parts.append('\n\n')

    def handle_data(self, value):
        if self.depth:
            self.parts.append(value)
            if self.link is not None:
                self.link['text'] += value
        if self.in_type:
            self.header.append(value)

    def result(self):
        paragraphs = [' '.join(p.split()).strip(' |') for p in ''.join(self.parts).split('\n')]
        return {'description': '\n\n'.join(p for p in paragraphs if p), 'typeLine': ' '.join(''.join(self.header).split()), 'spellLinks': self.links}


def fetch(entry):
    url, key = entry
    path = CACHE / f'{key}.html'
    for attempt in range(3):
        try:
            if path.exists():
                html = path.read_text(encoding='utf8')
            else:
                request = urllib.request.Request(url, headers={'User-Agent': 'DND-local-catalog-audit/1.0'})
                with urllib.request.urlopen(request, timeout=35) as response:
                    if response.url.split('/')[2] != '5e14.dnd.su':
                        raise ValueError('Unexpected source host')
                    html = response.read().decode('utf8')
                path.write_text(html, encoding='utf8')
            parser = DescriptionParser()
            parser.feed(html)
            result = parser.result()
            if not result['description']:
                raise ValueError('Missing item description')
            return {'key': key, 'url': url, 'checkedOn': '2026-10-16', 'sha256': hashlib.sha256(html.encode()).hexdigest(), **result}
        except Exception as error:
            if attempt == 2:
                return {'key': key, 'url': url, 'error': str(error)}
            time.sleep(1 + attempt)


if __name__ == '__main__':
    options = argparse.ArgumentParser()
    options.add_argument('--all-equipment', action='store_true')
    args = options.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    data = json.loads((ROOT / 'database/equipment/catalog-data.json').read_text(encoding='utf8'))
    selected = data['magic'] if args.all_equipment else [e for e in data['magic'] if e['typeLine'].startswith('Доспех') or e['siteId'] == 3617]
    entries = [(e['url'], f"item-{e['siteId']}") for e in selected]
    spells = json.loads((ROOT / 'database/spells/access-export.json').read_text(encoding='utf-8-sig'))['tables']['spells']
    entries += [(e['source_url'], f"spell-{e['site_id']}") for e in spells]
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(fetch, entries):
            results.append(result)
            if len(results) % 20 == 0:
                print(json.dumps({'checked': len(results), 'total': len(entries)}, ensure_ascii=False), flush=True)
    (CACHE / 'sources.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'checked': len(results), 'errors': [r for r in results if 'error' in r]}, ensure_ascii=False), flush=True)
