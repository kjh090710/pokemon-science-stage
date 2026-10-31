import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, Maximize, Monitor, Pause, Play, Square, Volume2} from 'lucide-react';
import {AudioEngine} from '../lib/audio-engine';
import {createStageChannel, isStageMessage} from '../lib/channel';
import type {StageCommand, StageMessage, StageState} from '../lib/channel';
import type {ControllerProps, Scene} from '../lib/model';
import {mediaUrl} from '../lib/model';
import {StageCanvas} from './StageCanvas';
import './Controller.css';

interface LiveState {index:number;revision:number;emergency:boolean;startAt?:number;gatePending?:boolean}
interface LiveSettings {masterVolume:number;fadeOutMs:number;volumes:Record<string,number>;collapsed:boolean}
const storageKey=(id:string)=>`stagecue-live:${id}`;
const bound=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function initialSettings({show}:ControllerProps):LiveSettings {
  const result:LiveSettings={masterVolume:show.document.settings.masterVolume,fadeOutMs:show.document.settings.fadeOutMs,volumes:Object.fromEntries(show.document.tracks.map(track=>[track.id,track.volume])),collapsed:false};
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey(show.id))||'null');
    if(!saved || typeof saved!=='object')return result;
    if(typeof saved.masterVolume==='number' && Number.isFinite(saved.masterVolume))result.masterVolume=bound(saved.masterVolume,0,1);
    if(typeof saved.fadeOutMs==='number' && Number.isFinite(saved.fadeOutMs))result.fadeOutMs=bound(saved.fadeOutMs,500,8000);
    if(typeof saved.collapsed==='boolean')result.collapsed=saved.collapsed;
    for(const id of Object.keys(result.volumes)){const value=saved.volumes?.[id];if(typeof value==='number' && Number.isFinite(value))result.volumes[id]=bound(value,0,1);}
  }catch{/* 저장 공간을 사용할 수 없어도 공연은 계속할 수 있습니다. */}
  return result;
}

