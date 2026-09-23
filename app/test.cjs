const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const story=require('./story.js'),{createModel}=require('./model.js');
test('staged message contains only the unexpected incoming line and bounded waits',()=>{
 const cues=Object.values(story.nodes).filter(n=>n.staging);assert.equal(cues.length,4);
 for(const n of cues){assert.ok(n.staging.leadMs>=0);assert.ok(n.staging.holdMs>0);assert.ok(n.staging.leadMs+n.staging.holdMs<=3400);}
 const message=cues.find(n=>n.staging.focusPhone);assert.deepEqual(message.phone,[['陈屿','你出来了？']]);assert.equal(message.phoneTitle,'陈屿');
});
test('knocking signals have a clear onset, finite unclipped samples and a quiet tail; double text has two hits',()=>{
 const {synthesize,cues}=require('./knock.js');
 for(const rate of [44100,48000])for(const kind of ['wall','room','door','far']){const data=synthesize(kind,rate);let peak=0,tail=0;for(let i=0;i<data.length;i++){assert.ok(Number.isFinite(data[i]));peak=Math.max(peak,Math.abs(data[i]));if(i>data.length-rate*.1)tail=Math.max(tail,Math.abs(data[i]));}assert.ok(peak>.5&&peak<1);assert.ok(tail<.01);assert.equal(Math.abs(data.at(-1)),0);}
 for(const n of Object.values(story.nodes))if(n.text==='咚。咚。'||n.text==='上面，又响了两声。')assert.equal(cues[n.sound].count,2);
});
test('two-line black opening; both chapters terminate; every save restores scene and pressure',()=>{
 const m=createModel(story);assert.equal(m.presentation().scene,'black');m.next();assert.equal(m.presentation().scene,'black');m.next();assert.equal(m.presentation().scene,'bedroom-lit');m.reset();
 const seen=new Set(),chapters=new Set();
 while(true){const n=m.node();assert.ok(!seen.has(n.id),'cycle');seen.add(n.id);assert.ok(!n.choices);chapters.add(m.presentation().chapter);
 const restored=createModel(story);restored.restore(JSON.parse(JSON.stringify(m.snapshot())));assert.deepEqual(restored.presentation(),m.presentation());assert.deepEqual(restored.node(),m.node());
 if(n.end)break;assert.ok(m.next());}
 assert.equal(chapters.size,2);assert.equal(seen.size,Object.keys(story.nodes).length);assert.ok(!m.next());assert.ok(m.back());assert.ok(!m.node().end);
});
test('invalid, out of order and older release saves cannot corrupt progress',()=>{
 const m=createModel(story),before=m.snapshot();
 for(const data of [{...before,story:'huicheng-chapter1-v1'},{...before,path:[story.start,story.chapters[1].start]},{...before,version:99},{...before,path:[story.start,story.start]}]){assert.ok(!m.validate(data));assert.throws(()=>m.restore(data));assert.deepEqual(m.snapshot(),before);}
});
test('backtracking across a chapter boundary restores prior chapter and ambience',()=>{
 const m=createModel(story);let before;
 while(m.node().id!==story.chapters[1].start){before=m.snapshot();assert.ok(m.next());}
 assert.equal(m.presentation().chapter,story.chapters[1].title);m.back();assert.deepEqual(m.snapshot(),before);assert.equal(m.presentation().scene,'store');assert.equal(m.presentation().chapter,story.chapters[0].title);m.next();assert.equal(m.presentation().scene,'black');
});
test('all staged scenes and assets exist; cues are recognized; no author notes leak',()=>{
 const css=fs.readFileSync(path.join(__dirname,'chapter.css'),'utf8');
 const sounds=new Set(['message','switch','door','call','connect','knock-muted','knock-room','knock-door','double-door','double-far']);
 for(const n of Object.values(story.nodes)){
 if(n.scene)assert.ok(css.includes(`data-scene="${n.scene}"`),n.scene);
 if(n.sound)assert.ok(sounds.has(n.sound),n.sound);
 if(n.phone){assert.ok(n.phoneTitle);assert.ok(n.phone.every(p=>p.length===2&&p.every(s=>typeof s==='string')));}
 assert.doesNotMatch(n.text,/^@ |^# |\*\*|制作备注|哪一个我/);
 if(n.speaker)assert.ok(['张明远','陈屿','老唐','房东','李哲'].some(name=>n.speaker.startsWith(name)));
 }
 for(const match of css.matchAll(/url\('([^']+)'\)/g))assert.ok(fs.existsSync(path.join(__dirname,match[1])),match[1]);
});
