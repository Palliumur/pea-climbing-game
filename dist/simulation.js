import {smooth,lerp,distance,organShape,coiledPath,development} from './growth.js?v=wrap-smooth-1';
import {SUPPORTS,shellGap,firstTouch} from './supports.js';
export const CONFIG=Object.freeze({poleX:.72,poleRadius:.10,poleHeight:10.5,growthSpeed:.061,turnRate:.25,orbitPeriod:10.8,wrapDuration:8.4,minY:.22,maxY:10.0,maxX:5.2,maxAngle:65*Math.PI/180});
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
// Use the whole torso axis. Arm, hand and head poses do not control direction.
export function bodyPoseFromLandmarks(landmarks,aspect=1){
 const ids=[11,12,23,24];
 if(ids.some(i=>{const p=landmarks?.[i];return !p||(p.visibility??1)<.55||p.x<0||p.x>1||p.y<0||p.y>1;}))return null;
 const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:((a.z??0)+(b.z??0))/2});
 const shoulders=midpoint(landmarks[11],landmarks[12]),hips=midpoint(landmarks[23],landmarks[24]);
 const height=hips.y-shoulders.y;if(height<.08)return null;
 // Mirror x to agree with the on-screen preview. Moving across the picture
 // without leaning does not change this shoulder-to-hip angle.
 const tilt=Math.atan2((hips.x-shoulders.x)*aspect,height),dead=3*Math.PI/180,maxLean=25*Math.PI/180;
 const amount=clamp((Math.abs(tilt)-dead)/(maxLean-dead),0,1);
 return {shoulders,hips,tilt,direction:Math.sign(tilt)*amount*CONFIG.maxAngle};
}
export function directionFromLandmarks(landmarks,aspect=1){return bodyPoseFromLandmarks(landmarks,aspect)?.direction??null;}
// Pitch relative to the hips is translation invariant in world-landmark space.
export function torsoPitch(points){
 const joints=[11,12,23,24].map(i=>points?.[i]);
 if(joints.some(p=>!p||!Number.isFinite(p.z)||!Number.isFinite(p.y)||(p.visibility??1)<.55))return null;
 const [a,b,c,d]=joints, height=(c.y+d.y-a.y-b.y)/2;
 return height>.12?Math.atan2((c.z+d.z-a.z-b.z)/2,height):null;
}
export function shoulderSpanSignal(points){
 const a=points?.[11],b=points?.[12];
 if(!a||!b)return null;
 const width=Math.abs(a.x-b.x);
 return width>.05?2*Math.log(width):null;
}
export class DepthInput{
 constructor(){this.reset();}
 reset(){this.samples=[];this.neutral=null;this.filtered=0;}
 update(pitch,dt){
  if(pitch===null){this.filtered=0;return 0;}
  if(this.neutral===null){
   this.samples.push(pitch);
   if(this.samples.length>=10)this.neutral=[...this.samples].sort((a,b)=>a-b)[5];
   return 0;
  }
  const delta=pitch-this.neutral;
  this.filtered+=(delta-this.filtered)*(1-Math.exp(-Math.min(dt,.25)/.22));
  const degrees=this.filtered*180/Math.PI;
  return Math.sign(degrees)*clamp((Math.abs(degrees)-4)/15,0,1)*Math.PI/3;
 }
}
const variation=(id,salt=0)=>{const v=Math.sin(id*127.1+salt*311.7)*43758.5453;return v-Math.floor(v);};
function organTraits(id){
 return {tendrilCount:id<2?0:[1,2,1,2,2,1,3][id%7],leafPairs:id===0?1:2,
   scale:.77+variation(id,1)*.17,spreadVariation:(variation(id,2)-.5)*.24,
   depthVariation:(variation(id,3)-.5)*.20,branchVariation:variation(id,4)};
}
export class PeaSimulation{
 constructor(supports=SUPPORTS){this.supports=supports;this.reset();}
 reset(){
  this.nodes=[{x:-1.04,y:-1.1,z:0,s:-3.45},{x:-1.08,y:.20,z:.01,s:-2.15},{x:-.97,y:.80,z:0,s:-1.55},{x:-1.03,y:1.35,z:.015,s:-1},{x:-.82,y:1.95,z:0,s:-.4},{x:-.88,y:2.35,z:0,s:0}];
  this.head={...this.nodes.at(-1)};this.angle=0;this.targetAngle=0;this.depthAngle=0;this.targetDepth=0;this.time=0;this.phase='exploring';this.travel=0;this.revision=0;this.blocked=false;
  this.connections=[];this.anchor=null;this.wrapProgress=0;this.waveOrigin=0;this.bendOriginAngle=0;this.lockedS=-Infinity;this.nextNode=.52;
  this.organs=[{id:0,at:-1.66,born:-55,side:-1},{id:1,at:-1.03,born:-38,side:1},{id:2,at:-.36,born:-20,side:-1},{id:3,at:0,born:-1,side:1}].map(o=>({...o,...organTraits(o.id)}));
  this.updateTip();
 }
 setDirection(radians,depth=0){
  this.targetAngle=clamp(radians,-CONFIG.maxAngle,CONFIG.maxAngle);
  this.targetDepth=clamp(depth,-Math.PI/3,Math.PI/3);
 }
 deformation(s){
  const start=Math.max(this.travel-1.05,this.lockedS),w=smooth((s-start)/Math.max(.05,this.travel-start));
  const p=this.time*Math.PI*2/CONFIG.orbitPeriod,q=this.waveOrigin*Math.PI*2/CONFIG.orbitPeriod;
  return{x:((Math.sin(p)-Math.sin(q))*.10+.24*(Math.sin(this.angle)-Math.sin(this.bendOriginAngle)))*w*w,y:0,z:(Math.cos(p)-Math.cos(q))*.055*w*w};
 }
 stemPoint(s){
  const all=[...this.nodes];if(distance(all.at(-1),this.head)>1e-7)all.push(this.head);
  let a=all[0],b=all[1];
  for(let i=1;i<all.length;i++){b=all[i];if(s<=b.s)break;a=b;}
  const t=clamp((s-a.s)/(b.s-a.s||1),0,1),p=lerp(a,b,t),d=this.deformation(s);
  return{x:p.x+d.x,y:p.y+d.y,z:p.z+d.z,s};
 }
 stemPoints(){return [...this.nodes.filter(n=>n.s<this.head.s-1e-7),this.head].map(p=>this.stemPoint(p.s));}
 shape(organ){
  if(organ.attachedShape)return {...organ.attachedShape,age:this.time-organ.born,development:development(this.time-organ.born)};
  const a=this.stemPoint(organ.at-.035),b=this.stemPoint(Math.min(this.head.s,organ.at+.035));
  const dy=b.y-a.y,dz=b.z-a.z;
  const heading=Math.atan2(b.x-a.x,Math.hypot(dy,dz));
  const base=this.stemPoint(organ.at),shape=organShape(organ,base,this.time,heading);
  // The leaf starts in the local plane of the shoot, including its depth tilt.
  const pitch=Math.atan2(dz,dy),cos=Math.cos(pitch),sin=Math.sin(pitch);
  const tilt=p=>{
   const y=p.y-base.y,z=p.z-base.z;
   return {x:p.x,y:base.y+y*cos-z*sin,z:base.z+y*sin+z*cos};
  };
  shape.rachis=shape.rachis.map(tilt);
  shape.paths=shape.paths.map(path=>path.map(tilt));
  return shape;
 }
 tendrilPaths(organ,shape=this.shape(organ)){
  const c=organ.contact;
  if(!c)return shape.paths;
  const paths=shape.paths.slice();
  const wrapped=coiledPath(c,c.progress,this.supports.find(s=>s.id===c.supportId));
  paths[c.branch]=wrapped;
  if(c.branch===0&&c.progress>0){
   // Keep daughter filaments on the same material point of the main tendril.
   const main=shape.paths[0];
   shape.forks.forEach((fraction,i)=>{
    const source=paths[i+1][0],index=fraction*(main.length-1);
    let root;
    if(index<=c.index-1){
     const j=Math.floor(index);
     root=lerp(wrapped[j],wrapped[j+1],index-j);
    }else if(index<c.index&&distance(main[c.index-1],source)<=distance(main[c.index-1],c)){
     const t=distance(main[c.index-1],source)/(distance(main[c.index-1],c)||1);
     root=lerp(wrapped[c.index-1],wrapped[c.index],t);
    }else{
     const length=c.original.slice(c.index+1).reduce((n,q,j)=>n+distance(q,c.original[c.index+j]),0);
     const beyond=(main.length-1-index)*distance(main[0],main[1]);
     const u=clamp(1-beyond/(length||1),0,1);
     const k=c.index+u*(wrapped.length-1-c.index),j=Math.min(wrapped.length-2,Math.floor(k));
     root=lerp(wrapped[j],wrapped[j+1],k-j);
    }
    paths[i+1]=paths[i+1].map(q=>({x:q.x+root.x-source.x,y:q.y+root.y-source.y,z:q.z+root.z-source.z}));
   });
  }
  return paths;
 }
 updateTip(){
  const wrapping=this.organs.findLast(o=>o.contact&&o.contact.progress<1);
  const exploring=this.organs.findLast(o=>o.tendrilCount>0&&!o.contact&&this.time-o.born>5);
  const active=wrapping??exploring??this.organs.findLast(o=>o.tendrilCount>0);
  this.tip={...this.tendrilPaths(active)[active.contact?.branch??0].at(-1)};
 }
 pinStem(at){
  // Bake the current soft pose, preserving continuity at the instant of touch.
  const fixedRoot=this.stemPoint(at);
  for(const p of this.nodes){const d=this.deformation(p.s);p.x+=d.x;p.y+=d.y;p.z+=d.z;}
  const d=this.deformation(this.head.s);this.head.x+=d.x;this.head.y+=d.y;this.head.z+=d.z;
  if(this.nodes.every(p=>Math.abs(p.s-at)>1e-8)){const i=this.nodes.findIndex(p=>p.s>at);if(i<0)this.nodes.push(fixedRoot);else this.nodes.splice(i,0,fixedRoot);}
  this.lockedS=Math.max(this.lockedS,at);this.waveOrigin=this.time;this.bendOriginAngle=this.angle;
 }
 detectContact(){
  for(const organ of this.organs){
   if(organ.contact||this.time-organ.born<7)continue;
   const shape=this.shape(organ);
   for(let b=0;b<shape.paths.length;b++){
    const path=shape.paths[b];
    for(let i=Math.floor(path.length*.45);i<path.length;i++){
     let hit,support;
     for(const shell of this.supports){
      hit=firstTouch(shell,path[i-1],path[i]);
      if(hit){support=shell;break;}
     }
     if(!hit)continue;
     const theta=Math.atan2(hit.z-support.z,hit.x-support.x);
     const previous=path[i-1],next=path[i];
     const tangential=(-(next.x-previous.x)*Math.sin(theta)+(next.z-previous.z)*Math.cos(theta))/(distance(previous,next)||1);
     // Preserve even a small tangential component instead of reversing it
     // during capture. A radial touch can wind either way.
     const sign=Math.abs(tangential)>.05?Math.sign(tangential):-organ.side;
     const original=path.map(q=>({...q}));
     original.splice(i,0,hit);
     const c={...hit,supportId:support.id,theta,sign,branch:b,index:i,original,
       progress:0,born:this.time,organId:organ.id,extension:.046*CONFIG.wrapDuration};
     organ.attachedShape=structuredClone(shape);organ.contact=c;this.anchor=c;this.phase='wrapping';this.wrapProgress=0;this.pinStem(organ.at);return;
    }
   }
  }
 }
 step(dt,speed=1){
  dt=clamp(dt,0,.06)*clamp(speed,.5,2);if(!dt)return;this.time+=dt;
  const maxTurn=CONFIG.turnRate*dt;
  this.angle+=clamp(this.targetAngle-this.angle,-maxTurn,maxTurn);
  let wrapLoad=0;
  for(const organ of this.organs){
   if(!organ.contact)continue;
   const p=organ.contact.progress;
   wrapLoad=Math.max(wrapLoad,smooth(p/.14)*smooth((1-p)/.14));
  }
  const rate=CONFIG.growthSpeed*(1-.28*wrapLoad);
  this.depthAngle+=clamp(this.targetDepth-this.depthAngle,-maxTurn,maxTurn);
  let dx=Math.sin(this.angle)*Math.cos(this.depthAngle),dz=Math.sin(this.depthAngle);
  let dy=Math.cos(this.angle)*Math.cos(this.depthAngle);
  // Ease head-on growth upward before the shoot reaches the shell.
  // Tangential and outward motion remain available.
  for(const shell of this.supports){
   const rx=this.head.x-shell.x,rz=this.head.z-shell.z,r=Math.hypot(rx,rz);
   if(r>shell.extent+.26||r<1e-6||this.head.y>shell.height)continue;
   const nx=rx/r,nz=rz/r,inward=Math.min(0,dx*nx+dz*nz);
   const avoid=1-smooth((shellGap(shell,this.head)-.04)/.20);
   if(inward<0){
    const incidence=-inward/Math.max(.0001,Math.hypot(dx,dz));
    const clearance=1-avoid*smooth(incidence/.35);
    dx*=clearance;dz*=clearance;
   }
   dy=Math.sqrt(Math.max(0,1-dx*dx-dz*dz));
  }
  const x=this.head.x+dx*rate*dt,y=this.head.y+dy*rate*dt,z=this.head.z+dz*rate*dt;
  this.blocked=y>CONFIG.maxY||Math.abs(x)>CONFIG.maxX||Math.abs(z)>4.5;
  if(!this.blocked){this.travel+=rate*dt;this.head={x,y,z,s:this.travel};
   if(distance(this.nodes.at(-1),this.head)>.022){this.nodes.push({...this.head});this.revision++;}
   if(this.travel>=this.nextNode){const id=this.organs.length;this.organs.push({id,at:this.travel,born:this.time,side:id%2?1:-1,...organTraits(id)});this.nextNode+=.52+variation(id,6)*.38;}
  }
  for(const o of this.organs){const c=o.contact;if(!c||c.progress>=1)continue;
   c.progress=clamp((this.time-c.born)/CONFIG.wrapDuration,0,1);this.wrapProgress=c.progress;
   if(c.progress===1)this.connections.push(structuredClone(c));
  }
  this.phase=this.organs.some(o=>o.contact&&o.contact.progress<1)?'wrapping':this.connections.length?'attached':'exploring';
  this.detectContact();this.updateTip();
 }
}
