import test from 'node:test';
import assert from 'node:assert/strict';
import {PeaSimulation,CONFIG,directionFromLandmarks} from '../dist/simulation.js';

test('direction changes are bounded and the fixed root and old stem persist',()=>{
  const s=new PeaSimulation(),root={...s.nodes[0]},old=s.nodes.map(p=>({...p}));
  s.setDirection(10);assert.equal(s.targetAngle,CONFIG.maxAngle);s.step(.05);
  assert.ok(s.angle>0&&s.angle<=CONFIG.turnRate*.05+1e-9);
  for(let i=0;i<120;i++)s.step(1/60);
  assert.deepEqual(s.nodes.slice(0,old.length),old);assert.deepEqual(s.nodes[0],root);
  const oldAngle=s.angle;s.setDirection(-CONFIG.maxAngle);s.step(.05);
  assert.ok(Math.abs(s.angle-oldAngle)<=CONFIG.turnRate*.05+1e-9);
});
test('identical input sequences give identical exploration, with tip separate from stem',()=>{
  const a=new PeaSimulation(),b=new PeaSimulation();
  for(let i=0;i<300;i++){a.setDirection(.55);b.setDirection(.55);a.step(1/60);b.step(1/60);}
  assert.deepEqual(a.tip,b.tip);assert.deepEqual(a.nodes,b.nodes);
  assert.notDeepEqual(a.tip,a.head);assert.equal(a.connections.length,0);
});
test('nearby supports preserve symmetric steering speed and range',()=>{
  const right=new PeaSimulation(),left=new PeaSimulation(),command=Math.PI/6;
  for(let i=0;i<600;i++){right.step(1/60);left.step(1/60);}
  right.setDirection(command);left.setDirection(-command);
  for(let i=0;i<150;i++){
    right.step(1/60);left.step(1/60);
    const expected=Math.min(command,(i+1)*CONFIG.turnRate/60);
    assert.ok(Math.abs(right.angle-expected)<1e-10);
    assert.ok(Math.abs(left.angle+expected)<1e-10);
  }
});
test('a real spatial contact triggers wrapping, and attachment remains after steering away',()=>{
  const s=new PeaSimulation();let reached=false;
  for(let i=0;i<60*100;i++){
    if(s.phase==='exploring')s.setDirection(.95);
    s.step(1/60);
    if(s.connections.length){reached=true;break;}
  }
  assert.ok(reached,'reachable pole should establish a connection');
  const connection=structuredClone(s.connections[0]);s.setDirection(-1);
  for(let i=0;i<180;i++)s.step(1/60);
  assert.deepEqual(s.connections[0],connection);assert.ok(s.head.x<CONFIG.poleX);
});
function body(lean=0,translate=0,aspect=1){
 const p=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1}));
 const shoulderX=.5+translate-Math.tan(lean)*.28/aspect;
 p[11]={x:shoulderX-.09,y:.30,visibility:1};p[12]={x:shoulderX+.09,y:.30,visibility:1};
 p[23]={x:.43+translate,y:.58,visibility:1};p[24]={x:.57+translate,y:.58,visibility:1};return p;
}
test('torso lean controls left and right, independent of arm pose or screen position',()=>{
 const p=body(.22),right=directionFromLandmarks(p);
 assert.ok(right>0);assert.ok(directionFromLandmarks(body(-.22))<0);
 p[16]={x:.95,y:.05,visibility:1};p[15]={x:.05,y:.90,visibility:1};
 assert.equal(directionFromLandmarks(p),right);
 assert.ok(Math.abs(directionFromLandmarks(body(.22,.10))-right)<1e-10);
 assert.ok(Math.abs(directionFromLandmarks(body(.22,0,16/9),16/9)-right)<1e-10);
});
test('standing upright has a dead zone and missing torso landmarks produce no command',()=>{
 assert.equal(directionFromLandmarks(),null);assert.equal(directionFromLandmarks(body()),0);
 assert.equal(directionFromLandmarks(body(.035)),0);
 const p=body(.2);p[23].visibility=.1;assert.equal(directionFromLandmarks(p),null);
 p[23].visibility=1;p[24].y=1.1;assert.equal(directionFromLandmarks(p),null);
 assert.equal(directionFromLandmarks(body(.5)),CONFIG.maxAngle);
});
test('reset clears contact history and recreates the same starting plant',()=>{
  const s=new PeaSimulation(),fresh=new PeaSimulation();s.setDirection(1);for(let i=0;i<90;i++)s.step(1/60);s.reset();assert.deepEqual(s,fresh);
});

test('attachment does not teleport the visible apex or interrupt shoot growth',()=>{
 const s=new PeaSimulation();s.setDirection(.95);let previous=s.stemPoint(s.head.s),seen=false;
 for(let i=0;i<60*50;i++){
  const oldTravel=s.travel;s.step(1/60);const p=s.stemPoint(s.head.s);
  assert.ok(Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z)<.006,'continuous visible shoot');previous=p;
  if(s.phase==='wrapping'){seen=true;assert.ok(s.travel>oldTravel,'main shoot continues growing');}
 }
 assert.ok(seen);assert.ok(s.connections.length);
 const organ=s.organs.find(o=>o.contact);assert.deepEqual(s.shape(organ).base,s.stemPoint(organ.at));
});

test('organs originate at successive nodes and have independent development ages',()=>{
 const s=new PeaSimulation();const initial=s.organs.length;
 for(let i=0;i<60*45&&s.organs.length<initial+2;i++)s.step(1/60);
 assert.ok(s.organs.length>initial);
 const first=s.organs[initial],next=s.organs[initial+1];
 assert.ok(next.at>first.at);assert.ok(next.born>first.born);
 assert.ok(s.shape(first).development.unfold>s.shape(next).development.unfold);
});

test('the young shoot bends with body direction while its established root stays fixed',()=>{
 const l=new PeaSimulation(),r=new PeaSimulation(),root={...l.stemPoint(l.nodes[0].s)};
 l.setDirection(-.7);r.setDirection(.7);for(let i=0;i<120;i++){l.step(1/60);r.step(1/60);}
 assert.ok(l.stemPoint(l.head.s).x<r.stemPoint(r.head.s).x);
 assert.deepEqual(l.stemPoint(l.nodes[0].s),root);assert.deepEqual(r.stemPoint(r.nodes[0].s),root);
});
test('the plant uses fewer unequal tendril groups and varied node intervals',()=>{
 const s=new PeaSimulation();assert.ok(s.organs.reduce((n,o)=>n+o.tendrilCount,0)<s.organs.length*3);
 for(let i=0;i<60*45;i++)s.step(1/60);
 assert.ok(new Set(s.organs.map(o=>o.tendrilCount)).size>2);
 const newNodes=s.organs.filter(o=>o.at>=0),gaps=newNodes.slice(1).map((o,i)=>o.at-newNodes[i].at);
 assert.ok(Math.max(...gaps)-Math.min(...gaps)>.03);
});
