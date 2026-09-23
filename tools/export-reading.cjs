/* Export chapter reading copies without runtime stage directives. */
const fs=require('node:fs'),path=require('node:path');
const story=require('../app/story.js');
const output=path.resolve(process.argv[2]||path.join(__dirname,'../work/reading'));
fs.mkdirSync(output,{recursive:true});
const chapters=story.chapters.map(chapter=>{
 const lines=['# '+chapter.title,''];
 const nodes=Object.values(story.nodes).filter(n=>n.chapter===chapter.title);
 for(const n of nodes){
  const unreadLines=n.phone?.slice(n.noticeBefore?story.nodes[n.noticeBefore].phone?.length||0:0);
  if(unreadLines?.length)lines.push(`> 手机消息 · ${n.phoneTitle}`,...unreadLines.map(([who,text])=>`> ${who}：${text}  `),'');
  if(n.evidence)lines.push('> 照片内容：'+n.evidence.alt,'');
  if(n.phoneStatus&&!n.noticeBefore)lines.push(`> ${n.phoneTitle} · ${n.phoneStatus}`,'');
  lines.push(n.speaker?`**${n.speaker}**：${n.text}`:n.text,'');
 }
 const result=lines.join('\n');
 for(const n of nodes)if(!result.includes(n.text))throw new Error('Missing '+n.id);
 return result;
});
fs.writeFileSync(path.join(output,'回程_0.11_前五章阅读稿.md'),'# 回程 0.11 前五章阅读稿\n\n公交卡与身份线重写稿。省略演出参数；新旧剧情不混读。\n\n'+chapters.join('\n\n'));
fs.writeFileSync(path.join(output,'回程_第五章_照片里的位置.md'),chapters[4]);
console.log('Exported five chapters; all narrative text verified.');
