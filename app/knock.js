/* Deterministic impact synthesis: short contact noise, inharmonic panel modes,
   low-pass transmission and early room reflections. No pitched downward sweep. */
(function(root){
 function synthesize(kind='wall',rate=44100){
   const presets={wall:{cut:780,decay:.095,modes:[137,229,367,541],gain:.78},room:{cut:1900,decay:.12,modes:[137,229,367,541],gain:.9},door:{cut:2500,decay:.15,modes:[109,183,313,487],gain:.86},far:{cut:650,decay:.10,modes:[109,183,313,487],gain:.56}};
   const p=presets[kind];if(!p)throw new Error('Unknown impact '+kind);
   const dry=new Float32Array(Math.ceil(rate*.72)),out=new Float32Array(dry.length);
   let seed=71391,low=0,slow=0;const alpha=1-Math.exp(-2*Math.PI*p.cut/rate);
   for(let i=0;i<dry.length;i++){
     const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
     const attack=1-Math.exp(-t/.0012);
     const contact=noise*(.7*Math.exp(-t/.007)+.17*Math.exp(-t/.033));
     let body=0;for(let j=0;j<p.modes.length;j++)body+=Math.sin(2*Math.PI*p.modes[j]*t+.23*j)*Math.exp(-t/(p.decay/(1+.6*j)))*(.6/(1+j));
     low+=alpha*((body+contact)*attack-low);slow+=.003*(low-slow);dry[i]=low-slow;
   }
   const taps=[[0,1],[.027,.12],[.061,.075],[.113,.035]];
   for(const [delay,gain]of taps){const d=Math.round(delay*rate);for(let i=d;i<out.length;i++)out[i]+=dry[i-d]*gain;}
   let peak=0;for(const x of out)peak=Math.max(peak,Math.abs(x));
   for(let i=0;i<out.length;i++)out[i]=out[i]/peak*p.gain*Math.min(1,(out.length-1-i)/(rate*.02));
   return out;
 }
 const cues={'knock-muted':{kind:'wall',pan:.22,count:1},'knock-room':{kind:'room',pan:.4,count:1},'knock-door':{kind:'door',pan:.12,count:1},'double-door':{kind:'door',pan:.12,count:2},'double-far':{kind:'far',pan:.28,count:2}};
 const api={synthesize,cues};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HCKnock=api;
})(typeof globalThis!=='undefined'?globalThis:this);
