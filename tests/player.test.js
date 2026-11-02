import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {frameAt,frameRect,validateManifest} from '../src/atlas-player.js';
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
