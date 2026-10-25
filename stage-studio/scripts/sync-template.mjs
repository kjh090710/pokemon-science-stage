import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'stage-studio/public/templates/pokemon');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'stage-data.js'),'utf8'),context);
const show=context.window.STAGE_SHOW;
const used=new Set();
const source=(relative)=>{used.add(relative);return {type:'url',url:'/templates/pokemon/'+relative};};
const tracks=[
 ['friends','우리는 모두 친구 · 가사 있음','friends-vocal.mp3',false,1,900],
 ['instrumental','우리는 모두 친구 · 피아노 반주','friends-instrumental-piano-tight.mp3',false,1,20],
 ['route','Route 216','route-216.mp3',true,1,900],
 ['farewell','Farewell','farewell.mp3',false,1,900],
 ['door','문 열림 효과음','door-open-short.mp3',false,1,0],
 ['finale','5장 이후 · 우리는 모두 친구 반복','friends-vocal.mp3',true,.25,900],
].map(([id,label,file,loop,volume,fadeInMs])=>({id:'track-'+id,label,source:source('audio/'+file),loop,volume,fadeInMs}));
const scenes=show.cues.map((cue,index)=>{
 const image=cue.lake==='dark'?'07-lake-pokemon-dark.png':show.images[cue.bg];
 const audio=cue.continuousAudio&&show.cues[index-1]?.audio===cue.audio?{action:'keep'}:cue.audio?{action:'play',trackId:'track-'+cue.audio}:{action:'stop'};
 return {id:cue.id,title:cue.chapter,note:cue.note||'',background:image?source('backgrounds/'+image):null,blackout:!!cue.blackout,fit:cue.instruction?'contain':'cover',position:cue.instruction?'right':'center',transition:{kind:cue.blackout?'cut':'fade',durationMs:cue.lake==='dark'||cue.id==='lake-restored'?1150:500},audio,...(cue.visual==='door'?{effect:{type:'gate',frames:[source('backgrounds/03-gate-forest-partial.png'),source('backgrounds/03-gate-forest-half.png')],durationMs:4000}}:{})};
});
for(const relative of used){const destination=path.join(output,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,relative),destination);}
fs.writeFileSync(path.join(output,'show.json'),JSON.stringify({title:'캐치캐치: 포켓몬을 잡아라!',description:'28개 장면과 실제 공연 음향이 연결된 포켓몬 과학 연극 템플릿',document:{schemaVersion:1,scenes,tracks,settings:{aspectRatio:'16:9',masterVolume:.75,fadeOutMs:2500}}},null,2));
console.log(`Pokemon template: ${scenes.length} scenes, ${tracks.length} tracks, ${used.size} assets.`);
