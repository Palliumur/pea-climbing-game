import {shellRadius} from './supports.js?v=spatial-orbit-1';
// Pea organ development in compressed exhibition time. Geometry is generated
// from age and local curvature, never by dragging one tip through space.
export const clamp01=x=>Math.max(0,Math.min(1,x));
export const smooth=x=>{x=clamp01(x);return x*x*(3-2*x);};
export const mix=(a,b,t)=>a+(b-a)*t;
export const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const lerp=(a,b,t)=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t)});
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function normalized(p){const l=Math.hypot(p.x,p.y,p.z)||1;return{x:p.x/l,y:p.y/l,z:p.z/l};}
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export function shootFrame(angle,depth=0){
  const s=Math.sin(angle),c=Math.cos(angle),sd=Math.sin(depth),cd=Math.cos(depth);
  return {axis:{x:s*cd,y:c*cd,z:sd},side:{x:c,y:-s,z:0},depth:{x:-s*sd,y:-c*sd,z:cd}};
}
// Young organs explore for a finite developmental interval. The phase slows
// continuously to rest, so mature leaves do not keep spinning around the stem.
function searchClock(age){
  const t=Math.max(0,age-4);
  if(t<4){const u=t/4;return 4*(u*u*u-.5*u*u*u*u);}
  if(t<=28)return t-2;
  const u=clamp01((t-28)/16);return 26+16*(u-u*u*u+.5*u*u*u*u);
}
export function development(age){
  return {rachis:smooth((age+.7)/12),bladeLength:smooth((age-1)/14),
    bladeWidth:smooth((age-4)/15),unfold:smooth((age-3)/15),
    tendril:smooth((age-3)/13),search:smooth((age-5)/7)*(1-.82*smooth((age-32)/26))};
}
export function bezier(a,b,c,d,t){const q=1-t;return{x:q*q*q*a.x+3*q*q*t*b.x+3*q*t*t*c.x+t*t*t*d.x,y:q*q*q*a.y+3*q*q*t*b.y+3*q*t*t*c.y+t*t*t*d.y,z:q*q*q*a.z+3*q*q*t*b.z+3*q*t*t*c.z+t*t*t*d.z};}
export function samplePath(points,t){const v=clamp01(t)*(points.length-1),i=Math.min(points.length-2,Math.floor(v));return lerp(points[i],points[i+1],v-i);}

