import test from 'node:test';
import assert from 'node:assert/strict';
import {development,organShape,coiledPath,distance} from '../dist/growth.js';

test('folded leaves elongate before the blade fully widens and opens',()=>{
 const young=development(5),older=development(15),mature=development(40);
 assert.ok(young.bladeLength>young.bladeWidth);assert.ok(young.unfold<.1);
 assert.ok(older.unfold>young.unfold);assert.equal(mature.unfold,1);
});
test('tendril base stays on the rachis and lateral branches originate along it',()=>{
 const o={id:3,born:0,side:1,scale:.83},base={x:0,y:0,z:0};
 const a=organShape(o,base,17),b=organShape(o,base,17+1/60);
 assert.deepEqual(a.paths[0][0],a.rachis.at(-1));
 assert.notDeepEqual(a.paths[1][0],a.paths[0][0]);
 assert.notDeepEqual(a.paths[1][0],a.paths[2][0]);
 a.paths.forEach((path,k)=>path.forEach((p,i)=>assert.ok(distance(p,b.paths[k][i])<.01,'no tip jumps')));
});
test('coiling preserves the proximal tissue and develops at the actual contact',()=>{
 const c={index:1,original:[{x:0,y:0,z:0},{x:.614,y:1,z:0},{x:.60,y:1.05,z:0}],theta:Math.PI,sign:1};
 const begin=coiledPath(c,0,.72,.1),end=coiledPath(c,1,.72,.1);
 assert.deepEqual(begin.slice(0,2),c.original.slice(0,2));assert.deepEqual(end.slice(0,2),c.original.slice(0,2));
 assert.deepEqual(begin.at(-1),c.original.at(-1));
 end.slice(2).forEach(p=>assert.ok(Math.abs(Math.hypot(p.x-.72,p.z)-.106)<1e-8));
});
