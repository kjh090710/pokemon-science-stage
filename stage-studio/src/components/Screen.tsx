import {useEffect, useRef, useState} from 'react';
import type {CSSProperties} from 'react';
import {useParams,useSearchParams} from 'react-router-dom';
import {createStageChannel,isStageMessage,validSession} from '../lib/channel';
import type {StageCommand,StageMessage,StageState} from '../lib/channel';
import {StageCanvas} from './StageCanvas';

export function Screen() {
  const {id=''}=useParams();
  const [params]=useSearchParams();
  const session=params.get('session')||'';
  const [state,setState]=useState<StageState|null>(null);
  const channelRef=useRef<BroadcastChannel|null>(null);
  const latestRevision=useRef(-1);

  useEffect(()=>{
    const previousTitle=document.title,previousOverflow=document.documentElement.style.overflow;
    latestRevision.current=-1;setState(null);
    document.title='공연 화면 · 제어창 연결 대기';document.documentElement.style.overflow='hidden';
    if(!validSession(session) || !id)return()=>{document.title=previousTitle;document.documentElement.style.overflow=previousOverflow;};
    const channel=createStageChannel(id,session);channelRef.current=channel;
    if(!channel)return()=>{document.title=previousTitle;document.documentElement.style.overflow=previousOverflow;};
    const hello=()=>channel.postMessage({type:'hello',session,showId:id} satisfies StageMessage);
    channel.onmessage=event=>{
      const message:unknown=event.data;
      if(!isStageMessage(message) || message.type!=='state' || message.session!==session || message.state.showId!==id)return;
      const next=message.state;
      if(next.index<0 || next.index>=next.document.scenes.length || next.revision<latestRevision.current)return;
      latestRevision.current=next.revision;setState(next);document.title=`${next.title} · 공연 화면`;
    };
    const closed=()=>channel.postMessage({type:'closed',session,showId:id} satisfies StageMessage);
    hello();const timer=window.setInterval(hello,2000);window.addEventListener('focus',hello);window.addEventListener('beforeunload',closed);
    return()=>{clearInterval(timer);window.removeEventListener('focus',hello);window.removeEventListener('beforeunload',closed);closed();channel.close();channelRef.current=null;document.title=previousTitle;document.documentElement.style.overflow=previousOverflow;};
  },[id,session]);

  function command(action:StageCommand) {channelRef.current?.postMessage({type:'command',session,showId:id,action} satisfies StageMessage);}

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.repeat)return;
      if(event.key.toLowerCase()==='f'){
        event.preventDefault();
        if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
        else void document.documentElement.requestFullscreen().catch(()=>{});
      }else if(event.key==='ArrowRight'||event.key===' '){event.preventDefault();channelRef.current?.postMessage({type:'command',session,showId:id,action:'next'} satisfies StageMessage);}
      else if(event.key==='ArrowLeft'){event.preventDefault();channelRef.current?.postMessage({type:'command',session,showId:id,action:'prev'} satisfies StageMessage);}
      else if(event.key.toLowerCase()==='b'){event.preventDefault();channelRef.current?.postMessage({type:'command',session,showId:id,action:'blackout'} satisfies StageMessage);}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[id,session]);

  const scene=state?.document.scenes[state.index];
  return <main className="stg-screen" style={{'--stg-ratio':state?.document.settings.aspectRatio==='4:3'?4/3:16/9} as CSSProperties} onClick={()=>command('next')} aria-label="공연 화면">
    {scene && state?<StageCanvas scene={{...scene,blackout:scene.blackout||state.emergency,transition:state.emergency?{kind:'cut',durationMs:0}:scene.transition}} mediaUrls={state.mediaUrls} aspectRatio={state.document.settings.aspectRatio} revision={state.revision} startAt={state.startAt}/>:<div className="stg-screen-blank"/>}
  </main>;
}
