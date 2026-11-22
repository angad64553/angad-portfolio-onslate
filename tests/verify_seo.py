"""SEO and build-output checks for the `onslet` branch (https://angad.onslate.in/).

Runs the real build (node build.mjs) and checks what Zoho Catalyst Slate will
serve from dist/client, not just the source files.

    python3 tests/verify_seo.py

Exits non-zero and lists every failure.
"""
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree
import json
import re
import subprocess
import sys

HOST = 'https://angad.onslate.in/'
OTHER = 'https://angad64553.github.io/'
ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist/client'
INDEXABLE = {'index.html': HOST, 'resume.html': f'{HOST}resume.html'}
NOINDEX = ('404.html', 'thankyou.html')
failures = []


def check(condition, message):
    if not condition:
        failures.append(message)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta, self.canonicals, self.refs, self.ids, self.ld, self.h1 = {}, [], [], set(), [], 0
        self._ld = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.add(a['id'])
        if tag == 'h1':
            self.h1 += 1
        if tag == 'meta' and (a.get('property') or a.get('name')):
            self.meta[a.get('property') or a.get('name')] = a.get('content', '')
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonicals.append(a.get('href'))
        for attr in ('href', 'src'):
            if a.get(attr):
                self.refs.append(a[attr])
        if a.get('srcset'):
            self.refs += [part.strip().split(' ')[0] for part in a['srcset'].split(',')]
        self._ld = tag == 'script' and a.get('type') == 'application/ld+json'

    def handle_endtag(self, tag):
        if tag == 'script':
            self._ld = False

    def handle_data(self, data):
        if self._ld and data.strip():
            self.ld.append(data)


def parse(path):
    page = Page()
    page.feed(path.read_text(encoding='utf-8'))
    return page


# 1. Build exactly as Slate does.
build = subprocess.run(['node', 'build.mjs'], cwd=ROOT, capture_output=True, text=True)
if build.returncode != 0:
    sys.exit(f'FAIL: build failed\n{build.stderr}')
for name in ('index.html', 'resume.html', 'robots.txt', 'sitemap.xml', '404.html', 'thankyou.html',
             'site.css', 'main.js', 'scene.js', 'favicon.svg', 'og-image-generated.png',
             'assets/fonts/archivo-variable.woff2', 'assets/fonts/ibm-plex-mono.woff2',
             'assets/vendor/three.r128.min.js'):
    check((DIST / name).is_file(), f'build output missing {name}')
for internal in ('README.md', 'DESIGN.md', 'SEARCH-INDEXING.md', 'package.json', 'build.mjs', 'tests', '.github'):
    check(not (DIST / internal).exists(), f'build output must not contain {internal}')
check(not (ROOT / '.github').exists(), 'the onslet branch must not contain a .github directory')

# 2. Indexable pages: canonical, robots, metadata, one h1.
pages = {}
for name, url in INDEXABLE.items():
    page = pages[name] = parse(DIST / name)
    check(page.canonicals == [url], f'{name} canonical must be exactly {url}, found {page.canonicals}')
    check(page.meta.get('og:url') == url, f'{name} og:url must be {url}')
    check(page.meta.get('twitter:url') == url, f'{name} twitter:url must be {url}')
    for key in ('og:image', 'twitter:image'):
        image = page.meta.get(key, '')
        check(image.startswith(HOST) and (DIST / image.replace(HOST, '')).is_file(), f'{name} {key} must be a built file on {HOST}')
    robots = page.meta.get('robots', '')
    check('noindex' not in robots and 'nofollow' not in robots, f'{name} must be indexable, robots="{robots}"')
    check(page.meta.get('description'), f'{name} needs a meta description')
    check(page.h1 == 1, f'{name} must have exactly one h1, found {page.h1}')
    for key, value in page.meta.items():
        if key.startswith(('og:', 'twitter:')):
            check(OTHER not in value, f'{name} {key} must not reference {OTHER}')
check(len({pages[n].meta.get('description') for n in INDEXABLE}) == len(INDEXABLE), 'meta descriptions must be unique')
titles_text = [re.search(r'<title>(.*?)</title>', (DIST / n).read_text(encoding='utf-8')).group(1) for n in INDEXABLE]
check(len(set(titles_text)) == len(titles_text), 'page titles must be unique')

