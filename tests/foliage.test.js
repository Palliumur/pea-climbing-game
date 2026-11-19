import test from 'node:test';
import assert from 'node:assert/strict';
import {leafProfile,bladeSurface,CapsuleField,pointSegmentDistanceSquared,clearPole} from '../dist/foliage.js';
import {PeaSimulation,CONFIG} from '../dist/simulation.js';

test('individual leaf silhouettes differ after normalising length and width',()=>{
 const profiles=[18,61,80,137,270,503].map(seed=>leafProfile(seed));
 const outlines=profiles.map(p=>Array.from({length:21},(_,i)=>bladeSurface(p,i/20,1).x/p.width));
 assert.ok(outlines.some(a=>a.some((x,i)=>Math.abs(x-outlines[0][i])>.05)));
 assert.deepEqual(leafProfile(80),profiles[2]);
 const leaf=bladeSurface(leafProfile(61),.2,1),stipule=bladeSurface(leafProfile(61,'stipule'),.2,1);
 assert.ok(stipule.x>leaf.x);assert.ok(profiles.every(p=>bladeSurface(p,0,0).y===0));
});
test('leaf vertices clear stems instead of moving their attachment in the leaf plane',()=>{
 const field=new CapsuleField(),a={x:0,y:0,z:0},b={x:.3,y:1,z:.12};field.addPath([a,b],.022);
 for(let i=0;i<=20;i++){
  const p={x:.3*i/20,y:i/20,z:.12*i/20};const x=p.x,y=p.y;
  field.project(p);assert.ok(pointSegmentDistanceSquared(p,a,b).distanceSquared>.022**2);
  assert.equal(p.x,x);assert.equal(p.y,y);
 }
});
test('leaf surfaces bend to one continuous side of the pole with clearance',()=>{
 for(let i=-20;i<=20;i++){
  const p={x:CONFIG.poleX+i*.006,y:3,z:0};clearPole(p,CONFIG,1,.024);
  assert.ok(Math.hypot(p.x-CONFIG.poleX,p.z)>=CONFIG.poleRadius+.0239);
 }
 const p={x:CONFIG.poleX,y:CONFIG.poleHeight+1,z:0};clearPole(p,CONFIG);assert.equal(p.z,0);
});
test('exploring left first still allows later attachment above the former height limit',()=>{
 const s=new PeaSimulation();for(let i=0;i<60*140&&!s.connections.length;i++){s.setDirection(s.time<20?-.85:.95);s.step(1/60);}
 assert.ok(s.connections.length,'the return path can reach a real support contact');
 assert.ok(s.connections[0].y>4.7,'the route uses the taller support');assert.ok(!s.blocked);
});
