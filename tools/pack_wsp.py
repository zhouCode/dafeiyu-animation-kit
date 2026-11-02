"""Build a standalone WSP2 clip from an exported PNG sequence (lossy palette)."""
from pathlib import Path
import argparse,json,struct,zlib
from PIL import Image
from wsp import decode

def pack(folder,output):
    meta=json.loads((folder/'manifest.json').read_text(encoding='utf8'))
    paths=sorted(folder.glob('[0-9][0-9][0-9][0-9].png'))
    if len(paths)!=meta['count'] or not paths:raise ValueError('Frame count mismatch')
    frames=[Image.open(p).convert('RGBA') for p in paths];w,h=frames[0].size;n=len(frames)
    if n>10000 or w>512 or h>512 or any(im.size!=(w,h) for im in frames):raise ValueError('Unsupported dimensions')
    atlas=Image.new('RGBA',(w*8,h*((n+7)//8)))
    for i,im in enumerate(frames):atlas.paste(im,((i%8)*w,(i//8)*h))
    indexed=atlas.quantize(colors=255,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE)
    pal=indexed.getpalette('RGBA')[:1020];pal+=([0]*(1020-len(pal)))
    palette=bytes(4)+bytes(pal)
    remap=bytes(0 if pal[i*4+3]==0 else i+1 for i in range(255))+bytes([0])
    chunks=[];pixels=[];previous=None;fps=round(meta['fps'])
    if not 0<fps<=120:raise ValueError('Unsupported fps')
    for i in range(n):
        x=(i%8)*w;y=(i//8)*h;px=indexed.crop((x,y,x+w,y+h)).tobytes().translate(remap)
        key=i%24==0;delta=px if key else bytes(a^b for a,b in zip(previous,px));pixels.append(px);previous=px
        delay=round((i+1)*1000/fps)-round(i*1000/fps)
        chunks.append(struct.pack('<BBH',int(key),0,delay)+zlib.compress(delta,9))
    offsets=[20+len(palette)+4*(n+1)]
    for chunk in chunks:offsets.append(offsets[-1]+len(chunk))
    blob=struct.pack('<4s8H',b'WSP2',2,w,h,n,256,fps,int(bool(meta.get('loop'))),0)+palette+struct.pack('<'+'I'*(n+1),*offsets)+b''.join(chunks)
    assert decode(blob)['frames']==pixels
    if output.exists():raise ValueError('Refusing to overwrite existing output')
    output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(blob)
    print(f'{n} frames, {w} x {h}, {len(blob)} bytes; indexed pixels round-trip verified')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('frames',type=Path);p.add_argument('output',type=Path)
    a=p.parse_args();pack(a.frames,a.output)