export function organShape(organ,base,time,shootAngle=0,shootDepth=0){
  const age=time-organ.born,d=development(age),side=organ.side;
  const clock=searchClock(age),phase=clock*Math.PI*2/10.8+organ.id*1.73;
  // Young folded leaves point up beside the apex; the petiole/rachis gradually
  // opens out. Search bending is a property of the whole young organ.
  const spread=side*(.10+(.85+(organ.spreadVariation??0))*d.unfold);
  const length=(.65+(organ.branchVariation??.5)*.12)*(.025+.975*d.rachis)*organ.scale;
  const frame=shootFrame(shootAngle,shootDepth);
  const local=(x,y,z)=>add(base,{x:frame.side.x*x+frame.axis.x*y+frame.depth.x*z,
    y:frame.side.y*x+frame.axis.y*y+frame.depth.y*z,z:frame.side.z*x+frame.axis.z*y+frame.depth.z*z});
  const azimuth=clock*Math.PI*2/18+organ.id*2.399963+(organ.depthVariation??0);
  const radius=Math.sin(spread)*length;
  const end=local(radius*Math.cos(azimuth),Math.cos(spread)*length+.025*d.search*Math.sin(phase),radius*Math.sin(azimuth));
  const a=base,b=local(radius*Math.cos(azimuth)*.08,length*.36,radius*Math.sin(azimuth)*.08);
  const c=add(lerp(base,end,.73),{x:frame.axis.x*.045*d.unfold,y:frame.axis.y*.045*d.unfold,z:frame.axis.z*.045*d.unfold});
  const rachis=Array.from({length:25},(_,i)=>bezier(a,b,c,end,i/24));
  const tangent=normalized({x:end.x-rachis[22].x,y:end.y-rachis[22].y,z:end.z-rachis[22].z});
  const mainLength=(.45+(organ.branchVariation??.5)*.19)*(.01+.99*d.tendril)*organ.scale;
  const paths=[],forks=[];
  function filament(root,dir,length,index){
    const points=[root],axis=normalized(dir);
    const radial=normalized(cross(Math.abs(axis.z)<.9?{x:0,y:0,z:1}:{x:0,y:1,z:0},axis));
    const binormal=normalized(cross(axis,radial));
    for(let j=1;j<=44;j++){
      const u=j/44;
      // The base barely bends; curvature accumulates toward the tip. The slow
      // ellipse is not stored as a permanent spiral in the stem.
      const bend=d.search*1.05*u*u;
      const hook=(.34+1.48*smooth((age-19)/20))*smooth((u-.65)/.35);
      const angle=bend+hook,around=phase-index*.87+side*.4+u*.35;
      const ca=Math.cos(angle),sa=Math.sin(angle),co=Math.cos(around),si=Math.sin(around);
      const v={x:axis.x*ca+(radial.x*co+binormal.x*si)*sa,
        y:axis.y*ca+(radial.y*co+binormal.y*si)*sa,z:axis.z*ca+(radial.z*co+binormal.z*si)*sa};
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
  const radius=Math.hypot(start.x-shell.x,start.z-shell.z),blendLength=Math.min(.08,budget*.65);
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
  // The entry blend may consume extra length while lifting off a sharp mesh
  // edge. Sample its actual arc and stop at the available tissue budget.
  const targetArc=[0];
  for(let i=1;i<target.length;i++)targetArc.push(targetArc.at(-1)+distance(target[i-1],target[i]));
  const targetLength=Math.min(budget,targetArc.at(-1)),uniform=[start];let cursor=1;
  for(let i=1;i<=count;i++){
    const at=targetLength*i/count;
    while(cursor<targetArc.length-1&&targetArc[cursor]<at)cursor++;
    const q=lerp(target[cursor-1],target[cursor],(at-targetArc[cursor-1])/(targetArc[cursor]-targetArc[cursor-1]||1));
    const a=Math.atan2(q.z-shell.z,q.x-shell.x),r=Math.hypot(q.x-shell.x,q.z-shell.z),minimum=shellRadius(shell,q.y,a)+.005;
    if(r<minimum){q.x=shell.x+minimum*Math.cos(a);q.z=shell.z+minimum*Math.sin(a);}
    uniform.push(q);
  }
  target=uniform;
  let collar=j;
  let collarLength=0;
  while(collar>1&&collarLength<.24){collarLength+=distance(points[collar],points[collar-1]);collar--;}
  const collarArc=[0];
  for(let k=collar+1;k<=j;k++)collarArc.push(collarArc.at(-1)+distance(points[k-1],points[k]));
  const source=[];
  let k=1;
  for(let i=0;i<=count;i++){
    const at=distal*i/count;
    while(k<arc.length-1&&arc[k]<at)k++;
    const q=tail.length===1?start:lerp(tail[k-1],tail[k],(at-arc[k-1])/(arc[k]-arc[k-1]||1));
    source.push(q);
  }
  const bends=[];let sourceHeading,targetHeading;
  const unwrap=(a,previous)=>previous===undefined?a:previous+Math.atan2(Math.sin(a-previous),Math.cos(a-previous));
  for(let i=1;i<=count;i++){
    const sourceLength=distance(source[i],source[i-1]);
    const a=sourceLength>1e-9?offset(source[i],source[i-1]):offset(points[j],points[j-1]),b=offset(target[i],target[i-1]);
    sourceHeading=unwrap(Math.atan2(a.z,a.x),sourceHeading);
    targetHeading=unwrap(Math.atan2(b.z,b.x),targetHeading??sourceHeading);
    bends.push({sourceHeading,targetHeading,sourcePitch:Math.atan2(a.y,Math.hypot(a.x,a.z)),
      targetPitch:Math.atan2(b.y,Math.hypot(b.x,b.z)),sourceLength,targetLength:distance(target[i],target[i-1])});
  }
  return {bends,collar,collarArc,collarLength};
}
function wrapShell(contact,progress,shell){
  if(progress<=0)return contact.original;
  let plan=wrapPlans.get(contact);
  if(!plan){plan=makeWrapPlan(contact,shell);wrapPlans.set(contact,plan);}
  const {bends,collar,collarArc,collarLength}=plan;
  const p=smooth(progress);
  const path=contact.original.slice(0,contact.index+1);
  for(const bend of bends){
    // Interpolate directions and tissue lengths instead of positions. This
    // keeps every segment nonzero even when a spatial tip initially points
    // against the winding direction, preventing a temporary cusp.
    const heading=mix(bend.sourceHeading,bend.targetHeading,p),pitch=mix(bend.sourcePitch,bend.targetPitch,p);
    path.push(advance(path.at(-1),{x:Math.cos(heading)*Math.cos(pitch),y:Math.sin(pitch),z:Math.sin(heading)*Math.cos(pitch)},mix(bend.sourceLength,bend.targetLength,p)));
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
