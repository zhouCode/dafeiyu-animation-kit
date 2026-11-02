import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AtlasPlayer,frameAt,frameRect,validateManifest} from '../src/atlas-player.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../assets/manifest.json',import.meta.url)));
test('current inventory contains 31 active clips and 3638 frames; no bottom route',()=>{
  validateManifest(manifest);assert.equal(manifest.clips.length,31);
  assert.equal(manifest.clips.reduce((s,c)=>s+c.count,0),3638);
  assert(!manifest.clips.some(c=>c.id.includes('bottom')));
});
test('all frame rectangles remain inside their row-major tile grid',()=>{
  for(const c of manifest.clips)for(let i=0;i<c.count;i++){
    const[x,y,w,h]=frameRect(c,i);assert(x>=0&&y>=0&&x+w<=c.cols*c.tileW&&y+h<=Math.ceil(c.count/c.cols)*c.tileH);
  }
});
test('loop includes its final frame and then wraps to the chosen first frame',()=>{
  const c={fps:24,count:124,loop:[49,98]};
  assert.equal(frameAt(c,98/24),98);assert.equal(frameAt(c,99/24),49);
  assert.equal(frameAt(c,148/24),98);assert.equal(frameAt(c,149/24),49);
  assert.equal(frameAt(c,500,false),123);
});
test('one-shot clips hold at their final frame and negative times do not underflow',()=>{
  for(const c of manifest.clips){assert.equal(frameAt(c,-1,false),0);assert.equal(frameAt(c,1000,false),c.count-1);}
});
test('reject malformed manifests and external asset paths',()=>{
  for(const change of [{src:'https://example.com/pixel.webp'},{src:'../secrets.webp'},{fps:0},{loop:[3,2]},{count:-1},{anchor:[NaN,1]}]){
    const m=structuredClone(manifest);Object.assign(m.clips[0],change);assert.throws(()=>validateManifest(m));
  }
  const m=structuredClone(manifest);m.clips.push(m.clips[0]);assert.throws(()=>validateManifest(m));
});
test('waist scale and corrected side offsets are retained',()=>{
  assert.equal(manifest.clips.find(c=>c.id==='grab_waist').displayScale,1.28);
  for(const c of manifest.clips.filter(c=>c.kind==='scene'))assert.equal(c.offset[0],c.id.endsWith('left')?-34:34);
});
test('cached idle/landing survive loading an entire six-clip interaction',async()=>{
  const oldDocument=globalThis.document,oldImage=globalThis.Image;
  globalThis.document={baseURI:'https://example.com/'};
  globalThis.Image=class{width=8192;height=8192;async decode(){}};
  try {
    const p=new AtlasPlayer(manifest,'./assets/');
    await p.preload(['idle_calm','grab','grab_waist','land']);
    const route=['walk_left','emerge_wall_left','retreat_wall_left','jump','idle_calm','land'];
    await p.preload(route);
    assert.equal(p.images.size,6);for(const id of route)assert(p.images.has(id),id);
  } finally {globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
test('late results from a cancelled sequence cannot evict the new sequence',async()=>{
  const oldDocument=globalThis.document,oldImage=globalThis.Image;
  globalThis.document={baseURI:'https://example.com/'};
  let unblock;const gate=new Promise(r=>unblock=r);
  globalThis.Image=class{width=8192;height=8192;async decode(){if(this.src.includes('walk_left'))await gate;}};
  try {
    const p=new AtlasPlayer(manifest,'./assets/',3);
    const old=p.preload(['walk_left','emerge_wall_left','retreat_wall_left']);
    await p.preload(['grab_waist','land','idle_calm']);
    unblock();await old;
    assert.equal(p.images.size,3);for(const id of ['grab_waist','land','idle_calm'])assert(p.images.has(id),id);
  } finally {globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
