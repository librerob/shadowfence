"""Download current Stable Chrome for Testing for Linux CI from Google's index."""
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.request
import zipfile

if sys.platform != 'linux':
    raise SystemExit('This helper runs in Linux CI; local tests use bundled Chromium.')
index_url='https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json'
with urllib.request.urlopen(index_url, timeout=30) as response:
    stable=json.load(response)['channels']['Stable']
version=stable['version']
if not all(part.isdecimal() for part in version.split('.')) or len(version.split('.')) != 4:
    raise ValueError('Invalid browser version')
url=next(item['url'] for item in stable['downloads']['chrome'] if item['platform']=='linux64')
if url != f'https://storage.googleapis.com/chrome-for-testing-public/{version}/linux64/chrome-linux64.zip':
    raise ValueError('Unexpected browser download origin or path')
root=Path('test-results/chrome-stable').resolve()
root.mkdir(parents=True,exist_ok=True)
archive=root/'chrome.zip'
with urllib.request.urlopen(url,timeout=120) as response, archive.open('wb') as target:
    while block:=response.read(1024*1024):
        target.write(block)
sha=hashlib.sha256(archive.read_bytes()).hexdigest()
with zipfile.ZipFile(archive) as contents:
    if contents.testzip() is not None:
        raise ValueError('Browser archive failed CRC verification')
    for entry in contents.infolist():
        path=(root/entry.filename).resolve()
        if not path.is_relative_to(root):
            raise ValueError('Unsafe browser archive path')
        contents.extract(entry,root)
        if not entry.is_dir() and (entry.external_attr>>16)&0o111:
            path.chmod(0o755)
executable=root/'chrome-linux64/chrome'
with open(os.environ['GITHUB_ENV'],'a',encoding='utf-8') as env:
    env.write(f'SHADOWFENCE_CHROME_EXECUTABLE={executable}\n')
Path('test-results/chrome-stable-report.json').write_text(json.dumps({'channel':'Stable Chrome for Testing','version':version,'url':url,'archiveSha256':sha,'source':index_url},indent=2)+'\n',encoding='utf-8')
print(f'Prepared Stable Chrome for Testing {version}; archive SHA-256 {sha}')
