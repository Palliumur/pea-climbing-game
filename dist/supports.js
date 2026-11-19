// Rendering and contact queries share these exact triangulated shells.
export function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
const TAU = 2 * Math.PI;
const bottom = -1.28;
function build(id, seed, x, z, radius, height) {
  const random = seeded(seed), vertices = [], indices = [], slices = [];
  const columns = Math.max(8, Math.round(radius * 36)), rows = Math.round(height / .23);
  const heightStep = (height - bottom) / rows;
  const phase = random() * TAU;
  for (let i = 0; i <= rows; i++) {
    const twist = .27 * Math.sin(i * .57 + phase) + (random() - .5) * .35;
    for (let j = 0; j < columns; j++) {
      const a = TAU * (j + twist + (random() - .5) * .57) / columns;
      const y = bottom + heightStep * (i + (i && i < rows ? (random() - .5) * .72 : i===rows ? .35*Math.sin(2*a+phase)+.25*Math.cos(a) : 0));
      const width = radius * (1 + .105*Math.sin(y*1.13 + phase) + .065*Math.sin(3*a + y*.64 + phase) + .035*(random()-.5));
      vertices.push({x:x + width*(Math.cos(a) + .21*Math.sin(y*.8+phase)),
        y, z:z + width*(.91*Math.sin(a) + .12*Math.cos(y*.7+phase))});
    }
  }
  for (let i=0; i<rows; i++) {
    slices[i]=[];
    for (let j=0; j<columns; j++) {
      const a=i*columns+j, b=i*columns+(j+1)%columns, c=a+columns, d=b+columns;
      const faces=random()<.48 ? [a,c,b,b,c,d] : [a,d,b,a,c,d];
      for (let k=0;k<6;k+=3) slices[i].push(faces.slice(k,k+3));
      indices.push(...faces);
    }
  }
  const top=vertices.length;
  vertices.push({x,y:height+.06,z});
  for(let j=0;j<columns;j++) indices.push(rows*columns+j,top,rows*columns+(j+1)%columns);
  return {id,x,z,radius,height,vertices,indices,slices,heightStep,extent:radius*1.50};
}
export const SUPPORTS = [
  build('S01',101,-3.79,.10,.26,12.74), build('S02',203,-5.04,.55,.15,12.1),
  build('S03',307,-2.40,-1.98,.39,13.03), build('S04',401,.72,.035,.15,12.15),
  build('S05',503,2.12,.18,.26,13.51), build('S06',607,3.67,-1.07,.39,12.38)
];
// Intersect a horizontal ray with the mesh's cross-section at this height.
export function shellRadius(shell,y,angle) {
  const dx=Math.cos(angle),dz=Math.sin(angle);
  const band=Math.floor((y-bottom)/shell.heightStep);
  for(let row=Math.max(0,band-1);row<=Math.min(shell.slices.length-1,band+1);row++) {
    for(const face of shell.slices[row]) {
      let firstX,firstZ;
      for(let k=0;k<3;k++) {
        const a=shell.vertices[face[k]], b=shell.vertices[face[(k+1)%3]];
        if((a.y>y)===(b.y>y))continue;
        const t=(y-a.y)/(b.y-a.y);
        const x=a.x+(b.x-a.x)*t-shell.x, z=a.z+(b.z-a.z)*t-shell.z;
        if(firstX===undefined){firstX=x;firstZ=z;continue;}
        const vx=x-firstX,vz=z-firstZ,det=dx*vz-dz*vx;
        if(Math.abs(det)<1e-12)break;
        const u=(firstX*dz-firstZ*dx)/det, r=(firstX*vz-firstZ*vx)/det;
        if(u>=-1e-8&&u<=1+1e-8&&r>0)return r;
      }
    }
  }
  return shell.radius; // Outside the playable vertical interval.
}
export function shellGap(shell,p) {
  const dx=p.x-shell.x,dz=p.z-shell.z;
  return Math.hypot(dx,dz)-shellRadius(shell,p.y,Math.atan2(dz,dx));
}
export function clearShells(p,side,margin) {
  for(const s of SUPPORTS) {
    if(Math.abs(p.x-s.x)>s.extent+margin||Math.abs(p.z-s.z)>s.extent+margin||p.y>s.height||p.y<bottom)continue;
    if(shellGap(s,p)>=margin)continue;
    // Move only the blade's depth, maintaining the original avoidance direction.
    let lo=0,hi=s.extent*2+margin*2;
    for(let i=0;i<9;i++) {
      const mid=(lo+hi)/2, q={x:p.x,y:p.y,z:p.z+side*mid};
      if(shellGap(s,q)<margin)lo=mid;else hi=mid;
    }
    p.z+=side*hi;
  }
  return p;
}

// Find the first point of an incoming distal segment within the tissue radius.
export function firstTouch(shell,a,b,pad=.005) {
  if(b.y<.35||b.y>shell.height-.12)return null;
  const extent=shell.extent+pad;
  if(Math.min(a.x,b.x)>shell.x+extent||Math.max(a.x,b.x)<shell.x-extent||
     Math.min(a.z,b.z)>shell.z+extent||Math.max(a.z,b.z)<shell.z-extent)return null;
  const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
  let lo=0,hi=1;
  // An already submerged proximal segment is not a new surface crossing.
  // Projecting it onto the shell manufactured an off-curve contact and kink.
  const gapA=shellGap(shell,a);
  if(gapA<pad-1e-7)return null;
  if(gapA<=pad)hi=0;
  else if(shellGap(shell,at(.5))<=pad)hi=.5;
  else if(shellGap(shell,b)>pad)return null;
  for(let i=0;i<10&&hi>0;i++){
    const t=(lo+hi)/2;if(shellGap(shell,at(t))<=pad)hi=t;else lo=t;
  }
  const q=at(hi),angle=Math.atan2(q.z-shell.z,q.x-shell.x);
  const r=shellRadius(shell,q.y,angle)+pad;
  return {x:shell.x+r*Math.cos(angle),y:q.y,z:shell.z+r*Math.sin(angle)};
}
