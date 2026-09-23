const assert=require('node:assert/strict');
module.exports=async({js,capture,pause})=>{
 const beats=await js(`Object.values(HCStory.nodes).filter(n=>n.noticeFor).map(n=>({id:n.id,next:n.next,phone:n.phone,status:n.phoneStatus}))`);
 for(const beat of beats){
  await js(`qaGoto(${JSON.stringify(beat.id)})`);
  assert.equal(await js(`document.getElementById('text').textContent`),'……',beat.id);
  assert.equal(await js(`document.getElementById('speaker').hidden`),true);
  assert.equal(await js(`document.getElementById('phone').hidden`),false);
  await js(`document.getElementById('scenery').click()`);
  assert.equal(await js(`document.getElementById('text').textContent`),await js(`HCStory.nodes[${JSON.stringify(beat.next)}].text`));
 }
 // Ordinary incoming messages block accidental double advances, too.
 const previous=await js(`Object.values(HCStory.nodes).find(n=>n.next==='c2-061-notice').id`);
 await js(`qaGoto(${JSON.stringify(previous)});document.getElementById('settings').click();document.getElementById('stage-toggle').click();document.getElementById('close-panel').click();document.getElementById('scenery').click();document.getElementById('scenery').click();`);
 assert.equal(await js(`document.getElementById('text').textContent`),'……');
 assert.equal(await js(`document.getElementById('dialogue').getAttribute('aria-busy')`),'true');
 await pause(950);await js(`document.getElementById('scenery').click()`);
 assert.equal(await js(`document.getElementById('text').textContent`),await js(`HCStory.nodes['c2-061'].text`));
 await js(`document.getElementById('settings').click();document.getElementById('stage-toggle').click();document.getElementById('close-panel').click();`);
 // This is the reported two-message scene; both lines must fit without scrolling.
 await js(`qaGoto('c2-061-notice')`);
 const bounds=await js(`(()=>{const p=document.getElementById('phone'),b=p.querySelectorAll('.bubble');return {text:[...b].map(x=>x.textContent),bottom:b[b.length-1].getBoundingClientRect().bottom,box:p.getBoundingClientRect().bottom};})()`);
 assert.deepEqual(bounds.text,['里面有声音。','有人叫我。']);assert.ok(bounds.bottom<=bounds.box);
 await capture('message-before-reaction');
 await js(`document.getElementById('scenery').click()`);await capture('message-reaction');
 const voices=await js(`(()=>{const out={};for(const n of Object.values(HCStory.nodes)){if(n.speaker&&!out[n.speaker.split(' · ')[0]])out[n.speaker.split(' · ')[0]]=n.id;}return out;})()`);
 const colors=new Set();
 for(const [name,id]of Object.entries(voices)){
  await js(`qaGoto(${JSON.stringify(id)})`);
  assert.equal(await js(`document.getElementById('speaker').textContent`),await js(`HCStory.nodes[${JSON.stringify(id)}].speaker`));
  colors.add(await js(`getComputedStyle(document.getElementById('speaker')).color`));
  if(['张明远','陈屿','录音中的声音'].includes(name))await capture('speaker-'+name);
 }
 assert.equal(colors.size,Object.keys(voices).length,'speaker accents should differ');
 await js(`qaGoto(HCStory.start)`);assert.equal(await js(`document.getElementById('dialogue').dataset.voice`),'narrator');
};
