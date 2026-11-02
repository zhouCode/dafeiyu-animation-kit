"""Portable WSP2 parser. RGBA palette + keyframes / XOR deltas + zlib."""
import struct,zlib

def decode(blob):
    if len(blob)<20:raise ValueError('Truncated header')
    magic,version,w,h,count,colors,fps,loop,reserved=struct.unpack_from('<4s8H',blob)
    if magic!=b'WSP2' or version!=2 or not 0<w<=2048 or not 0<h<=2048 or not 0<count<=10000 or not 0<colors<=256 or not 0<fps<=120:
        raise ValueError('Unsupported WSP2 header')
    start=20+colors*4+4*(count+1)
    if start>len(blob):raise ValueError('Truncated table')
    palette=blob[20:20+colors*4]
    offsets=struct.unpack_from('<'+'I'*(count+1),blob,20+colors*4)
    if offsets[0]!=start or offsets[-1]!=len(blob) or any(a>=b for a,b in zip(offsets,offsets[1:])):
        raise ValueError('Invalid offsets')
    frames=[];durations=[];previous=None
    for a,b in zip(offsets,offsets[1:]):
        if b-a<5:raise ValueError('Truncated frame')
        key,pad,delay=struct.unpack_from('<BBH',blob,a)
        if key not in (0,1) or delay==0 or (previous is None and not key):raise ValueError('Invalid frame header')
        inflater=zlib.decompressobj();raw=inflater.decompress(blob[a+4:b],w*h+1)
        if len(raw)!=w*h or not inflater.eof or inflater.unused_data:raise ValueError('Invalid compressed frame')
        pixels=raw if key else bytes(x^y for x,y in zip(previous,raw))
        if max(pixels)>=colors:raise ValueError('Invalid palette index')
        frames.append(pixels);durations.append(delay);previous=pixels
    return dict(width=w,height=h,count=count,fps=fps,loop=bool(loop),palette=palette,frames=frames,durations=durations)
