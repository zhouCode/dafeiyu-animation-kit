"""Verify hashes, all RGBA frames, atlas geometry, bounds and active inventory."""
from pathlib import Path
import hashlib,json,math
from PIL import Image

def validate(root):
    m=json.loads((root/'assets/manifest.json').read_text(encoding='utf8'))
    ids=set();frames=0
    assert m['schemaVersion']==1
    for c in m['clips']:
        assert c['id'] not in ids and 'bottom' not in c['id'];ids.add(c['id'])
        path=(root/'assets'/c['src']).resolve()
        assert path.is_relative_to((root/'assets').resolve())
        assert hashlib.sha256(path.read_bytes()).hexdigest()==c['sha256'],c['id']
        with Image.open(path) as atlas:
            assert atlas.mode=='RGBA',c['id']
            assert atlas.size==(c['cols']*c['tileW'],math.ceil(c['count']/c['cols'])*c['tileH']),c['id']
            for i in range(c['count']):
                x=(i%c['cols'])*c['tileW'];y=(i//c['cols'])*c['tileH']
                frame=atlas.crop((x,y,x+c['tileW'],y+c['tileH']))
                box=frame.getbbox();assert (list(box) if box else None)==c['bounds'][i],(c['id'],i)
            if c['id'].startswith('retreat_'):assert c['bounds'][-1] is None,c['id']
        if c['loop']:assert 0<=c['loop'][0]<=c['loop'][1]<c['count']
        frames+=c['count']
    assert len(ids)==31 and frames==3638
    print(json.dumps({'clips':len(ids),'frames':frames,'hashesAndPixelsValid':True}))

if __name__=='__main__':validate(Path(__file__).resolve().parents[1])
