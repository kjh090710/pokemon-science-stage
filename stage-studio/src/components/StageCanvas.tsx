import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {CSSProperties} from 'react';
import {mediaUrl} from '../lib/model';
import type {MediaUrls, Scene} from '../lib/model';
import './StageCanvas.css';

export interface StageCanvasProps {
  scene:Scene;
  mediaUrls:MediaUrls;
  aspectRatio:'16:9'|'4:3';
  revision?:number;
  startAt?:number;
}

interface Visual {key:string;source:string;fit:Scene['fit'];position:Scene['position'];blackout:boolean}
const backgroundStyle = (visual:Visual):CSSProperties => ({
  backgroundImage:!visual.blackout && visual.source ? `url(${JSON.stringify(visual.source)})` : 'none',
  backgroundSize:visual.fit,
  backgroundPosition:`${visual.position} center`,
});

export function StageCanvas({scene,mediaUrls,aspectRatio,revision=0,startAt}:StageCanvasProps) {
  const source = mediaUrl(scene.background,mediaUrls);
  const visual = useMemo<Visual>(()=>({key:JSON.stringify([source,scene.fit,scene.position,scene.blackout]),source,fit:scene.fit,position:scene.position,blackout:scene.blackout}),[source,scene.fit,scene.position,scene.blackout]);
  const [layers,setLayers] = useState<{current:Visual;previous:Visual|null;visible:boolean}>({current:visual,previous:null,visible:true});
  const currentRef = useRef(visual);
  const [duration,setDuration] = useState(0);
  const frameRefs = useRef<(HTMLDivElement|null)[]>([]);
  const frameUrls = (scene.effect?.frames ?? []).slice(0,2).map(frame=>mediaUrl(frame,mediaUrls));
  const frameKey = frameUrls.join('|');
  const gateDuration = Math.max(100,scene.effect?.durationMs ?? 4000);

  useLayoutEffect(()=>{
    if (visual.key === currentRef.current.key) {
      setLayers(state=>state.previous?{current:visual,previous:null,visible:true}:state);
      return;
    }
    const previous = currentRef.current;
    currentRef.current = visual;
    const milliseconds = scene.transition.kind === 'fade' ? Math.max(0,Math.min(60000,scene.transition.durationMs)) : 0;
    setDuration(milliseconds);
    if (!milliseconds) {setLayers({current:visual,previous:null,visible:true});return;}
    setLayers({current:visual,previous,visible:false});
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(()=>setLayers(state=>({...state,visible:true})));});
    const timeout = window.setTimeout(()=>setLayers(state=>state.current.key===visual.key?{...state,previous:null,visible:true}:state),milliseconds+80);
    return ()=>{cancelAnimationFrame(firstFrame);cancelAnimationFrame(secondFrame);clearTimeout(timeout);};
  },[visual,scene.transition.kind,scene.transition.durationMs]);

  useLayoutEffect(()=>{
    let frame = 0;
    const smooth = (value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
    const paint = (progress:number)=>{
      if(frameRefs.current[0])frameRefs.current[0].style.opacity=String(smooth(progress/.58));
      if(frameRefs.current[1])frameRefs.current[1].style.opacity=String(smooth((progress-.36)/.64));
    };
    paint(0);
    if (scene.blackout || scene.effect?.type !== 'gate' || startAt === undefined) return;
    const tick = ()=>{
      const progress=Math.max(0,Math.min(1,(Date.now()-startAt)/gateDuration));
      paint(progress);
      if(progress<1)frame=requestAnimationFrame(tick);
    };
    tick();
    return ()=>cancelAnimationFrame(frame);
  },[scene.id,scene.blackout,scene.effect?.type,gateDuration,revision,startAt,frameKey]);

  return <div className="stg-canvas" style={{aspectRatio:aspectRatio.replace(':',' / ')}} aria-label={scene.blackout?'암전 화면':scene.title}>
    {layers.previous && <div className="stg-layer stg-layer-previous" style={backgroundStyle(layers.previous)} aria-hidden="true"/>}
    <div className="stg-layer stg-layer-current" style={{...backgroundStyle(layers.current),opacity:layers.visible?1:0,transitionDuration:`${duration}ms`}} aria-hidden="true"/>
    {!scene.blackout && scene.effect?.type==='gate' && <div className="stg-gate" aria-hidden="true">
      {frameUrls.map((url,index)=><div key={`${index}:${url}`} ref={element=>{frameRefs.current[index]=element;}} className="stg-gate-frame" style={{backgroundImage:url?`url(${JSON.stringify(url)})`:'none',backgroundSize:scene.fit,backgroundPosition:`${scene.position} center`}}/>)}
    </div>}
  </div>;
}
