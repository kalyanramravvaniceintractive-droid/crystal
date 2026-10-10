import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './style.css';

gsap.registerPlugin(ScrollTrigger);

function CrystalScene({ onProgress, onReady }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05030b');
    scene.fog = new THREE.FogExp2('#0b0618', 0.025);
    const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 180);
    camera.position.set(0, 0.2, 13);
    scene.add(new THREE.HemisphereLight('#c4b5ff', '#100819', 1.15));
    const key = new THREE.DirectionalLight('#fff7ff', 3.2); key.position.set(-3, 5, 7); scene.add(key);

    // A compact procedural environment map gives the glass a stable, richly colored reflection.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene(); envScene.background = new THREE.Color('#080513');
    const envLights = [ ['#b95bff', -4, 1, 1, 2.1, 6], ['#69deff', 4, -1, 0, 1.5, 5], ['#fff1ff', 0, 5, -2, 4, 1.2], ['#46128c', -1, -4, -2, 5, 1.4] ];
    envLights.forEach(([c,x,y,z,w,h]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({ color:c, side:THREE.DoubleSide })); m.position.set(x,y,z); m.lookAt(0,0,0); envScene.add(m); });
    const envMap = pmrem.fromScene(envScene, 0.04).texture; scene.environment = envMap; pmrem.dispose();

    const journey = new THREE.Group(); scene.add(journey);
    const shell = new THREE.Group(); journey.add(shell);
    const facetMats=['#f7efff','#c8a5f2','#e7dcff','#aa83d8','#f3e7ff','#d7c3fa'].map(color=>new THREE.MeshPhysicalMaterial({color,metalness:.015,roughness:.028,transmission:.96,thickness:1.8,ior:1.66,envMapIntensity:3.1,attenuationColor:new THREE.Color('#b590ed'),attenuationDistance:5.2,clearcoat:1,clearcoatRoughness:.025,flatShading:true,side:THREE.DoubleSide}));
    const crystalMat = facetMats[0];
    const innerMat = new THREE.MeshPhysicalMaterial({ color:'#aa82e8', metalness:.025, roughness:.14, transmission:.72, thickness:.85, ior:1.66, envMapIntensity:1.9, emissive:'#210c38', emissiveIntensity:.12, flatShading:true, side:THREE.DoubleSide });
    // Quartz habit: hexagonal prism, uneven growth rings and a crystalline termination.
    const geom = new THREE.BufferGeometry(); const positions=[]; const inds=[]; const sides=6;
    positions.push(0,-3.05,0); const ringA=[], ringB=[];
    for(let i=0;i<sides;i++){
      const a=i/sides*Math.PI*2+Math.PI/6, w=1+Math.sin(i*7.7)*.08;
      ringA.push(positions.length/3); positions.push(Math.cos(a)*.8*w,-.95+Math.sin(i*5.2)*.11,Math.sin(a)*.72*w);
    }
    for(let i=0;i<sides;i++){
      const a=i/sides*Math.PI*2+Math.PI/6+.025, w=1+Math.sin(i*6.1+1.2)*.1;
      ringB.push(positions.length/3); positions.push(Math.cos(a)*1.0*w,.94+Math.sin(i*4.4)*.13,Math.sin(a)*.88*w);
    }
    const top=positions.length/3; positions.push(0,3.18,.035);
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides, a=ringA[i], an=ringA[j], b=ringB[i], bn=ringB[j];
      inds.push(0,an,a, top,b,bn, a,an,bn, a,bn,b); geom.addGroup(i*12,12,i);
    }
    geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geom.setIndex(inds); geom.computeVertexNormals();
    const outer = new THREE.Mesh(geom, facetMats); shell.add(outer);
    // A restrained Fresnel layer gives the sharp glass edges a spectral highlight.
    const edgeGlass=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
      vertexShader:`varying vec3 vWorldNormal; varying vec3 vView; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorldNormal=normalize(mat3(modelMatrix)*normal); vView=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
      fragmentShader:`varying vec3 vWorldNormal; varying vec3 vView; void main(){ float f=pow(1.0-abs(dot(normalize(vWorldNormal),normalize(vView))),2.15); vec3 violet=vec3(0.42,0.17,0.78); vec3 ice=vec3(0.22,0.72,0.92); vec3 c=mix(violet,ice,smoothstep(-0.15,0.55,vWorldNormal.x)); gl_FragColor=vec4(c,f*0.42); }`
    });
    const spectralEdge=new THREE.Mesh(geom,edgeGlass); spectralEdge.renderOrder=2; shell.add(spectralEdge);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1), innerMat); core.scale.set(.72,1.38,.72); shell.add(core);
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 18), new THREE.LineBasicMaterial({ color:'#ead6ff', transparent:true, opacity:.2 })); shell.add(wire);
    const striationMat=new THREE.LineBasicMaterial({color:'#e4caff',transparent:true,opacity:.18});
    for(let k=0;k<5;k++){
      const points=[], phase=k*1.17;
      for(let j=0;j<42;j++){const t=j/41;points.push(new THREE.Vector3(Math.sin(phase+t*2.4)*(.28+t*.14),-2.1+t*4.25,Math.cos(phase+t*2.1)*(.22+t*.15)));}
      shell.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),striationMat));
    }
    const inclusionGeo=new THREE.SphereGeometry(1,6,5), inclusionMat=new THREE.MeshBasicMaterial({color:'#e5c7ff',transparent:true,opacity:.24});
    const inclusions=new THREE.InstancedMesh(inclusionGeo,inclusionMat,52), dummy=new THREE.Object3D();
    for(let i=0;i<52;i++){const y=-2.2+Math.random()*4.4,a=Math.random()*Math.PI*2,r=.16+Math.random()*.38,s=.008+Math.random()*.018;dummy.position.set(Math.cos(a)*r,y,Math.sin(a)*r*.72);dummy.scale.set(s,s*(1+Math.random()*2),s);dummy.updateMatrix();inclusions.setMatrixAt(i,dummy.matrix);}
    shell.add(inclusions);
    const shards=[];
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4, y=-1.55+(i%4)*.98;
      const shard=new THREE.Mesh(new THREE.OctahedronGeometry(.38+(i%3)*.13,0), i%2?innerMat:crystalMat);
      shard.position.set(Math.cos(a)*.43,y,Math.sin(a)*.42); shard.scale.set(.72,1.8,.58); shard.rotation.set(.2*i,.25*i,.12*i); shell.add(shard); shards.push({mesh:shard, home:shard.position.clone(), rot:shard.rotation.clone(), dir:new THREE.Vector3(Math.cos(a)*1.9,(i%2?1:-1)*.3,Math.sin(a)*1.5)});
    }
    const innerWorld=new THREE.Group(); innerWorld.scale.setScalar(.01); scene.add(innerWorld);
    const worldMat = new THREE.MeshPhysicalMaterial({ color:'#d2b5ff', roughness:.08, metalness:.04, transmission:.88, thickness:1.1, ior:1.64, envMapIntensity:1.8, emissive:'#180b31', emissiveIntensity:.12, clearcoat:1, flatShading:true });
    const cyanMat = new THREE.MeshPhysicalMaterial({ color:'#bbf6ff', roughness:.065, metalness:.04, transmission:.9, thickness:.9, ior:1.57, envMapIntensity:1.9, emissive:'#073947', emissiveIntensity:.16, flatShading:true });
    const darkRock = new THREE.MeshStandardMaterial({ color:'#100c21', roughness:.34, metalness:.28, emissive:'#10031f', emissiveIntensity:.16 });
    // Distant cave ribs and dense crystal garden, arranged as reused low-poly meshes.
    for(let i=0;i<28;i++){
      const side=i%2?1:-1, z=-i*1.18-5, h=2.0+(i*17%13)*.24;
      const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.02,.36,h,6,1),i%4===0?cyanMat:worldMat);
      pillar.position.set(side*(2.8+(i*7%11)*.19),-1.1+h*.5,z); pillar.rotation.z=side*(.08+(i%3)*.04); innerWorld.add(pillar);
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.8+(i%4)*.27,0),darkRock); rock.scale.set(1.8,.45,1.2); rock.position.set(side*(2.55+(i%3)*.3),-2.55,z+.1); innerWorld.add(rock);
      if(i%4===0){ const island=new THREE.Group(); island.position.set(-side*(1.8+(i%3)*.6),.3+(i%2)*1.0,z-1); innerWorld.add(island); const base=new THREE.Mesh(new THREE.DodecahedronGeometry(.68,1),darkRock); base.scale.set(1.35,.54,1); island.add(base); const spike=new THREE.Mesh(new THREE.ConeGeometry(.22,.95,6),worldMat); spike.position.y=.58; island.add(spike); }
    }
    const architecture=new THREE.Group(); innerWorld.add(architecture);
    for(let i=0;i<7;i++) { const tower=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,1.2+(i%3)*.45,5),i%2?worldMat:cyanMat); tower.position.set((i-3)*.45,-.6,-25-Math.abs(i-3)*.18); architecture.add(tower); const cap=new THREE.Mesh(new THREE.OctahedronGeometry(.28,1),i%2?cyanMat:worldMat); cap.position.set((i-3)*.45,.2+(i%3)*.22,-25-Math.abs(i-3)*.18); architecture.add(cap); }
    const coreGem=new THREE.Mesh(new THREE.OctahedronGeometry(1.5,2),new THREE.MeshPhysicalMaterial({...innerMat,emissive:'#6423b7',emissiveIntensity:.65,roughness:.07})); coreGem.position.set(0,.25,-27); coreGem.scale.y=1.55; innerWorld.add(coreGem);
    const links=new THREE.Group(); innerWorld.add(links);
    for(let i=0;i<18;i++){ const a=i*2.399, r=2.2+(i%4)*.33; const p=new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r*.65,-27+(i%5)*.42); const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([p,coreGem.position]),new THREE.LineBasicMaterial({color:i%3?'#9d53ff':'#4be8ff',transparent:true,opacity:.42})); links.add(line); const dot=new THREE.Mesh(new THREE.SphereGeometry(.045,8,8),new THREE.MeshBasicMaterial({color:i%3?'#ec8dff':'#71efff'})); dot.position.copy(p); links.add(dot); }
    // Stars and drifting motes use single point-cloud draw calls.
    const starN=1250, starPos=new Float32Array(starN*3); for(let i=0;i<starN;i++){ starPos[i*3]=(Math.random()-.5)*75; starPos[i*3+1]=(Math.random()-.5)*42; starPos[i*3+2]=-Math.random()*95; }
    const starGeo=new THREE.BufferGeometry(); starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3)); const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#cbb8ff',size:.038,transparent:true,opacity:.78,sizeAttenuation:true})); scene.add(stars);
    const moteN=430,motePos=new Float32Array(moteN*3); for(let i=0;i<moteN;i++){motePos[i*3]=(Math.random()-.5)*15;motePos[i*3+1]=(Math.random()-.5)*9;motePos[i*3+2]=(Math.random()-.5)*34-8;}
    const moteGeo=new THREE.BufferGeometry();moteGeo.setAttribute('position',new THREE.BufferAttribute(motePos,3));const motes=new THREE.Points(moteGeo,new THREE.PointsMaterial({color:'#bb80ff',size:.027,transparent:true,opacity:.74}));scene.add(motes);
    const trails=new THREE.Group();scene.add(trails);
    for(let k=0;k<3;k++){const points=[];for(let i=0;i<180;i++){const t=i/179*Math.PI*2;points.push(new THREE.Vector3(Math.cos(t)*(2.2+k*.24),Math.sin(t*2+k)*(.65+k*.14),Math.sin(t)*(1+k*.25)));}const curve=new THREE.CatmullRomCurve3(points); const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(260)),new THREE.LineBasicMaterial({color:k===1?'#4be8ff':'#b95cff',transparent:true,opacity:.5}));trails.add(line);}

    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.36,.62,1.12); composer.addPass(bloom);
    let progress=0, disposed=false;
    const timeline=gsap.timeline({paused:true,onUpdate:()=>{const value=timeline.progress();if(Number.isFinite(value)){progress=value;onProgress?.(value);}}});
    timeline.to(camera.position,{z:9.7,duration:.12,ease:'none'},0);
    timeline.to(shell.rotation,{y:Math.PI*.72,duration:.3,ease:'none'},0);
    timeline.to(shell.scale,{x:1.3,y:1.3,z:1.3,duration:.14,ease:'none'},.15);
    timeline.to(camera.position,{x:.34,y:.12,duration:.13,ease:'sine.inOut'},.16);
    timeline.to(camera.position,{x:-.22,y:-.08,duration:.15,ease:'sine.inOut'},.29);
    timeline.to(shards.map(s=>s.mesh.position),{x:(i)=>shards[i].home.x+shards[i].dir.x,y:(i)=>shards[i].home.y+shards[i].dir.y,z:(i)=>shards[i].home.z+shards[i].dir.z,duration:.15,ease:'power2.inOut'},.3);
    timeline.to(shards.map(s=>s.mesh.rotation),{x:(i)=>shards[i].rot.x+.45,y:(i)=>shards[i].rot.y+(i%2?-.8:.8),z:(i)=>shards[i].rot.z+.32,duration:.17,ease:'power2.inOut'},.3);
    timeline.to(camera.rotation,{z:-.035,duration:.12,ease:'sine.inOut'},.34);
    timeline.to(shell.scale,{x:5.2,y:5.2,z:5.2,duration:.13,ease:'power2.in'},.43);
    timeline.to(innerWorld.scale,{x:1,y:1,z:1,duration:.1,ease:'power2.out'},.43);
    timeline.to(camera.position,{z:-9,duration:.18,ease:'power2.inOut'},.44);
    timeline.to(camera.rotation,{z:.025,duration:.18,ease:'sine.inOut'},.48);
    timeline.to(innerWorld.position,{z:8,duration:.2,ease:'none'},.56);
    timeline.to(camera.position,{x:.55,y:.25,z:-19,duration:.25,ease:'power1.inOut'},.6);
    timeline.to(camera.rotation,{z:0,duration:.16,ease:'sine.inOut'},.67);
    timeline.to(coreGem.scale,{x:1.45,y:2.1,z:1.45,duration:.12,ease:'sine.inOut'},.78);
    timeline.to(camera.position,{x:0,y:0,z:13.2,duration:.15,ease:'power2.inOut'},.88);
    timeline.to(innerWorld.scale,{x:.01,y:.01,z:.01,duration:.12,ease:'power2.in'},.88);
    timeline.to(shell.scale,{x:1.15,y:1.15,z:1.15,duration:.12,ease:'power2.out'},.9);
    timeline.to(shards.map(s=>s.mesh.position),{x:(i)=>shards[i].home.x,y:(i)=>shards[i].home.y,z:(i)=>shards[i].home.z,duration:.12,ease:'power2.in'},.9);
    timeline.to(shards.map(s=>s.mesh.rotation),{x:(i)=>shards[i].rot.x,y:(i)=>shards[i].rot.y,z:(i)=>shards[i].rot.z,duration:.12,ease:'power2.in'},.9);
    timeline.to(shell.rotation,{y:Math.PI*2,duration:.14,ease:'none'},.86);
    ScrollTrigger.create({ trigger:'.story', start:'top top', end:'bottom bottom', scrub:.85, animation:timeline, invalidateOnRefresh:true });
    const lenis=new Lenis({duration:1.25,smoothWheel:true,lerp:.075,orientation:'vertical',gestureOrientation:'vertical',smoothTouch:false});
    lenis.on('scroll',ScrollTrigger.update);
    const updateLenis=(time)=>lenis.raf(time*1000); gsap.ticker.add(updateLenis);
    const clock=new THREE.Clock();
    let renderRaf=0;
    const render=()=>{ if(disposed)return; const t=clock.getElapsedTime(); shell.rotation.y+=reduced?0:.00055; shell.rotation.x=reduced?0:Math.sin(t*.16)*.014; innerWorld.rotation.y=reduced?0:.012*Math.sin(t*.12); coreGem.rotation.y=reduced?0:t*.075; trails.rotation.y=reduced?0:t*.022; motes.rotation.y=reduced?0:t*.0012; bloom.strength=window.innerWidth<700?.22:.3; composer.render(); renderRaf=requestAnimationFrame(render); };
    const readyTimer=requestAnimationFrame(()=>onReady?.());
    render();
    const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);};
    window.addEventListener('resize',resize);
    return ()=>{disposed=true;cancelAnimationFrame(renderRaf);cancelAnimationFrame(readyTimer);window.removeEventListener('resize',resize);ScrollTrigger.getAll().forEach(t=>t.kill());gsap.ticker.remove(updateLenis);lenis.destroy();timeline.kill();composer.dispose();renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});envMap.dispose();};
  },[]);
  return <canvas className="scene-canvas" ref={canvasRef} aria-label="Interactive three-dimensional amethyst crystal experience" />;
}

const chapters=[
  { id:'awakening', title:'A world beyond reflection', eyebrow:'01 — THE AWAKENING', copy:'In the stillness between stars, something remembers how to shine.' },
  { id:'living', title:'Light, held in stone', eyebrow:'02 — THE LIVING GEM', copy:'Every surface keeps a different sky. Every facet, another way through.' },
  { id:'fracture', title:'The edge of elsewhere', eyebrow:'03 — FRACTURE OF DIMENSIONS', copy:'The crystal opens. Its silence has an impossible depth.' },
  { id:'threshold', title:'Step through the surface', eyebrow:'04 — THE IMPOSSIBLE ZOOM', copy:'Past the last reflection, a whole universe waits.' },
  { id:'world', title:'A universe in miniature', eyebrow:'05 — THE HIDDEN WORLD', copy:'Islands drift above ancient waters. Violet towers catch a cyan dawn.' },
  { id:'core', title:'Where every orbit begins', eyebrow:'06 — THE COSMIC CORE', copy:'All paths lead back to a single, luminous heart.' },
  { id:'return', title:'Every dimension begins within', eyebrow:'07 — THE RETURN', copy:'Worlds fold into light. The crystal remembers its shape.' },
];
function App(){
  const [progress,setProgress]=useState(0); const [loaded,setLoaded]=useState(false); const [active,setActive]=useState(0);
  useEffect(()=>{const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)setActive(Number(e.target.dataset.index));}),{threshold:.42});document.querySelectorAll('.chapter').forEach(el=>obs.observe(el));return()=>obs.disconnect();},[]);
  return <>
    <div className="loading" data-ready={loaded}><div className="loading-gem">◇</div><span>ENTERING THE CRYSTAL DIMENSION</span><i><b style={{transform:`scaleX(${progress||.08})`}} /></i></div>
    <CrystalScene onProgress={p=>setProgress(p)} onReady={()=>setLoaded(true)} />
    <header className="topbar"><a className="wordmark" href="#top"><span className="mark">✧</span> THE CRYSTAL DIMENSION</a><div className="top-right"><span className="live-dot"/> A SCROLL-BOUND JOURNEY <span className="scroll-hint">SCROLL TO EXPLORE <b>↓</b></span></div></header>
    <div className="progress-rail"><span style={{transform:`scaleY(${progress})`}}/></div>
    <main className="story" id="top">
      <section className="chapter hero" data-index="0"><div className="hero-copy"><p className="kicker"><span/> A WORLD BEYOND REFLECTION</p><h1>THE CRYSTAL<br/><em>DIMENSION</em></h1><p className="hero-sub">There is a universe on the other side of the light.</p></div><div className="hero-foot"><span>AN INTERACTIVE EXPERIENCE</span><span>01 <i/> 07</span></div></section>
      {chapters.slice(1).map((c,i)=><section className={`chapter chapter-${i+1}`} data-index={i+1} key={c.id}><div className="chapter-copy"><p className="kicker"><span/>{c.eyebrow}</p><h2>{c.title}</h2><p>{c.copy}</p>{i===2&&<div className="coordinates">OPTICAL DEPTH <b>∞</b><br/>REFRACTION INDEX <b>1.72</b><br/>ORIGIN <b>UNKNOWN</b></div>}</div></section>)}
      <footer className="chapter finale" data-index="6"><div className="final-copy"><span className="final-spark">✧</span><p className="kicker">THE JOURNEY CONTINUES WITHIN</p><h2>EVERY DIMENSION<br/>BEGINS <em>WITHIN.</em></h2><a href="#top" className="replay">RETURN TO THE BEGINNING <span>↑</span></a></div><div className="hero-foot"><span>THE CRYSTAL DIMENSION</span><span>∞</span></div></footer>
    </main>
    <div className="chapter-marker"><span>0{active+1}</span><i/><span>07</span></div>
    <div className="sound-note"><span className="sound-bars"><i/><i/><i/></span> SOUND DESIGN <span className="muted">— COMING SOON</span></div>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
