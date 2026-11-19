import test from 'node:test';
import assert from 'node:assert/strict';
import {PeaSimulation} from '../dist/simulation.js';
import {SUPPORTS,firstTouch,shellGap,shellRadius} from '../dist/supports.js';
import {distance} from '../dist/growth.js';

test('every visible shell can receive a surface contact from either side',()=>{
  assert.equal(SUPPORTS.length,6);
  for(const shell of SUPPORTS)for(const theta of [.2,1.8,3.4,5.1]){
    const at=r=>({x:shell.x+r*Math.cos(theta),z:shell.z+r*Math.sin(theta),y:3.21});
    const r=shellRadius(shell,3.21,theta);
    const hit=firstTouch(shell,at(r+.045),at(r-.025));
    assert.ok(hit);assert.ok(Math.abs(shellGap(shell,hit)-.005)<1e-7);
    assert.equal(firstTouch(shell,at(r+.08),at(r+.03)),null);
  }
});
test('an already submerged segment does not manufacture a projected surface contact',()=>{
  const shell=SUPPORTS[3];
  assert.equal(firstTouch(shell,{x:shell.x,y:3,z:shell.z},{x:shell.x+.01,y:3.01,z:shell.z}),null);
});
for(const [name,input,id] of [['right',.95,'S04'],['left',-.98,'S01']]){
  test(name+' route attaches to its own mesh and respects the available distal length',()=>{
    const sim=new PeaSimulation();sim.setDirection(input);
    for(let i=0;i<2400&&!sim.connections.length;i++)sim.step(.05);
    const o=sim.organs.find(o=>o.contact?.progress===1),c=o?.contact;
    assert.equal(c?.supportId,id);
    const path=sim.tendrilPaths(o)[c.branch];
    const shell=SUPPORTS.find(s=>s.id===id);
    assert.deepEqual(path[c.index],c.original[c.index]);
    const firstFlexible=c.original.slice(0,c.index).findIndex(p=>distance(p,c)<.27);
    if(firstFlexible>0)assert.deepEqual(path.slice(0,firstFlexible),c.original.slice(0,firstFlexible));
    const length=points=>points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
    assert.ok(length(path.slice(c.index))<=length(c.original.slice(c.index))+c.extension+.002);
    // Elastic tissue bridges the mesh's sharp edges with a small clearance.
    for(const p of path.slice(c.index+1))assert.ok(shellGap(shell,p)>=.00499&&shellGap(shell,p)<=.03);
    sim.setDirection(-input);for(let i=0;i<80;i++)sim.step(.05);
    assert.deepEqual(sim.tendrilPaths(o)[c.branch],path);
  });
}
