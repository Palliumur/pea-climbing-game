import {shellRadius} from './supports.js';
// Pea organ development in compressed exhibition time. Geometry is generated
// from age and local curvature, never by dragging one tip through space.
export const clamp01=x=>Math.max(0,Math.min(1,x));
export const smooth=x=>{x=clamp01(x);return x*x*(3-2*x);};
export const mix=(a,b,t)=>a+(b-a)*t;
export const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const lerp=(a,b,t)=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t)});
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function normalized(p){const l=Math.hypot(p.x,p.y,p.z)||1;return{x:p.x/l,y:p.y/l,z:p.z/l};}
export function development(age){
  return {rachis:smooth((age+.7)/12),bladeLength:smooth((age-1)/14),
    bladeWidth:smooth((age-4)/15),unfold:smooth((age-3)/15),
    tendril:smooth((age-3)/13),search:smooth((age-5)/7)*(1-.82*smooth((age-32)/26))};
}
export function bezier(a,b,c,d,t){const q=1-t;return{x:q*q*q*a.x+3*q*q*t*b.x+3*q*t*t*c.x+t*t*t*d.x,y:q*q*q*a.y+3*q*q*t*b.y+3*q*t*t*c.y+t*t*t*d.y,z:q*q*q*a.z+3*q*q*t*b.z+3*q*t*t*c.z+t*t*t*d.z};}
export function samplePath(points,t){const v=clamp01(t)*(points.length-1),i=Math.min(points.length-2,Math.floor(v));return lerp(points[i],points[i+1],v-i);}

export function organShape(organ,base,time,shootAngle=0){
  const age=time-organ.born,d=development(age),side=organ.side;
  const phase=time*Math.PI*2/10.8+organ.id*1.73;
  // Young folded leaves point up beside the apex; the petiole/rachis gradually
  // opens out. Search bending is a property of the whole young organ.
  const spread=side*(.10+(.85+(organ.spreadVariation??0))*d.unfold)+shootAngle*.55;
  const length=(.65+(organ.branchVariation??.5)*.12)*(.025+.975*d.rachis)*organ.scale;
  const sw=Math.sin(phase)*.075*d.search;
  const end={x:base.x+Math.sin(spread)*length+sw,y:base.y+Math.cos(spread)*length,z:base.z+(.09+(organ.depthVariation??0))*d.unfold+Math.cos(phase)*.055*d.search};
  const a=base,b=add(base,{x:Math.sin(spread*.36)*length*.3,y:length*.36,z:0});
  const c={x:mix(base.x,end.x,.73),y:mix(base.y,end.y,.73)+.045*d.unfold,z:mix(base.z,end.z,.7)};
  const rachis=Array.from({length:25},(_,i)=>bezier(a,b,c,end,i/24));
  const tangent=normalized({x:end.x-rachis[22].x,y:end.y-rachis[22].y,z:end.z-rachis[22].z});
  const mainLength=(.45+(organ.branchVariation??.5)*.19)*(.01+.99*d.tendril)*organ.scale;
  const paths=[],forks=[];
  function filament(root,dir,length,index){
    const points=[root];const baseAngle=Math.atan2(dir.x,dir.y);
    for(let j=1;j<=44;j++){
      const u=j/44;
      // The base barely bends; curvature accumulates toward the tip. The slow
      // ellipse is not stored as a permanent spiral in the stem.
      const bend=d.search*(Math.sin(phase-index*.57)*1.12*u*u+.15*Math.sin(phase*.63+index)*u);
      const hook=(.34+1.48*smooth((age-19)/20))*smooth((u-.65)/.35);
      const angle=baseAngle+bend+side*hook;
      const dz=d.search*Math.cos(phase-index*.57)*.43*u*u+dir.z*.6;
      const v=normalized({x:Math.sin(angle),y:Math.cos(angle),z:dz});
      points.push(add(points.at(-1),{x:v.x*length/44,y:v.y*length/44,z:v.z*length/44}));
    }
    return points;
  }
  const count=organ.tendrilCount??3;
  if(count)paths.push(filament(end,tangent,mainLength,0));
  // Organ-specific branch counts and attachment sites stay consistent over
  // time. Lower leaves have no tendrils; upper organs develop fewer, unequal arms.
  for(let k=0;k<count-1;k++){
    const v=organ.branchVariation??.5,t=.28+k*.23+(v-.5)*.14,root=samplePath(paths[0],t),sign=k?side:-side;
    const dir=normalized({x:tangent.x+sign*.57,y:tangent.y*.85,z:tangent.z+(k?-.2:.24)});
    forks.push(t);
    paths.push(filament(root,dir,mainLength*(k?.34+(organ.branchVariation??.5)*.22:.50+(organ.branchVariation??.5)*.20),k+1));
  }
  return {base,rachis,paths,forks,age,development:d,spread,scale:organ.scale};
}

