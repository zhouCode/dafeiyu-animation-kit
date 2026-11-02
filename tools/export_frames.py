"""Export atlas cells as full RGBA PNG frames without changing their anchors."""
import argparse, json
from pathlib import Path
from PIL import Image

def export(root, output, ids=None):
    manifest=json.loads((root/'assets/manifest.json').read_text(encoding='utf8'))
    selected=[c for c in manifest['clips'] if ids is None or c['id'] in ids]
    if ids and set(ids)-{c['id'] for c in selected}:raise ValueError('Unknown clip ID')
    if output.exists() and any(output.iterdir()):raise ValueError('Output must be a new or empty directory')
    output.mkdir(parents=True,exist_ok=True)
    for c in selected:
        folder=output/c['id'];folder.mkdir()
        with Image.open(root/'assets'/c['src']) as atlas:
            atlas=atlas.convert('RGBA')
            for i in range(c['count']):
                x=(i%c['cols'])*c['tileW'];y=(i//c['cols'])*c['tileH']
                atlas.crop((x,y,x+c['tileW'],y+c['tileH'])).save(folder/f'{i:04}.png')
        metadata={k:v for k,v in c.items() if k not in ['src','sha256','cols']}
        metadata['pattern']='%04d.png'
        metadata['durationsMs']=[round((i+1)*1000/c['fps'])-round(i*1000/c['fps']) for i in range(c['count'])]
        (folder/'manifest.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf8')
    for name in ['ASSET-NOTICE.md','LICENSE-SCOPE.md']:
        (output/name).write_bytes((root/name).read_bytes())
    print(f'Exported {sum(c["count"] for c in selected)} frames / {len(selected)} clips')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',type=Path,required=True);p.add_argument('--clip',action='append')
    args=p.parse_args();export(Path(__file__).resolve().parents[1],args.output.resolve(),args.clip)
