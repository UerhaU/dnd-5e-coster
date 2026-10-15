import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'database' / 'equipment'

class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables=[]; self.table=None; self.row=None; self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='table': self.table=[]
        elif self.table is not None and tag=='tr': self.row=[]
        elif self.row is not None and tag in ('td','th'): self.cell=''
    def handle_data(self,text):
        if self.cell is not None: self.cell+=text
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:
            self.row.append(' '.join(self.cell.split())); self.cell=None
        elif tag=='tr' and self.row is not None:
            self.table.append(self.row); self.row=None
        elif tag=='table' and self.table is not None:
            self.tables.append(self.table); self.table=None

for name in ('inventory','firearms'):
    parser=Tables()
    parser.feed((ROOT/(name+'.html')).read_text(encoding='utf-8'))
    (ROOT/(name+'-tables.json')).write_text(json.dumps(parser.tables,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Equipment tables extracted.')
