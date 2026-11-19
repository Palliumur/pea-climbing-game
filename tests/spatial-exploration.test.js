import test from 'node:test';
import assert from 'node:assert/strict';
import {PeaSimulation,CONFIG,bodyPoseFromLandmarks} from '../dist/simulation.js';
import {SUPPORTS,shellGap} from '../dist/supports.js';
import {distance,organShape,coiledPath} from '../dist/growth.js';
import {CatmullRomCurve3,Vector3} from '../dist/vendor/three/three.module.js';

function body(command=0,depth=0,width=.1){
  const tilt=command===0?0:Math.sign(command)*(3+22*Math.min(1,Math.abs(command)/CONFIG.maxAngle))*Math.PI/180;
  const shoulders=.5-Math.tan(tilt)*.28/(16/9);
  const points=[];
  for(const [id,side,top] of [[11,-1,true],[12,1,true],[23,-1,false],[24,1,false]])
    points[id]={x:(top?shoulders:.5)+side*width,y:top?.3:.58,z:top?depth:0,visibility:1};
  return points;
}
const span=(points,key)=>Math.max(...points.map(p=>p[key]))-Math.min(...points.map(p=>p[key]));
function angle(a,b,c){
  const dot=(b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)+(b.z-a.z)*(c.z-b.z);
  return Math.acos(Math.max(-1,Math.min(1,dot/(distance(a,b)*distance(b,c)))));
}

test('camera input uses lateral lean independently of landmark depth and shoulder width',()=>{
  const a=bodyPoseFromLandmarks(body(.7),16/9);
  for(const depth of [-.6,0,.6])for(const width of [.07,.15]){
    const b=bodyPoseFromLandmarks(body(.7,depth,width),16/9);
    assert.ok(Math.abs(a.direction-b.direction)<1e-12);
  }
});

test('a neutral plant explores three dimensions while its root stays fixed',()=>{
  const sim=new PeaSimulation([]),root={...sim.stemPoint(sim.nodes[0].s)},points=[];
  for(let frame=0;frame<60*40;frame++){
    const previous=sim.stemPoint(sim.head.s);sim.step(1/60);
    const current=sim.stemPoint(sim.head.s);points.push(current);
    assert.ok(distance(previous,current)<.006,'continuous apex at 60 fps');
    assert.deepEqual(sim.stemPoint(sim.nodes[0].s),root);
    assert.equal(sim.targetDepth,0);
  }
  assert.ok(span(points,'x')>.2,'autonomous lateral component');
  assert.ok(span(points,'z')>1,'autonomous fore/aft component');
  assert.ok(span(sim.nodes,'z')>.05,'new stem growth records a spatial trajectory');
  const before=sim.stemPoints();sim.step(0);assert.deepEqual(sim.stemPoints(),before,'pause freezes the orbit');
});

test('young organ tips sweep a spatial volume and mature organs settle',()=>{
  const organ={id:4,born:0,side:-1,scale:.84,tendrilCount:2},base={x:0,y:0,z:0},points=[];
  for(let i=0;i<=240;i++){
    const shape=organShape(organ,base,10+i/10,.15,.12);
    assert.deepEqual(shape.base,base);points.push(shape.paths[0].at(-1));
  }
  assert.ok(span(points,'x')>.5&&span(points,'z')>.5,'front/back and lateral exploration');
  const origin=points[0],a=points[60],b=points[120],c=points[180];
  const determinant=(a.x-origin.x)*((b.y-origin.y)*(c.z-origin.z)-(b.z-origin.z)*(c.y-origin.y))-
    (a.y-origin.y)*((b.x-origin.x)*(c.z-origin.z)-(b.z-origin.z)*(c.x-origin.x))+
    (a.z-origin.z)*((b.x-origin.x)*(c.y-origin.y)-(b.y-origin.y)*(c.x-origin.x));
  assert.ok(Math.abs(determinant)>.001,'trajectory is not confined to one plane');
  const mature=organShape(organ,base,70),later=organShape(organ,base,75);
  assert.deepEqual(mature.rachis,later.rachis);assert.deepEqual(mature.paths,later.paths);
});

