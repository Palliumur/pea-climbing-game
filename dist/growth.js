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
function roundedShell(shell,low,high){
  // A periodic cubic B-spline bridges individual mesh edges. The measured
  // outward padding keeps the elastic route outside the actual mesh.
  const columns=64,rows=5,tau=Math.PI*2,profiles=[];
  const spline=(values,a)=>{
    const v=((a/tau%1)+1)%1*columns,i=Math.floor(v),t=v-i,q=1-t;
    const at=k=>values[(k+columns)%columns];
    return (q*q*q*at(i-1)+(3*t*t*t-6*t*t+4)*at(i)+
      (-3*t*t*t+3*t*t+3*t+1)*at(i+1)+t*t*t*at(i+2))/6;
  };
  for(let row=0;row<rows;row++){
    const y=mix(low,high,row/(rows-1));
    const radii=Array.from({length:columns},(_,i)=>shellRadius(shell,y,i*tau/columns));
    let padding=.008;
    for(let i=0;i<columns*4;i++){
      const a=i*tau/(columns*4);
      padding=Math.max(padding,shellRadius(shell,y,a)-spline(radii,a)+.008);
    }
    profiles.push(radii.map(r=>r+padding));
  }
  return (a,y)=>{
    const v=clamp01((y-low)/(high-low))*(rows-1),i=Math.min(rows-2,Math.floor(v));
    return mix(spline(profiles[i],a),spline(profiles[i+1],a),smooth(v-i));
  };
}
function makeWrapPlan(contact,shell){
  const points=contact.original,j=contact.index,start=points[j],tail=points.slice(j);
  const arc=[0];
  for(let i=1;i<tail.length;i++)arc.push(arc[i-1]+distance(tail[i-1],tail[i]));
  const distal=arc.at(-1),budget=distal+contact.extension;
  const count=96;
  const rise=.10,step=budget/count;
  const profile=roundedShell(shell,start.y-.04,start.y+budget*rise+.04);
  const radius=Math.hypot(start.x-shell.x,start.z-shell.z),blendLength=Math.min(.14,budget*.65);
  const shift=radius-profile(contact.theta,start.y),epsilon=.0001;
  const probe=contact.theta+contact.sign*epsilon/radius,probeY=start.y+epsilon*rise;
  const derivative=(shellRadius(shell,probeY,probe)-shellRadius(shell,start.y,contact.theta)-
    profile(probe,probeY)+profile(contact.theta,start.y))/epsilon;
  let target,angles,bump=0;
  for(let pass=0;pass<6;pass++){
    target=[start];angles=[contact.theta];let extra=0;
    for(let i=1;i<=count;i++){
      const travel=i*step,u=clamp01(travel/blendLength),y=start.y+travel*rise;
      function surface(delta){
        const a=angles.at(-1)+contact.sign*delta;
        const r=profile(a,y)+shift*(1-smooth(u))+derivative*blendLength*u*(1-u)**2+bump*u*u*(1-u)**2;
        return {x:shell.x+r*Math.cos(a),y,z:shell.z+r*Math.sin(a)};
      }
      let delta=step/Math.max(.01,profile(angles.at(-1),y));
      for(let k=0;k<6;k++)delta*=step/Math.max(1e-8,distance(target.at(-1),surface(delta)));
      const q=surface(delta),a=angles.at(-1)+contact.sign*delta;
      target.push(q);angles.push(a);
      const gap=Math.hypot(q.x-shell.x,q.z-shell.z)-shellRadius(shell,y,a);
      if(u<1&&gap<.005)extra=Math.max(extra,(.005-gap)/Math.max(1e-8,u*u*(1-u)**2));
    }
    if(extra<1e-5)break;
    bump+=extra*1.1;
  }
  let collar=j;
  let collarLength=0;
  while(collar>1&&collarLength<.24){collarLength+=distance(points[collar],points[collar-1]);collar--;}
  const collarArc=[0];
  for(let k=collar+1;k<=j;k++)collarArc.push(collarArc.at(-1)+distance(points[k-1],points[k]));
  const source=[],polar=[],radii=[];
  let k=1,previousAngle=contact.theta;
  for(let i=0;i<=count;i++){
    const at=distal*i/count;
    while(k<arc.length-1&&arc[k]<at)k++;
    const q=tail.length===1?start:lerp(tail[k-1],tail[k],(at-arc[k-1])/(arc[k]-arc[k-1]||1));
    const a=Math.atan2(q.z-shell.z,q.x-shell.x);
    previousAngle+=Math.atan2(Math.sin(a-previousAngle),Math.cos(a-previousAngle));
    source.push(q);polar.push(previousAngle);
    radii.push(Math.hypot(q.x-shell.x,q.z-shell.z));
  }
  return {source,polar,radii,target,angles,collar,collarArc,collarLength};
}
function wrapShell(contact,progress,shell){
  if(progress<=0)return contact.original;
  let plan=wrapPlans.get(contact);
  if(!plan){plan=makeWrapPlan(contact,shell);wrapPlans.set(contact,plan);}
  const {source,polar,radii,target,angles,collar,collarArc,collarLength}=plan;
  const p=smooth(progress);
  const path=contact.original.slice(0,contact.index+1);
  for(let i=1;i<source.length;i++){
    // A shared bend fraction preserves the ordering of material along the
    // coil. Staggering it along u made short distal tips double back midway.
    const theta=mix(polar[i],angles[i],p),y=mix(source[i].y,target[i].y,p);
    const r=mix(radii[i],Math.hypot(target[i].x-shell.x,target[i].z-shell.z),p);
    path.push({x:shell.x+r*Math.cos(theta),y,z:shell.z+r*Math.sin(theta)});
  }
  const j=contact.index,start=contact.original[j];
  const incoming=normalized(offset(start,contact.original[j-1]));
  const outgoing=normalized(offset(path[j+1],start));
  const delta=offset(outgoing,incoming);
  // Hermite displacement keeps the collar's root and contact fixed. Its
  // contact tangent follows the CURRENT coil, including intermediate frames.
  for(let k=collar+1;k<j;k++){
    const u=collarArc[k-collar]/(collarLength||1);
    path[k]=advance(contact.original[k],delta,collarLength*u*u*(u-1));
  }
  return path;
}
