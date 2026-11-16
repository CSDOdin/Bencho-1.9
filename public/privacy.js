(() => {
  'use strict';
  const key='bencho19-privacy-choice', version=1, duration=180*86400000;
  const read=(storage,k)=>{try{return JSON.parse(storage.getItem(k));}catch{return null;}};
  let panel, opener;
  function close(){panel?.remove();panel=null;opener?.focus({preventScroll:true});}
  function show(focus=false){
    if(panel){if(focus){opener=document.activeElement;panel.querySelector('button').focus({preventScroll:true});}return;}
    opener=focus?document.activeElement:null;
    panel=document.createElement('section');panel.className='cookie-notice';panel.setAttribute('aria-label','Cookies y privacidad');
    panel.innerHTML='<div><h2>Tu privacidad, clara.</h2><p>Guardamos tu carrito y las preferencias necesarias. Sin publicidad ni analítica. <a href="/cookies.html">Ver detalles</a></p></div><div class="cookie-actions"><button type="button" data-ack>Aceptar necesarias</button><button type="button" data-close>Ahora no</button></div><p class="cookie-status" role="status"></p>';
    panel.setAttribute('data-cart-background','');
    document.body.append(panel);positionNotice();
    panel.querySelector('[data-ack]').onclick=()=>{try{localStorage.setItem(key,JSON.stringify({version,necessary:true,optional:false,at:Date.now()}));close();}catch{panel.querySelector('.cookie-status').textContent='El navegador no permite guardar la preferencia. Puedes cerrar este aviso y seguir navegando.';}};
    panel.querySelector('[data-close]').onclick=()=>{try{sessionStorage.setItem('bencho19-privacy-dismissed','true');}catch{}close();};
    if(focus)panel.querySelector('button').focus({preventScroll:true});
  }
  function positionNotice(){
    if(!panel)return;
    const bar=document.getElementById('floating-bar');
    const rect=bar?.getBoundingClientRect();
    const visible=bar&&!bar.hidden&&getComputedStyle(bar).display!=='none'&&rect.height>0;
    panel.style.setProperty('--cookie-bottom',(visible?Math.max(16,innerHeight-rect.top+10):16)+'px');
  }
  addEventListener('resize',positionNotice,{passive:true});
  const floating=document.getElementById('floating-bar');
  if(floating)new MutationObserver(positionNotice).observe(floating,{attributes:true,childList:true,subtree:true,attributeFilter:['style','hidden','class']});
  document.querySelectorAll('[data-cookie-settings]').forEach(b=>b.addEventListener('click',()=>show(true)));
  const choice=read(localStorage,key);const dismissed=read(sessionStorage,'bencho19-privacy-dismissed');
  if((!choice||choice.version!==version||!Number.isFinite(choice.at)||Date.now()-choice.at>duration)&&!dismissed)show();
  if(document.querySelector('[data-privacy-contact]')) fetch('/api/config',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{
    const r=data.config?.restaurant||data.restaurant;if(!r)return;
    document.querySelectorAll('[data-legal-name]').forEach(el=>el.textContent=r.fullName||r.name||'Bencho 1:9');
    document.querySelectorAll('[data-legal-location]').forEach(el=>{if(r.location)el.textContent=r.location;});
    const phone=String(r.whatsapp||'').replace(/\D/g,'');
    if(/^\d{8,15}$/.test(phone))document.querySelectorAll('[data-privacy-contact]').forEach(a=>a.href='https://wa.me/'+phone);
  }).catch(()=>{});
  const request=document.getElementById('request-deletion');
  if(request)request.onclick=()=>{
    const output=document.getElementById('deletion-result');
    if(output)output.textContent='La edición estándar no registra pedidos. Para consultas sobre datos anteriores, contacta directamente al restaurante.';
  };
  document.getElementById('clear-local')?.addEventListener('click',()=>{
    if(!confirm('¿Borrar el carrito y las preferencias guardadas en este navegador?'))return;
    try{
      ['bencho19_cart','bencho19-order-session','bencho19-admin-tab',key].forEach(k=>localStorage.removeItem(k));
      ['bencho19-order-pending','bencho19-privacy-dismissed'].forEach(k=>sessionStorage.removeItem(k));
      document.getElementById('local-result').textContent='Datos locales eliminados. La sesión administrativa se cierra desde el panel.';
      close();show();
    }catch{document.getElementById('local-result').textContent='No se pudo acceder al almacenamiento. Puedes borrarlo desde los ajustes de tu navegador.';}
  });
})();

