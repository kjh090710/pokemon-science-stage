import {mediaUrl} from './model';
import type {MediaUrls, ShowDocument, Track} from './model';

interface Envelope {from:number;to:number;start:number;end:number}
type AudioSettings = ShowDocument['settings'];
const clamp = (value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

export class AudioEngine {
  readonly player:HTMLAudioElement;
  activeTrackId:string|null = null;
  effectTrackId:string|null = null;
  trackVolumes:Record<string,number> = {};
  masterVolume:number;
  fadeOutMs:number;
  private tracks:Map<string,Track>;
  private urls:MediaUrls;
  private readonly status:(message:string)=>void;
  private ctx:AudioContext|null = null;
  private master:GainNode|null = null;
  private musicLevel:GainNode|null = null;
  private effectLevel:GainNode|null = null;
  private envelope:GainNode|null = null;
  private envelopeState:Envelope = {from:1,to:1,start:0,end:0};
  private operation = 0;
  private effectOperation = 0;
  private fadeDeadline = 0;
  private naturalFade = false;
  private effectSource:AudioBufferSourceNode|null = null;
  private effectEnvelope:GainNode|null = null;
  private buffers = new Map<string,Promise<AudioBuffer>>();
  private disposed = false;

  constructor(tracks:Track[],urls:MediaUrls,settings:AudioSettings,status:(message:string)=>void) {
    this.tracks=new Map(tracks.map(track=>[track.id,track]));
    this.urls=urls;
    this.masterVolume=clamp(settings.masterVolume,0,1);
    this.fadeOutMs=clamp(settings.fadeOutMs,0,30000);
    this.status=status;
    this.player=document.createElement('audio');
    this.player.preload='auto';
    this.player.crossOrigin='anonymous';
    for(const track of tracks)this.trackVolumes[track.id]=clamp(track.volume,0,1);
    this.player.onended=()=>{
      if(!this.activeTrackId || this.disposed)return;
      this.activeTrackId=null;this.fadeDeadline=0;
      this.status('음악 재생 완료');
    };
    this.player.onerror=()=>{if(!this.disposed)this.status('음원을 불러오지 못했습니다. 파일 연결과 인터넷 연결을 확인해 주세요.');};
    this.player.ontimeupdate=()=>{
      if(!this.ctx || !this.activeTrackId || this.player.loop || this.naturalFade || this.fadeDeadline)return;
      const remaining=this.player.duration-this.player.currentTime;
      if(remaining>0 && remaining<=this.fadeOutMs/1000){
        this.naturalFade=true;
        this.fadeDeadline=this.ctx.currentTime+remaining;
        this.ramp(0,remaining);
      }
    };
  }

  configure(tracks:Track[],urls:MediaUrls) {
    this.tracks=new Map(tracks.map(track=>[track.id,track]));this.urls=urls;
    for(const track of tracks)if(this.trackVolumes[track.id]===undefined)this.trackVolumes[track.id]=clamp(track.volume,0,1);
  }

  private context() {
    if(this.ctx)return this.ctx;
    const AudioContextClass=window.AudioContext || (window as Window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioContextClass)throw new Error('이 브라우저는 공연 음향을 지원하지 않습니다.');
    const ctx=new AudioContextClass();this.ctx=ctx;
    const master=ctx.createGain();master.gain.value=this.masterVolume;master.connect(ctx.destination);this.master=master;
    const music=ctx.createGain();music.connect(master);this.musicLevel=music;
    const effect=ctx.createGain();effect.connect(master);this.effectLevel=effect;
    const envelope=ctx.createGain();envelope.connect(music);this.envelope=envelope;
    ctx.createMediaElementSource(this.player).connect(envelope);
    return ctx;
  }

  async unlock() {
    if(this.disposed)return;
    const ctx=this.context();
    if(ctx.state!=='running')await ctx.resume();
  }

  setMasterVolume(value:number) {
    this.masterVolume=clamp(value,0,1);
    if(this.ctx && this.master)this.master.gain.setValueAtTime(this.masterVolume,this.ctx.currentTime);
  }

  setTrackVolume(id:string,value:number) {
    if(!this.tracks.has(id) || !Number.isFinite(value))return;
    this.trackVolumes[id]=clamp(value,0,1);
    if(!this.ctx)return;
    if(id===this.activeTrackId)this.musicLevel?.gain.setValueAtTime(this.trackVolumes[id],this.ctx.currentTime);
    if(id===this.effectTrackId)this.effectLevel?.gain.setValueAtTime(this.trackVolumes[id],this.ctx.currentTime);
  }

  setFadeOut(milliseconds:number) {this.fadeOutMs=clamp(milliseconds,0,30000);}

  private envelopeValueAt(time:number) {
    const state=this.envelopeState;
    if(state.end<=state.start)return state.to;
    if(time<=state.start)return state.from;
    if(time>=state.end)return state.to;
    return state.from+(state.to-state.from)*(time-state.start)/(state.end-state.start);
  }

  private setEnvelope(value:number) {
    if(!this.ctx || !this.envelope)return;
    const now=this.ctx.currentTime;
    this.envelope.gain.cancelScheduledValues(now);
    this.envelope.gain.setValueAtTime(value,now);
    this.envelopeState={from:value,to:value,start:now,end:now};
  }

  private ramp(value:number,seconds:number) {
    if(!this.ctx || !this.envelope)return;
    const now=this.ctx.currentTime,current=this.envelopeValueAt(now),duration=Math.max(0,seconds);
    // 새 램프의 시작점을 현재 시각에 고정해 첫 순간의 음량 저하를 막습니다.
    this.envelope.gain.cancelScheduledValues(now);
    this.envelope.gain.setValueAtTime(current,now);
    if(duration)this.envelope.gain.linearRampToValueAtTime(value,now+duration);
    else this.envelope.gain.setValueAtTime(value,now);
    this.envelopeState={from:current,to:value,start:now,end:now+duration};
  }

  async stopMusic(fadeMs=this.fadeOutMs) {
    const operation=++this.operation;
    if(!this.player.paused && this.ctx && fadeMs>0){
      const remaining=(this.fadeDeadline-this.ctx.currentTime)*1000;
      if(remaining>0)fadeMs=Math.min(fadeMs,remaining);
      this.fadeDeadline=this.ctx.currentTime+fadeMs/1000;
      this.ramp(0,fadeMs/1000);
      await new Promise<void>(resolve=>window.setTimeout(resolve,fadeMs));
    }
    if(operation!==this.operation || this.disposed)return false;
    this.player.pause();this.player.currentTime=0;this.activeTrackId=null;this.fadeDeadline=0;
    return true;
  }

  async play(id:string) {
    const track=this.tracks.get(id);
    if(!track){this.status('연결된 음원을 찾을 수 없습니다.');return;}
    const operation=++this.operation;
    this.stopEffect();
    const url=mediaUrl(track.source,this.urls);
    if(!url){this.status(`${track.label} 파일을 불러오지 못했습니다.`);return;}
    try {
      await this.unlock();
      if(operation!==this.operation || this.disposed)return;
      if(!this.player.paused && this.ctx){
        const remaining=(this.fadeDeadline-this.ctx.currentTime)*1000;
        const duration=remaining>0?remaining:this.fadeOutMs;
        this.fadeDeadline=this.ctx.currentTime+duration/1000;
        this.ramp(0,duration/1000);
        await new Promise<void>(resolve=>window.setTimeout(resolve,duration));
        if(operation!==this.operation || this.disposed)return;
      }
      this.player.pause();this.fadeDeadline=0;
      this.player.src=url;this.player.loop=track.loop;this.player.currentTime=0;
      this.naturalFade=false;this.activeTrackId=id;
      this.musicLevel?.gain.setValueAtTime(this.trackVolumes[id]??track.volume,this.ctx!.currentTime);
      this.setEnvelope(0);
      await this.player.play();
      if(operation!==this.operation || this.disposed)return;
      this.ramp(1,Math.max(0,track.fadeInMs)/1000);
      this.status(`재생 중 · ${track.label}${track.loop?' · 반복':''}`);
    } catch {
      if(operation===this.operation && !this.disposed){this.activeTrackId=null;this.status('음향 준비 또는 해당 음원의 재생 버튼을 눌러 주세요.');}
    }
  }

  stopEffect() {
    ++this.effectOperation;
    if(this.effectSource){
      this.effectSource.onended=null;
      try{this.effectSource.stop();}catch{/* 이미 끝난 소스입니다. */}
      this.effectSource.disconnect();this.effectSource=null;
    }
    this.effectEnvelope?.disconnect();this.effectEnvelope=null;
    this.effectTrackId=null;
  }

  async stop() {
    this.stopEffect();
    this.status(`음향을 서서히 종료하는 중 · ${(this.fadeOutMs/1000).toFixed(1)}초`);
    if(await this.stopMusic())this.status('음향 정지');
  }

  async pause() {
    const hadEffect=!!this.effectSource;
    this.stopEffect();
    const operation=++this.operation;
    if(hadEffect){this.status('효과음 정지');return;}
    if(!this.activeTrackId)return;
    if(this.player.paused){
      try{
        await this.unlock();if(operation!==this.operation || this.disposed)return;
        this.naturalFade=false;this.fadeDeadline=0;
        await this.player.play();if(operation!==this.operation || this.disposed)return;
        this.ramp(1,.3);this.status('음악 재생');
      }catch{if(!this.disposed)this.status('해당 음원의 재생 버튼을 눌러 주세요.');}
    }else{this.player.pause();this.status('음악 일시정지');}
  }

  async prepareEffect(id:string) {
    const track=this.tracks.get(id),url=track?mediaUrl(track.source,this.urls):'';
    if(!url)throw new Error('효과음 파일을 찾을 수 없습니다.');
    let promise=this.buffers.get(url);
    if(!promise){
      promise=fetch(url).then(response=>{if(!response.ok)throw new Error('효과음을 불러오지 못했습니다.');return response.arrayBuffer();}).then(data=>this.context().decodeAudioData(data));
      this.buffers.set(url,promise);
      promise.catch(()=>{if(this.buffers.get(url)===promise)this.buffers.delete(url);});
    }
    return promise;
  }

  async scheduleEffect(id:string,durationMs:number,onReady:(startAt:number)=>void) {
    this.stopEffect();
    const operation=this.effectOperation;
    const [,buffer]=await Promise.all([this.unlock(),this.prepareEffect(id)]);
    if(operation!==this.effectOperation || this.disposed)return;
    const ctx=this.context();
    if(ctx.state!=='running')throw new Error('음향 준비 버튼을 눌러 주세요.');
    const lead=.18,duration=Math.max(.1,durationMs/1000),start=ctx.currentTime+lead,startAt=Date.now()+lead*1000;
    const source=ctx.createBufferSource(),envelope=ctx.createGain();
    source.buffer=buffer;source.playbackRate.value=buffer.duration<duration?buffer.duration/duration:1;
    envelope.gain.setValueAtTime(0,start);
    envelope.gain.linearRampToValueAtTime(1,start+Math.min(.04,duration/4));
    envelope.gain.setValueAtTime(1,start+duration-Math.min(.18,duration/4));
    envelope.gain.linearRampToValueAtTime(0,start+duration);
    this.effectLevel!.gain.setValueAtTime(this.trackVolumes[id]??1,ctx.currentTime);
    source.connect(envelope).connect(this.effectLevel!);
    source.onended=()=>{
      if(this.effectSource===source){this.effectSource=null;this.effectEnvelope=null;this.effectTrackId=null;if(!this.disposed)this.status('효과음 종료');}
      source.disconnect();envelope.disconnect();
    };
    this.effectSource=source;this.effectEnvelope=envelope;this.effectTrackId=id;
    source.start(start);source.stop(start+duration);
    onReady(startAt);
    this.status(`효과음 재생 · ${(duration).toFixed(1)}초`);
  }

  dispose() {
    this.disposed=true;++this.operation;this.stopEffect();this.player.pause();
    this.player.onended=null;this.player.ontimeupdate=null;this.player.onerror=null;
    this.player.removeAttribute('src');this.player.load();
    void this.ctx?.close().catch(()=>{});
  }
}