for name in NOINDEX:
    if (DIST / name).is_file():
        check('noindex' in parse(DIST / name).meta.get('robots', ''), f'{name} must be noindex')

# 3. JSON-LD on the homepage.
home = pages['index.html']
check(len(home.ld) == 1, 'expected one JSON-LD block on the homepage')
for block in home.ld:
    try:
        graph = json.loads(block)
    except json.JSONDecodeError as error:
        failures.append(f'JSON-LD is invalid: {error}')
        continue
    check([node.get('@type') for node in graph] == ['Person', 'WebSite', 'ProfilePage'], 'unexpected JSON-LD types')

    def walk(node, key=''):
        if isinstance(node, dict):
            for k, value in node.items():
                if k not in ('sameAs', 'worksFor'):
                    walk(value, k)
        elif isinstance(node, list):
            for value in node:
                walk(value, key)
        elif key in ('@id', 'url') and isinstance(node, str):
            check(node.startswith(HOST), f'JSON-LD {key} must be on {HOST}: {node}')

    walk(graph)
    check(OTHER in graph[0].get('sameAs', []), 'Person sameAs should list the open-source edition')
    check(graph[2].get('mainEntity', {}).get('@id') == graph[0].get('@id'), 'ProfilePage mainEntity must reference the Person')

# 4. Links in every built page resolve inside the build; anchors exist.
for path in sorted(DIST.glob('*.html')):
    page = parse(path)
    for ref in page.refs:
        if ref.startswith(('http://', 'https://', 'mailto:', 'tel:', 'data:')):
            continue
        if ref.startswith('#'):
            check(ref == '#' or ref[1:] in page.ids, f'{path.name} links to missing anchor {ref}')
            continue
        target = ref.split('?')[0].split('#')[0].lstrip('/')
        check(target in ('', './') or (DIST / target).is_file(), f'{path.name} references missing {ref}')
        check(target != 'index.html', f'{path.name} links to index.html; link to the root URL instead')
for asset in re.findall(r'url\("?(assets/[^")]+)', (DIST / 'site.css').read_text(encoding='utf-8')) + \
        re.findall(r"'(assets/[^']+)'", (DIST / 'scene.js').read_text(encoding='utf-8')):
    check((DIST / asset).is_file(), f'asset {asset} is not in the build output')
check('resume.html' in home.refs, 'the homepage must link to the résumé')
check(any(ref.startswith(OTHER) for ref in home.refs), 'the homepage should link to the open-source edition')

# 5. Sitemap.
try:
    sitemap = ElementTree.parse(DIST / 'sitemap.xml').getroot()
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    locs = [loc.text for loc in sitemap.findall('s:url/s:loc', ns)]
    check(sorted(locs) == sorted(INDEXABLE.values()), f'sitemap must list exactly the indexable pages, found {locs}')
    for lastmod in sitemap.findall('s:url/s:lastmod', ns):
        check(re.fullmatch(r'\d{4}-\d{2}-\d{2}', lastmod.text or ''), f'bad lastmod {lastmod.text}')
    for image in sitemap.iter('{http://www.google.com/schemas/sitemap-image/1.1}loc'):
        check(image.text.startswith(HOST) and (DIST / image.text.replace(HOST, '')).is_file(), f'sitemap image {image.text} missing')
    check(OTHER not in (DIST / 'sitemap.xml').read_text(encoding='utf-8'), f'sitemap must not reference {OTHER}')
except ElementTree.ParseError as error:
    failures.append(f'sitemap.xml is not valid XML: {error}')

# 6. robots.txt.
robots = (DIST / 'robots.txt').read_text(encoding='utf-8')
check(re.findall(r'(?im)^sitemap:\s*(\S+)', robots) == [f'{HOST}sitemap.xml'], f'robots.txt must declare only {HOST}sitemap.xml')
check(not re.search(r'(?im)^disallow:\s*\S', robots), 'robots.txt must not disallow anything')

if failures:
    print('FAIL:\n  - ' + '\n  - '.join(failures))
    sys.exit(1)
print(f'PASS: build output, SEO metadata, JSON-LD, links, sitemap and robots.txt are consistent for {HOST}')
