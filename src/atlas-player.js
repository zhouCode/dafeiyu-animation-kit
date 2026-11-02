// SPDX-License-Identifier: MIT
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function frameAt(clip, seconds, repeat = true) {
  const frame = Math.max(0, Math.floor(seconds * clip.fps));
  if (repeat && clip.loop && frame > clip.loop[1]) {
    const [first, last] = clip.loop;
    return first + (frame - first) % (last - first + 1);
  }
  return Math.min(frame, clip.count - 1);
}

export function frameRect(clip, frame) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= clip.count) throw new RangeError('Invalid frame');
  return [(frame % clip.cols) * clip.tileW, Math.floor(frame / clip.cols) * clip.tileH, clip.tileW, clip.tileH];
}

export function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.clips) || !manifest.clips.length) throw new Error('Invalid manifest');
  const seen = new Set();
  for (const c of manifest.clips) {
    if (!/^[a-z][a-z0-9_]*$/.test(c.id) || seen.has(c.id)) throw new Error('Duplicate or invalid clip ID');
    seen.add(c.id);
    for (const key of ['count', 'tileW', 'tileH', 'cols']) if (!Number.isInteger(c[key]) || c[key] <= 0) throw new Error('Invalid '+key);
    if (!Number.isFinite(c.fps) || c.fps <= 0 || c.fps > 120) throw new Error('Invalid fps');
    if (!/^atlases\/[a-z0-9_]+\.webp$/.test(c.src)) throw new Error('Atlas must be a local relative asset');
    if (c.loop && (c.loop.length !== 2 || !c.loop.every(Number.isInteger) || c.loop[0] < 0 || c.loop[1] < c.loop[0] || c.loop[1] >= c.count)) throw new Error('Invalid loop');
    if (!Array.isArray(c.anchor) || c.anchor.length !== 2 || !c.anchor.every(Number.isFinite)) throw new Error('Invalid anchor');
  }
  return manifest;
}

/** Lazy, bounded atlas cache. No frameworks, network services, or platform APIs. */
export class AtlasPlayer {
  constructor(manifest, baseUrl, maxCached = 6) {
    validateManifest(manifest);
    if (!Number.isInteger(maxCached) || maxCached < 1) throw new Error('Invalid cache size');
    this.manifest = manifest;
    this.baseUrl = new URL(baseUrl, document.baseURI);
    this.clips = new Map(manifest.clips.map(c => [c.id, c]));
    this.images = new Map(); this.pending = new Map(); this.maxCached = maxCached;
    this.pinned = new Set(); this.preloadEpoch = 0;
  }
  prune() {
    for (const id of this.images.keys()) {
      if (this.images.size <= this.maxCached) break;
      if (!this.pinned.has(id)) this.images.delete(id);
    }
  }
  async load(id) {
    if (!this.clips.has(id)) throw new Error('Unknown clip: '+id);
    if (this.images.has(id)) {
      const image=this.images.get(id);this.images.delete(id);this.images.set(id,image);return image;
    }
    if (this.pending.has(id)) return this.pending.get(id);
    const promise = (async () => {
      const clip = this.clips.get(id), image = new Image();
      image.src = new URL(clip.src, this.baseUrl).href;
      await image.decode();
      if (image.width < clip.cols * clip.tileW || image.height < Math.ceil(clip.count / clip.cols) * clip.tileH) throw new Error('Atlas too small: '+id);
      this.images.set(id, image);
      this.prune();
      return image;
    })();
    this.pending.set(id, promise);
    try { return await promise; } finally { this.pending.delete(id); }
  }
  async preload(ids) {
    ids=[...new Set(ids)];
    if(ids.length>this.maxCached) throw new Error('Sequence exceeds atlas cache budget');
    const epoch=++this.preloadEpoch;
    this.pinned=new Set(ids);
    const images=await Promise.all(ids.map(id=>this.load(id)));
    if(epoch===this.preloadEpoch) {
      ids.forEach((id,i)=>{this.images.delete(id);this.images.set(id,images[i]);});
    }
    this.prune();return images;
  }
  draw(ctx, id, seconds, {x = 120, y = 286, rotation = 0, scale = 1, repeat = true, frame} = {}) {
    const clip = this.clips.get(id), image = this.images.get(id);
    if (!clip || !image) return null;
    this.images.delete(id); this.images.set(id, image);
    const index = frame === undefined ? frameAt(clip, seconds, repeat) : frame;
    ctx.save();
    if (clip.kind === 'scene') {
      ctx.translate(...(clip.offset || [0, 0]));
      ctx.drawImage(image, ...frameRect(clip, index), 0, 0, ...clip.sceneSize);
    } else {
      ctx.translate(x, y); ctx.rotate(rotation);
      const s = scale * (clip.displayScale || 1); ctx.scale(s, s);
      ctx.drawImage(image, ...frameRect(clip, index), -clip.anchor[0], -clip.anchor[1], clip.tileW, clip.tileH);
    }
    ctx.restore(); return index;
  }
}
