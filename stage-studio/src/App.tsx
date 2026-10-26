import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Link,Navigate,Route,Routes,useNavigate,useParams} from 'react-router-dom';
import {ArrowLeft,Download,Loader2,Theater} from 'lucide-react';
import {AuthPage} from './components/AuthPage';
import {Library} from './components/Library';
import {Editor} from './components/Editor';
import {Controller} from './components/Controller';
import {Screen} from './components/Screen';
import {useAuth} from './lib/auth';
import {getPokemonTemplate} from './lib/templates';
import {parseShowDocument} from './lib/validation';
import {showFingerprint,useShow} from './lib/useShow';
import type {ShowRecord} from './lib/model';

function Loading(){return <div className="app-loading" role="status"><Loader2 className="spinning" size={24}/>작업실을 준비하고 있어요.</div>;}
function Problem({message}:{message:string}){return <main className="app-problem"><Theater size={36}/><h1>작품을 열지 못했습니다.</h1><p>{message}</p><Link className="app-button" to="/shows"><ArrowLeft size={16}/>내 작품으로</Link></main>;}
function Protected({children}:{children:ReactNode}){const {user,loading}=useAuth();if(loading)return <Loading/>;return user?<>{children}</>:<Navigate to="/login" replace/>;}
function Home(){const {user,loading}=useAuth();if(loading)return <Loading/>;return user?<Navigate to="/shows" replace/>:<AuthPage/>;}
function Callback(){const {user,loading}=useAuth();if(loading)return <Loading/>;if(user)return <Navigate to="/shows" replace/>;return <Navigate to="/login" replace state={{error:new URLSearchParams(window.location.search).get('error_description')||'로그인을 완료하지 못했습니다. 다시 시도해 주세요.'}}/>;}
function exportShow(show:ShowRecord){const data=JSON.stringify({format:'stagecue-show',version:1,title:show.title,description:show.description,document:show.document},null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=show.title.replace(/[\\/:*?"<>|]/g,'_')+'.stagecue.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function Workspace({performance=false}:{performance?:boolean}){
 const {id=''}=useParams();const nav=useNavigate();const model=useShow(id);const [leaving,setLeaving]=useState(false),[startError,setStartError]=useState('');
 const leaveRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!leaving)return;
  const previous=document.activeElement;
  const dialog=leaveRef.current;
  const buttons=()=>Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
  buttons().find(button=>button.dataset.initialFocus==='true')?.focus();
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setLeaving(false);return;}
   if(event.key!=='Tab')return;
   const items=buttons(),first=items[0],last=items[items.length-1];
   if(!first)return;
   if(!dialog?.contains(document.activeElement)){event.preventDefault();first.focus();}
   else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.removeEventListener('keydown',onKey);if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
 },[leaving]);
 if(model.loading)return <Loading/>;if(!model.show)return <Problem message={model.error||'작품이 존재하지 않습니다.'}/>;
 if(performance&&model.mediaLoading)return <Loading/>;
 if(performance&&model.mediaError)return <Problem message={model.mediaError}/>;
 if(performance)return <Controller key={id} show={model.show} mediaUrls={model.mediaUrls} onBack={()=>nav('/shows/'+id)}/>;
 const start=async()=>{try{if(model.dirty)await model.save();nav('/control/'+id);}catch{setStartError('저장이 완료되지 않아 공연을 시작하지 않았습니다. 저장 오류를 확인해 주세요.');}};
 return <><Editor show={model.show} mediaUrls={model.mediaUrls} onChange={model.change} onTitleChange={model.title} onSave={model.save} saving={model.saving} dirty={model.dirty} error={model.error||startError||null} onUpload={model.upload} onBack={()=>model.dirty?setLeaving(true):nav('/shows')} onStart={()=>{void start();}}/>
 {leaving&&<div className="app-dialog-backdrop"><section ref={leaveRef} className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-title"><h2 id="leave-title">저장하지 않은 변경 사항이 있습니다.</h2><p>돌아가기 전에 저장하거나, JSON으로 편집본을 내보낼 수 있습니다.</p><button className="app-text-button" onClick={()=>exportShow(model.show!)}><Download size={15}/>편집본 내보내기</button><div className="app-dialog-actions"><button data-initial-focus="true" className="app-button" onClick={()=>setLeaving(false)}>계속 편집</button><button className="app-button" onClick={()=>nav('/shows')}>저장하지 않고 나가기</button><button className="app-button primary" disabled={model.saving} onClick={()=>{void model.save().then(()=>nav('/shows')).catch(()=>setLeaving(false));}}>저장 후 나가기</button></div></section></div>}
 </>;
}
const demoKey='stagecue-demo-v1';
function Demo({performance=false}:{performance?:boolean}){
 const nav=useNavigate();const [show,setShow]=useState<ShowRecord|null>(null),[error,setError]=useState(''),[saved,setSaved]=useState('');const latest=useRef(show);latest.current=show;
 useEffect(()=>{let alive=true;getPokemonTemplate().then(template=>{const now=new Date().toISOString();let value:ShowRecord={id:'demo',owner_id:'demo',title:template.title,description:template.description,document:template.document,revision:1,created_at:now,updated_at:now};try{const old=JSON.parse(localStorage.getItem(demoKey)||'null');if(old&&typeof old.title==='string')value={...value,title:old.title.slice(0,160),document:parseShowDocument(old.document)};}catch{/* 기본 템플릿으로 복구합니다. */}if(alive){setShow(value);setSaved(showFingerprint(value));}}).catch(reason=>{if(alive)setError(reason instanceof Error?reason.message:'체험을 불러오지 못했습니다.');});return()=>{alive=false;};},[]);
 const save=async()=>{if(!latest.current)return;try{if(!latest.current.title.trim())throw new Error('공연 이름을 입력해 주세요.');const value={...latest.current,title:latest.current.title.trim(),document:parseShowDocument(latest.current.document)};localStorage.setItem(demoKey,JSON.stringify(value));latest.current=value;setShow(value);setSaved(showFingerprint(value));setError('');}catch(reason){setError(reason instanceof Error?reason.message:'이 브라우저에 저장하지 못했습니다.');throw reason;}};
 if(!show)return error?<Problem message={error}/>:<Loading/>;
 if(performance)return <Controller show={show} mediaUrls={{}} onBack={()=>nav('/demo')}/>;
 return <div className="demo-shell"><div className="demo-banner"><span>체험 작업실 · 저장한 내용은 이 브라우저에 남습니다.</span><Link to="/login">로그인해서 내 작품 만들기</Link></div><Editor show={show} mediaUrls={{}} onChange={document=>setShow(value=>value?{...value,document}:value)} onTitleChange={title=>setShow(value=>value?{...value,title}:value)} onSave={save} saving={false} dirty={showFingerprint(show)!==saved} error={error||null} onUpload={async()=>{throw new Error('이미지·음원을 업로드하려면 먼저 로그인해 주세요.');}} onBack={()=>nav('/login')} onStart={()=>{void save().then(()=>nav('/demo/control')).catch(()=>{});}}/></div>;
}
export function App(){return <Routes><Route path="/" element={<Home/>}/>{['/login','/signup','/forgot-password','/reset-password'].map(path=><Route key={path} path={path} element={<AuthPage/>}/>)}<Route path="/auth/callback" element={<Callback/>}/><Route path="/shows" element={<Protected><Library/></Protected>}/><Route path="/shows/:id" element={<Protected><Workspace/></Protected>}/><Route path="/control/:id" element={<Protected><Workspace performance/></Protected>}/><Route path="/demo" element={<Demo/>}/><Route path="/demo/control" element={<Demo performance/>}/><Route path="/screen/:id" element={<Screen/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>;}
