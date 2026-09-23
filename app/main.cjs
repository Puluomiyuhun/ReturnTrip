const { app, BrowserWindow, Menu, session } = require('electron');
const path = require('node:path');
const smoke=process.argv.includes('--smoke-test');
const qa=process.argv.includes('--qa-test');
app.setName('HuichengChapters08');
if(qa)app.setPath('userData',path.join(app.getPath('temp'),'huicheng-qa-'+process.pid));
// A stable userData name keeps saves across future prototype builds.
const single = app.requestSingleInstanceLock();
let win;
if (!single) app.quit();
else {
 app.on('second-instance', () => { if(win){if(win.isMinimized())win.restore();win.focus();} });
 app.whenReady().then(() => {
   Menu.setApplicationMenu(null);
   session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
   session.defaultSession.setPermissionCheckHandler(()=>false);
   session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,cb)=>cb({cancel:true}));
   win = new BrowserWindow({width:1440,height:900,minWidth:860,minHeight:640,show:false,title:'回程 · 前四章',backgroundColor:'#10171d',autoHideMenuBar:true,icon:path.join(__dirname,'assets','icon.png'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,devTools:false,backgroundThrottling:!qa}});
   win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   win.webContents.on('will-navigate',event=>event.preventDefault());
   win.webContents.on('before-input-event',(event,input)=>{if(input.key==='F11' && input.type==='keyDown'){win.setFullScreen(!win.isFullScreen());event.preventDefault();}});
   win.once('ready-to-show',()=>{if(!smoke&&!qa)win.show();});
   if(qa)win.webContents.once('did-finish-load',async()=>{try{await require('./qa.cjs')(win);app.exit(0);}catch(e){console.error(e.stack);app.exit(1);}});
   if(smoke){
     const timeout=setTimeout(()=>{console.error('Chapter smoke timeout');app.exit(1);},15000);
     win.webContents.once('did-fail-load',()=>{clearTimeout(timeout);app.exit(1);});
     win.webContents.once('did-finish-load',()=>{clearTimeout(timeout);console.log('Chapter smoke passed: '+win.webContents.getTitle());app.exit(0);});
   }
   win.loadFile(path.join(__dirname,'index.html'));
 });
 app.on('window-all-closed',()=>app.quit());
}
