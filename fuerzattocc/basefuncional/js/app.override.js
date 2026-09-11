// Override to safely rebind tPersonal rowDblClick to populatePersonalModal
document.addEventListener('DOMContentLoaded', function(){
  try{
    // If tables are initialized later, try again after a short delay
    const ensureRebind = () => {
      if(typeof tPersonal!=='undefined' && tPersonal && typeof tPersonal.on==='function'){
        tPersonal.on('rowDblClick', function(e,row){
          const d = row.getData();
          if(typeof populatePersonalModal === 'function'){
            try{ populatePersonalModal(d); }catch(err){ console.error('populatePersonalModal error:', err); }
          } else {
            console.warn('populatePersonalModal not defined');
          }
        });
        return true;
      }
      return false;
    };

    if(!ensureRebind()){
      // try a few times in case initialization is async
      let attempts = 0;
      const id = setInterval(()=>{
        attempts++;
        if(ensureRebind() || attempts>10) clearInterval(id);
      }, 200);
    }
  }catch(err){console.warn('app.override.js failed to bind:', err);} 
});
