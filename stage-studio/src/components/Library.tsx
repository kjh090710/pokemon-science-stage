import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Check, Copy, FileText, Image as ImageIcon, Loader2, LogOut, MoreHorizontal, Pencil, Play, Plus, Search, Theater, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { ShowSummary } from '../lib/model';
import { emptyDocument, mediaUrl } from '../lib/model';
import { createShow, deleteShow, duplicateShow, getShow, listShows, resolveMedia } from '../lib/repository';
import { getPokemonTemplate } from '../lib/templates';
import { parseShowDocument } from '../lib/validation';
import './Library.css';

const failure = (cause:unknown,fallback:string) => cause instanceof Error ? cause.message : fallback;
const modifiedTime = (show:ShowSummary) => Number.isFinite(Date.parse(show.updated_at)) ? Date.parse(show.updated_at) : 0;
const formatDate = (value:string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'short',day:'numeric',timeZone:'Asia/Seoul'}).format(time) : '날짜 정보 없음';
};

export function Library() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [shows,setShows] = useState<ShowSummary[]>([]);
  const [thumbnails,setThumbnails] = useState<Record<string,string>>({});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [notice,setNotice] = useState<string|null>(null);
  const [query,setQuery] = useState('');
  const [sort,setSort] = useState<'recent'|'name'>('recent');
  const [openMenu,setOpenMenu] = useState<string|null>(null);
  const [createOpen,setCreateOpen] = useState(false);
  const [template,setTemplate] = useState<'blank'|'pokemon'>('blank');
  const [title,setTitle] = useState('새 공연');
  const [description,setDescription] = useState('');
  const [titleEdited,setTitleEdited] = useState(false);
  const [creating,setCreating] = useState(false);
  const [deleting,setDeleting] = useState<ShowSummary|null>(null);
  const [busyId,setBusyId] = useState<string|null>(null);
  const [signingOut,setSigningOut] = useState(false);
  const [dialogError,setDialogError] = useState<string|null>(null);
  const listOperation = useRef(0);
  const mounted = useRef(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const locked = useRef(false);
  locked.current = creating || !!busyId;
  const userName = String(auth.user?.user_metadata.name || auth.user?.user_metadata.full_name || auth.user?.email?.split('@')[0] || '사용자');
  const filtered = useMemo(()=>{
    const search = query.trim().toLocaleLowerCase('ko');
    return shows.filter(show=>!search||`${show.title} ${show.description}`.toLocaleLowerCase('ko').includes(search)).sort((a,b)=>sort==='name'?a.title.localeCompare(b.title,'ko')||modifiedTime(b)-modifiedTime(a):modifiedTime(b)-modifiedTime(a));
  },[shows,query,sort]);

  const refresh = useCallback(async()=>{
    const operation = ++listOperation.current;
    setLoading(true); setError(null);
    try {
      const items = await listShows();
      if (!mounted.current || operation !== listOperation.current) return;
      setShows(items); setLoading(false);
      const urls:Record<string,string> = {};
      await Promise.all(items.map(async show=>{
        const first = show.document.scenes.find(scene=>!scene.blackout&&scene.background);
        if (!first?.background) return;
        if (first.background.type==='url') { urls[show.id]=first.background.url; return; }
        try {
          const media = await resolveMedia({...show.document,tracks:[],scenes:[{...first,audio:{action:'stop'},effect:undefined}]});
          urls[show.id] = mediaUrl(first.background,media);
        } catch { /* A missing thumbnail must not hide a user's editable show. */ }
      }));
      if (mounted.current && operation === listOperation.current) setThumbnails(urls);
    } catch (cause) {
      if (mounted.current && operation === listOperation.current) { setError(failure(cause,'작품 목록을 불러오지 못했습니다.')); setLoading(false); }
    }
  },[]);

  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;++listOperation.current;};
  },[]);
  useEffect(()=>{
    if (auth.loading) return;
    if (!auth.user) { navigate('/login',{replace:true}); return; }
    void refresh();
  },[auth.loading,auth.user,refresh,navigate]);
  useEffect(()=>{
    if (!openMenu) return;
    const close = (event:PointerEvent) => {if (!(event.target instanceof Element) || !event.target.closest('.lib-menu-area')) setOpenMenu(null);};
    const escape = (event:KeyboardEvent) => {if(event.key==='Escape')setOpenMenu(null);};
    window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);
    return ()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);};
  },[openMenu]);
  useEffect(()=>{
    if (!createOpen && !deleting) return;
    const previous = window.document.activeElement as HTMLElement|null;
    if (createOpen) titleInput.current?.focus(); else cancelDelete.current?.focus();
    const keyboard = (event:KeyboardEvent)=>{
      if (event.key==='Escape'&&!locked.current) {setCreateOpen(false);setDeleting(null);}
      if (event.key!=='Tab') return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]');
      if (!items?.length) return;
      const first=items[0],last=items[items.length-1];
      if (event.shiftKey&&window.document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&window.document.activeElement===last){event.preventDefault();first.focus();}
    };
    window.addEventListener('keydown',keyboard);
    return ()=>{window.removeEventListener('keydown',keyboard);if(previous?.isConnected)previous.focus();};
  },[createOpen,deleting]);

  function openCreate(kind:'blank'|'pokemon'='blank') {
    setTemplate(kind);setTitle(kind==='pokemon'?'캐치캐치: 포켓몬을 잡아라!':'새 공연');setTitleEdited(false);setDescription('');setDialogError(null);setCreateOpen(true);setOpenMenu(null);
  }
  function chooseTemplate(kind:'blank'|'pokemon') {
    setTemplate(kind);
    if(!titleEdited)setTitle(kind==='pokemon'?'캐치캐치: 포켓몬을 잡아라!':'새 공연');
  }
  async function submitCreate(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(creating)return;
    if(!title.trim()){setDialogError('작품 이름을 입력해 주세요.');return;}
    setCreating(true);setDialogError(null);
    try {
      const source = template==='pokemon'?await getPokemonTemplate():null;
      const document = parseShowDocument(source?.document||emptyDocument());
      const show = await createShow(title.trim(),document,description.trim()||source?.description||'');
      navigate(`/shows/${show.id}`);
    } catch(cause){if(mounted.current)setDialogError(failure(cause,'작품을 만들지 못했습니다. 다시 시도해 주세요.'));}
    finally{if(mounted.current)setCreating(false);}
  }
  async function duplicate(summary:ShowSummary) {
    if(busyId)return;setBusyId(summary.id);setOpenMenu(null);setError(null);setNotice(null);
    try{const source=await getShow(summary.id);const copy=await duplicateShow(source);if(mounted.current){setNotice(`“${copy.title}”을 만들었습니다.`);await refresh();}}
    catch(cause){if(mounted.current)setError(failure(cause,'작품을 복제하지 못했습니다.'));}
    finally{if(mounted.current)setBusyId(null);}
  }
  async function confirmDelete() {
    if(!deleting||busyId)return;setBusyId(deleting.id);setDialogError(null);
    try{const result=await deleteShow(deleting.id);if(mounted.current){setNotice(result.cleanupPending?`“${deleting.title}”을 목록에서 삭제했습니다. 남은 파일은 다음 접속 때 자동으로 정리됩니다.`:`“${deleting.title}”을 삭제했습니다.`);setDeleting(null);await refresh();}}
    catch(cause){if(mounted.current)setDialogError(failure(cause,'작품을 삭제하지 못했습니다. 다시 시도해 주세요.'));}
    finally{if(mounted.current)setBusyId(null);}
  }
  async function signOut() {
    setSigningOut(true);setError(null);
    try{await auth.signOut();navigate('/login',{replace:true});}
    catch(cause){setError(failure(cause,'로그아웃하지 못했습니다.'));setSigningOut(false);}
  }

  return <div className="lib-page">
    <header className="lib-header"><Link to="/shows" className="lib-brand"><Theater size={29} strokeWidth={1.8}/><span>큐 스튜디오</span></Link><span className="lib-header-divider"/><span className="lib-header-label">내 작품</span><div className="lib-account"><span className="lib-avatar" aria-hidden="true">{userName.slice(0,1).toLocaleUpperCase('ko')}</span><span className="lib-user-name">{userName}</span><button onClick={()=>void signOut()} disabled={signingOut}><LogOut size={15}/><span>{signingOut?'로그아웃 중':'로그아웃'}</span></button></div></header>
    <main className="lib-main">
      <section className="lib-page-heading"><div><p className="lib-eyebrow">MY STAGE</p><h1>내 작품{!loading&&!error&&<span>{shows.length}</span>}</h1><p className="lib-description">장면을 만들고, 다음 무대를 준비하세요.</p></div><button className="lib-button lib-primary" onClick={()=>openCreate()} disabled={!!busyId}><Plus size={17}/>새 작품</button></section>
      {error&&<div className="lib-alert lib-alert-error" role="alert"><span>{error}</span><button onClick={()=>void refresh()} disabled={loading}>다시 불러오기</button></div>}
      {notice&&<div className="lib-alert lib-alert-success" role="status"><Check size={15}/><span>{notice}</span><button onClick={()=>setNotice(null)} aria-label="안내 닫기"><X size={15}/></button></div>}
      <div className="lib-toolbar"><label className="lib-search"><Search size={16}/><input type="search" placeholder="작품 검색" aria-label="작품 검색" value={query} onChange={event=>setQuery(event.target.value)}/></label><label className="lib-sort"><span>정렬</span><select value={sort} aria-label="작품 정렬" onChange={event=>setSort(event.target.value as 'recent'|'name')}><option value="recent">최근 수정순</option><option value="name">이름순</option></select></label></div>
      {loading?<div className="lib-loading" role="status"><Loader2 size={22} className="lib-spin"/><span>작품을 불러오고 있어요.</span></div>:shows.length===0?<section className="lib-empty"><span className="lib-empty-icon"><Theater size={37} strokeWidth={1.4}/></span><h2>{error?'작품 목록을 확인할 수 없어요':'첫 공연을 만들어 보세요'}</h2><p>{error?'목록을 다시 불러오거나 새 작품을 만들 수 있어요.':'빈 장면에서 시작하거나 준비된 공연을 나만의 무대로 바꿔 보세요.'}</p><div><button className="lib-button lib-primary" onClick={()=>openCreate()}><Plus size={16}/>새 작품 만들기</button><button className="lib-button" onClick={()=>openCreate('pokemon')}>포켓몬 템플릿으로 시작<ArrowRight size={14}/></button></div></section>:filtered.length===0?<section className="lib-no-results"><Search size={29}/><h2>검색 결과가 없어요</h2><p>다른 이름이나 설명으로 검색해 보세요.</p><button onClick={()=>setQuery('')}>검색 초기화</button></section>:<section className="lib-shows" aria-label="내 공연 목록"><div className="lib-table-heading" aria-hidden="true"><span>작품</span><span>장면</span><span>최근 수정</span><span/></div>{filtered.map(show=><article className="lib-show-row" key={show.id}>
        <Link to={`/shows/${show.id}`} className="lib-show-main"><span className="lib-show-thumbnail">{thumbnails[show.id]?<img src={thumbnails[show.id]} alt="" loading="lazy"/>:<ImageIcon size={25} strokeWidth={1.4}/>}</span><span className="lib-show-text"><strong>{show.title}</strong><span>{show.description||'설명이 없는 작품'}</span><small className="lib-mobile-meta">{show.document.scenes.length}개 장면 · {formatDate(show.updated_at)}</small></span></Link>
        <span className="lib-scene-count">{show.document.scenes.length}<small>개 장면</small></span><time className="lib-modified" dateTime={show.updated_at}>{formatDate(show.updated_at)}</time><div className="lib-row-actions">{busyId===show.id?<Loader2 className="lib-spin lib-row-spinner" size={17}/>:<><Link className="lib-edit-link" to={`/shows/${show.id}`}><Pencil size={13}/>편집</Link><Link className="lib-run-link" to={`/control/${show.id}`} aria-label={`${show.title} 공연 시작`} title="공연 시작"><Play size={15}/></Link><div className="lib-menu-area"><button className="lib-more" aria-label={`${show.title} 더 보기`} aria-haspopup="menu" aria-expanded={openMenu===show.id} disabled={!!busyId} onClick={()=>setOpenMenu(openMenu===show.id?null:show.id)}><MoreHorizontal size={18}/></button>{openMenu===show.id&&<div className="lib-row-menu" role="menu"><button role="menuitem" onClick={()=>void duplicate(show)}><Copy size={14}/>작품 복제</button><button className="lib-danger-text" role="menuitem" onClick={()=>{setDeleting(show);setDialogError(null);setOpenMenu(null);}}><Trash2 size={14}/>작품 삭제</button></div>}</div></>}</div>
      </article>)}</section>}
      {!loading&&shows.length>0&&<section className="lib-template-shortcut"><span><FileText size={16}/><strong>다음 공연을 더 쉽게 준비하세요.</strong><span>준비된 장면과 음향으로 시작할 수 있어요.</span></span><button onClick={()=>openCreate('pokemon')} disabled={!!busyId}>포켓몬 템플릿 사용<ArrowRight size={14}/></button></section>}
    </main>
    {(createOpen||deleting)&&<div className="lib-dialog-backdrop" onClick={event=>{if(event.target===event.currentTarget&&!locked.current){setCreateOpen(false);setDeleting(null);}}}><div ref={dialogRef} className={`lib-dialog ${deleting?'lib-delete-dialog':''}`} role="dialog" aria-modal="true" aria-labelledby="lib-dialog-title">
      {createOpen?<><div className="lib-dialog-heading"><div><h2 id="lib-dialog-title">새 작품 만들기</h2><p>어떤 무대를 준비하고 있나요?</p></div><button aria-label="새 작품 만들기 닫기" disabled={creating} onClick={()=>setCreateOpen(false)}><X size={18}/></button></div><form onSubmit={event=>void submitCreate(event)}><fieldset className="lib-template-options" disabled={creating}><legend>시작 방식</legend><button type="button" className={template==='blank'?'is-selected':''} aria-pressed={template==='blank'} onClick={()=>chooseTemplate('blank')}><span className="lib-template-option-icon"><Plus size={21}/></span><strong>빈 공연</strong><small>첫 장면부터 직접 구성</small>{template==='blank'&&<Check className="lib-option-check" size={15}/>}</button><button type="button" className={template==='pokemon'?'is-selected':''} aria-pressed={template==='pokemon'} onClick={()=>chooseTemplate('pokemon')}><span className="lib-template-option-image"><img src="/templates/pokemon/backgrounds/07-lake-gold.png" alt=""/></span><strong>포켓몬 공연</strong><small>준비된 장면과 음향으로 시작</small>{template==='pokemon'&&<Check className="lib-option-check" size={15}/>}</button></fieldset><label className="lib-field"><span>작품 이름</span><input ref={titleInput} value={title} onChange={event=>{setTitle(event.target.value);setTitleEdited(true);}} placeholder="작품 이름을 입력해 주세요" required maxLength={160} disabled={creating}/></label><label className="lib-field"><span>설명 <small>선택</small></span><textarea value={description} onChange={event=>setDescription(event.target.value)} placeholder="공연 날짜나 준비 내용을 간단히 적어 주세요." maxLength={2000} disabled={creating}/></label>{dialogError&&<div className="lib-dialog-error" role="alert">{dialogError}</div>}<div className="lib-dialog-actions"><button type="button" className="lib-button" disabled={creating} onClick={()=>setCreateOpen(false)}>취소</button><button className="lib-button lib-primary" type="submit" disabled={creating||!title.trim()}>{creating?<Loader2 size={16} className="lib-spin"/>:<Plus size={16}/>}<span>{creating?'작품을 만드는 중…':'작품 만들기'}</span></button></div></form></>:deleting&&<><span className="lib-delete-icon"><Trash2 size={24}/></span><h2 id="lib-dialog-title">작품을 삭제할까요?</h2><p className="lib-delete-description"><strong>{deleting.title}</strong>의 장면과 업로드한 파일이 함께 삭제됩니다. 이 작업은 되돌릴 수 없어요.</p>{dialogError&&<div className="lib-dialog-error" role="alert">{dialogError}</div>}<div className="lib-dialog-actions"><button ref={cancelDelete} className="lib-button" disabled={!!busyId} onClick={()=>setDeleting(null)}>취소</button><button className="lib-button lib-delete-confirm" disabled={!!busyId} onClick={()=>void confirmDelete()}>{busyId?<Loader2 className="lib-spin" size={16}/>:<Trash2 size={15}/>}<span>{busyId?'삭제 중…':'삭제하기'}</span></button></div></>}
    </div></div>}
  </div>;
}
