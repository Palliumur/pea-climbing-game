import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONFIG} from '../dist/simulation.js';
import {SUPPORTS,shellGap} from '../dist/supports.js';
import {coiledPath,distance} from '../dist/growth.js';
import {CatmullRomCurve3,Vector3} from '../dist/vendor/three/three.module.js';

// Captured from the original visible-fold reproductions. Keeping these
// independent of growth routes preserves the regression as exploration evolves.
const contacts=JSON.parse(readFileSync(new URL('./fixtures/wrapping-contacts.json',import.meta.url)));
function angle(a,b,c){
  const dot=(b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)+(b.z-a.z)*(c.z-b.z);
  return Math.acos(Math.max(-1,Math.min(1,dot/(distance(a,b)*distance(b,c)))));
}
const length=path=>path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0);

for(const shell of SUPPORTS)test(shell.id+' wraps without folds throughout the animation',()=>{
  const c=contacts.find(c=>c.supportId===shell.id),frames=Math.round(CONFIG.wrapDuration*60);
  assert.deepEqual(coiledPath(c,0,shell),c.original);
  let previousTip=c.original.at(-1);
  for(let frame=1;frame<=frames;frame++){
    const path=coiledPath(c,frame/frames,shell);
    assert.deepEqual(path[0],c.original[0],'filament root stays attached');
    assert.deepEqual(path[c.index],c.original[c.index],'contact remains fixed');
    assert.ok(distance(path.at(-1),previousTip)<.009,'continuous tip at 60 fps');
    previousTip=path.at(-1);
    for(let i=1;i<path.length-1;i++){
      assert.ok(angle(path[i-1],path[i],path[i+1])<20*Math.PI/180,
        `no short kink at frame ${frame}, point ${i}`);
    }
    if(frame%12===0){
      // Check the centripetal spline used by the tube renderer as well as its
      // control points; an interpolated curve can overshoot between samples.
      const curve=new CatmullRomCurve3(path.map(p=>new Vector3(p.x,p.y,p.z)),false,'centripetal');
      curve.arcLengthDivisions=Math.max(300,path.length*3);
      const rendered=curve.getSpacedPoints(256);
      for(let i=1;i<rendered.length-1;i++)assert.ok(angle(rendered[i-1],rendered[i],rendered[i+1])<25*Math.PI/180,
        `no rendered fold at frame ${frame}, point ${i}`);
    }
  }
  const finished=coiledPath(c,1,shell);
  assert.ok(length(finished.slice(c.index))<=length(c.original.slice(c.index))+c.extension+.002,
    'winding respects available distal tissue');
  for(const p of finished.slice(c.index))assert.ok(shellGap(shell,p)>=.0049&&shellGap(shell,p)<.03,
    'finished coil stays outside and close to the actual shell');
});
