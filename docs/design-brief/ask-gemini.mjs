// Usage: node --env-file=.env.local design-brief/ask-gemini.mjs <out-name> "<task>" shot1 shot2 ...
import {readFileSync,writeFileSync} from 'node:fs';
const [,,out,task,...shots]=process.argv,dir=new URL('.',import.meta.url).pathname,MODEL=process.env.GEMINI_MODEL||'gemini-4-carbon';
const parts=[{text:readFileSync(dir+'BRIEF.md','utf8')},{text:'\n\n# YOUR TASK NOW\n'+task}];
for(const s of shots){parts.push({text:`Screenshot: ${s}`});parts.push({inline_data:{mime_type:'image/png',data:readFileSync(`${dir}shots/${s}.png`).toString('base64')}})}
const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{maxOutputTokens:60000}})});
if(!r.ok){const e=await r.json().catch(()=>({}));console.log('ERROR',r.status,String(e.error?.message).replaceAll(process.env.GEMINI_API_KEY,'***'));process.exit(1)}
let text='',finish,usage,buf='';const dec=new TextDecoder();
for await(const chunk of r.body){buf+=dec.decode(chunk,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!line.startsWith('data:'))continue;try{const j=JSON.parse(line.slice(5));text+=j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';finish=j.candidates?.[0]?.finishReason??finish;usage=j.usageMetadata??usage}catch{}}}
writeFileSync(`${dir}gemini/${out}.md`,text);
console.log('saved',out,text.length,'chars; finish:',finish,'tokens:',JSON.stringify(usage));
