import * as THREE from 'three';
// Persistent, tapered tube with a parallel-transport frame. References reviewed:
// VegetationGeneratorThreeJS/src/ivy.ts and SeedThree/src/core/branch-mesh.js.
// Implementation below is pea-specific; buffers are updated in place each frame.
export class GrowingTube extends THREE.Mesh{
 constructor(material,radius=.006,rings=64,sides=6,arcLength=false){
  const geo=new THREE.BufferGeometry(),n=(rings+1)*(sides+1),indices=[];
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage));
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
  geo.setIndex(indices);super(geo,material);this.radius=radius;this.rings=rings;this.sides=sides;this.arcLength=arcLength;this.frustumCulled=false;
  this.curve=new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3(0,.01,0)],false,'centripetal');
  this.p=new THREE.Vector3();this.t=new THREE.Vector3();this.n=new THREE.Vector3();this.b=new THREE.Vector3();this.delta=new THREE.Vector3();
 }
 update(points,baseRadius=this.radius,tipRatio=.14){
  this.visible=points.length>1;if(!this.visible)return;
  while(this.curve.points.length<points.length)this.curve.points.push(new THREE.Vector3());
  this.curve.points.length=points.length;points.forEach((p,i)=>this.curve.points[i].set(p.x,p.y,p.z));
  if(this.arcLength){this.curve.arcLengthDivisions=Math.max(300,points.length*3);this.curve.updateArcLengths();}
  const pos=this.geometry.attributes.position,normal=this.geometry.attributes.normal,filament=this.geometry.attributes.filamentRadius;
  this.n.set(0,0,1);
  for(let i=0;i<=this.rings;i++){
   const u=i/this.rings;
   if(this.arcLength){this.curve.getPointAt(u,this.p);this.curve.getTangentAt(u,this.t).normalize();}
   else{this.curve.getPoint(u,this.p);this.curve.getTangent(u,this.t).normalize();}
   this.n.addScaledVector(this.t,-this.n.dot(this.t));if(this.n.lengthSq()<1e-6)this.n.set(1,0,0).addScaledVector(this.t,-this.t.x);this.n.normalize();this.b.crossVectors(this.t,this.n).normalize();
   const r=baseRadius*(1-(1-tipRatio)*Math.pow(u,1.6));
   for(let j=0;j<=this.sides;j++){
    const a=j/this.sides*Math.PI*2,k=i*(this.sides+1)+j;
    this.delta.copy(this.n).multiplyScalar(Math.cos(a)).addScaledVector(this.b,Math.sin(a));
    if(filament)filament.setX(k,r);
    pos.setXYZ(k,this.p.x+this.delta.x*r,this.p.y+this.delta.y*r,this.p.z+this.delta.z*r);normal.setXYZ(k,this.delta.x,this.delta.y,this.delta.z);
   }
  }
  pos.needsUpdate=true;normal.needsUpdate=true;if(filament)filament.needsUpdate=true;
 }
}
export function unfoldBlade(mesh,development,baseSize=1){
 const g=mesh.geometry,rest=g.userData.rest??(g.userData.rest=g.attributes.position.array.slice()),p=g.attributes.position;
 const open=development.unfold,length=.08+.92*development.bladeLength,width=.04+.96*development.bladeWidth,fold=(1-open)*1.43;
 for(let i=0;i<p.count;i++){
  const k=i*3,x=rest[k],y=rest[k+1],z=rest[k+2];
  p.setXYZ(i,x*width*Math.cos(fold),y*length,(z*open+Math.abs(x)*width*Math.sin(fold)+(1-open)*.07*Math.sin(y/.73*Math.PI))*length);
 }
 p.needsUpdate=true;mesh.scale.setScalar(baseSize);
}