export function Controller({show,mediaUrls,onBack}:ControllerProps) {
  const [session]=useState(()=>crypto.randomUUID());
  const [live,setLive]=useState<LiveState>({index:0,revision:0,emergency:false});
  const liveRef=useRef(live);
  const [settings,setSettings]=useState(()=>initialSettings({show,mediaUrls,onBack}));
  const [audioStatus,setAudioStatus]=useState('음향 준비를 누르면 공연을 시작할 수 있습니다.');
  const [connection,setConnection]=useState(false);
  const [windowError,setWindowError]=useState('');
  const [fullPreview,setFullPreview]=useState(false);
  const engineRef=useRef<AudioEngine|null>(null);
  const channelRef=useRef<BroadcastChannel|null>(null);
  const cueToken=useRef(0);
  const lastHello=useRef(0);
  const hasStarted=useRef(false);
  const documentRef=useRef(show.document);
  const mediaRef=useRef(mediaUrls);
  const settingsRef=useRef(settings);
  const previewRef=useRef<HTMLDivElement|null>(null);
  const commandsRef=useRef<(command:StageCommand)=>void>(()=>{});
  documentRef.current=show.document;mediaRef.current=mediaUrls;settingsRef.current=settings;
  const scenes=show.document.scenes;
  const current=scenes[live.index] ?? scenes[0];
  const upcoming=scenes[live.index+1];
  const mediaPending=useMemo(()=>[
    ...show.document.tracks.map(track=>track.source),
    ...show.document.scenes.flatMap(scene=>[...(scene.background?[scene.background]:[]),...(scene.effect?.frames??[])]),
  ].some(ref=>ref.type==='storage' && !mediaUrls[ref.path]),[show.document,mediaUrls]);
  const mediaPendingRef=useRef(mediaPending);mediaPendingRef.current=mediaPending;
  const imagePromises=useRef(new Map<string,Promise<void>>());
  const prepareImage=useCallback((url:string):Promise<void>=>{
    if(!url)return Promise.reject(new Error('문 이미지를 찾을 수 없습니다.'));
    const old=imagePromises.current.get(url);if(old)return old;
    const image=new Image();
    const promise=new Promise<void>((resolve,reject)=>{
      image.onload=()=>resolve();image.onerror=()=>reject(new Error('문 이미지를 불러오지 못했습니다.'));
      image.src=url;
    });
    imagePromises.current.set(url,promise);
    promise.catch(()=>{if(imagePromises.current.get(url)===promise)imagePromises.current.delete(url);});
    return promise;
  },[]);

  const publish=useCallback((next:LiveState=liveRef.current)=>{
    const state:StageState={showId:show.id,title:show.title,document:documentRef.current,mediaUrls:mediaRef.current,...next};
    channelRef.current?.postMessage({type:'state',session,state} satisfies StageMessage);
  },[session,show.id,show.title]);

  const updateLive=useCallback((next:LiveState)=>{liveRef.current=next;setLive(next);publish(next);},[publish]);

  useEffect(()=>{
    const engine=new AudioEngine(documentRef.current.tracks,mediaRef.current,documentRef.current.settings,setAudioStatus);
    engine.setMasterVolume(settingsRef.current.masterVolume);engine.setFadeOut(settingsRef.current.fadeOutMs);
    for(const [id,value]of Object.entries(settingsRef.current.volumes))engine.setTrackVolume(id,value);
    engineRef.current=engine;
    return ()=>{++cueToken.current;engineRef.current=null;engine.dispose();};
  },[show.id]);

  useEffect(()=>{engineRef.current?.configure(show.document.tracks,mediaUrls);publish();},[show.document,mediaUrls,publish]);
  useEffect(()=>{
    for(const scene of show.document.scenes){
      for(const ref of [...(scene.background?[scene.background]:[]),...(scene.effect?.frames??[])]){
        const url=mediaUrl(ref,mediaUrls);if(url)void prepareImage(url).catch(()=>{});
      }
    }
  },[show.document,mediaUrls,prepareImage]);
  useEffect(()=>{
    const engine=engineRef.current;
    engine?.setMasterVolume(settings.masterVolume);engine?.setFadeOut(settings.fadeOutMs);
    for(const [id,value]of Object.entries(settings.volumes))engine?.setTrackVolume(id,value);
    try{localStorage.setItem(storageKey(show.id),JSON.stringify(settings));}catch{/* 일부 브라우저의 비공개 모드에서는 저장이 제한됩니다. */}
  },[settings,show.id]);

  useEffect(()=>{
    const channel=createStageChannel(show.id,session);channelRef.current=channel;
    if(!channel){setWindowError('이 브라우저는 공연 화면 연결을 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용해 주세요.');return;}
    channel.onmessage=event=>{
      const message:unknown=event.data;
      if(!isStageMessage(message) || message.session!==session || !('showId'in message) || message.showId!==show.id)return;
      if(message.type==='hello'){lastHello.current=Date.now();setConnection(true);publish();}
      else if(message.type==='closed'){lastHello.current=0;setConnection(false);}
      else if(message.type==='command')commandsRef.current(message.action);
    };
    const timer=window.setInterval(()=>{if(lastHello.current && Date.now()-lastHello.current>7000)setConnection(false);},2000);
    const focus=()=>publish();window.addEventListener('focus',focus);
    return ()=>{clearInterval(timer);window.removeEventListener('focus',focus);channel.close();channelRef.current=null;};
  },[session,show.id,publish]);

  const followScene=useCallback(async(scene:Scene,revision:number)=>{
    const token=++cueToken.current,engine=engineRef.current;
    if(!engine)return;
    engine.stopEffect();
    if(scene.effect?.type==='gate'){
      const duration=bound(scene.effect.durationMs,100,60000);
      if(scene.audio.action==='play')void engine.stopMusic(100);
      else if(scene.audio.action==='stop')void engine.stop();
      let timeout=0;
      try{
        await Promise.race([
          (async()=>{
            await Promise.all(scene.effect!.frames.slice(0,2).map(ref=>prepareImage(mediaUrl(ref,mediaRef.current))));
            if(token!==cueToken.current || liveRef.current.revision!==revision)return;
            if(scene.audio.action==='play' && scene.audio.trackId){
              await engine.scheduleEffect(scene.audio.trackId,duration,startAt=>{
                if(token===cueToken.current && liveRef.current.revision===revision)updateLive({...liveRef.current,startAt,gatePending:false});
              });
            }else updateLive({...liveRef.current,startAt:Date.now()+180,gatePending:false});
          })(),
          new Promise<never>((_,reject)=>{timeout=window.setTimeout(()=>reject(new Error('문 효과 준비 시간 초과')),8000);}),
        ]);
      }catch{
        if(token===cueToken.current && liveRef.current.revision===revision){
          ++cueToken.current;
          engine.stopEffect();setAudioStatus('문 이미지 또는 효과음을 불러오지 못해 화면만 진행합니다. 파일 연결을 확인해 주세요.');
          updateLive({...liveRef.current,startAt:Date.now()+180,gatePending:false});
        }
      }finally{clearTimeout(timeout);}
      return;
    }
    if(scene.audio.action==='play' && scene.audio.trackId)void engine.play(scene.audio.trackId);
    else if(scene.audio.action==='stop')void engine.stop();
    // keep은 정지·일시정지를 포함해 현재 음향 상태를 그대로 둡니다.
  },[updateLive,prepareImage]);

  const go=useCallback((delta:number)=>{
    if(mediaPendingRef.current){setAudioStatus('미디어 파일을 준비하고 있습니다. 잠시 후 진행해 주세요.');return;}
    const previous=liveRef.current,target=bound(previous.index+delta,0,documentRef.current.scenes.length-1);
    if(target===previous.index || target<0)return;
    hasStarted.current=true;
    const scene=documentRef.current.scenes[target];
    const next:LiveState={index:target,revision:previous.revision+1,emergency:false,gatePending:scene.effect?.type==='gate'};
    updateLive(next);void engineRef.current?.unlock().catch(()=>{});void followScene(scene,next.revision);
  },[followScene,updateLive]);

  const blackout=useCallback(()=>{
    const previous=liveRef.current,emergency=!previous.emergency;
    ++cueToken.current;
    if(emergency)void engineRef.current?.stop();
    const scene=documentRef.current.scenes[previous.index];
    updateLive({...previous,emergency,revision:previous.revision+1,gatePending:false,startAt:scene?.effect?Date.now()-scene.effect.durationMs:undefined});
  },[updateLive]);

  commandsRef.current=command=>{if(command==='next')go(1);else if(command==='prev')go(-1);else blackout();};

  const restartCurrent=useCallback(()=>{
    if(mediaPendingRef.current){setAudioStatus('미디어 파일을 준비하고 있습니다. 잠시 후 진행해 주세요.');return;}
    const previous=liveRef.current,scene=documentRef.current.scenes[previous.index];
    if(!scene)return;
    hasStarted.current=true;
    const next:LiveState={index:previous.index,revision:previous.revision+1,emergency:false,gatePending:scene.effect?.type==='gate'};
    updateLive(next);void followScene(scene,next.revision);
  },[followScene,updateLive]);

  const openScreen=()=>{
    if(mediaPendingRef.current)return;
    void engineRef.current?.unlock().catch(()=>{});
    const url=new URL(`${import.meta.env.BASE_URL}screen/${encodeURIComponent(show.id)}`,location.origin);url.searchParams.set('session',session);
    const screen=window.open(url.href,`stagecue-screen-${session}`,'popup=yes,width=1280,height=800');
    if(!screen)setWindowError('팝업이 차단되었습니다. 브라우저에서 이 사이트의 팝업을 허용한 뒤 다시 열어 주세요.');
    else{setWindowError('');if(!hasStarted.current)restartCurrent();}
  };

  const manualPlay=(id:string)=>{
    if(mediaPendingRef.current){setAudioStatus('미디어 파일을 준비하고 있습니다. 잠시 후 재생해 주세요.');return;}
    const engine=engineRef.current;if(!engine)return;
    ++cueToken.current;
    const effectScene=documentRef.current.scenes.find(scene=>scene.effect?.type==='gate' && scene.audio.trackId===id);
    if(effectScene?.effect){
      const scene=documentRef.current.scenes[liveRef.current.index];
      if(scene.effect?.type==='gate' && scene.audio.trackId===id && !liveRef.current.emergency)restartCurrent();
      else{releaseGate();void engine.stopMusic(100);void engine.scheduleEffect(id,effectScene.effect.durationMs,()=>{}).catch(()=>setAudioStatus('효과음 파일을 확인해 주세요.'));}
    }else {releaseGate();void engine.play(id);}
  };

  const stopSound=()=>{++cueToken.current;void engineRef.current?.stop();releaseGate();};
  const pauseSound=()=>{++cueToken.current;void engineRef.current?.pause();releaseGate();};
  function releaseGate(){
    const state=liveRef.current;
    if(state.gatePending && !state.emergency)updateLive({...state,gatePending:false,startAt:Date.now()+180});
  }

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement;
      if(target.closest('input,textarea,select,button,[contenteditable="true"]') || event.repeat)return;
      if(event.key==='ArrowRight'||event.key===' '){event.preventDefault();commandsRef.current('next');}
      else if(event.key==='ArrowLeft'){event.preventDefault();commandsRef.current('prev');}
      else if(event.key.toLowerCase()==='b'){event.preventDefault();commandsRef.current('blackout');}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);

  const actionLabel=(scene:Scene)=>{
    if(scene.effect?.type==='gate')return '문 열기 · 효과음 재생';
    const track=show.document.tracks.find(track=>track.id===scene.audio.trackId);
    if(scene.audio.action==='play' && track)return `${scene.blackout?'암전 · ':''}${track.label} 재생`;
    return scene.title;
  };

  if(!current)return <main className="ctl-controller ctl-empty"><button onClick={onBack}><ArrowLeft size={18} aria-hidden="true"/> 편집기로 돌아가기</button><h1>아직 공연할 장면이 없습니다.</h1><p>편집기에서 장면을 추가한 뒤 공연을 시작해 주세요.</p></main>;
  return <main className={`ctl-controller ${settings.collapsed?'ctl-audio-collapsed':''}`} aria-busy={mediaPending}>
    <header className="ctl-header">
      <div className="ctl-heading"><button className="ctl-icon-button" onClick={onBack} aria-label="편집기로 돌아가기"><ArrowLeft size={20} aria-hidden="true"/></button><div><span className="ctl-eyebrow">STAGECUE STUDIO <span aria-hidden="true">/</span> 공연 진행</span><h1>{show.title}</h1></div></div>
      <div className="ctl-header-actions"><span className={`ctl-connection ${connection?'ctl-connected':''}`} role="status"><i aria-hidden="true"/>{connection?'공연 화면 연결됨':'공연 화면 연결 대기'}</span><button className="ctl-open-screen" onClick={openScreen} disabled={mediaPending}><Monitor size={18} aria-hidden="true"/> 공연 화면 열기 <ArrowUpRight size={16} aria-hidden="true"/></button></div>
    </header>
    {windowError && <div className="ctl-alert" role="alert">{windowError}</div>}
    {mediaPending && <div className="ctl-alert" role="status">공연에 사용할 이미지와 음원을 준비하고 있습니다. 파일을 모두 불러오면 진행 버튼이 활성화됩니다.</div>}
    <section className="ctl-workspace">
      <div className="ctl-run">
        <div className="ctl-section-heading"><div><span className="ctl-eyebrow">STAGE MONITOR</span><h2>공연 화면 미리보기</h2></div><button className="ctl-text-button" onClick={()=>{if(previewRef.current?.requestFullscreen){void previewRef.current.requestFullscreen().catch(()=>setFullPreview(!fullPreview));}else setFullPreview(!fullPreview);}}><Maximize size={17} aria-hidden="true"/> 크게 보기</button></div>
        <div className={`ctl-preview ${fullPreview?'ctl-preview-expanded':''}`} data-aspect={show.document.settings.aspectRatio} ref={previewRef} onClick={fullPreview?()=>setFullPreview(false):undefined}>
          <StageCanvas scene={{...current,blackout:current.blackout||live.emergency,transition:live.emergency?{kind:'cut',durationMs:0}:current.transition}} mediaUrls={mediaUrls} aspectRatio={show.document.settings.aspectRatio} revision={live.revision} startAt={live.startAt}/>
          {live.gatePending && <span className="ctl-preview-status">효과음 준비 중…</span>}
          {fullPreview && <button className="ctl-preview-close" onClick={()=>setFullPreview(false)}>미리보기 닫기</button>}
        </div>
        <div className="ctl-cue-information"><div className="ctl-cue-number" aria-label={`${live.index+1}번째 장면, 전체 ${scenes.length}개`}><span>{String(live.index+1).padStart(2,'0')}</span><small>/ {String(scenes.length).padStart(2,'0')}</small></div><div className="ctl-note"><div className="ctl-current-line"><div><span className="ctl-current-label">현재 장면</span><h2>{current.title}</h2></div><button className="ctl-text-button" onClick={restartCurrent} disabled={mediaPending}><Play size={16} aria-hidden="true"/> 현재 장면 다시 시작</button></div><p>{current.note || '이 장면에는 운영 메모가 없습니다.'}</p></div></div>
        <div className="ctl-transport"><button className="ctl-previous" onClick={()=>go(-1)} disabled={live.index===0||mediaPending}><ArrowLeft size={19} aria-hidden="true"/> 이전</button><button className="ctl-next" onClick={()=>go(1)} disabled={!upcoming||mediaPending}><span><small>{upcoming?'다음 동작':'마지막 장면'}</small><strong>{upcoming?actionLabel(upcoming):'공연 마지막 장면입니다'}</strong></span><ArrowRight size={24} aria-hidden="true"/></button></div>
        <div className="ctl-safety-row"><div><span className="ctl-current-label">긴급 제어</span><p>현재 장면을 유지한 채 화면을 암전합니다.</p></div><button className={`ctl-blackout ${live.emergency?'ctl-emergency-on':''}`} onClick={blackout} aria-pressed={live.emergency}><span aria-hidden="true"/> {live.emergency?'암전 해제':'긴급 암전'} <kbd>B</kbd></button></div>
        <div className="ctl-stage-help"><span><kbd>←</kbd> 이전 <kbd>→</kbd> <kbd>Space</kbd> 다음</span><span>공연 화면에서 <kbd>F</kbd> 전체 화면</span></div>
      </div>
      <aside className="ctl-audio">
        <div className="ctl-section-heading"><div><span className="ctl-eyebrow">SOUND DESK</span><h2><Volume2 size={18} aria-hidden="true"/> 음향 재생</h2></div><button className="ctl-text-button" aria-expanded={!settings.collapsed} aria-controls="ctl-sound-controls" onClick={()=>setSettings(state=>({...state,collapsed:!state.collapsed}))}>{settings.collapsed?<ChevronDown size={17} aria-hidden="true"/>:<ChevronUp size={17} aria-hidden="true"/>} {settings.collapsed?'펼치기':'접기'}</button></div>
        <div id="ctl-sound-controls" hidden={settings.collapsed}>
          <p className="ctl-audio-intro">장면을 넘기면 설정한 음악이 함께 재생됩니다. 필요할 때 아래에서 직접 조작하세요.</p>
          <button className="ctl-prepare" onClick={()=>void engineRef.current?.unlock().then(()=>setAudioStatus('음향 준비 완료')).catch(()=>setAudioStatus('이 브라우저의 소리 재생 권한을 확인해 주세요.'))}><Volume2 size={17} aria-hidden="true"/> 음향 준비</button>
          <div className="ctl-tracks" role="list" aria-label="공연 음원">{show.document.tracks.map((track,index)=><div className="ctl-track" key={track.id} role="listitem"><div className="ctl-track-top"><span className="ctl-track-index">{String(index+1).padStart(2,'0')}</span><div><h3>{track.label}</h3><small>{track.loop?'반복 재생':'한 번 재생'}</small></div><button className="ctl-track-play" onClick={()=>manualPlay(track.id)} aria-label={`${track.label} 재생`} disabled={mediaPending}><Play size={16} aria-hidden="true"/> 재생</button></div><div className="ctl-track-level"><label htmlFor={`ctl-volume-${track.id}`}>개별 음량</label><output htmlFor={`ctl-volume-${track.id}`}>{Math.round((settings.volumes[track.id]??track.volume)*100)}%</output></div><div className="ctl-volume-row"><input id={`ctl-volume-${track.id}`} aria-label={`${track.label} 개별 음량`} aria-valuetext={`${Math.round((settings.volumes[track.id]??track.volume)*100)}%`} type="range" min="0" max="100" value={Math.round((settings.volumes[track.id]??track.volume)*100)} onChange={event=>setSettings(state=>({...state,volumes:{...state.volumes,[track.id]:Number(event.target.value)/100}}))}/></div></div>)}</div>
          <div className="ctl-audio-transport"><button onClick={pauseSound}><Pause size={16} aria-hidden="true"/> 일시정지 / 계속</button><button onClick={stopSound}><Square size={15} aria-hidden="true"/> 서서히 정지</button></div>
          <div className="ctl-mixer"><h3>마스터 설정</h3><label htmlFor="ctl-master">전체 음량 <output htmlFor="ctl-master">{Math.round(settings.masterVolume*100)}%</output></label><input id="ctl-master" aria-valuetext={`${Math.round(settings.masterVolume*100)}%`} type="range" min="0" max="100" value={Math.round(settings.masterVolume*100)} onChange={event=>setSettings(state=>({...state,masterVolume:Number(event.target.value)/100}))}/><label htmlFor="ctl-fade">페이드아웃 시간 <output htmlFor="ctl-fade">{(settings.fadeOutMs/1000).toFixed(1)}초</output></label><input id="ctl-fade" aria-valuetext={`${(settings.fadeOutMs/1000).toFixed(1)}초`} type="range" min="0.5" max="8" step="0.5" value={settings.fadeOutMs/1000} onChange={event=>setSettings(state=>({...state,fadeOutMs:Number(event.target.value)*1000}))}/><p>현재 음량에서 0까지 부드럽게 줄어듭니다.</p></div>
        </div>
        <div className="ctl-audio-status" role="status"><Volume2 size={16} aria-hidden="true"/><span>{audioStatus}</span></div>
      </aside>
    </section>
    <footer className="ctl-footer"><span>STAGECUE STUDIO</span><p>공연 화면을 빔으로 옮긴 뒤 F 키를 눌러 주세요. 이 제어창은 노트북에 두고 진행하세요.</p></footer>
  </main>;
}