test('uncontacted spatial exploration is independent of distant supports',()=>{
  const free=new PeaSimulation([]),far=new PeaSimulation([SUPPORTS[3]]);
  // Move the plant's route away from the only support, keeping the same input.
  for(let i=0;i<600;i++){
    free.setDirection(-.8);far.setDirection(-.8);free.step(1/30);far.step(1/30);
    assert.deepEqual(free.tip,far.tip);
    assert.deepEqual(free.head,far.head);
  }
  assert.equal(far.connections.length,0);
});

test('screen overlap with a distant depth plane does not trigger attachment',()=>{
  const original=SUPPORTS[3],dz=-12;
  const shell={...original,z:original.z+dz,vertices:original.vertices.map(p=>({...p,z:p.z+dz}))};
  const sim=new PeaSimulation([shell]);
  for(let i=0;i<3000;i++){sim.setDirection(.95);sim.step(1/30);}
  assert.ok(sim.head.x>shell.x,'plant passes the support horizontal coordinate');
  assert.equal(sim.connections.length,0);assert.equal(sim.anchor,null);
});

for(const id of ['S01','S02','S04','S05','S06'])test(id+' can wrap using lateral body input and autonomous depth exploration',()=>{
  const shell=SUPPORTS.find(s=>s.id===id),sim=new PeaSimulation();let organ;
  const side=Math.sign(shell.x+.88),offset=id==='S06'?0:.45,dt=.04;
  for(let frame=0;frame<6000;frame++){
    const command=(shell.x-sim.head.x-side*offset)*1.8;
    sim.setDirection(bodyPoseFromLandmarks(body(command),16/9).direction);
    assert.equal(sim.targetDepth,0);
    sim.step(dt);
    organ=sim.organs.find(o=>o.contact?.supportId===id);
    if(organ?.contact.progress===1)break;
  }
  assert.ok(organ?.contact.progress===1,'a real contact must complete winding');
  const c=organ.contact;assert.ok(Math.abs(shellGap(shell,c)-.005)<1e-5);
  const duration=Math.round(CONFIG.wrapDuration*60);let previous=c.original.at(-1);
  for(let frame=1;frame<=duration;frame++){
    const path=coiledPath(c,frame/duration,shell);
    assert.deepEqual(path[c.index],c.original[c.index]);
    assert.ok(distance(previous,path.at(-1))<.009,'continuous spatial wrapping');previous=path.at(-1);
    for(let i=1;i<path.length-1;i++)assert.ok(angle(path[i-1],path[i],path[i+1])<20*Math.PI/180,'no local fold');
    if(frame%24===0){
      const curve=new CatmullRomCurve3(path.map(p=>new Vector3(p.x,p.y,p.z)),false,'centripetal');
      curve.arcLengthDivisions=Math.max(300,path.length*3);
      const rendered=curve.getSpacedPoints(256);
      for(let i=1;i<rendered.length-1;i++)assert.ok(angle(rendered[i-1],rendered[i],rendered[i+1])<25*Math.PI/180,'no rendered cusp');
    }
  }
});

test('a sustained lateral lean makes smooth swept contacts on different supports',()=>{
  const sim=new PeaSimulation();sim.setDirection(.9);
  for(let frame=0;frame<85*60;frame++)sim.step(1/60);
  assert.ok(new Set(sim.connections.map(c=>c.supportId)).size>=2);
  for(const organ of sim.organs.filter(o=>o.contact)){
    const c=organ.contact,shell=SUPPORTS.find(s=>s.id===c.supportId);
    assert.ok(Math.abs(shellGap(shell,c)-.005)<1e-5);
    for(let frame=1;frame<=504;frame++){
      const path=coiledPath(c,frame/504,shell);
      for(let i=1;i<path.length-1;i++)assert.ok(angle(path[i-1],path[i],path[i+1])<20*Math.PI/180,
        `no sweep-induced fold on ${c.supportId} organ ${c.organId}`);
    }
  }
});
