import * as THREE from 'three';
import {leafRandom,leafProfile,bladeSurface} from './foliage.js?v=habitat-1';

export function leafGeometry(seed=0,kind='leaflet'){
  const p=[],uv=[],localUv=[],ids=[],colors=[],rows=30,cols=14,profile=leafProfile(seed,kind);
  for(let i=0;i<=rows;i++){
    const t=i/rows;
    for(let j=0;j<=cols;j++){
      const side=j/cols*2-1,v=bladeSurface(profile,t,side);p.push(v.x,v.y,v.z);
      // Give each blade its own stable sample of the ink texture, with a monotonic
      // sample of it for each leaf; preserve the central vein and its direction.
      const zoom=.84+leafRandom(seed,22)*.14,curve=(leafRandom(seed,23)-.5)*.025*Math.sin(Math.PI*t);
      let u=.5+side*.5*zoom+curve;if(leafRandom(seed,24)>.5)u=1-u;
      const texV=.018+Math.pow(t,.85+leafRandom(seed,25)*.30)*(.93+leafRandom(seed,26)*.035);
      uv.push(u,texV);
      localUv.push(j/cols,t);
      const light=1-.035*side*side+.012*Math.sin(t*5+seed);colors.push(...profile.tint.map(c=>c*light));
    }
  }
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j;ids.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('bladeUv',new THREE.Float32BufferAttribute(localUv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(ids);g.computeVertexNormals();g.userData.profile=profile;return g;
}

// A small repeatable pigment field stays bound to the expanding blade UVs.
export function inkMap() {
  const w=256, pixels=new Uint8Array(w*w*4);let state=81289;
  for(let y=0;y<w;y++)for(let x=0;x<w;x++){
    state=(Math.imul(1664525,state)+1013904223)>>>0;
    const r=state/4294967296,u=x/w-.5,v=y/w;
    const sweep=.5+.5*Math.sin(v*16+u*6+2*Math.sin(u*8));
    const midrib=Math.exp(-Math.abs(u-.021*Math.sin(v*6))*105)*(1-v)*.18;
    const lateral=Math.abs(Math.sin(v*15-.7-4.5*Math.abs(u)));
    const vein=.085*Math.exp(-lateral*19)*Math.min(1,Math.abs(u)*10)*(1-Math.abs(u)*1.9);
    const ink=.88+.045*sweep+.055*r-midrib-vein-(r>.91?.37:0);
    const k=(y*w+x)*4;
    pixels[k]=pixels[k+1]=pixels[k+2]=Math.round(255*ink);pixels[k+3]=255;
  }
  const tex=new THREE.DataTexture(pixels,w,w);tex.colorSpace=THREE.SRGBColorSpace;
  tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;return tex;
}
export function leafMaterial(map,tint){
  return new THREE.MeshBasicMaterial({map,color:tint,vertexColors:true,side:THREE.DoubleSide});
}
