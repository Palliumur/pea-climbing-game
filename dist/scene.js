import * as THREE from 'three';
import {development,samplePath} from './growth.js?v=depth-growth-1';
import {GrowingTube,unfoldBlade} from './growing-mesh.js?v=habitat-1';
import {CapsuleField,leafRandom} from './foliage.js?v=habitat-1';
import {inkMap,leafGeometry,leafMaterial} from './botanical.js?v=habitat-1';

import {clearShells} from './supports.js';
import {soilMesh,shellMesh} from './habitat.js';
const V=(p)=>new THREE.Vector3(p.x,p.y,p.z??0);
function disposeChildren(group){for(const child of [...group.children]){group.remove(child);child.traverse(o=>{if(o.isMesh)o.geometry?.dispose();});}}

export class PeaScene{
  constructor(container,sim){
    this.container=container;this.sim=sim;this.lastRevision=-1;this.lastGeom=-1;this.leaves=[];this.dynamicLeaves=0;this.lastConnection=0;this.trailPoints=[];this.showTrail=false;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0);
    this.camera=new THREE.PerspectiveCamera(29,1,.08,120);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));container.appendChild(this.renderer.domElement);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    const map=inkMap();this.leafGeos=Array.from({length:3},(_,i)=>leafGeometry(800+i));this.leafGeo=this.leafGeos[0];
    this.leafMaterials=['#c6dec6','#a5c3a5','#d6e9d0','#c1d8be'].map(c=>leafMaterial(map,c));this.leafMat=this.leafMaterials[0];
    this.ready=Promise.resolve();
    this.stemMat=new THREE.MeshBasicMaterial({color:'#a4bea0'});
    this.filamentHeight={value:680};
    this.tendrilMat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true});
    this.tendrilMat.onBeforeCompile=shader=>{
      shader.uniforms.cssHeight=this.filamentHeight;
      shader.vertexShader='attribute float filamentRadius;uniform float cssHeight;varying float coverage;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
        float unitsPerPixel=-2.*(modelViewMatrix*vec4(position,1.)).z/(cssHeight*projectionMatrix[1][1]);
        float radius=max(filamentRadius,.54*unitsPerPixel);
        coverage=clamp(filamentRadius/radius,.20,1.);
        vec3 transformed=position+normal*(radius-filamentRadius);`);
      shader.fragmentShader='varying float coverage;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a*=coverage;\n#include <opaque_fragment>');
    };
    this.plant=new THREE.Group();this.scene.add(this.plant);this.stem=new GrowingTube(this.stemMat,.022,240,8,true);this.stem.castShadow=true;this.plant.add(this.stem);
    this.tendrils=new THREE.Group();this.plant.add(this.tendrils);this.connectionGroup=new THREE.Group();this.plant.add(this.connectionGroup);this.foliage=new THREE.Group();this.plant.add(this.foliage);
    this.soil=soilMesh(innerWidth<700);this.scene.add(this.soil);
    this.sim.supports.forEach(s=>this.scene.add(shellMesh(s)));
    this.trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#a8c2aa',transparent:true,opacity:.36,depthWrite:false}));this.scene.add(this.trail);
    this.apexBud=new THREE.Group();this.plant.add(this.apexBud);this.budBlades=[];
    for(let i=0;i<3;i++){
      const blade=new THREE.Mesh(this.leafGeos[i].clone(),this.leafMaterials[2]);
      blade.castShadow=true;this.apexBud.add(blade);this.budBlades.push(blade);
    }
    this.capsules=new CapsuleField();this.cameraAim=new THREE.Vector3();this.cameraDistance=0;this.overview=true;this.reset();
    this.resize=()=>{
      const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
      this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);
      this.filamentHeight.value=h;this.soil.userData.pixelScale.value=h*this.renderer.getPixelRatio()*.5;this.frameCamera(true);
    };
    this.observer=new ResizeObserver(this.resize);this.observer.observe(container);this.resize();
  }
  frameCamera(snap=false){
    const {head}=this.sim, wide=this.overview, aspect=this.camera.aspect;
    const apex=wide?null:this.sim.stemPoint(head.s);
    const aim=wide?new THREE.Vector3(-.48,5.88,-.28):
      new THREE.Vector3(apex.x+.13,Math.max(1.52,apex.y-.58),apex.z+.04);
    const span=wide?Math.max(17.65,16.6/aspect):Math.max(5.65,4.65/aspect);
    const distance=span/(2*Math.tan(this.camera.fov*Math.PI/360));
    const t=snap?1:.07;
    this.cameraAim.lerp(aim,t);this.cameraDistance+=(distance-this.cameraDistance)*t;
    const pitch=wide?.28:.17;
    const yaw=.075;
    this.camera.position.copy(this.cameraAim).addScaledVector(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)),this.cameraDistance);
    this.camera.lookAt(this.cameraAim);this.camera.updateMatrixWorld();
  }
  createOrgan(organ){
    const group=new THREE.Group(),branch=new GrowingTube(this.stemMat,.007,36,6);
    group.add(branch);const blades=[],stipules=[];
    const makeBlade=(slot,kind,pair=0,sign=1)=>{
      const seed=organ.id*137+slot*19+61;
      const leaf=new THREE.Mesh(leafGeometry(seed,kind),this.leafMaterials[(organ.id+slot)%4]);
      leaf.castShadow=true;leaf.receiveShadow=true;
      const stalk=new GrowingTube(this.stemMat,.0025,10,5);group.add(stalk,leaf);
      return {leaf,stalk,pair,sign,seed};
    };
    for(let pair=0;pair<(organ.leafPairs??2);pair++)for(const sign of[-1,1])blades.push(makeBlade(pair*2+(sign>0?1:0),'leaflet',pair,sign));
    for(const sign of[-1,1])stipules.push(makeBlade(4+(sign>0?1:0),'stipule',0,sign));
    const filaments=Array.from({length:organ.tendrilCount??3},(_,i)=>{const mesh=new GrowingTube(this.tendrilMat,i?.0028:.004,72,5);const colors=[],base=new THREE.Color('#9aa995'),light=new THREE.Color('#e6eddf');
      for(let row=0;row<=mesh.rings;row++)for(let j=0;j<=mesh.sides;j++){
        const c=base.clone().lerp(light,.18+.45*row/mesh.rings+.32*(.5+.5*Math.cos(j/mesh.sides*2*Math.PI)));
        colors.push(c.r,c.g,c.b);
      }
      mesh.geometry.setAttribute('filamentRadius',new THREE.BufferAttribute(new Float32Array(colors.length/3),1).setUsage(THREE.DynamicDrawUsage));
      mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));group.add(mesh);return mesh;});
    const view={group,branch,blades,stipules,filaments,organ};this.foliage.add(group);this.leaves.push(view);return view;
  }
  poseBlade(view,attachment,direction,normal,dev,size){
    const {leaf,stalk,seed}=view;
    const y=direction.clone().normalize(),z=normal.clone().addScaledVector(y,-normal.dot(y)).normalize(),x=new THREE.Vector3().crossVectors(y,z).normalize();z.crossVectors(x,y).normalize();
    const root=attachment.clone().addScaledVector(y,.037+leafRandom(seed,17)*.022).addScaledVector(z,.018);
    const side=view.clearanceSide??(view.clearanceSide=attachment.z<-.015?-1:1);
    this.capsules.project(root,side);clearShells(root,side,.025);this.capsules.project(root,side);
    leaf.position.copy(root);leaf.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
    const mature=dev.bladeLength===1&&dev.bladeWidth===1&&dev.unfold===1;
    if(!mature||!view.opened){unfoldBlade(leaf,dev,size);leaf.geometry.computeVertexNormals();view.opened=mature;}leaf.updateMatrixWorld(true);
    const p=leaf.geometry.attributes.position,world=new THREE.Vector3();
    const positions=leaf.geometry.userData.collisionWorld??(leaf.geometry.userData.collisionWorld=new Float32Array(p.count*3));
    for(let i=0;i<p.count;i++){world.fromBufferAttribute(p,i).applyMatrix4(leaf.matrixWorld);positions[i*3]=world.x;positions[i*3+1]=world.y;positions[i*3+2]=world.z;}
    // Keep the blade surface intact. Its short petiolule yields as a whole,
    // instead of distorting individual vertices into bumps around obstacles.
    let offset=0;
    // The clearance envelope exceeds the spacing of this probe lattice.
    // Checking a compact lattice keeps continuous animation responsive.
    for(let pass=0;pass<4;pass++){
      let delta=0;
      for(let row=0;row<=30;row+=3)for(let col=0;col<=14;col+=2){
        const i=row*15+col;world.fromArray(positions,i*3);world.z+=side*offset;
        const z=world.z;this.capsules.project(world,side);clearShells(world,side,.04);this.capsules.project(world,side);delta=Math.max(delta,(world.z-z)*side);
      }
      if(delta<1e-5)break;offset+=delta+.002;
    }
    view.clearanceOffset=Math.max(offset,(view.clearanceOffset??0)*.94);root.z+=side*view.clearanceOffset;leaf.position.copy(root);leaf.updateMatrixWorld(true);
    const mid=attachment.clone().lerp(root,.5);clearShells(mid,side,.015);
    stalk.update([attachment,mid,root],.0026*(.3+.7*dev.bladeLength),.7);
  }
  reset(){
    disposeChildren(this.foliage);this.leaves=[];this.lastGeom=-1;this.lastShapeTime=-1;this.trailPoints=[];
    this.trail.geometry.dispose();this.trail.geometry=new THREE.BufferGeometry();
    this.sim.organs.forEach(o=>this.createOrgan(o));this.updateGeometry();
  }
  updateGeometry(){
    const s=this.sim;
    const stem=s.stemPoints();this.stem.update(stem,.021,.18);
    while(this.leaves.length<s.organs.length)this.createOrgan(s.organs[this.leaves.length]);
    const shapes=this.leaves.map(view=>s.shape(view.organ)),paths=this.leaves.map((view,i)=>s.tendrilPaths(view.organ,shapes[i]));
    this.capsules.clear();this.capsules.addPath(this.stem.curve.getSpacedPoints(180),.022,'stem');
    shapes.forEach((shape,i)=>{this.capsules.addPath(shape.rachis,.007,i,2);paths[i].forEach(path=>this.capsules.addPath(path,.004,i,4));});
    for(let index=0;index<this.leaves.length;index++){
      const view=this.leaves[index],o=view.organ,shape=shapes[index],d=shape.development;
      view.branch.update(shape.rachis,.0065*(.18+.82*d.rachis),.55);
      for(const blade of view.blades){
        const {pair,sign,seed}=blade,delay=pair*(1.3+leafRandom(seed,2)*1.4),part=development(shape.age-delay);
        const t=.25+pair*.31+(leafRandom(seed,3)-.5)*.075;
        const base=V(samplePath(shape.rachis,t)),tangent=V(samplePath(shape.rachis,Math.min(1,t+.04))).sub(V(samplePath(shape.rachis,Math.max(0,t-.04)))).normalize();
        const spread=new THREE.Vector3(tangent.y,-tangent.x,.12+(leafRandom(seed,4)-.5)*.35).normalize();
        const opening=.10+(1.00+(leafRandom(seed,5)-.5)*.28)*part.unfold;
        const direction=tangent.clone().multiplyScalar(Math.cos(opening)).addScaledVector(spread,sign*Math.sin(opening));
        const normal=new THREE.Vector3((leafRandom(seed,6)-.5)*.6,(leafRandom(seed,7)-.5)*.5,1).normalize();
        const bladeSize=(pair?.47:.56)*( .91+leafRandom(seed,8)*.20)*o.scale;
        this.poseBlade(blade,base,direction,normal,part,bladeSize);
      }
      for(const blade of view.stipules){
        const {sign,seed}=blade,dir=new THREE.Vector3(sign*(.22+.58*d.unfold),1,(leafRandom(seed,10)-.5)*.45).normalize();
        this.poseBlade(blade,V(shape.base),dir,new THREE.Vector3(sign*.18,.06,1),development(shape.age+3),(.29+leafRandom(seed,11)*.09)*o.scale);
      }
      paths[index].forEach((path,i)=>{
        const filament=view.filaments[i];
        filament.arcLength=o.contact?.branch===i;
        filament.update(path,(i?.0038:.0068)*(.25+.75*d.tendril),.12);
      });
    }
    // The apical meristem remains a small packet of folded primordia, distinct
    // from the terminal tendrils of a compound leaf below it.
    this.apexBud.position.copy(V(s.stemPoint(s.head.s)));
    const previous=s.stemPoint(s.head.s-.055);
    const direction=this.apexBud.position.clone().sub(V(previous)).normalize();
    this.apexBud.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    this.budBlades.forEach((blade,i)=>{
      blade.position.set((i-1)*.008,-i*.012,.008-i*.006);
      blade.rotation.set(0,(i-1)*.7,(i-1)*.11);
      unfoldBlade(blade,{bladeLength:.57-i*.09,bladeWidth:.23,unfold:.13},.22-i*.035);blade.geometry.computeVertexNormals();
    });
    this.lastShapeTime=s.time;
  }
  render(now,active=false){
    this.frameCamera();
    // All botanical motion uses simulation time; pause freezes the organism.
    // Persistent buffers remove the old 10 Hz destroy/rebuild animation.
    if(this.lastShapeTime!==this.sim.time)this.updateGeometry();
    if(active&&this.sim.time-this.lastGeom>.08){
      this.trailPoints.push(V(this.sim.tip));if(this.trailPoints.length>500)this.trailPoints.shift();
      if(this.trailPoints.length>1){this.trail.geometry.dispose();this.trail.geometry=new THREE.BufferGeometry().setFromPoints(this.trailPoints);}
      this.lastGeom=this.sim.time;
    }
    this.trail.visible=this.showTrail;
    this.renderer.render(this.scene,this.camera);
  }
  project(point){const p=V(point).project(this.camera);return{x:(p.x*.5+.5)*this.container.clientWidth,y:(-.5*p.y+.5)*this.container.clientHeight};}
}
