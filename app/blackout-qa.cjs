/* Verify actual CSS image selection throughout every scripted blackout. */
const assert=require('node:assert/strict');
module.exports=async({js,pause,capture})=>{
 const transitions=await js(`(()=>{const all=Object.values(HCStory.nodes);return all.flatMap((n,i)=>n.scene==='black'&&i>0?[{id:n.id,previous:all[i-1].id,text:n.text}]:[]);})()`);
 for(const cue of transitions){
  await js(`qaGoto(${JSON.stringify(cue.previous)})`);
  const before=await js(`getComputedStyle(document.getElementById('scenery')).backgroundImage`);
  await js(`document.getElementById('scenery').click()`);
  await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
  assert.equal(await js(`getComputedStyle(document.getElementById('scenery')).backgroundImage`),before,cue.id+' changed image before fade');
  await pause(160);
  assert.equal(await js(`getComputedStyle(document.getElementById('scenery')).backgroundImage`),before,cue.id+' changed image during fade');
  if(cue.text.startsWith('我沿着楼梯'))await capture('hallway-fading');
  await pause(1100);
  await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
  assert.equal(await js(`Number(getComputedStyle(document.getElementById('scenery')).opacity)`),0,cue.id+' is not black '+JSON.stringify(await js(`({data:{...document.getElementById('scenery').dataset},animations:document.getElementById('scenery').getAnimations().map(a=>({time:a.currentTime,state:a.playState}))})`)));
  await js(`qaGoto(${JSON.stringify(cue.id)})`);
  assert.equal(await js(`Number(getComputedStyle(document.getElementById('scenery')).opacity)`),0,cue.id+' restore flashes');
 }
 await js(`qaGoto(HCStory.start)`);
 assert.equal(await js(`getComputedStyle(document.getElementById('scenery')).backgroundImage`),'none');
 await capture('opening-black');
 return transitions.length;
};
