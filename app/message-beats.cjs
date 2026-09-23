/* Stable inserted beats: preserve every original narrative ID for old saves. */
module.exports=function addMessageBeat(node,nodes){
 if(!node.noticeFirst)return;
 if(node.text==='……')throw new Error('An existing ellipsis does not need another beat: '+node.id);
 if(!node.phone&&!node.phoneStatus)throw new Error('Message beat requires a phone event: '+node.id);
 const id=node.id+'-notice';
 const notice={...node,id,text:'……',speaker:'',noticeFor:node.id};
 if(node.noticeCount)notice.phone=node.phone.slice(0,node.noticeCount);
 notice.staging=node.staging?{...node.staging,hideText:true}: {leadMs:0,holdMs:800};
 if(notice.staging.leadMs>0&&notice.sound)notice.staging.soundOnReveal=true;
 delete notice.noticeFirst;delete notice.noticeCount;
 nodes[id]=notice;node.noticeBefore=id;
 // The original paragraph follows only on a separate advance; no repeated notification.
 delete node.sound;delete node.staging;delete node.noticeFirst;delete node.noticeCount;
};
