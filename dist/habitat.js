import * as THREE from 'three';
import {seeded} from './supports.js';

const TAU=2*Math.PI;
const grey=(n)=>new THREE.Color().setRGB(n,n,n,THREE.SRGBColorSpace);
function attribute(values,size){return new THREE.Float32BufferAttribute(values,size);}

export function shellMesh(s) {
  const positions=[], bary=[], tones=[], strokes=[];
  const random=seeded(390+s.id.charCodeAt(2));
  for(let i=0;i<s.indices.length;i+=3){
    const pts=s.indices.slice(i,i+3).map(j=>s.vertices[j]);
    const a=Math.atan2(pts[0].z-s.z,pts[0].x-s.x), y=pts[0].y;
    const fold=.5+.5*Math.sin(2.3*a+1.7*y+.57*Math.sin(2.2*y));
    const facing=.5+.5*Math.cos(a+2.2);
    const tone=.023+.034*facing+.036*fold**3+random()*.021;
    const stroke=.105+.13*facing+.20*fold**4+.09*random();
    for(let k=0;k<3;k++){
      const p=pts[k];positions.push(p.x,p.y,p.z);bary.push(+(k===0),+(k===1),+(k===2));
      tones.push(tone);strokes.push(stroke);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',attribute(positions,3));geo.setAttribute('bary',attribute(bary,3));
  geo.setAttribute('tone',attribute(tones,1));geo.setAttribute('stroke',attribute(strokes,1));
  const group=new THREE.Group();
  for(const back of [true,false]){
    const mat=new THREE.ShaderMaterial({side:back?THREE.BackSide:THREE.FrontSide,transparent:true,depthWrite:false,
      uniforms:{rear:{value:back?1:0}},
      vertexShader:`attribute vec3 bary; attribute float tone,stroke; varying vec3 b,local;
      varying vec2 shade; void main(){b=bary;local=position;shade=vec2(tone,stroke);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 b,local;varying vec2 shade;uniform float rear;
      void main(){vec3 d=max(fwidth(b),vec3(.0001));
      vec3 edge=smoothstep(d*.08,d*.90,b);float e=1.-min(edge.x,min(edge.y,edge.z));
      float paper=fract(sin(dot(floor(local*225.),vec3(19.13,37.91,71.3)))*4375.);
      float ink=mix(shade.x+paper*.017,shade.y,e)*mix(1.,.65,rear);
      gl_FragColor=vec4(vec3(ink),mix(.76,.38,rear)+e*.15);}`
    });
    const skin=new THREE.Mesh(geo,mat);skin.renderOrder=back?1:2;group.add(skin);
  }
  return group;
}

const boundary=a=>1+.044*Math.sin(3*a+.6)+.038*Math.cos(5*a-.2)+.023*Math.sin(8*a);
function terrainHeight(x,z,r) {
  return -.61+.13*Math.sin(.78*x+1.6*z)+.125*Math.cos(.88*x-.82*z)
    +.07*Math.sin(.6*x+2.4*z)-.34*r**4;
}
function soilPoint(a,r){
  const edge=boundary(a),x=-.47+7.65*r*edge*Math.cos(a), z=3.75*r*edge*Math.sin(a);
  return {x,y:terrainHeight(x,z,r),z};
}
export function soilMesh(compact=false){
  const group=new THREE.Group(), random=seeded(536), pos=[], color=[], size=[];
  const count=compact?38000:77000;
  for(let i=0;i<count;i++){
    const side=i<count*.19, a=random()*TAU, r=side?1:Math.sqrt(random())*1.026;
    const {x,y,z}=soilPoint(a,r);
    const ridge=.5+.5*Math.sin(.82*x+2.5*z+.82*Math.sin(1.22*x));
    const patch=.5+.5*Math.cos(1.4*x-1.9*z);
    const depth=side?random():0;
    if(random()>(.28+.56*ridge+.15*patch)*(1-depth*.8))continue;
    const fade=side?(.60-depth*.44):Math.max(.09,1-Math.max(0,r-.92)*8.9);
    const light=(.15+.47*ridge+.15*patch+.23*random())*(.40+.60*random())*fade;
    const c=grey(light);color.push(c.r,c.g,c.b);
    const scatter=(side?depth*.09:.012);
    pos.push(x+(random()-.5)*scatter,y+.014+(random()-.5)*.078-depth*.35,z+(random()-.5)*scatter);
    size.push(.008+.021*random()**2);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',attribute(pos,3));geometry.setAttribute('color',attribute(color,3));geometry.setAttribute('grainSize',attribute(size,1));
  const mat=new THREE.ShaderMaterial({
    uniforms:{pixelScale:{value:900}},vertexColors:true,transparent:true,depthWrite:false,
    vertexShader:`attribute float grainSize; uniform float pixelScale; varying vec3 ink; varying float coverage;
    void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;
    float d=grainSize*pixelScale*projectionMatrix[1][1]/max(0.1,-p.z);
    gl_PointSize=clamp(d,1.,3.6);coverage=clamp(d,.31,1.);ink=color;}`,
    fragmentShader:`varying vec3 ink; varying float coverage;void main(){float r=length(gl_PointCoord-.5);
    gl_FragColor=vec4(ink,coverage*(1.-smoothstep(.28,.51,r)));
    #include <colorspace_fragment>
    }`
  });
  group.add(new THREE.Points(geometry,mat));
  const ground=[],idx=[],rings=30,segments=120;
  for(let i=0;i<=rings;i++)for(let j=0;j<segments;j++){
    const p=soilPoint(j/segments*TAU,i/rings);ground.push(p.x,p.y-.065,p.z);
    if(i){const k=i*segments+j,l=i*segments+(j+1)%segments;idx.push(k,l,k-segments,l,l-segments,k-segments);}
  }
  const surface=new THREE.BufferGeometry();surface.setAttribute('position',attribute(ground,3));surface.setIndex(idx);
  group.add(new THREE.Mesh(surface,new THREE.MeshBasicMaterial({color:0x020202,side:THREE.DoubleSide})));
  group.userData.pixelScale=mat.uniforms.pixelScale;
  return group;
}
