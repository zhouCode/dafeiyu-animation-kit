// SPDX-License-Identifier: MIT
import {AtlasPlayer, clamp, frameAt} from '../src/atlas-player.js';

const $ = s => document.querySelector(s);
const canvas = $('#stage'), ctx = canvas.getContext('2d');
const W = 240, H = 320, FLOOR = 286;
const groups = {all:'全部',state:'日常状态',expression:'表情与小动作',interaction:'触摸互动',edge:'屏幕边缘',locomotion:'走动与坐下'};
let player, manifest, filter='all', selected='idle_calm', loadEpoch=0, pointer=null;
let mode='idle', clipId='idle_calm', age=0, x=120, y=FLOOR, angle=0, vx=0, vy=0;
let grab='grab', held='grab', offset={x:0,y:-90}, target={x:120,y:180}, lastMove;
let queue=[], paused=matchMedia('(prefers-reduced-motion: reduce)').matches, lastTime=0, idleTime=0;
const status = text => $('#state').textContent=text;
const error = e => { $('#error').textContent='动作加载失败，请刷新重试：'+e.message; status('加载失败'); };
const duration = id => player.clips.get(id).count/player.clips.get(id).fps;
const eased = t => 1 - Math.pow(1-clamp(t,0,1),3);

function enter(next, id, label) {
  mode=next;clipId=id;age=0;status(label || player.clips.get(id)?.label || next);
  $('#timeline').max=player.clips.get(id)?.count-1 || 0;
}
function releaseCapture() {
  const id=pointer; pointer=null;
  if(id!==null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  canvas.classList.remove('holding');
}
function neutral() { queue=[];releaseCapture();x=120;y=FLOOR;angle=vx=vy=0;idleTime=0; }
async function ready(ids, after) {
  const epoch=++loadEpoch; status('正在载入…');$('#error').textContent='';
  try {await player.preload(ids);if(epoch===loadEpoch) after();}
  catch(e){if(epoch===loadEpoch)error(e);}
}
function setPaused(value){paused=value;$('#pause').textContent=value?'播放':'暂停';$('#pause').setAttribute('aria-label',value?'开始播放':'暂停播放');}
function reset(){neutral();ready(['idle_calm','grab','grab_waist','land'],()=>enter('idle','idle_calm','安静待机 · 可以拖动我'));}
function select(id) {
  neutral();selected=id;
  ready([id,'grab','grab_waist','land','idle_calm'],()=>{enter('preview',id);setPaused(false);renderActions();});
}
function nextStep() {
  if(!queue.length){neutral();enter('idle','idle_calm','我回来啦');return;}
  const step=queue.shift();enter(step.mode,step.id,step.label);Object.assign(currentStep,step);
}
const currentStep={};
function route(side, ending) {
  neutral();setPaused(false); const sign=side==='left'?-1:1;
  const walk='walk_'+side, emerge='emerge_wall_'+side, retreat='retreat_wall_'+side;
  ready([walk,emerge,retreat,'jump','idle_calm','land'],()=>{
    queue=[{mode:'walk-out',id:walk,label:'走到'+(sign<0?'左':'右')+'边',sign,length:2.2},
      {mode:'emerge',id:emerge,label:'偷偷探头',length:duration(emerge)+.8},
      ...(ending==='hide'?[{mode:'retreat',id:retreat,label:'缩回藏起来',length:duration(retreat)},
        {mode:'hidden',id:'idle_calm',label:'藏一会儿…',length:.8}]:[]),
      {mode:'jump-in',id:'jump',label:'跳回来啦',sign,length:.9},
      {mode:'landing',id:'land',label:'站稳了',length:duration('land')/1.9}];
    nextStep();
  });
}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function hit(p){
  const c=player.clips.get(clipId);if(!c||!player.images.has(clipId)||mode==='hidden')return false;
  const f=frameAt(c,age,mode==='idle'||mode==='held'),b=c.bounds?.[f];if(!b)return false;
  if(c.kind==='scene')return p.x-(c.offset?.[0]||0)>=b[0]&&p.x-(c.offset?.[0]||0)<=b[2]&&p.y>=b[1]&&p.y<=b[3];
  const s=c.displayScale||1,dx=p.x-x,dy=p.y-y,co=Math.cos(angle),si=Math.sin(angle);
  const qx=(dx*co+dy*si)/s+c.anchor[0],qy=(-dx*si+dy*co)/s+c.anchor[1];
  return qx>=b[0]&&qx<=b[2]&&qy>=b[1]&&qy<=b[3];
}
async function beginGrab(p, pointerId=null){
  const epoch=++loadEpoch;held=grab;
  try{await player.preload([held,'land','idle_calm']);}catch(e){error(e);return;}
  if(epoch!==loadEpoch || (pointerId!==null&&pointer!==pointerId))return;
  queue=[];setPaused(false);
  if(player.clips.get(clipId)?.kind==='scene'){x=p.x;y=p.y+80;}
  offset=held==='grab_waist'?{x:0,y:0}:{x:clamp(p.x-x,-35,35),y:clamp(p.y-y,-125,-40)};
  target={...p};lastMove={...p,t:performance.now()};vx=vy=0;angle=0;
  enter('held',held,held==='grab_waist'?'呜……轻一点呀':'诶？被拎起来啦！');canvas.classList.add('holding');
}
function drop(){
  if(mode!=='held'){releaseCapture();++loadEpoch;return;}
  if(performance.now()-(lastMove?.t||0)>100)vx=vy=0;
  releaseCapture();vx=clamp(vx*.45,-180,180);vy=clamp(vy*.4,-150,160);
  enter('fall',held,'哇——要落地了！');
}
canvas.addEventListener('pointerdown',e=>{
  if(!player||!hit(point(e)))return;
  e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);beginGrab(point(e),pointer);
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==pointer||mode!=='held')return;
  const p=point(e),t=performance.now(),dt=Math.max(.008,(t-lastMove.t)/1000);
  vx=clamp((p.x-lastMove.x)/dt,-800,800);vy=clamp((p.y-lastMove.y)/dt,-800,800);
  target={x:clamp(p.x,12,W-12),y:clamp(p.y,15,H-20)};lastMove={...p,t};
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(e.pointerId===pointer)drop();});
window.addEventListener('blur',()=>{if(mode==='held')drop();});
canvas.addEventListener('dblclick',e=>{if(player&&hit(point(e)))select('pet');});
canvas.addEventListener('keydown',e=>{
  if(!player)return;
  if(e.code==='Space'){e.preventDefault();mode==='held'?drop():beginGrab({x,y:y-90});}
  else if(e.code==='Escape')reset();
  else if(mode==='held'&&e.code.startsWith('Arrow')){
    e.preventDefault();target.x=clamp(target.x+(e.code==='ArrowRight'?12:e.code==='ArrowLeft'?-12:0),12,W-12);
    target.y=clamp(target.y+(e.code==='ArrowDown'?12:e.code==='ArrowUp'?-12:0),15,H-20);
  }
});
function renderActions(){
  const query=$('#search').value.trim().toLowerCase();$('#actions').replaceChildren();
  for(const c of manifest.clips){
    if(filter!=='all'&&filter!==c.category||query&&!`${c.label} ${c.id}`.toLowerCase().includes(query))continue;
    const b=document.createElement('button');b.className='action'+(c.id===selected?' selected':'');b.dataset.clip=c.id;
    const title=document.createElement('strong');title.textContent=c.label;
    const code=document.createElement('code');code.textContent=c.id;
    const detail=document.createElement('small');detail.textContent=`${c.count} 帧 · ${(c.count/c.fps).toFixed(2)}s · ${c.loop?'循环区间':'单次动作'}`;
    b.append(title,code,detail);b.onclick=()=>select(c.id);$('#actions').append(b);
  }
}
function update(dt){
  age+=dt;
  if(mode==='held'){
    const movement=performance.now()-(lastMove?.t||0)<100?vx:0;
    angle+=(clamp(-movement*.0008,-.45,.45)-angle)*Math.min(1,dt*10);
    x=target.x-(offset.x*Math.cos(angle)-offset.y*Math.sin(angle));
    y=target.y-(offset.x*Math.sin(angle)+offset.y*Math.cos(angle));
  }else if(mode==='fall'){
    const c=player.clips.get(held),b=c.bounds[frameAt(c,age,true)];
    const foot=(b?b[3]-c.anchor[1]:0)*(c.displayScale||1);
    const steps=Math.max(1,Math.ceil(dt/.016)),step=dt/steps;
    for(let i=0;i<steps&&y+foot<FLOOR;i++){vy+=850*step;x=clamp(x+vx*step,45,W-45);y+=vy*step;}
    angle*=Math.exp(-dt*5);
    if(y+foot>=FLOOR){y=FLOOR;angle=0;enter('landing','land','站稳啦');currentStep.length=duration('land')/1.9;}
  }else if(mode==='landing'){
    if(age>=currentStep.length){if(queue.length)nextStep();else{neutral();enter('idle','idle_calm');}}
  }else if(['walk-out','emerge','retreat','hidden','jump-in'].includes(mode)){
    const t=clamp(age/currentStep.length,0,1);
    if(mode==='walk-out'){x=120+currentStep.sign*230*t;y=FLOOR;}
    if(mode==='jump-in'){const start=currentStep.sign<0?-65:W+65;x=start+(120-start)*eased(t);y=FLOOR-75*Math.sin(Math.PI*t);}
    if(age>=currentStep.length)nextStep();
  }else if(mode==='preview'){
    const c=player.clips.get(clipId);
    if(!c.loop&&age>=duration(clipId)){age=(c.count-1)/c.fps;setPaused(true);}
  }else if(mode==='idle'){
    idleTime+=dt;
    if($('#auto').checked&&idleTime>12){idleTime=0;route(Math.random()<.5?'left':'right',Math.random()<.5?'hide':'jump');}
  }
}
function render(now){
  // Animation time follows elapsed time even when rendering is below 24 fps.
  // Substep falling physics instead of slowing every clip down with a dt cap.
  const dt=lastTime?Math.min((now-lastTime)/1000,2):0;lastTime=now;
  if(player){
    if(!paused&&!document.hidden)update(dt);
    ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,W,H);
    if(mode!=='hidden'){
      const c=player.clips.get(clipId);
      if(c?.kind!=='scene'&&!$('#checker').checked){ctx.fillStyle='#7089a320';ctx.beginPath();ctx.ellipse(clamp(x,15,225),FLOOR+3,29,4,0,0,Math.PI*2);ctx.fill();}
      const time=mode==='landing'?age*1.9:age;
      const frame=player.draw(ctx,clipId,time,{x,y,rotation:angle,repeat:['idle','held','fall','preview','walk-out'].includes(mode)});
      if(frame!==null){$('#timeline').value=frame;$('#frame').textContent=`${frame+1} / ${c.count}`;}
    }
  }
  requestAnimationFrame(render);
}
$('#pause').onclick=()=>{if(paused&&mode==='preview'&&age>=(duration(clipId)-1/player.clips.get(clipId).fps))age=0;setPaused(!paused);};
$('#reset').onclick=reset;
$('#timeline').oninput=e=>{if(!player)return;queue=[];releaseCapture();mode='preview';age=Number(e.target.value)/player.clips.get(clipId).fps;setPaused(true);};
$('#search').oninput=()=>player&&renderActions();
$('#checker').onchange=e=>$('#room').classList.toggle('checker',e.target.checked);
document.querySelectorAll('[data-grab]').forEach(b=>b.onclick=()=>{grab=b.dataset.grab;document.querySelectorAll('[data-grab]').forEach(x=>x.classList.toggle('active',x===b));});
document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{if(player)route(...b.dataset.route.split('-'));});
for(const[id,label]of Object.entries(groups)){
  const b=document.createElement('button');b.textContent=label;b.classList.toggle('active',id===filter);
  b.onclick=()=>{filter=id;document.querySelectorAll('#filters button').forEach(x=>x.classList.toggle('active',x===b));if(player)renderActions();};$('#filters').append(b);
}
Object.defineProperty(window,'animationState',{get:()=>({mode,clipId,age,x,y,paused,loaded:player?[...player.images.keys()]:[],queued:queue.length})});
try{
  const url=new URL('../assets/manifest.json',import.meta.url),response=await fetch(url);
  if(!response.ok)throw new Error('无法读取动作清单，请通过 HTTP 服务器打开');
  manifest=await response.json();player=new AtlasPlayer(manifest,new URL('./',url));renderActions();
  await player.preload(['idle_calm','grab','grab_waist','land']);enter('idle','idle_calm','安静待机 · 可以拖动我');
  setPaused(paused);requestAnimationFrame(render);
}catch(e){error(e);}
