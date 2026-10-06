/* Same origin and shortcut path: reload preserves the desk's device storage. */
const COMMAND_CENTER_VERSION='2026.10.06.2';
let COMMAND_CENTER_LATEST=COMMAND_CENTER_VERSION;
function commandCenterReloadUrl(version=COMMAND_CENTER_LATEST){
  const url=new URL(location.href);url.searchParams.set('release',version);url.searchParams.set('_reload',Date.now());return url.href;
}
function setupCommandCenter(){
  $('app-version').textContent='Version '+COMMAND_CENTER_VERSION+' · Updates';
  $('check-update').addEventListener('click',async()=>{
    const button=$('check-update');button.disabled=true;
    try{
      const response=await fetch('version.json?check='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw new Error('version');
      const manifest=await response.json();
      if(!/^[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]+$/.test(manifest.version))throw new Error('version');
      COMMAND_CENTER_LATEST=manifest.version;
      const newer=COMMAND_CENTER_LATEST!==COMMAND_CENTER_VERSION;
      $('update-status').textContent=newer?`Version ${COMMAND_CENTER_LATEST} is available. Reload to open it.`:`You have the current version (${COMMAND_CENTER_VERSION}).`;
      $('reload-app').textContent=newer?'Reload update':'Reload app';
    }catch(err){$('update-status').textContent='Could not check for updates. Your app and drafts are still available.';}
    finally{button.disabled=false;}
  });
  $('reload-app').addEventListener('click',()=>{
    if(ACTIVE_WRITES||flushing){$('update-status').textContent='A save is still running. Reload when it finishes.';return;}
    location.replace(commandCenterReloadUrl());
  });
}
