/* Real Electron renderer acceptance test. Runs only with --qa-test, isolated saves. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function(win){
 const output=path.resolve(process.cwd(),'work/qa-v06');fs.mkdirSync(output,{recursive:true});
 const wc=win.webContents,errors=[];wc.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
 const js=code=>wc.executeJavaScript(code,true);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 await js(`localStorage.setItem('huicheng.chapters.v06.preferences',JSON.stringify({speed:0,size:30,volume:30,delay:3,mute:false,typeScale:3,staging:false}));`);
 const loaded=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await loaded;
 await js(`document.getElementById('start').click()`);await pause(200);
 await js(`window.qaKnockEvents=[];const originalStart=AudioBufferSourceNode.prototype.start,originalStop=AudioBufferSourceNode.prototype.stop;AudioBufferSourceNode.prototype.start=function(...args){if(this.isKnock)qaKnockEvents.push({type:'start',length:this.buffer.length,at:args[0]});return originalStart.apply(this,args)};AudioBufferSourceNode.prototype.stop=function(...args){if(this.isKnock)qaKnockEvents.push({type:'stop',node:JSON.parse(localStorage.getItem('huicheng.chapters.v06.auto'))?.path.at(-1)});return originalStop.apply(this,args)};void 0;`);
 const checked=await js(`(async()=>{
   const $=id=>document.getElementById(id),story=HCStory;const issues=[];
   const snap=()=>JSON.parse(localStorage.getItem('huicheng.chapters.v06.auto'));
   const first=snap();if(!first)throw new Error('Start did not create save');
   let count=0;
   while(count++<1000){const data=snap(),n=story.nodes[data.path.at(-1)];if(n.end)break;
     if($('text').textContent!==n.text)issues.push('text '+n.id);
     if($('speaker').textContent!==(n.speaker||''))issues.push('speaker '+n.id);
     if($('chapter').textContent!==n.chapter)issues.push('chapter '+n.id);
     if(n.phone&&($('phone').hidden||$('phone').querySelector('b').textContent!==n.phoneTitle))issues.push('phone '+n.id);
     const t=$('text').getBoundingClientRect(),d=$('dialogue').getBoundingClientRect();
     if(t.bottom>d.bottom||t.right>d.right||d.bottom>innerHeight)issues.push('overflow '+n.id);
     $('scenery').click();
   }
   if($('ending').hidden)issues.push('No ending');
   $('end-history').click();
   if(!$('panel-body').textContent.includes('你出来了？')||!$('panel-body').textContent.includes('陈屿'))issues.push('Missing messages in history');
   $('close-panel').click();
   return {count,issues};
 })()`);
 assert.deepEqual(checked.issues,[]);assert.ok(checked.count>200);
 const knockEvents=await js('qaKnockEvents');assert.equal(knockEvents.filter(e=>e.type==='start').length,11);assert.ok(knockEvents.filter(e=>e.type==='start').every(e=>e.length>30000));
 // Fast forward through ordinary narration must not stop scheduled impacts.
 assert.ok(knockEvents.filter(e=>e.type==='stop').every(e=>e.node===Object.values(require('./story.js').nodes).filter(n=>!n.end).at(-1).id));
 await js(`window.qaGoto=(id)=>{const path=[];let n=HCStory.nodes[HCStory.start];while(n){path.push(n.id);if(n.id===id)break;n=HCStory.nodes[n.next];}localStorage.setItem('huicheng.chapters.v06.auto',JSON.stringify({story:HCStory.id,version:HCStory.version,path,savedAt:Date.now()}));document.getElementById('end-title').click();document.getElementById('continue').click();};void 0;`);
 for(const [scene,id] of Object.entries(await js(`Object.fromEntries(['store','restaurant','hallway','living-day'].map(s=>[s,Object.values(HCStory.nodes).find(n=>n.scene===s).id]))`))){
   await js(`qaGoto(${JSON.stringify(id)})`);await pause(2300);fs.writeFileSync(path.join(output,scene+'.png'),(await wc.capturePage()).toPNG());
 }
 const interaction=await js(`(()=>{const $=id=>document.getElementById(id),snap=()=>JSON.parse(localStorage.getItem('huicheng.chapters.v06.auto'));const issues=[];
   const before=snap().path.length;$('scenery').click();if(snap().path.length!==before+1)issues.push('background click');
   $('dialogue').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));if(snap().path.length!==before+2)issues.push('space');
   $('back').click();if(snap().path.length!==before+1)issues.push('back');
   $('save').click();$('panel-body').querySelector('.slot button').click();$('close-panel').click();const saved=snap().path.at(-1);$('scenery').click();$('load').click();$('panel-body').querySelectorAll('.slot button')[1].click();if(snap().path.at(-1)!==saved)issues.push('manual load');
   $('settings').click();const index=snap().path.length;$('scenery').click();if(snap().path.length!==index)issues.push('modal click');$('close-panel').click();
   if(getComputedStyle($('text')).userSelect!=='none')issues.push('text selection');
   if(getComputedStyle($('reading-hint')).display!=='none')issues.push('reading hint');
   return issues;
 })()`);assert.deepEqual(interaction,[]);
 win.setContentSize(860,640);await pause(200);
 const compact=await js(`(()=>{const $=id=>document.getElementById(id);$('settings').click();const slider=document.querySelector('[aria-label="文字大小"]');slider.value=40;slider.dispatchEvent(new Event('input'));$('close-panel').click();qaGoto(HCStory.start);const problems=[];let count=0;while(count++<1000){const data=JSON.parse(localStorage.getItem('huicheng.chapters.v06.auto')),n=HCStory.nodes[data.path.at(-1)];if(n.end)break;const t=$('text').getBoundingClientRect(),d=$('dialogue').getBoundingClientRect();if(t.bottom>d.bottom||d.top<135||d.bottom>innerHeight)problems.push(n.id);$('scenery').click();}return problems;})()`);
 assert.deepEqual(compact,[]);
 const finalPhone=await js(`Object.values(HCStory.nodes).find(n=>n.phone?.some(p=>p[1]==='我在你家门口。')).id`);await js(`qaGoto(${JSON.stringify(finalPhone)})`);await pause(1000);fs.writeFileSync(path.join(output,'compact-phone.png'),(await wc.capturePage()).toPNG());
 console.log('Phone audit: '+JSON.stringify(await js(`(()=>{const e=document.getElementById('phone'),s=getComputedStyle(e);return {hidden:e.hidden,display:s.display,opacity:s.opacity,rect:e.getBoundingClientRect().toJSON(),text:e.textContent,animations:e.getAnimations().map(a=>({time:a.currentTime,state:a.playState})),visibility:document.visibilityState}})()`)));
 await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
 fs.writeFileSync(path.join(output,'compact-phone.png'),(await wc.capturePage()).toPNG());
 // Test the real timed scene, with auto on and instant text. Clicking must not skip it.
 const staged=await js(`(()=>{const all=Object.values(HCStory.nodes),index=all.findIndex(n=>n.staging?.focusPhone);return {id:all[index].id,previous:all[index-1].id};})()`);
 await js(`qaGoto(${JSON.stringify(staged.previous)});document.getElementById('settings').click();document.getElementById('stage-toggle').click();document.getElementById('close-panel').click();document.getElementById('auto').click();document.getElementById('dialogue').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));`);
 const stageState=()=>js(`({id:JSON.parse(localStorage.getItem('huicheng.chapters.v06.auto')).path.at(-1),hidden:document.getElementById('phone').hidden,busy:document.getElementById('dialogue').getAttribute('aria-busy'),phase:document.getElementById('app').dataset.stage})`);
 let state=await stageState();assert.equal(state.id,staged.id);assert.equal(state.hidden,true);assert.equal(state.busy,'true');
 await js(`document.getElementById('dialogue').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}))`);assert.equal((await stageState()).id,staged.id);
 await pause(1700);state=await stageState();assert.equal(state.hidden,false);assert.equal(state.busy,'true');
 await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
 fs.writeFileSync(path.join(output,'staged-message.png'),(await wc.capturePage()).toPNG());
 await pause(1900);state=await stageState();assert.equal(state.id,staged.id);assert.equal(state.busy,null);
 // Back during the second run cancels all pending callbacks, even after their due time.
 await js(`document.getElementById('back').click();document.getElementById('scenery').click();document.getElementById('back').click();`);
 await pause(3600);state=await stageState();assert.equal(state.id,staged.previous);assert.equal(state.phase,'');assert.equal(state.busy,null);
 // Restoring at the cue shows the message immediately without replaying its wait.
 await js(`qaGoto(${JSON.stringify(staged.id)})`);state=await stageState();assert.equal(state.hidden,false);assert.equal(state.busy,null);
 const typing=await js(`(async()=>{const $=id=>document.getElementById(id);$('settings').click();const slider=document.querySelector('[aria-label="逐字间隔"]');slider.value=65;slider.dispatchEvent(new Event('input'));$('close-panel').click();qaGoto(HCStory.start);$('scenery').click();const snap=()=>JSON.parse(localStorage.getItem('huicheng.chapters.v06.auto'));const id=snap().path.at(-1);$('scenery').click();if(snap().path.at(-1)!==id||$('text').textContent!==HCStory.nodes[id].text)return false;$('scenery').click();return snap().path.at(-1)!==id;})()`);assert.equal(typing,true);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({status:'passed',nodes:checked.count,resolutions:['1440x900 window','860x640 content'],fontSizes:[30,40],checks:['full traversal','chapter header','narrator and dialogue names','phone recipient','history includes messages','background click','space','back','manual save/load','modal isolation','non-selectable text','hidden reading hint','compact bounds','typewriter completion','delayed message reveal','hold blocks click and auto','back cancels staged timers','loading bypasses previously read pause'],rendererErrors:errors},null,2));
 console.log('QA passed: '+checked.count+' nodes, 2 resolutions, saves and interactions. Screenshots: '+output);
};
