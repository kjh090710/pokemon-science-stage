import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Copy, FileText, GripVertical, Image as ImageIcon, Loader2, Music2, Pause, Play, Plus, Save, Theater, Trash2, Upload, Volume2, X } from 'lucide-react';
import type { EditorProps, MediaRef, Scene, ShowDocument, Track } from '../lib/model';
import { createScene, mediaKey, mediaUrl, newId } from '../lib/model';
import { StageCanvas } from './StageCanvas';
import './Editor.css';

type DeleteTarget = { kind:'scene'|'track'; id:string; title:string };
const percent = (value:number) => Math.round(value * 100);
const fileLabel = (ref:MediaRef) => {
  const value = ref.type === 'storage' ? ref.path : ref.url;
  try { return decodeURIComponent(value.split('/').pop()?.split('?')[0] || '연결된 파일'); }
  catch { return '연결된 파일'; }
};

export function Editor({ show, mediaUrls, onChange, onTitleChange, onSave, saving, dirty, error, onUpload, onBack, onStart }:EditorProps) {
  const document = show.document;
  const latest = useRef(document);
  latest.current = document;
  const [selectedId, setSelectedId] = useState(document.scenes[0]?.id || '');
  const [tab, setTab] = useState<'scene'|'audio'>('scene');
  const [uploading, setUploading] = useState<'image'|'audio'|null>(null);
  const [uploadError, setUploadError] = useState<string|null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget|null>(null);
  const [draggedId, setDraggedId] = useState<string|null>(null);
  const [dropId, setDropId] = useState<string|null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string|null>(null);
  const [previewStartAt, setPreviewStartAt] = useState<number|undefined>();
  const [previewRevision, setPreviewRevision] = useState(0);
  const imageInput = useRef<HTMLInputElement>(null);
  const trackInput = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewOperation = useRef(0);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLElement>(null);
  const scene = document.scenes.find(item => item.id === selectedId) || document.scenes[0];
  const sceneIndex = scene ? document.scenes.findIndex(item => item.id === scene.id) : -1;
  const backgrounds = useMemo(() => {
    const items = new Map<string,{ref:MediaRef;title:string}>();
    for (const item of document.scenes) if (item.background && !items.has(mediaKey(item.background))) items.set(mediaKey(item.background), {ref:item.background,title:item.title});
    return [...items.values()];
  }, [document.scenes]);

  useEffect(() => {
    if (!deleteTarget) return;
    const previousFocus = window.document.activeElement as HTMLElement|null;
    cancelDeleteRef.current?.focus();
    const escape = (event:KeyboardEvent) => {
      if (event.key === 'Escape') setDeleteTarget(null);
      if (event.key !== 'Tab') return;
      const buttons = deleteDialogRef.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length-1];
      if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [deleteTarget]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio?.pause(); };
  }, []);

  useEffect(() => {
    const track = document.tracks.find(item => item.id === previewTrackId);
    if (!track) {
      if (previewTrackId) { audioRef.current?.pause(); setPreviewTrackId(null); }
      return;
    }
    if (!audioRef.current) return;
    audioRef.current.volume = Math.max(0, Math.min(1, track.volume * document.settings.masterVolume));
    audioRef.current.loop = track.loop;
  }, [document.tracks, document.settings.masterVolume, previewTrackId]);

  function update(change:(current:ShowDocument)=>ShowDocument) {
    const next = change(latest.current);
    if (next === latest.current) return;
    latest.current = next;
    onChange(next);
  }
  function patchScene(id:string, patch:Partial<Scene>) {
    update(current => ({...current, scenes:current.scenes.map(item => item.id === id ? {...item,...patch} : item)}));
  }
  function patchTrack(id:string, patch:Partial<Track>) {
    update(current => ({...current, tracks:current.tracks.map(item => item.id === id ? {...item,...patch} : item)}));
  }
  function selectScene(id:string) { setSelectedId(id); setLibraryOpen(false); setPreviewStartAt(undefined); }
  function addScene() {
    const next = createScene();
    update(current => {
      const index = current.scenes.findIndex(item => item.id === scene?.id);
      const scenes = [...current.scenes];
      scenes.splice(index < 0 ? scenes.length : index + 1, 0, next);
      return {...current,scenes};
    });
    selectScene(next.id);
    setTab('scene');
  }
  function duplicateScene() {
    if (!scene) return;
    const copy:Scene = {...structuredClone(scene),id:newId(),title:`${scene.title} 복사`};
    update(current => {
      const scenes = [...current.scenes];
      scenes.splice(current.scenes.findIndex(item => item.id === scene.id) + 1, 0, copy);
      return {...current,scenes};
    });
    selectScene(copy.id);
  }
  function moveScene(id:string, direction:-1|1) {
    update(current => {
      const index = current.scenes.findIndex(item => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.scenes.length) return current;
      const scenes = [...current.scenes];
      [scenes[index],scenes[target]] = [scenes[target],scenes[index]];
      return {...current,scenes};
    });
  }
  function dropScene(targetId:string) {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDropId(null); return; }
    update(current => {
      const moved = current.scenes.find(item => item.id === draggedId);
      if (!moved) return current;
      const scenes = current.scenes.filter(item => item.id !== draggedId);
      const index = scenes.findIndex(item => item.id === targetId);
      if (index < 0) return current;
      scenes.splice(index, 0, moved);
      return {...current,scenes};
    });
    setDraggedId(null);
    setDropId(null);
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'scene') {
      const current = latest.current;
      if (current.scenes.length < 2) { setDeleteTarget(null); return; }
      const index = current.scenes.findIndex(item => item.id === deleteTarget.id);
      const scenes = current.scenes.filter(item => item.id !== deleteTarget.id);
      update(value => ({...value,scenes}));
      if (scene?.id === deleteTarget.id) selectScene(scenes[Math.min(index, scenes.length - 1)].id);
    } else {
      if (previewTrackId === deleteTarget.id) { audioRef.current?.pause(); setPreviewTrackId(null); }
      update(current => ({...current,tracks:current.tracks.filter(item => item.id !== deleteTarget.id),scenes:current.scenes.map(item => item.audio.trackId === deleteTarget.id ? {...item,audio:{action:'stop'}} : item)}));
    }
    setDeleteTarget(null);
  }
  async function uploadImage(file:File) {
    if (!scene) return;
    const targetId = scene.id;
    setUploading('image'); setUploadError(null);
    try { const background = await onUpload(file); patchScene(targetId,{background,blackout:false,effect:undefined}); }
    catch (cause) { setUploadError(cause instanceof Error ? cause.message : '이미지를 업로드하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setUploading(null); }
  }
  async function uploadTrack(file:File) {
    setUploading('audio'); setUploadError(null);
    try {
      const source = await onUpload(file);
      const track:Track = {id:newId(),label:file.name.replace(/\.[^.]+$/,''),source,volume:.8,loop:false,fadeInMs:900};
      update(current => ({...current,tracks:[...current.tracks,track]}));
    } catch (cause) { setUploadError(cause instanceof Error ? cause.message : '음원을 업로드하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setUploading(null); }
  }
  async function previewTrack(track:Track) {
    const audio = audioRef.current;
    if (!audio) return;
    const operation = ++previewOperation.current;
    if (previewTrackId === track.id && !audio.paused) { audio.pause(); setPreviewTrackId(null); return; }
    const url = mediaUrl(track.source,mediaUrls);
    if (!url) { setUploadError('음원을 불러오는 중입니다. 잠시 후 다시 재생해 주세요.'); return; }
    audio.pause(); audio.src = url; audio.loop = track.loop;
    audio.volume = Math.max(0,Math.min(1,track.volume * document.settings.masterVolume));
    try { await audio.play(); if (operation === previewOperation.current) setPreviewTrackId(track.id); }
    catch { if (operation === previewOperation.current) setUploadError('이 음원을 재생하지 못했습니다. 파일을 확인해 주세요.'); }
  }
  const selectedTrack = document.tracks.find(track => track.id === scene?.audio.trackId);
  const audioDescription = !scene || scene.audio.action === 'stop' ? '음악 서서히 종료' : scene.audio.action === 'keep' ? '현재 음악 유지' : selectedTrack?.label || '재생할 음원을 선택하세요';

  return <div className="studio-editor">
    <header className="studio-header">
      <button className="studio-brand" onClick={onBack} aria-label="큐 스튜디오 내 작품으로"><Theater size={29} strokeWidth={1.8}/><span>큐 스튜디오</span></button>
      <div className="studio-breadcrumb"><button onClick={onBack}>내 작품</button><ChevronRight size={17}/></div>
      <input className="studio-show-title" aria-label="작품 제목" value={show.title} onChange={event=>onTitleChange(event.target.value)} placeholder="작품 제목"/>
      <div className="studio-header-actions">
        <span className={`studio-save-state ${dirty?'is-dirty':''}`} aria-live="polite">{saving?'저장 중':dirty?'변경사항 있음':'모든 변경사항 저장됨'}</span>
        <button className="studio-button studio-save" disabled={saving || !dirty} onClick={()=>{setUploadError(null);void onSave().catch(cause=>setUploadError(cause instanceof Error?cause.message:'저장하지 못했습니다.'));}}>{saving?<Loader2 className="studio-spin" size={17}/>:dirty?<Save size={17}/>:<Check size={17}/>}<span>{saving?'저장 중':'저장'}</span></button>
        <button className="studio-button studio-primary" onClick={()=>{audioRef.current?.pause();onStart();}} disabled={saving || !document.scenes.length}><Play size={17} fill="currentColor"/><span>공연 시작</span></button>
      </div>
    </header>
    {(error || uploadError) && <div className="studio-error" role="alert"><span>{uploadError || error}</span>{uploadError&&<button onClick={()=>setUploadError(null)} aria-label="알림 닫기"><X size={16}/></button>}</div>}
    <main className="studio-layout">
      <aside className="studio-scenes" aria-label="장면 목록">
        <div className="studio-scenes-heading"><h2>장면 <span>{document.scenes.length}</span></h2><button onClick={addScene} className="studio-add-scene"><Plus size={16}/><span>장면 추가</span></button></div>
        <ol className="studio-scene-list">
          {document.scenes.map((item,index)=><li key={item.id} className={`${scene?.id===item.id?'is-selected ':''}${dropId===item.id?'is-drop-target ':''}${draggedId===item.id?'is-dragging':''}`} draggable onDragStart={event=>{setDraggedId(item.id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',item.id);}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move';setDropId(item.id);}} onDrop={event=>{event.preventDefault();dropScene(item.id);}} onDragEnd={()=>{setDraggedId(null);setDropId(null);}}>
            <button className="studio-scene-select" onClick={()=>selectScene(item.id)} aria-current={scene?.id===item.id?'step':undefined} aria-label={`${index+1}. ${item.title}${item.blackout?' · 암전':''}`}>
              <span className="studio-scene-number">{index+1}</span><span className={`studio-scene-thumbnail ${item.blackout?'is-blackout':''}`}>{!item.blackout&&mediaUrl(item.background,mediaUrls)?<img src={mediaUrl(item.background,mediaUrls)} alt="" draggable={false} style={{objectFit:item.fit,objectPosition:item.position}}/>:item.blackout?<span>암전</span>:<ImageIcon size={19}/>}</span><span className="studio-scene-name">{item.title || '이름 없는 장면'}{item.audio.action==='play'&&<Music2 size={11} aria-label="음악 재생"/>}</span><GripVertical className="studio-scene-grip" size={13}/>
            </button>
          </li>)}
        </ol>
        <div className="studio-scene-order"><span>선택한 장면 이동</span><button disabled={sceneIndex<=0} onClick={()=>scene&&moveScene(scene.id,-1)} aria-label="선택한 장면 위로 이동" title="위로 이동"><ArrowUp size={17}/></button><button disabled={sceneIndex<0||sceneIndex>=document.scenes.length-1} onClick={()=>scene&&moveScene(scene.id,1)} aria-label="선택한 장면 아래로 이동" title="아래로 이동"><ArrowDown size={17}/></button></div>
      </aside>
      <section className="studio-workspace" aria-label="장면 편집">
        {scene?<>
          <div className="studio-preview-frame" style={{aspectRatio:document.settings.aspectRatio==='4:3'?'4 / 3':'16 / 9'}}><div className="studio-canvas"><StageCanvas scene={scene} mediaUrls={mediaUrls} aspectRatio={document.settings.aspectRatio} revision={previewRevision} startAt={previewStartAt}/></div>{scene.effect?.type==='gate'&&!scene.blackout&&<button className="studio-effect-preview" onClick={()=>{setPreviewRevision(value=>value+1);setPreviewStartAt(Date.now());}}><Play size={12} fill="currentColor"/>문 열림 미리보기</button>}</div>
          <div className="studio-preview-nav"><button disabled={sceneIndex<=0} onClick={()=>selectScene(document.scenes[sceneIndex-1].id)} aria-label="이전 장면 선택"><ChevronLeft size={18}/></button><span><span>{sceneIndex+1} / {document.scenes.length}</span><i>·</i><strong>{scene.title || '이름 없는 장면'}</strong></span><button disabled={sceneIndex>=document.scenes.length-1} onClick={()=>selectScene(document.scenes[sceneIndex+1].id)} aria-label="다음 장면 선택"><ChevronRight size={18}/></button></div>
          <div className="studio-notes-panel"><label htmlFor="studio-note"><FileText size={18}/>운영 메모</label><textarea id="studio-note" value={scene.note} onChange={event=>patchScene(scene.id,{note:event.target.value})} placeholder="배우의 대사나 조명·음향 시작 시점을 적어 주세요."/><div className="studio-note-caption">이 메모는 제어창에만 표시됩니다.</div><div className="studio-cue-summary"><div className="studio-cue-heading"><Music2 size={18}/><span>음악 큐</span><button className="studio-text-button" onClick={()=>setTab('audio')}>설정</button></div><div className="studio-cue-action"><span className="studio-cue-icon">{scene.audio.action==='play'?<Play size={15} fill="currentColor"/>:scene.audio.action==='keep'?<Volume2 size={18}/>:<Pause size={16}/>}</span><span>{audioDescription}</span></div></div></div>
        </>:<div className="studio-empty"><Theater size={40}/><h2>첫 장면을 만들어 보세요</h2><p>배경과 음악을 연결해 공연을 시작할 수 있어요.</p><button className="studio-button studio-primary" onClick={addScene}><Plus size={17}/>장면 추가</button></div>}
      </section>
      <aside className="studio-inspector" aria-label="장면과 음향 설정">
        <div className="studio-tabs" role="tablist" aria-label="편집 항목"><button id="studio-scene-tab" role="tab" aria-selected={tab==='scene'} aria-controls="studio-scene-panel" className={tab==='scene'?'is-active':''} onClick={()=>setTab('scene')}>장면</button><button id="studio-audio-tab" role="tab" aria-selected={tab==='audio'} aria-controls="studio-audio-panel" className={tab==='audio'?'is-active':''} onClick={()=>setTab('audio')}>음향</button></div>
        {tab==='scene'?<div id="studio-scene-panel" className="studio-inspector-content" role="tabpanel" aria-labelledby="studio-scene-tab">
          {scene?<>
            <label className="studio-field"><span>장면 이름</span><input value={scene.title} onChange={event=>patchScene(scene.id,{title:event.target.value})} placeholder="장면 이름"/></label>
            <section className="studio-inspector-section"><h3>배경 이미지</h3><div className="studio-background-preview">{mediaUrl(scene.background,mediaUrls)?<img src={mediaUrl(scene.background,mediaUrls)} alt="현재 배경" style={{objectFit:scene.fit,objectPosition:scene.position}}/>:<span><ImageIcon size={25}/>배경을 추가해 주세요</span>}{scene.background&&<button className="studio-remove-image" aria-label="배경 이미지 제거" onClick={()=>patchScene(scene.id,{background:null,effect:undefined})}><X size={14}/></button>}</div><button className="studio-button studio-upload-button" disabled={!!uploading} onClick={()=>imageInput.current?.click()}>{uploading==='image'?<Loader2 size={18} className="studio-spin"/>:<Upload size={18}/>}<span>{uploading==='image'?'업로드 중…':scene.background?'이미지 변경':'이미지 업로드'}</span></button><input className="studio-visually-hidden" ref={imageInput} type="file" accept="image/*" tabIndex={-1} aria-label="배경 이미지 업로드" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void uploadImage(file);}}/>
              {backgrounds.length>0&&<><button className="studio-library-toggle" onClick={()=>setLibraryOpen(!libraryOpen)} aria-expanded={libraryOpen}>기존 배경에서 선택<ChevronRight size={14} className={libraryOpen?'is-open':''}/></button>{libraryOpen&&<div className="studio-background-library">{backgrounds.map(item=><button key={mediaKey(item.ref)} title={item.title} aria-label={`${item.title} 배경 사용`} aria-pressed={scene.background?mediaKey(scene.background)===mediaKey(item.ref):false} onClick={()=>{patchScene(scene.id,{background:item.ref,blackout:false,effect:scene.background&&mediaKey(scene.background)===mediaKey(item.ref)?scene.effect:undefined});setLibraryOpen(false);}}>{mediaUrl(item.ref,mediaUrls)?<img src={mediaUrl(item.ref,mediaUrls)} alt={item.title}/>:<ImageIcon size={16}/>}</button>)}</div>}</>}
              <div className="studio-fit-field"><span>이미지 맞춤</span><div className="studio-segmented"><button aria-pressed={scene.fit==='cover'} className={scene.fit==='cover'?'is-selected':''} onClick={()=>patchScene(scene.id,{fit:'cover'})}>화면 채우기</button><button aria-pressed={scene.fit==='contain'} className={scene.fit==='contain'?'is-selected':''} onClick={()=>patchScene(scene.id,{fit:'contain'})}>전체 보기</button></div></div>
              <label className="studio-field studio-field-inline"><span>이미지 위치</span><select value={scene.position} onChange={event=>patchScene(scene.id,{position:event.target.value as Scene['position']})}><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label>
            </section>
            <section className="studio-inspector-section"><div className="studio-switch-field"><span>암전 효과</span><button className={`studio-switch ${scene.blackout?'is-on':''}`} role="switch" aria-checked={scene.blackout} aria-label="암전 효과" onClick={()=>patchScene(scene.id,{blackout:!scene.blackout})}><span/></button><small>{scene.blackout?'사용':'사용 안 함'}</small></div><label className="studio-field"><span>전환 효과</span><select value={scene.transition.kind} onChange={event=>patchScene(scene.id,{transition:{...scene.transition,kind:event.target.value as 'cut'|'fade'}})}><option value="fade">부드럽게 전환</option><option value="cut">즉시 전환</option></select></label><label className="studio-field studio-field-inline"><span>전환 시간</span><div className="studio-unit-input"><input type="number" min="0.1" max="15" step="0.1" disabled={scene.transition.kind==='cut'} value={scene.transition.durationMs/1000} onChange={event=>patchScene(scene.id,{transition:{...scene.transition,durationMs:Math.max(100,Math.min(15000,Number(event.target.value)*1000))}})}/><span>초</span></div></label>{scene.effect?.type==='gate'&&<label className="studio-field studio-field-inline"><span>문 열림 시간</span><div className="studio-unit-input"><input type="number" min="0.5" max="30" step="0.5" value={scene.effect.durationMs/1000} onChange={event=>patchScene(scene.id,{effect:{...scene.effect!,durationMs:Math.max(500,Math.min(30000,Number(event.target.value)*1000))}})}/><span>초</span></div></label>}</section>
            <div className="studio-scene-actions"><button className="studio-button studio-delete-button" disabled={document.scenes.length<2} title={document.scenes.length<2?'마지막 장면은 삭제할 수 없습니다.':undefined} onClick={()=>setDeleteTarget({kind:'scene',id:scene.id,title:scene.title})}><Trash2 size={16}/>삭제</button><button className="studio-button" onClick={duplicateScene}><Copy size={16}/>장면 복제</button></div>
            <label className="studio-field studio-field-inline studio-aspect-field"><span>공연 화면 비율</span><select value={document.settings.aspectRatio} onChange={event=>update(current=>({...current,settings:{...current.settings,aspectRatio:event.target.value as '16:9'|'4:3'}}))}><option value="16:9">16:9</option><option value="4:3">4:3</option></select></label>
          </>:<p className="studio-inspector-empty">장면을 추가해 편집을 시작하세요.</p>}
        </div>:<div id="studio-audio-panel" className="studio-inspector-content" role="tabpanel" aria-labelledby="studio-audio-tab">
          {scene&&<section className="studio-inspector-section studio-section-first"><h3>현재 장면 음향</h3><label className="studio-field"><span className="studio-light-label">장면이 시작되면</span><select value={scene.audio.action} onChange={event=>patchScene(scene.id,{audio:{action:event.target.value as Scene['audio']['action'],...(event.target.value==='play'?{trackId:scene.audio.trackId || document.tracks[0]?.id}:{})}})}><option value="stop">음악 서서히 종료</option><option value="play">음악 재생</option><option value="keep">현재 음악 유지</option></select></label>{scene.audio.action==='play'&&<label className="studio-field"><span className="studio-light-label">재생할 음원</span><select value={scene.audio.trackId || ''} onChange={event=>patchScene(scene.id,{audio:{action:'play',trackId:event.target.value||undefined}})}><option value="">음원 선택</option>{document.tracks.map(track=><option key={track.id} value={track.id}>{track.label}</option>)}</select>{!document.tracks.length&&<small>아래에서 먼저 음원을 추가해 주세요.</small>}</label>}</section>}
          <section className="studio-inspector-section"><div className="studio-section-title"><h3>공연 음원 <span>{document.tracks.length}</span></h3><button className="studio-icon-button" disabled={!!uploading} aria-label="음원 추가" title="음원 추가" onClick={()=>trackInput.current?.click()}>{uploading==='audio'?<Loader2 size={17} className="studio-spin"/>:<Plus size={18}/>}</button></div><input className="studio-visually-hidden" ref={trackInput} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" tabIndex={-1} aria-label="공연 음원 업로드" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void uploadTrack(file);}}/>
            {document.tracks.length===0?<div className="studio-no-tracks"><Music2 size={24}/><p>공연에 사용할 음악을 추가하세요.</p><button className="studio-button" disabled={!!uploading} onClick={()=>trackInput.current?.click()}><Upload size={15}/>음원 업로드</button></div>:<div className="studio-tracks">{document.tracks.map(track=><div key={track.id} className="studio-track"><div className="studio-track-title"><button className={`studio-track-play ${previewTrackId===track.id?'is-playing':''}`} aria-label={`${track.label} ${previewTrackId===track.id?'미리듣기 정지':'미리듣기'}`} onClick={()=>void previewTrack(track)}>{previewTrackId===track.id?<Pause size={14}/>:<Play size={14} fill="currentColor"/>}</button><input value={track.label} aria-label="음원 이름" onChange={event=>patchTrack(track.id,{label:event.target.value})}/><button className="studio-track-delete" aria-label={`${track.label} 음원 삭제`} onClick={()=>setDeleteTarget({kind:'track',id:track.id,title:track.label})}><X size={14}/></button></div><div className="studio-track-source" title={fileLabel(track.source)}>{fileLabel(track.source)}</div><label className="studio-range-label"><span>개별 음량</span><output>{percent(track.volume)}%</output><input type="range" min="0" max="100" value={percent(track.volume)} aria-label={`${track.label} 개별 음량`} onChange={event=>patchTrack(track.id,{volume:Number(event.target.value)/100})}/></label><div className="studio-track-options"><label><input type="checkbox" checked={track.loop} onChange={event=>patchTrack(track.id,{loop:event.target.checked})}/>반복 재생</label><label>시작 페이드 <input type="number" aria-label={`${track.label} 시작 페이드 초`} min="0" max="15" step="0.1" value={track.fadeInMs/1000} onChange={event=>patchTrack(track.id,{fadeInMs:Math.max(0,Math.min(15000,Number(event.target.value)*1000))})}/>초</label></div></div>)}</div>}
          </section>
          <section className="studio-inspector-section"><h3>전체 음향</h3><label className="studio-range-label"><span>전체 볼륨</span><output>{percent(document.settings.masterVolume)}%</output><input type="range" min="0" max="100" value={percent(document.settings.masterVolume)} aria-label="전체 볼륨" onChange={event=>update(current=>({...current,settings:{...current.settings,masterVolume:Number(event.target.value)/100}}))}/></label><label className="studio-range-label"><span>종료 페이드</span><output>{(document.settings.fadeOutMs/1000).toFixed(1)}초</output><input type="range" min="0.5" max="8" step="0.5" value={document.settings.fadeOutMs/1000} aria-label="전체 음악 종료 페이드 초" onChange={event=>update(current=>({...current,settings:{...current.settings,fadeOutMs:Number(event.target.value)*1000}}))}/></label><p className="studio-settings-help">음악이 끝나거나 종료 큐를 실행할 때 적용돼요. 개별 음량과 전체 볼륨이 함께 적용됩니다.</p></section>
        </div>}
      </aside>
    </main>
    <audio ref={audioRef} onEnded={()=>setPreviewTrackId(null)} preload="none"/>
    {deleteTarget&&<div className="studio-dialog-backdrop" onClick={event=>{if(event.target===event.currentTarget)setDeleteTarget(null);}}><section ref={deleteDialogRef} className="studio-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-delete-title" aria-describedby="studio-delete-description"><span className="studio-dialog-icon"><Trash2 size={22}/></span><h2 id="studio-delete-title">{deleteTarget.kind==='scene'?'장면':'음원'}을 삭제할까요?</h2><p id="studio-delete-description"><strong>{deleteTarget.title || '이름 없는 항목'}</strong>{deleteTarget.kind==='scene'?' 장면이 공연에서 삭제됩니다.':' 음원과 이 음원을 재생하는 장면의 연결이 삭제됩니다.'}</p><div><button ref={cancelDeleteRef} className="studio-button" onClick={()=>setDeleteTarget(null)}>취소</button><button className="studio-button studio-confirm-delete" onClick={confirmDelete}>삭제하기</button></div></section></div>}
  </div>;
}
