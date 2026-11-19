// Deterministic individual leaf morphology and geometric clearance helpers.
export function leafRandom(seed,salt=0){const n=Math.sin(seed*127.1+salt*311.7)*43758.5453;return n-Math.floor(n);}
export function leafProfile(seed,kind='leaflet'){
 const r=n=>leafRandom(seed,n),stipule=kind==='stipule';
 return {seed,kind,length:(stipule?.65:.69)+r(1)*.065,width:(stipule?.255:.22)+r(2)*.035,
  basePower:stipule?.60+r(3)*.12:.66+r(3)*.16,tipPower:stipule?.48+r(4)*.10:.50+r(4)*.14,
  asym:(r(5)-.5)*.13,curve:(r(6)-.5)*.028,twist:(r(7)-.5)*.036,
  droop:.045+r(8)*.030,cup:.014+r(9)*.012,edge:.003+r(10)*.005,phase:r(11)*Math.PI*2,
  tint:[.98+r(12)*.025,.98+r(13)*.025,.97+r(14)*.025]};
}
export function bladeSurface(p,t,s){
 const peak=p.basePower/(p.basePower+p.tipPower);
 const norm=Math.pow(peak,p.basePower)*Math.pow(1-peak,p.tipPower);
 let width=p.width*Math.pow(t,p.basePower)*Math.pow(1-t,p.tipPower)/norm;
 // Keep both leaflets and the broader stipules smoothly rounded.

 width*=1+p.asym*s*Math.sin(Math.PI*t);
 const center=p.curve*Math.sin(Math.PI*t)*(.35+.65*t);
 const x=s*width*(1+.011*Math.sin(t*57+p.phase+2*s))*.90+center,y=t*p.length;
 const z=p.cup*Math.sin(Math.PI*t)*(1-s*s)-p.droop*t*t*t+p.twist*s*t*t+p.edge*s*s*Math.sin(t*7+p.phase)*Math.sin(Math.PI*t);
 return {x,y,z};
}
export function pointSegmentDistanceSquared(p,a,b){
 const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,l=x*x+y*y+z*z;
 const t=l?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y+(p.z-a.z)*z)/l)):0;
 const q={x:a.x+x*t,y:a.y+y*t,z:a.z+z*t};
 return {distanceSquared:(p.x-q.x)**2+(p.y-q.y)**2+(p.z-q.z)**2,point:q};
}
export function clearPole(p,pole,side=1,margin=.018){
 if(p.y<-.99||p.y>pole.poleHeight+.03)return p;
 const radius=pole.poleRadius+margin,dx=p.x-pole.poleX;
 if(Math.abs(dx)>=radius)return p;
 const surface=Math.sqrt(radius*radius-dx*dx);
 if(side*p.z<surface)p.z=side*surface;
 return p;
}
export class CapsuleField{
 constructor(cell=.24){this.cell=cell;this.cells=new Map();}
 key(x,y,z){return `${x},${y},${z}`;}
 clear(){this.cells.clear();}
 addPath(points,radius,owner=null,stride=1){
  for(let i=0;i<points.length-1;i+=stride){
   const a=points[i],b=points[Math.min(i+stride,points.length-1)],r=radius+.045,c={a,b,r,owner,physicalRadius:radius};
   const min=[Math.min(a.x,b.x)-r,Math.min(a.y,b.y)-r,Math.min(a.z,b.z)-r].map(x=>Math.floor(x/this.cell));
   const max=[Math.max(a.x,b.x)+r,Math.max(a.y,b.y)+r,Math.max(a.z,b.z)+r].map(x=>Math.floor(x/this.cell));
   for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
    const key=this.key(x,y,z);let list=this.cells.get(key);if(!list)this.cells.set(key,list=[]);list.push(c);
   }
  }
 }
 candidates(p){return this.cells.get(this.key(Math.floor(p.x/this.cell),Math.floor(p.y/this.cell),Math.floor(p.z/this.cell)))??[];}
 project(p,side=1){
  // Clear narrow stems along the leaf's chosen depth side. Inflated capsules
  // also cover the spaces between neighbouring vertices of the leaf mesh.
  for(let pass=0;pass<2;pass++)for(const c of this.candidates(p)){
   const hit=pointSegmentDistanceSquared(p,c.a,c.b);if(hit.distanceSquared>=c.r*c.r)continue;
   const dx=p.x-hit.point.x,dy=p.y-hit.point.y;
   const dz=Math.sqrt(Math.max(0,c.r*c.r-dx*dx-dy*dy));
   p.z=hit.point.z+side*(dz+.003);
  }
  return p;
 }
}
