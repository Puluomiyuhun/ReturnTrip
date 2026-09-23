(function(root){
 'use strict';
 function createModel(story){
   let path=[story.start];
   const node=()=>story.nodes[path[path.length-1]];
   function choice(){
     for(let i=0;i<path.length-1;i++){
       const n=story.nodes[path[i]];
       const picked=n.choices?.find(c=>c.next===path[i+1]);
       if(picked)return picked.id;
     }
     return null;
   }
   function resolved(n=node()){
     const c=choice();
     return {...n,text:n.textByChoice?.[c] ?? n.text,sound:n.soundByChoice?.[c] ?? n.sound};
   }
   function presentation(){
     const state={scene:'black',backgroundScene:'black',backgroundCamera:'wide',place:'',time:'',ambience:'quiet',chapter:'第一章 · 明天见',pressure:0,camera:'wide',focus:'none',heldPhone:null,heldStatus:null};
     for(const id of path){
       const n=story.nodes[id];
       if(n.scene!=null||n.phone||n.phoneStatus||n.clearPhone){state.heldPhone=null;state.heldStatus=null;if(state.focus==='phone'||n.scene!=null)state.focus='none';}
       for(const key of ['scene','place','time','ambience','chapter','pressure','camera','focus'])if(n[key]!=null)state[key]=n[key];
       if(state.scene!=='black'){state.backgroundScene=state.scene;state.backgroundCamera=state.camera;}
       if(n.holdPhone&&n.phone)state.heldPhone={title:n.phoneTitle,lines:n.phone};
       if(n.holdPhone&&n.phoneStatus)state.heldStatus={title:n.phoneTitle,status:n.phoneStatus};
     }
     return state;
   }
   function migrate(data){
     // Chapters 1–3 are unchanged. Remove only the old, completed three-chapter endpoint.
     if(story.id==='huicheng-chapters-v08'&&data?.story==='huicheng-chapters-v07'&&data.version===1&&Array.isArray(data.path)){
       const legacy=[...data.path];
       if(legacy.at(-1)==='end'&&legacy.at(-2)==='c3-147')legacy.pop();
       if(legacy.every(id=>/^c[123]-\d{3}$/.test(id)))return {...data,story:story.id,path:legacy};
     }
     if(story.id==='huicheng-chapter1-v1' && story.start==='chapter1-intro-1' && data?.story===story.id && data.version===story.version && Array.isArray(data.path) && data.path[0]==='chapter1-000')return {...data,path:['chapter1-intro-1','chapter1-intro-2',...data.path]};
     return data;
   }
   function validate(data){
     data=migrate(data);
     if(!data || data.story!==story.id || data.version!==story.version || !Array.isArray(data.path) || data.path.length<1 || data.path.length>Object.keys(story.nodes).length || data.path[0]!==story.start)return false;
     for(let i=0;i<data.path.length;i++){
       const n=story.nodes[data.path[i]];
       if(!n)return false;
       if(i+1<data.path.length){const next=data.path[i+1];if(n.choices?!n.choices.some(c=>c.next===next):n.next!==next)return false;}
     }
     return true;
   }
   return {
     node,resolved,presentation,choice,validate,
     history:()=>path.map(id=>resolved(story.nodes[id])),
     next:()=>{const n=node();if(n.next){path.push(n.next);return true;}return false;},
     choose:(id)=>{const c=node().choices?.find(c=>c.id===id);if(!c)return false;path.push(c.next);return true;},
     back:()=>{if(path.length<=1)return false;path.pop();return true;},
     reset:()=>{path=[story.start];},
     snapshot:()=>({story:story.id,version:story.version,path:[...path]}),
     restore:(data)=>{if(!validate(data))throw new Error('存档不属于本试作，或内容已损坏。');path=[...migrate(data).path];}
   };
 }
 if(typeof module!=='undefined' && module.exports)module.exports={createModel};else root.HCModel={createModel};
})(typeof globalThis!=='undefined'?globalThis:this);