const coilCache=new WeakMap();
export function coiledPath(contact,progress,poleX,poleRadius){
  if(typeof poleX==='object'){
    const cached=coilCache.get(contact);
    if(cached?.progress===progress)return cached.path;
    const path=wrapShell(contact,progress,poleX);
    coilCache.set(contact,{progress,path});return path;
  }
  const p=smooth(progress),radius=poleRadius+.006;
  const prefix=contact.original.slice(0,contact.index+1).map(p=>({...p}));
  const start=prefix.at(-1),tail=contact.original.slice(contact.index+1);
  const oldLength=tail.reduce((s,p,i)=>s+distance(p,i?tail[i-1]:start),0);
  const length=oldLength+.46*p;
  const count=48;
  for(let j=1;j<=count;j++){
    const u=j/count,travel=length*u;
    const theta=contact.theta+contact.sign*travel/radius;
    const target={x:poleX+Math.cos(theta)*radius,y:start.y+travel*.075,z:Math.sin(theta)*radius};
    // Bend the original distal tissue first, then continue distal extension.
    // At progress=0 the entire visible curve is exactly the pre-contact curve.
    const source=tail.length?samplePath([start,...tail],u):start;
    prefix.push(lerp(source,target,p));
  }
  return prefix;
}

// Precompute a continuous surface route once per contact. Distances on this
// route are material lengths, so thin and thick shells wind by different angles.
const wrapPlans=new WeakMap();
const offset=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const advance=(p,v,s)=>({x:p.x+v.x*s,y:p.y+v.y*s,z:p.z+v.z*s});
function makeWrapPlan(contact,shell){
  const points=contact.original,j=contact.index,start=points[j],tail=points.slice(j);
  const arc=[0];
  for(let i=1;i<tail.length;i++)arc.push(arc[i-1]+distance(tail[i-1],tail[i]));
  const distal=arc.at(-1),budget=distal+contact.extension;
  const target=[start], angles=[contact.theta], count=72;
  const rise=.10,step=budget/count;
  for(let i=1;i<=count;i++){
    const prev=target.at(-1),theta=angles.at(-1),y=start.y+i*step*rise;
    const clearance=mix(.005,.006,smooth(i/5));
    function surface(delta){
      const a=theta+contact.sign*delta,r=shellRadius(shell,y,a)+clearance;
      return {x:shell.x+r*Math.cos(a),y,z:shell.z+r*Math.sin(a)};
    }
    let delta=step/Math.max(.01,shellRadius(shell,y,theta));
    for(let k=0;k<4;k++)delta*=step/Math.max(1e-8,distance(prev,surface(delta)));
    target.push(surface(delta));angles.push(theta+contact.sign*delta);
  }
  const tangent=normalized(offset(target[1],start));
  let collar=j;
  while(collar>1&&distance(points[collar],start)<.16)collar--;
  const collarArc=[0];
  for(let k=collar+1;k<=j;k++)collarArc.push(collarArc.at(-1)+distance(points[k-1],points[k]));
  const collarLength=collarArc.at(-1);
  const entry=normalized(offset(points[collar+1],points[collar]));
  const b=advance(points[collar],entry,collarLength*.35),c=advance(start,tangent,-collarLength*.52);
  const rounded=points.slice(0,j+1);
  for(let k=collar+1;k<j;k++)rounded[k]=bezier(points[collar],b,c,start,collarArc[k-collar]/(collarLength||1));
  const source=[],polar=[],gaps=[];
  let k=1,previousAngle=contact.theta;
  for(let i=0;i<=count;i++){
    const at=distal*i/count;
    while(k<arc.length-1&&arc[k]<at)k++;
    const q=tail.length===1?start:lerp(tail[k-1],tail[k],(at-arc[k-1])/(arc[k]-arc[k-1]||1));
    const a=Math.atan2(q.z-shell.z,q.x-shell.x);
    previousAngle+=Math.atan2(Math.sin(a-previousAngle),Math.cos(a-previousAngle));
    source.push(q);polar.push(previousAngle);
    gaps.push(Math.hypot(q.x-shell.x,q.z-shell.z)-shellRadius(shell,q.y,a));
  }
  return {source,polar,gaps,rounded,target,angles};
}
function wrapShell(contact,progress,shell){
  if(progress<=0)return contact.original;
  let plan=wrapPlans.get(contact);
  if(!plan){plan=makeWrapPlan(contact,shell);wrapPlans.set(contact,plan);}
  const {source,polar,gaps,rounded,target,angles}=plan;
  if(progress===1)return [...rounded,...target.slice(1)];
  const p=smooth(progress);
  const path=rounded.map((q,i)=>lerp(contact.original[i],q,p));
  for(let i=1;i<source.length;i++){
    // Proximal tissue curls first; the tip catches up continuously.
    const u=i/(source.length-1),w=smooth(progress+progress*(1-progress)*(.65-u));
    const theta=mix(polar[i],angles[i],w),y=mix(source[i].y,target[i].y,w);
    const clearance=mix(gaps[i],mix(.005,.006,smooth(i/5)),w);
    const r=shellRadius(shell,y,theta)+clearance;
    path.push({x:shell.x+r*Math.cos(theta),y,z:shell.z+r*Math.sin(theta)});
  }
  return path;
}
