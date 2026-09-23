/* Real Electron renderer acceptance test. Runs only with --qa-test, isolated saves. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function(win){
 const output=path.resolve(process.cwd(),'work/qa-v09');fs.mkdirSync(output,{recursive:true});
 const wc=win.webContents,errors=[];wc.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
 const js=code=>wc.executeJavaScript(code,true);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 // A hidden Windows surface may return its previous frame on the first capture.
 const capture=async(name)=>{await wc.capturePage();await pause(150);await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');fs.writeFileSync(path.join(output,name+'.png'),(await wc.capturePage()).toPNG());};
 await js(`localStorage.setItem('huicheng.chapters.v09.preferences',JSON.stringify({speed:0,size:30,volume:30,delay:3,mute:false,typeScale:3,staging:false}));`);
 const loaded=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await loaded;
 await capture('title-five-chapters');
 await js(`document.getElementById('chapter5-preview').click()`);await pause(200);
 assert.equal(await js(`JSON.parse(localStorage.getItem('huicheng.chapters.v09.auto')).path.at(-1)`),'c5-001');
 await js(`localStorage.removeItem('huicheng.chapters.v09.auto')`);
 const fresh=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await fresh;
 await js(`localStorage.removeItem('huicheng.chapters.v09.auto')`);
 await js(`document.getElementById('start').click()`);await pause(200);
 await js(`window.qaKnockEvents=[];const originalStart=AudioBufferSourceNode.prototype.start,originalStop=AudioBufferSourceNode.prototype.stop;AudioBufferSourceNode.prototype.start=function(...args){if(this.isKnock)qaKnockEvents.push({type:'start',length:this.buffer.length,at:args[0]});return originalStart.apply(this,args)};AudioBufferSourceNode.prototype.stop=function(...args){if(this.isKnock)qaKnockEvents.push({type:'stop',node:JSON.parse(localStorage.getItem('huicheng.chapters.v09.auto'))?.path.at(-1)});return originalStop.apply(this,args)};void 0;`);
 const checked=await js(`(async()=>{
   const $=id=>document.getElementById(id),story=HCStory;const issues=[];
   const snap=()=>JSON.parse(localStorage.getItem('huicheng.chapters.v09.auto'));
   const first=snap();if(!first)throw new Error('Start did not create save');
   let count=0;
   while(count++<1000){const data=snap(),n=story.nodes[data.path.at(-1)];if(n.end)break;
     if($('text').textContent!==n.text)issues.push('text '+n.id);
     if($('speaker').textContent!==(n.speaker||''))issues.push('speaker '+n.id);
     if($('chapter').textContent!==n.chapter)issues.push('chapter '+n.id);
     if(n.phone&&($('phone').hidden||$('phone').querySelector('b').textContent!==n.phoneTitle))issues.push('phone '+n.id);
     const reading=HCModel.createModel(story);reading.restore(data);const presentation=reading.presentation();
     if(presentation.heldPhone&&($('phone').hidden||!$('phone-lines').textContent.includes(presentation.heldPhone.lines[0][1])))issues.push('held phone '+n.id);
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
 const knockEvents=await js('qaKnockEvents');assert.equal(knockEvents.filter(e=>e.type==='start').length,13);assert.ok(knockEvents.filter(e=>e.type==='start').every(e=>e.length>30000));
 // Fast forward through ordinary narration must not stop scheduled impacts.
 assert.ok(knockEvents.filter(e=>e.type==='stop').every(e=>e.node===Object.values(require('./story.js').nodes).filter(n=>!n.end).at(-1).id));
 await js(`window.qaGoto=(id)=>{const path=[];let n=HCStory.nodes[HCStory.start];while(n){path.push(n.id);if(n.id===id)break;n=HCStory.nodes[n.next];}localStorage.setItem('huicheng.chapters.v09.auto',JSON.stringify({story:HCStory.id,version:HCStory.version,path,savedAt:Date.now()}));document.getElementById('end-title').click();document.getElementById('continue').click();};void 0;`);
 const evidence=await js(`Object.values(HCStory.nodes).find(n=>n.evidence).id`);
 await js(`qaGoto(${JSON.stringify(evidence)});document.querySelector('.evidence-button').click()`);
 await js(`document.querySelector('.evidence-image').decode().then(()=>true)`);
 assert.equal(await js(`document.getElementById('panel').open&&document.querySelector('.evidence-image').naturalWidth>0`),true);await capture('chapter4-photo');
 await js(`document.getElementById('scenery').click()`);
 assert.equal(await js(`JSON.parse(localStorage.getItem('huicheng.chapters.v09.auto')).path.at(-1)`),evidence);
 await js(`document.getElementById('close-panel').click();document.getElementById('history').click();document.querySelector('#panel-body .log-entry button').click()`);
 assert.equal(await js(`!!document.querySelector('.evidence-image')`),true);await js(`document.getElementById('close-panel').click()`);
 await require('./blackout-qa.cjs')({js,pause,capture});
 for(const [scene,id] of Object.entries(await js(`Object.fromEntries(['store','restaurant','hallway','living-day','hallway-open'].map(s=>[s,Object.values(HCStory.nodes).find(n=>n.scene===s).id]))`))){
   await js(`qaGoto(${JSON.stringify(id)})`);await pause(2300);await capture(scene);
 }
 const interaction=await js(`(()=>{const $=id=>document.getElementById(id),snap=()=>JSON.parse(localStorage.getItem('huicheng.chapters.v09.auto'));const issues=[];
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
 const compact=await js(`(()=>{const $=id=>document.getElementById(id);$('settings').click();const slider=document.querySelector('[aria-label="文字大小"]');slider.value=40;slider.dispatchEvent(new Event('input'));$('close-panel').click();qaGoto(HCStory.start);const problems=[];let count=0;while(count++<1000){const data=JSON.parse(localStorage.getItem('huicheng.chapters.v09.auto')),n=HCStory.nodes[data.path.at(-1)];if(n.end)break;const t=$('text').getBoundingClientRect(),d=$('dialogue').getBoundingClientRect();if(t.bottom>d.bottom||d.top<135||d.bottom>innerHeight)problems.push(n.id);$('scenery').click();}return problems;})()`);
 assert.deepEqual(compact,[]);
 await js(`document.getElementById('home').click()`);
 assert.equal(await js(`document.querySelector('.prototype').getBoundingClientRect().bottom<=innerHeight`),true);
 await capture('compact-title');
 const mute=await js(`(()=>{const m=HCModel.createModel(HCStory),all=[];while(!m.node().end){if(m.presentation().heldStatus)all.push(m.node());m.next();}return all.sort((a,b)=>b.text.length-a.text.length)[0].id;})()`);
 await js(`qaGoto(${JSON.stringify(mute)})`);
 assert.equal(await js(`!document.getElementById('phone').hidden&&document.getElementById('phone-lines').textContent.includes('麦克风已关闭')`),true);
 assert.equal(await js(`document.getElementById('dialogue').getBoundingClientRect().top-document.getElementById('phone').getBoundingClientRect().bottom>=8`),true);
 await capture('chapter4-muted');
 const fifthClip=await js(`Object.values(HCStory.nodes).find(n=>n.id.startsWith('c5-')&&n.text==='我不知道是不是进人了。').id`);
 await js(`qaGoto(${JSON.stringify(fifthClip)})`);await capture('chapter5-recognition');
 const fifthMessage=await js(`Object.values(HCStory.nodes).find(n=>n.id.startsWith('c5-')&&n.phone?.some(p=>p[1]==='现在没声音了')).id`);
 await js(`qaGoto(${JSON.stringify(fifthMessage)})`);await capture('chapter5-message');
 assert.equal(await js(`(()=>{const phone=document.getElementById('phone'),bubble=phone.querySelector('.bubble');return bubble.textContent==='现在没声音了'&&bubble.getBoundingClientRect().bottom<=phone.getBoundingClientRect().bottom;})()`),true);
 const reaction=await js(`(()=>{const m=HCModel.createModel(HCStory),found=[];while(!m.node().end){if(m.presentation().heldPhone&&!m.node().phone)found.push(m.node());m.next();}return found.sort((a,b)=>b.text.length-a.text.length)[0].id;})()`);
 await js(`qaGoto(${JSON.stringify(reaction)})`);
 const held=await js(`(()=>{const phone=document.getElementById('phone'),dialogue=document.getElementById('dialogue');return {shown:!phone.hidden,gap:dialogue.getBoundingClientRect().top-phone.getBoundingClientRect().bottom,focus:document.getElementById('app').dataset.focus};})()`);
 assert.equal(held.shown,true);assert.equal(held.focus,'phone');assert.ok(held.gap>=8,JSON.stringify(held));await pause(1500);await capture('chapter1-held-message');
 const phoneKnock=await js(`Object.values(HCStory.nodes).find(n=>n.sound==='knock-phone').id`);
 await js(`qaGoto(${JSON.stringify(phoneKnock)})`);await pause(500);await capture('chapter3-phone-knock');
 const chapter3=await js('HCStory.chapters[2].start');await js(`qaGoto(${JSON.stringify(chapter3)})`);await pause(1700);await capture('chapter3-card');
 const finalPhone=await js(`Object.values(HCStory.nodes).find(n=>n.phone?.some(p=>p[1]==='我在你家门口。')).id`);await js(`qaGoto(${JSON.stringify(finalPhone)})`);await pause(1000);await capture('compact-phone');
 console.log('Phone audit: '+JSON.stringify(await js(`(()=>{const e=document.getElementById('phone'),s=getComputedStyle(e);return {hidden:e.hidden,display:s.display,opacity:s.opacity,rect:e.getBoundingClientRect().toJSON(),text:e.textContent,animations:e.getAnimations().map(a=>({time:a.currentTime,state:a.playState})),visibility:document.visibilityState}})()`)));
 await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
 await capture('compact-phone');
 // Test the real timed scene, with auto on and instant text. Clicking must not skip it.
 const staged=await js(`(()=>{const all=Object.values(HCStory.nodes),index=all.findIndex(n=>n.staging?.focusPhone);return {id:all[index].id,previous:all[index-1].id};})()`);
 await js(`qaGoto(${JSON.stringify(staged.previous)});document.getElementById('settings').click();document.getElementById('stage-toggle').click();document.getElementById('close-panel').click();document.getElementById('auto').click();document.getElementById('dialogue').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));`);
 const stageState=()=>js(`({id:JSON.parse(localStorage.getItem('huicheng.chapters.v09.auto')).path.at(-1),hidden:document.getElementById('phone').hidden,busy:document.getElementById('dialogue').getAttribute('aria-busy'),phase:document.getElementById('app').dataset.stage})`);
 let state=await stageState();assert.equal(state.id,staged.id);assert.equal(state.hidden,true);assert.equal(state.busy,'true');
 await js(`document.getElementById('dialogue').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}))`);assert.equal((await stageState()).id,staged.id);
 await pause(1700);state=await stageState();assert.equal(state.hidden,false);assert.equal(state.busy,'true');
 await pause(2400);state=await stageState();assert.equal(state.id,staged.id);assert.equal(state.busy,null);
 // Capture on a separate run so GPU capture latency cannot consume the auto delay.
 await js(`document.getElementById('auto').click();qaGoto(${JSON.stringify(staged.previous)});document.getElementById('scenery').click();`);
 await pause(1700);await capture('staged-message');
 // Back during the second run cancels all pending callbacks, even after their due time.
 await js(`document.getElementById('back').click();document.getElementById('scenery').click();document.getElementById('back').click();`);
 await pause(4100);state=await stageState();assert.equal(state.id,staged.previous);assert.equal(state.phase,'');assert.equal(state.busy,null);
 // Restoring at the cue shows the message immediately without replaying its wait.
 await js(`qaGoto(${JSON.stringify(staged.id)})`);state=await stageState();assert.equal(state.hidden,false);assert.equal(state.busy,null);
 // The correction message must land before any interpretation, with a separate ellipsis beat.
 const correction=await js(`(()=>{const all=Object.values(HCStory.nodes),i=all.findIndex(n=>n.phone?.some(p=>p[1]==='发错了。'));return {id:all[i].id,previous:all[i-1].id,next:all[i+1].id};})()`);
 await js(`qaGoto(${JSON.stringify(correction.previous)});document.getElementById('scenery').click();`);
 assert.equal(await js(`document.getElementById('text').textContent`),'');
 await pause(850);
 assert.equal(await js(`document.getElementById('text').textContent`),'……');assert.equal((await stageState()).hidden,false);
 await js(`document.getElementById('scenery').click()`);assert.equal((await stageState()).id,correction.id);
 await pause(1300);await capture('correction-pause');
 await js(`document.getElementById('scenery').click()`);assert.equal((await stageState()).id,correction.next);
 assert.ok((await js(`document.getElementById('text').textContent`)).startsWith('我把肩膀'));
 // The close impact must wait for its lead-in, and clicks cannot leak its subtitle.
 const impact=await js(`(()=>{const all=Object.values(HCStory.nodes),index=all.findIndex(n=>n.sound==='knock-room'&&n.staging?.soundOnReveal);return {id:all[index].id,previous:all[index-1].id,lead:all[index].staging.leadMs};})()`);
 await js(`qaGoto(${JSON.stringify(impact.previous)})`);
 const startCount=await js(`qaKnockEvents.filter(e=>e.type==='start').length`);
 await js(`document.getElementById('scenery').click();document.getElementById('scenery').click();document.getElementById('dialogue').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));`);
 const beforeImpact=await js(`({text:document.getElementById('text').textContent,count:qaKnockEvents.filter(e=>e.type==='start').length,duck:document.getElementById('app').dataset.audioDucked})`);
 assert.equal(beforeImpact.text,'');assert.equal(beforeImpact.count,startCount);assert.equal(beforeImpact.duck,'false');
 await pause(impact.lead+150);
 const afterImpact=await js(`({text:document.getElementById('text').textContent,count:qaKnockEvents.filter(e=>e.type==='start').length,effect:document.getElementById('app').dataset.effect})`);
 assert.equal(afterImpact.text,'咚。');assert.equal(afterImpact.count,startCount+1);assert.equal(afterImpact.effect,'');await capture('chapter1-close-impact');
 // Back, a modal, and leaving the app each cancel delayed audio independently.
 for(const cancel of ['back','modal','blur']){
  await js(`qaGoto(${JSON.stringify(impact.previous)});document.getElementById('scenery').click();`);
  const count=await js(`qaKnockEvents.filter(e=>e.type==='start').length`);
  await js(cancel==='back'?`document.getElementById('back').click()` : cancel==='modal'?`document.getElementById('settings').click()` : `window.dispatchEvent(new Event('blur'))`);
  await pause(impact.lead+150);assert.equal(await js(`qaKnockEvents.filter(e=>e.type==='start').length`),count,cancel+' leaked delayed knock');
  if(cancel==='modal')await js(`document.getElementById('close-panel').click()`);
 }
 await js(`qaGoto(${JSON.stringify(impact.previous)});document.getElementById('settings').click();document.getElementById('stage-toggle').click();document.getElementById('close-panel').click();document.getElementById('scenery').click();`);
 assert.equal(await js(`document.getElementById('text').textContent`),'咚。');assert.equal((await stageState()).busy,null);
 const typing=await js(`(async()=>{const $=id=>document.getElementById(id);$('settings').click();const slider=document.querySelector('[aria-label="逐字间隔"]');slider.value=65;slider.dispatchEvent(new Event('input'));$('close-panel').click();qaGoto(HCStory.start);$('scenery').click();const snap=()=>JSON.parse(localStorage.getItem('huicheng.chapters.v09.auto'));const id=snap().path.at(-1);$('scenery').click();if(snap().path.at(-1)!==id||$('text').textContent!==HCStory.nodes[id].text)return false;$('scenery').click();return snap().path.at(-1)!==id;})()`);assert.equal(typing,true);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({status:'passed',nodes:checked.count,resolutions:['1440x900 window','860x640 content'],fontSizes:[30,40],checks:['full traversal','chapter header','narrator and dialogue names','phone recipient','history includes messages','background click','space','back','manual save/load','modal isolation','non-selectable text','hidden reading hint','compact bounds','typewriter completion','delayed message reveal','hold blocks click and auto','back cancels staged timers','loading bypasses previously read pause','held phone restores and clears','held phone does not overlap long narration','delayed impact and subtitle reveal','knock preserves ambience without recoil','back modal and blur cancel delayed audio','disabled staging shows subtitle immediately'],rendererErrors:errors},null,2));
 console.log('QA passed: '+checked.count+' nodes, 2 resolutions, saves and interactions. Screenshots: '+output);
};
