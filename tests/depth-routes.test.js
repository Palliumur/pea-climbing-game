import test from 'node:test';
import assert from 'node:assert/strict';
import {PeaSimulation,CONFIG,DepthInput,torsoPitch,shoulderSpanSignal,bodyPoseFromLandmarks} from '../dist/simulation.js';
import {SUPPORTS,shellGap} from '../dist/supports.js';
import {distance} from '../dist/growth.js';

function torso(cx,cy,gap,halfWidth,dz=0){
  const pose=[];
  for(const [i,side,shoulder] of [[11,-1,true],[12,1,true],[23,-1,false],[24,1,false]]){
    pose[i]={x:cx+side*halfWidth,y:cy-(shoulder?gap:0),z:shoulder?-dz:0,visibility:1};
  }
  return pose;
}
const radians=Math.PI/180;
function desiredLean(command,limit,dead,range){
  return command===0?0:Math.sign(command)*(dead+Math.min(1,Math.abs(command)/limit)*range)*radians;
}

test('depth uses relative posture, ignores noise at neutral and rejects missing joints',()=>{
  const filter=new DepthInput(),neutral=torsoPitch(torso(0,0,.5,.16,.07));
  for(let i=0;i<10;i++)assert.equal(filter.update(neutral,.08),0);
  assert.equal(filter.update(neutral+.02,.08),0);
  for(let i=0;i<20;i++)filter.update(neutral+.28,.08);
  assert.ok(filter.filtered>.25);
  assert.equal(torsoPitch([]),null);
  const turned=torso(0,0,.5,.16,.1);
  turned[11].z-=.1;turned[12].z+=.1;
  assert.ok(Math.abs(torsoPitch(turned)-Math.atan2(.1,.5))<1e-9);
});

for(const mode of ['pitch','span'])for(const shell of SUPPORTS){
  test(shell.id+' completes a wrap from torso input using '+mode,()=>{
    const sim=new PeaSimulation(),input=new DepthInput(),dt=1/30,aspect=16/9;
    let previousTip,previousApex,organ;
    for(let frame=0;frame<4500;frame++){
      if(frame%3===0){
        const side=shell.x<-.88?-1:1;
        const x=frame<30?0:(shell.x-sim.head.x-side*.46)*1.8;
        // The inside right shell sits across the direct route to S05.
        // Take a short foreground detour before turning back into the target.
        const targetZ=shell.id==='S05'&&sim.head.x<1.14?.76:shell.z-.10;
        const depth=frame<30?0:Math.max(-.85,Math.min(.85,(targetZ-sim.head.z)*1.6));
        const roll=desiredLean(x,CONFIG.maxAngle,3,22);
        const pitch=desiredLean(depth,Math.PI/3,4,15);
        const width=.1*(mode==='span'?Math.exp(pitch/2):1);
        const screen=torso(.5,.65,.28,width);
        for(const i of [11,12])screen[i].x-=Math.tan(roll)*.28/aspect;
        const world=torso(0,0,.5,.18,Math.tan(pitch)*.5);
        const signal=mode==='pitch'?torsoPitch(world):shoulderSpanSignal(screen);
        sim.setDirection(bodyPoseFromLandmarks(screen,aspect).direction,input.update(signal,.1));
      }
      sim.step(dt);
      const apex=sim.stemPoint(sim.head.s);
      if(previousApex)assert.ok(distance(previousApex,apex)<.008,'continuous visible apex');
      previousApex=apex;
      organ??=sim.organs.find(o=>o.contact?.supportId===shell.id);
      if(!organ)continue;
      const c=organ.contact,path=sim.tendrilPaths(organ)[c.branch],tip=path.at(-1);
      if(previousTip)assert.ok(distance(previousTip,tip)<.009,'continuous wrapping tip');
      previousTip=tip;
      assert.ok(Math.abs(shellGap(shell,c)-.005)<.00001);
      if(c.progress===1){
        assert.ok(sim.connections.some(connection=>connection.supportId===shell.id));
        const a=path.slice(0,c.index).reverse().find(q=>distance(q,c)>.012);
        const b=path.slice(c.index+1).find(q=>distance(q,c)>.012);
        const dot=(c.x-a.x)*(b.x-c.x)+(c.y-a.y)*(b.y-c.y)+(c.z-a.z)*(b.z-c.z);
        assert.ok(dot/(distance(a,c)*distance(b,c))>Math.cos(30*radians),'rounded shell entry');
        return;
      }
    }
    assert.fail('route did not attach to '+shell.id);
  });
}
