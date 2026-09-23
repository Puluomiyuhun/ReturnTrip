/* Offline renderer. No network, analytics, external fonts or native privileges. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const voiceKey=name=>[['张明远','mingyuan'],['陈屿','chen'],['老唐','tang'],['房东','landlord'],['李哲','lizhe'],['录音中的声音','recording'],['门内的声音','recording'],['民警','police']].find(([who])=>(name||'').startsWith(who))?.[1]||'narrator';
 const story=window.HCStory, model=window.HCModel.createModel(story);
 const STORAGE='huicheng.chapters.v11.';
 const prefs={speed:32,size:30,volume:30,delay:3,mute:false,typeScale:3,staging:true};
 let staging=false,stageTimers=[],finishStage=null,textHeld=false;
 let mode='title',typing=null,autoTimer=null,auto=false,toastTimer=null,fullText='',typed=0,lastFocus=null;
 let storageWorking=true;
 function read(key){try{return JSON.parse(localStorage.getItem(STORAGE+key));}catch{return null;}}
 function write(key,value){try{localStorage.setItem(STORAGE+key,JSON.stringify(value));return true;}catch{storageWorking=false;toast('无法写入本地存档，请使用“导出当前进度”。');return false;}}
 const stored=read('preferences');
 if(stored){for(const key of ['speed','size','volume','delay'])if(Number.isFinite(stored[key]))prefs[key]=stored[key];prefs.mute=stored.mute===true;prefs.staging=stored.staging!==false;}
 // Upgrade the old, undersized typography while preserving relative preference.
 if(stored && stored.typeScale!==3 && Number.isFinite(stored.size))prefs.size=stored.size+8;
 prefs.speed=Math.max(0,Math.min(65,prefs.speed));prefs.size=Math.max(24,Math.min(40,prefs.size));prefs.volume=Math.max(0,Math.min(70,prefs.volume));prefs.delay=Math.max(1,Math.min(8,prefs.delay));
 function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
 const sound={ctx:null,master:null,rain:null,room:null,sources:[],ambience:'quiet',scene:'black',ducked:false,
   async init(){
     if(!this.ctx){try{
       this.ctx=new (window.AudioContext||window.webkitAudioContext)();
       this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
       this.environment=this.ctx.createGain();this.environment.connect(this.master);this.environment.gain.value=this.ducked?.055:1;
       const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*8,this.ctx.sampleRate);const d=buffer.getChannelData(0);let previous=0;
       for(let i=0;i<d.length;i++){previous=.94*previous+.06*(Math.random()*2-1);d[i]=previous;}
       const noise=this.ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
       this.rainFilter=this.ctx.createBiquadFilter();this.rainFilter.type='lowpass';this.rainFilter.frequency.value=1100;
       this.rainPan=this.ctx.createStereoPanner();this.rain=this.ctx.createGain();noise.connect(this.rainFilter);this.rainFilter.connect(this.rainPan);this.rainPan.connect(this.rain);this.rain.connect(this.environment);noise.start();
       // A steady refrigerator/ventilation bed makes the public spaces audibly distinct.
       const hum=this.ctx.createOscillator();hum.type='sine';hum.frequency.value=96;
       this.room=this.ctx.createGain();hum.connect(this.room);this.room.connect(this.environment);hum.start();
     }catch{toast('此设备未能启用声音，字幕仍可完整阅读。');return;}}
     await this.ctx.resume().catch(()=>{});this.level();this.setAmbience(this.ambience);
   },
   level(){if(this.master)this.master.gain.setTargetAtTime(prefs.mute||document.hidden||mode!=='game'?0:prefs.volume/100,this.ctx.currentTime,.06);$('sound').textContent=prefs.mute?'声音 关':'声音 开';$('sound').setAttribute('aria-label',prefs.mute?'开启声音':'关闭声音');},
   setAmbience(value,scene=this.scene){
     this.ambience=value;this.scene=scene;if(!this.ctx)return;
     const enclosed=['night','lamp','bedroom-lit','bedside'].includes(scene),now=this.ctx.currentTime;
     if(this.rain){this.rain.gain.setTargetAtTime(value==='quiet'?0:value==='rain'?(enclosed?.11:.19):.025,now,.65);this.rainFilter.frequency.setTargetAtTime(enclosed?460:1600,now,.7);this.rainPan.pan.setTargetAtTime(enclosed?.5:-.25,now,.7);}
     if(this.room)this.room.gain.setTargetAtTime(value==='store'?.018:value==='quiet'?0:.003,now,.7);
   },
   duck(value,release=.8){this.ducked=value;$('app').dataset.audioDucked=String(value);if(this.environment){const gain=this.environment.gain;gain.cancelScheduledValues(this.ctx.currentTime);gain.setTargetAtTime(value?.055:1,this.ctx.currentTime,value?.12:release);}},
   cancel({keepKnocks=false}={}){const kept=[];for(const source of this.sources){if(keepKnocks&&source.isKnock){kept.push(source);continue;}try{source.stop();}catch{}}this.sources=kept;},
   knock(cue){
     const spec=window.HCKnock.cues[cue];if(!spec)return false;
     this.knockBuffers??={};let buffer=this.knockBuffers[spec.kind];
     if(!buffer){const data=window.HCKnock.synthesize(spec.kind,this.ctx.sampleRate);buffer=this.ctx.createBuffer(1,data.length,this.ctx.sampleRate);buffer.copyToChannel(data,0);this.knockBuffers[spec.kind]=buffer;}
     for(let i=0;i<spec.count;i++){
       const source=this.ctx.createBufferSource(),pan=this.ctx.createStereoPanner(),amp=this.ctx.createGain();source.buffer=buffer;source.isKnock=true;
       pan.pan.value=spec.pan;amp.gain.value=window.HCKnock.playbackGain*(i===0?1:.9);source.connect(amp);amp.connect(pan);pan.connect(this.master);
       source.start(this.ctx.currentTime+i*.48);this.sources.push(source);
       source.onended=()=>{source.disconnect();amp.disconnect();pan.disconnect();this.sources=this.sources.filter(s=>s!==source);};
     }
     return true;
   },
   tone(freq,when,length,gain,pan=0,type='sine'){
     if(!this.ctx)return;const start=this.ctx.currentTime+when;
     const osc=this.ctx.createOscillator(),amp=this.ctx.createGain(),panner=this.ctx.createStereoPanner();
     osc.type=type;osc.frequency.setValueAtTime(freq,start);osc.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.48),start+length);
     amp.gain.setValueAtTime(.0001,start);amp.gain.exponentialRampToValueAtTime(gain,start+.008);amp.gain.exponentialRampToValueAtTime(.0001,start+length);
     panner.pan.value=pan;osc.connect(amp);amp.connect(panner);panner.connect(this.master);osc.start(start);osc.stop(start+length+.01);this.sources.push(osc);
     osc.onended=()=>{osc.disconnect();amp.disconnect();panner.disconnect();this.sources=this.sources.filter(s=>s!==osc);};
   },
   play(cue){this.cancel({keepKnocks:true});if(!cue||cue==='none'||!this.ctx)return;
     if(this.knock(cue))return;
     if(cue==='switch'){this.tone(950,0,.025,.025,0,'triangle');return;}
     if(cue==='door'){this.tone(310,0,.3,.014,.25,'triangle');return;}
     if(cue==='call'){this.tone(440,0,.55,.035);this.tone(480,.65,.4,.025);return;}
     if(cue==='connect'){this.tone(630,0,.09,.035);return;}
     if(cue==='message'){this.tone(820,0,.18,.06);this.tone(1100,.13,.2,.04);return;}
     if(cue==='message-close'){this.tone(155,0,.13,.038,0,'triangle');this.tone(155,.17,.12,.032,0,'triangle');this.tone(820,.06,.13,.035);return;}
     const far=cue==='double-far',near=cue==='double-near';const pan=far?.7:-.6;
     this.tone(near?190:140,0,.18,far?.2:.32,pan,'sine');
     this.tone(620,0,.045,far?.02:.05,pan,'triangle');
     if(cue.startsWith('double')){this.tone(near?190:140,.48,.18,far?.2:.32,pan);this.tone(620,.48,.045,far?.02:.05,pan,'triangle');}
   }
 };
 function applyPrefs(){document.documentElement.style.setProperty('--font',prefs.size+'px');sound.level();}
 applyPrefs();
 function clearTimers(){clearInterval(typing);typing=null;clearTimeout(autoTimer);autoTimer=null;for(const timer of stageTimers)clearTimeout(timer);stageTimers=[];staging=false;finishStage=null;textHeld=false;$('app').dataset.stage='';$('app').dataset.effect='';$('app').dataset.phoneFocus='false';$('dialogue').removeAttribute('aria-busy');}
 function startText(instant=false){
   textHeld=false;
   if(instant||prefs.speed===0||matchMedia('(prefers-reduced-motion: reduce)').matches)completeText();
   else typing=setInterval(()=>{typed++;$('text').textContent=fullText.slice(0,typed);if(typed>=fullText.length)completeText();},prefs.speed);
 }
 function stageBeat(n,p){
   if(!n.staging||!prefs.staging)return;
   const cue=n.staging,hasPhone=!!(n.phone||n.phoneStatus);staging=true;clearTimeout(autoTimer);
   $('dialogue').setAttribute('aria-busy','true');$('advance-mark').textContent='';$('app').dataset.stage='waiting';
   if(cue.duck)sound.duck(true);
   if(hasPhone&&cue.leadMs>0)$('phone').hidden=true;
   let revealed=false;
   const reveal=(silent=false)=>{
     if(revealed)return;revealed=true;
     if(hasPhone)$('phone').hidden=false;$('app').dataset.stage='revealed';$('app').dataset.phoneFocus=String(!!cue.focusPhone||p.focus==='phone');
     if(!silent&&cue.soundOnReveal)sound.play(n.sound);
     if(!silent&&cue.effect)$('app').dataset.effect=cue.effect;
     if(textHeld)startText(silent);
   };
   finishStage=({silent=false}={})=>{for(const timer of stageTimers)clearTimeout(timer);stageTimers=[];reveal(silent);staging=false;finishStage=null;$('dialogue').removeAttribute('aria-busy');$('app').dataset.stage='done';sound.duck(p.focus==='phone');if(!typing){$('advance-mark').textContent='›';scheduleAuto();}};
   if(cue.leadMs>0)stageTimers.push(setTimeout(()=>reveal(),cue.leadMs));else reveal();
   stageTimers.push(setTimeout(()=>finishStage?.(),cue.leadMs+cue.holdMs));
 }
 function setAuto(value){auto=value;$('auto').textContent=value?'自动 开':'自动 关';$('auto').setAttribute('aria-pressed',String(value));clearTimeout(autoTimer);if(value&&!typing)scheduleAuto();}
 function scheduleAuto(){clearTimeout(autoTimer);const messageLength=(model.node().phone||[]).reduce((sum,line)=>sum+line[1].length,0);if(!staging&&auto&&mode==='game'&&!$('panel').open&&!model.node().choices)autoTimer=setTimeout(advance,Math.max(prefs.delay*1000,(fullText.length+messageLength)*90));}
 function saveAuto(){write('auto',{...model.snapshot(),savedAt:Date.now()});updateContinue();}
 function updateContinue(){const data=read('auto');$('continue').disabled=!model.validate(data);}
 function setMode(next){mode=next;$('title-screen').hidden=next!=='title';$('game-screen').hidden=next!=='game';$('ending').hidden=next!=='end';sound.level();}
 function showTitle(){$('app').dataset.intro='false';$('app').dataset.focus='none';clearTimers();sound.duck(false);setAuto(false);sound.cancel();setMode('title');paintScene({scene:'bedroom-lit',backgroundScene:'bedroom-lit',backgroundCamera:'wide'},{instant:true});$('chapter').textContent='第一章 · 明天见';updateContinue();$('start').focus();}
 function completeText(){clearInterval(typing);typing=null;typed=fullText.length;$('text').textContent=fullText;$('advance-mark').textContent=model.node().choices||staging?'':'›';$('reading-hint').textContent='';showChoices();scheduleAuto();}
 function showChoices(){const choices=model.node().choices;if(!choices||typing){$('choices').hidden=true;return;}setAuto(false);$('choices').replaceChildren();for(const c of choices){const b=document.createElement('button');b.textContent=c.label;b.addEventListener('click',()=>{sound.init();if(model.choose(c.id)){render();$('dialogue').focus();}});$('choices').append(b);}$('choices').hidden=false;}
 function paintScene(p,{instant=false,blackout=p.scene==='black'}={}){
   const el=$('scenery');
   if(blackout&&!instant&&el.dataset.blackout!=='true'){
     const style=getComputedStyle(el);el.style.filter=style.filter;el.style.transform=style.transform;
   }else if(!blackout||instant){el.style.filter='';el.style.transform='';}
   el.style.transition=instant?'none':blackout?'opacity 1.2s ease':'';
   el.dataset.scene=p.backgroundScene;el.dataset.camera=p.backgroundCamera;el.dataset.blackout=String(blackout);
 }
 function render({instant=false,quiet=false}={}){
   clearTimers();sound.cancel({keepKnocks:!quiet});const n=model.resolved(),p=model.presentation(),timed=!!(!instant&&!quiet&&prefs.staging&&n.staging);$('app').dataset.intro=String(p.scene==='black');$('app').dataset.pressure=String(p.pressure);$('app').dataset.focus=p.focus;$('app').dataset.phoneFocus=String(p.focus==='phone'&&!timed);sound.duck(p.focus==='phone');
   if(n.end){sound.cancel();setAuto(false);setMode('end');paintScene(p,{instant:instant||quiet,blackout:true});saveAuto();$('ending').querySelector('small').textContent=storageWorking?'本次阅读已保存在自动存档中':'本地存档不可用，可返回回看后导出进度';$('replay').focus();return;}
   setMode('game');paintScene(p,{instant:instant||quiet});$('place').textContent=p.place;$('time').textContent=p.time;$('chapter').textContent=p.chapter;sound.setAmbience(p.ambience,p.scene);
   $('chapter-card').hidden=!n.card;if(n.card){$('card-kicker').textContent=n.card[0];$('card-title').textContent=n.card[1];$('card-subtitle').textContent=n.card[2];}
   const phone=n.phone||p.heldPhone?.lines;
   $('app').dataset.phoneCarry=String(!n.phone&&!!p.heldPhone);
   const phoneStatus=n.phoneStatus||p.heldStatus?.status;
   $('dialogue').dataset.voice=voiceKey(n.speaker);$('phone').dataset.voice=voiceKey(n.phoneTitle||p.heldPhone?.title||p.heldStatus?.title);
   $('speaker').textContent=n.speaker||'';$('speaker').hidden=!n.speaker;$('phone').hidden=!(phone||phoneStatus);$('phone').querySelector('b').textContent=n.phoneTitle||p.heldPhone?.title||p.heldStatus?.title||'陈屿';$('dialogue').classList.toggle('sound-beat',!!n.beat);$('phone-lines').replaceChildren();
   if(phoneStatus){const status=document.createElement('div');status.className='call-status';status.textContent=phoneStatus;$('phone-lines').append(status);}
   if(phone){for(const [speaker,text]of phone){const bubble=document.createElement('div');bubble.className='bubble'+(speaker==='我'?' me':'');bubble.textContent=text;$('phone-lines').append(bubble);}$('phone').scrollTop=0;}
   if(n.evidence)button('查看记录',()=>showEvidence(n.evidence),$('phone-lines')).className='evidence-button';
   $('choices').hidden=true;$('back').disabled=model.snapshot().path.length===1;
   fullText=n.text||'';typed=0;$('text').textContent='';$('advance-mark').textContent='';$('reading-hint').textContent='轻点画面，显示整句';
   if(!quiet&&!(timed&&n.staging.soundOnReveal))sound.play(n.sound);
   textHeld=!!(timed&&n.staging.hideText);
   if(!textHeld)startText(instant);
   if(timed)stageBeat(n,p);
   saveAuto();
 }
 async function start(){if($('panel').open)$('panel').close();setAuto(false);model.reset();setMode('game');await sound.init();render();$('dialogue').focus();}
 function advance(){if(mode!=='game'||$('panel').open)return;if(staging){if(typing)completeText();return;}if(typing){completeText();return;}if(model.next())render();}
 function back(){if(mode!=='game'||$('panel').open)return;setAuto(false);if(model.back())render({instant:true,quiet:true});}
 function loadData(data){try{model.restore(data);$('panel').close();setAuto(false);setMode('game');sound.init();render({instant:true,quiet:true});$('dialogue').focus();}catch(e){toast(e.message);}}
 function openPanel(title,kicker='HUI CHENG'){
   setAuto(false);finishStage?.({silent:true});if(typing)completeText();sound.cancel();lastFocus=document.activeElement;$('panel-title').textContent=title;$('panel-kicker').textContent=kicker;$('panel-body').replaceChildren();
   if(!$('panel').open)$('panel').showModal();$('close-panel').focus();return $('panel-body');
 }
 function button(label,action,parent){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',action);parent.append(b);return b;}
 function paragraph(text,parent,cls='muted'){const p=document.createElement('p');p.className=cls;p.textContent=text;parent.append(p);return p;}
 function showEvidence(evidence){const body=openPanel(evidence.title,'留存记录');const img=document.createElement('img');img.className='evidence-image';img.src=evidence.src;img.alt=evidence.alt;body.append(img);paragraph(evidence.alt,body);}
 function history(){
   const body=openPanel('回看','MEMORIES / 已经读过的文字');
   paragraph('这里保留本次已读的对白与手机消息。',body);
   for(const n of model.history()){
     if(n.end)continue;const row=document.createElement('article');row.className='log-entry';row.dataset.voice=voiceKey(n.speaker||n.phoneTitle);if(n.speaker){const who=document.createElement('small');who.textContent=n.speaker;row.append(who);}const unreadLines=n.phone?.slice(n.noticeBefore?story.nodes[n.noticeBefore].phone?.length||0:0);if(unreadLines?.length){const label=document.createElement('small');label.textContent='与'+(n.phoneTitle||'陈屿')+'的消息';row.append(label);for(const [who,words] of unreadLines)paragraph(who+'：'+words,row,'log-message');}if(n.phoneStatus&&!n.noticeBefore)paragraph((n.phoneTitle||'陈屿')+' · '+n.phoneStatus,row,'log-message');paragraph(n.text,row,'');if(n.evidence)button('查看记录',()=>showEvidence(n.evidence),row);body.append(row);
   }
   requestAnimationFrame(()=>$('panel').scrollTop=$('panel').scrollHeight);
 }
 function settings(){
   const body=openPanel('阅读设置','SETTINGS');
   const fields=[['speed','逐字间隔',0,65,'毫秒'],['size','文字大小',24,40,'px'],['volume','总音量',0,70,'%'],['delay','自动等待',1,8,'秒']];
   for(const [key,label,min,max,unit]of fields){
     const row=document.createElement('label');row.className='setting-row';const labelText=document.createElement('span');labelText.textContent=label;row.append(labelText);
     const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.value=prefs[key];range.setAttribute('aria-label',label);row.append(range);
     const out=document.createElement('output');out.textContent=prefs[key]+unit;row.append(out);body.append(row);
     range.addEventListener('input',()=>{prefs[key]=Number(range.value);out.textContent=prefs[key]+unit;applyPrefs();write('preferences',prefs);});
   }
   const stageButton=button('演出停顿：'+(prefs.staging?'开':'关'),()=>{prefs.staging=!prefs.staging;stageButton.textContent='演出停顿：'+(prefs.staging?'开':'关');stageButton.setAttribute('aria-pressed',String(prefs.staging));write('preferences',prefs);},body);stageButton.id='stage-toggle';stageButton.setAttribute('aria-pressed',String(prefs.staging));
   paragraph('演出停顿用于关键敲击和消息，最长 3.9 秒。部分片刻会先留白，再同步出现声音和文字；期间不能提前揭示或跳过。回退、读档不重复等待，可在上方关闭。',body);
   paragraph('逐字间隔设为 0 可立即显示全文。自动阅读会在选择处停止；打开面板或切到其他窗口时也会停止。',body);
   paragraph('空格 / Enter：推进　←：上一句　H：回看　A：自动　S：保存　L：读取　Esc：设置 / 关闭面板　F11：全屏',body);
   paragraph('声音包含合成雨声、室内低鸣、敲击与电话提示；当前没有配音或背景音乐。所有关键信息都有文字提示。',body);
 }
 function confirmAction(title,message,action,cancelAction){const body=openPanel(title);const box=document.createElement('div');box.className='confirm-box';paragraph(message,box,'');button('确认',action,box);button('取消',cancelAction||(()=>$('panel').close()),box);body.append(box);}
 function slots(saveMode){
   const body=openPanel(saveMode?'保存进度':'读取进度',saveMode?'SAVE / 不会改变已经发生的事':'LOAD / 回到你停下的地方');
   const keys=saveMode?['slot1','slot2','slot3']:['auto','slot1','slot2','slot3'];
   for(const key of keys){
     const raw=read(key),data=model.validate(raw)?raw:null;const row=document.createElement('div');row.className='slot';const info=document.createElement('div');info.className='slot-info';const heading=document.createElement('b');heading.textContent=key==='auto'?'自动存档':'存档 '+key.slice(-1);info.append(heading);
     if(data){const savedModel=window.HCModel.createModel(story);savedModel.restore(data);paragraph(savedModel.resolved().text,info,'');const date=document.createElement('small');date.textContent=new Date(data.savedAt||0).toLocaleString('zh-CN');info.append(date);}else paragraph(raw?'存档不可用':'尚无记录',info,'');row.append(info);
     if(saveMode){button(data?'覆盖保存':'保存',()=>{const commit=()=>{if(write(key,{...model.snapshot(),savedAt:Date.now()})){slots(true);toast('已保存到存档 '+key.slice(-1));}};if(data)confirmAction('覆盖存档','这会替换此槽位的旧进度，其他存档不变。',commit,()=>slots(true));else commit();},row);}else button('读取',()=>loadData(data),row).disabled=!data;
     body.append(row);
   }
   const actions=document.createElement('div');actions.className='panel-actions';
   button('导出当前进度',()=>{
     const data={...model.snapshot(),savedAt:Date.now()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='回程-进度.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   },actions);
   button('导入进度文件',()=>$('import-file').click(),actions);body.append(actions);paragraph('自动存档随阅读更新。手动槽位独立保留；进度文件仅包含本游戏的阅读节点。',body);
 }
 $('import-file').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>100000){toast('文件过大，不是有效的进度文件。');return;}try{const data=JSON.parse(await file.text());if(!model.validate(data))throw new Error();loadData(data);toast('已导入进度');}catch{toast('无法读取：文件不是本试作的有效进度。');}});
 $('start').onclick=()=>{const old=read('auto');if(model.validate(old))confirmAction('开始新的阅读','开始后会更新自动存档，手动存档仍会保留。',start);else start();};
 $('continue').onclick=()=>loadData(read('auto'));
 $('chapter5-preview').onclick=async()=>{const begin=async()=>{if($('panel').open)$('panel').close();setAuto(false);model.reset();while(model.node().id!==story.chapters[4].start&&model.next()){}setMode('game');await sound.init();render({instant:true,quiet:true});$('dialogue').focus();};if(model.validate(read('auto')))confirmAction('试读第五章','将从第五章开始并更新本版自动进度，手动存档仍保留。',begin);else await begin();};
 $('title-load').onclick=()=>slots(false);$('title-settings').onclick=settings;
 // One delegated handler: controls never fall through to story advancement.
 let pointerStart=null;
 $('app').addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
 $('app').addEventListener('click',event=>{
   const moved=pointerStart && Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>9;
   pointerStart=null;
   if(event.button!==0 || event.defaultPrevented || mode!=='game' || $('panel').open)return;
   if(event.detail>0 && moved)return;
   if(event.target.closest('button,a,input,select,textarea,dialog,#choices,[data-no-advance]'))return;
   setAuto(false);sound.init();advance();
   if(mode==='game')$('dialogue').focus({preventScroll:true});
 });
 $('app').addEventListener('selectstart',event=>event.preventDefault());
 $('app').addEventListener('dragstart',event=>event.preventDefault());
 $('back').onclick=back;
 $('history').onclick=history;$('end-history').onclick=history;
 $('auto').onclick=()=>setAuto(!auto);$('save').onclick=()=>slots(true);$('load').onclick=()=>slots(false);$('settings').onclick=settings;
 $('home').onclick=()=>{saveAuto();showTitle();};$('replay').onclick=start;$('end-title').onclick=showTitle;
 $('close-panel').onclick=()=>$('panel').close();$('panel').addEventListener('close',()=>{lastFocus?.focus?.();});
 $('sound').onclick=()=>{prefs.mute=!prefs.mute;write('preferences',prefs);sound.init();applyPrefs();};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('可以使用 F11 切换全屏。');}};
 document.addEventListener('fullscreenchange',()=>$('fullscreen').textContent=document.fullscreenElement?'退出全屏':'全屏');
 document.addEventListener('keydown',e=>{
   if(e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
   if($('panel').open)return;
   if(e.key==='Escape'){e.preventDefault();settings();return;}
   if(mode!=='game')return;
   const control=e.target.closest?.('button,input,select');
   if((e.key===' '||e.key==='Enter')&&!control){e.preventDefault();sound.init();advance();}
   else if(e.key==='ArrowLeft'){e.preventDefault();back();}
   else if(e.key.toLowerCase()==='h')history();else if(e.key.toLowerCase()==='a')setAuto(!auto);
   else if(e.key.toLowerCase()==='s')slots(true);else if(e.key.toLowerCase()==='l')slots(false);
 });
 function settleOnLeave(){setAuto(false);finishStage?.({silent:true});sound.cancel();$('app').dataset.effect='';}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)settleOnLeave();sound.level();});
 window.addEventListener('blur',settleOnLeave);
 window.addEventListener('beforeunload',()=>{if(mode!=='title')saveAuto();});
 showTitle();
})();
