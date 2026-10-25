import type {ShowDocument} from './model';
import {parseShowDocument} from './validation';
export interface ShowTemplate {title:string;description:string;document:ShowDocument;}
let promise:Promise<ShowTemplate>|null=null;
export function getPokemonTemplate():Promise<ShowTemplate>{
 if(!promise)promise=fetch('/templates/pokemon/show.json').then(async response=>{if(!response.ok)throw new Error('기본 템플릿을 불러오지 못했습니다.');const data=await response.json();return {title:String(data.title),description:String(data.description),document:parseShowDocument(data.document)};}).catch(error=>{promise=null;throw error;});
 return promise.then(template=>structuredClone(template));
}
