const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const story=require('./story.js'),{createModel}=require('./model.js');
test('staged message contains only the unexpected incoming line and bounded waits',()=>{
 const cues=Object.values(story.nodes).filter(n=>n.staging);assert.ok(cues.length>=4);
 for(const n of cues){assert.ok(n.staging.leadMs>=0);assert.ok(n.staging.holdMs>0);assert.ok(n.staging.leadMs+n.staging.holdMs<=3900);if(n.staging.soundOnReveal){assert.ok(n.sound);assert.ok(n.staging.hideText);}}
 const message=cues.find(n=>n.staging.focusPhone);assert.deepEqual(message.phone,[['陈屿','你出来了？']]);assert.equal(message.phoneTitle,'陈屿');
});
test('knocking signals have a clear onset, finite unclipped samples and a quiet tail; double text has two hits',()=>{
 const {synthesize,cues}=require('./knock.js');
 for(const rate of [44100,48000])for(const kind of ['wall','room','door','far','phone']){const data=synthesize(kind,rate);let peak=0,tail=0;for(let i=0;i<data.length;i++){assert.ok(Number.isFinite(data[i]));peak=Math.max(peak,Math.abs(data[i]));if(i>data.length-rate*.1)tail=Math.max(tail,Math.abs(data[i]));}assert.ok(peak>.5&&peak<1);assert.ok(tail<.01);assert.equal(Math.abs(data.at(-1)),0);}
 for(const n of Object.values(story.nodes))if(n.text==='咚。咚。'||n.text==='上面，又响了两声。')assert.equal(cues[n.sound].count,2);
});
test('two-line black opening; three chapters terminate; every save restores scene and pressure',()=>{
 const m=createModel(story);assert.equal(m.presentation().scene,'black');m.next();assert.equal(m.presentation().scene,'black');m.next();assert.equal(m.presentation().scene,'bedroom-lit');m.reset();
 const seen=new Set(),chapters=new Set();
 while(true){const n=m.node();assert.ok(!seen.has(n.id),'cycle');seen.add(n.id);assert.ok(!n.choices);chapters.add(m.presentation().chapter);
 const restored=createModel(story);restored.restore(JSON.parse(JSON.stringify(m.snapshot())));assert.deepEqual(restored.presentation(),m.presentation());assert.deepEqual(restored.node(),m.node());
 if(n.end)break;assert.ok(m.next());}
 assert.equal(chapters.size,3);assert.equal(seen.size,Object.keys(story.nodes).length);assert.ok(!m.next());assert.ok(m.back());assert.ok(!m.node().end);
});
test('invalid, out of order and older release saves cannot corrupt progress',()=>{
 const m=createModel(story),before=m.snapshot();
 for(const data of [{...before,story:'huicheng-chapter1-v1'},{...before,story:'huicheng-chapters-v06'},{...before,path:[story.start,story.chapters[1].start]},{...before,version:99},{...before,path:[story.start,story.start]}]){assert.ok(!m.validate(data));assert.throws(()=>m.restore(data));assert.deepEqual(m.snapshot(),before);}
});
test('backtracking across each chapter boundary restores prior scene and ambience',()=>{
 for(let i=1;i<story.chapters.length;i++){
 const m=createModel(story);let before,presentation;
 while(m.node().id!==story.chapters[i].start){before=m.snapshot();presentation=m.presentation();assert.ok(m.next());}
 assert.equal(m.presentation().chapter,story.chapters[i].title);m.back();assert.deepEqual(m.snapshot(),before);assert.deepEqual(m.presentation(),presentation);assert.equal(m.presentation().chapter,story.chapters[i-1].title);m.next();assert.equal(m.presentation().scene,'black');
 }
});
test('all staged scenes and assets exist; cues are recognized; no author notes leak',()=>{
 const css=fs.readFileSync(path.join(__dirname,'chapter.css'),'utf8');
 const sounds=new Set(['message','message-close','switch','door','call','connect','knock-muted','knock-room','knock-door','double-door','double-far','knock-phone']);
 for(const n of Object.values(story.nodes)){
 if(n.scene)assert.ok(css.includes(`data-scene="${n.scene}"`),n.scene);
 if(n.sound)assert.ok(sounds.has(n.sound),n.sound);
 if(n.phone){assert.ok(n.phoneTitle);assert.ok(n.phone.every(p=>p.length===2&&p.every(s=>typeof s==='string')));}
 assert.doesNotMatch(n.text,/^@ |^# |\*\*|制作备注|哪一个我/);
 if(n.speaker)assert.ok(['张明远','陈屿','老唐','房东','李哲'].some(name=>n.speaker.startsWith(name)));
 }
 for(const match of css.matchAll(/url\('([^']+)'\)/g))assert.ok(fs.existsSync(path.join(__dirname,match[1])),match[1]);
});

test('the unsettling message survives reaction nodes, restores, and clears at the reply',()=>{
 const m=createModel(story);
 while(!m.node().holdPhone||m.node().noticeFor)assert.ok(m.next());
 assert.equal(m.presentation().focus,'phone');assert.deepEqual(m.presentation().heldPhone.lines,[['陈屿','你出来了？']]);
 let reactions=0;
 while(true){const before=m.snapshot();m.next();if(m.node().phone){assert.equal(m.presentation().heldPhone,null);assert.equal(m.presentation().focus,'door');m.back();assert.deepEqual(m.snapshot(),before);assert.ok(m.presentation().heldPhone);break;}
  const restored=createModel(story);restored.restore(m.snapshot());assert.equal(restored.presentation().focus,'phone');assert.deepEqual(restored.presentation().heldPhone,m.presentation().heldPhone);assert.ok(!m.node().phone);reactions++;
 }
 assert.ok(reactions>=5);
 const {cues}=require('./knock.js');assert.ok(cues['knock-muted'].pan>0);assert.ok(cues['knock-room'].pan<0);
});

test('chapter three phone impacts keep the physically open door and restore without stale state',()=>{
 const m=createModel(story),heard=[];
 while(!m.node().end){
  if(m.node().sound==='knock-phone'){
   assert.equal(m.presentation().scene,'hallway-open');assert.equal(m.presentation().ambience,'quiet');
   assert.equal(m.presentation().chapter,story.chapters[2].title);
   const restored=createModel(story);restored.restore(m.snapshot());assert.deepEqual(restored.presentation(),m.presentation());
   assert.ok(restored.back());assert.ok(restored.next());assert.equal(restored.node().sound,'knock-phone');heard.push(m.node().id);
  }
  m.next();
 }
 assert.equal(heard.length,2);assert.equal(m.presentation().scene,'hallway-open');
 const {cues,synthesize}=require('./knock.js');assert.equal(cues['knock-phone'].pan,0);assert.equal(cues['knock-phone'].count,1);
 assert.notDeepEqual(synthesize('phone'),synthesize('door'));
});

test('blackouts retain the preceding image and camera on forward, restore and back',()=>{
 const m=createModel(story);let image='black',camera='wide',count=0;
 while(!m.node().end){const p=m.presentation();if(p.scene!=='black'){image=p.scene;camera=p.camera;}else count++;
 assert.equal(p.backgroundScene,image);assert.equal(p.backgroundCamera,camera);
 const restored=createModel(story);restored.restore(m.snapshot());assert.deepEqual(restored.presentation(),p);
 const before=m.snapshot();if(m.next()){m.back();assert.deepEqual(m.snapshot(),before);assert.deepEqual(m.presentation(),p);m.next();}}
 assert.ok(count>5);
});
test('incoming messages have a separate beat and old same-version saves retain position',()=>{
 const m=createModel(story),old=Object.values(story.nodes).filter(n=>!n.noticeFor).map(n=>n.id);
 for(let i=1;i<=old.length;i++){m.restore({story:story.id,version:story.version,path:old.slice(0,i)});assert.equal(m.node().id,old[i-1]);}
 for(const n of Object.values(story.nodes).filter(n=>n.noticeFor)){
 assert.equal(n.text,'……');assert.equal(n.speaker,'');assert.equal(n.next,n.noticeFor);assert.equal(story.nodes[n.next].noticeBefore,n.id);assert.ok(!story.nodes[n.next].sound&&!story.nodes[n.next].staging);
 }
});