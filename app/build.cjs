/* Compile the editable manuscript and its explicit stage cues into a linear story. */
const fs=require('node:fs'),path=require('node:path');
const source=fs.existsSync(path.resolve(__dirname,'../story'))?path.resolve(__dirname,'../story'):path.resolve(__dirname,'../回程-前两章-v0.6剧本');
const files=['第一章-明天见.md','第二章-等一会儿.md','第三章-门开着.md','第四章-先别挂.md'];
const nodes={},chapters=[];
for(const [i,file] of files.entries()){
 const blocks=fs.readFileSync(path.join(source,file),'utf8').trim().split(/\r?\n\s*\r?\n/);
 let pending={},chapter='',count=0;
 for(let block of blocks){
   if(block.startsWith('# ')){chapter=block.slice(2);chapters.push({title:chapter,start:`c${i+1}-001`});continue;}
   const lines=block.split(/\r?\n/);while(lines[0]?.startsWith('@ ')){Object.assign(pending,JSON.parse(lines.shift().slice(2)));}
   block=lines.join('\n').trim();if(!block)continue;
   const spoken=block.match(/^\*\*(.+?)\*\*：([\s\S]+)$/);
   const id=`c${i+1}-${String(++count).padStart(3,'0')}`;
   const n={id,chapter,speaker:spoken?spoken[1]:'',text:spoken?spoken[2]:block,intro:false,...pending};
   if(count===1){n.chapter=chapter;n.pressure??=0;n.camera??='wide';}
   if(n.scene==='black')n.intro=true;
   // Black transitional sequences keep the blackout until a scene change.
   nodes[id]=n;pending={};
 }
}
const ids=Object.keys(nodes);ids.forEach((id,i)=>nodes[id].next=ids[i+1]||'end');
nodes.end={id:'end',end:true,text:'前四章 · 完'};
const story={id:'huicheng-chapters-v08',version:1,title:'回程',start:ids[0],chapters,nodes};
fs.writeFileSync(path.join(__dirname,'story.js'),`(function(root){const story=${JSON.stringify(story,null,2)};if(typeof module!=='undefined'&&module.exports)module.exports=story;else root.HCStory=story;})(typeof globalThis!=='undefined'?globalThis:this);\n`);
console.log(JSON.stringify({chapters:chapters.length,nodes:ids.length,characters:Object.values(nodes).reduce((s,n)=>s+n.text.length+(n.phone||[]).reduce((a,p)=>a+p[1].length,0),0)},null,2));
