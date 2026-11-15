(() => {
  'use strict';
  const key='bencho19-privacy-choice', version=1, duration=180*86400000;
  const read=(storage,k)=>{try{return JSON.parse(storage.getItem(k));}catch{return null;}};
  let panel, opener;
  function close(){panel?.remove();panel=null;opener?.focus();}
  function show(focus=false){
    if(panel){if(focus)panel.querySelector('button').focus();return;}
    opener=focus?document.activeElement:null;
    panel=document.createElement('section');panel.className=focus?'cookie-notice':'cookie-notice cookie-inline';panel.setAttribute('aria-label','Cookies y privacidad');
    panel.innerHTML='<div><h2>Tu privacidad, clara.</h2><p>Usamos almacenamiento necesario para tu carrito y las preferencias del sitio. Esta versión no incluye cookies publicitarias ni analíticas opcionales. Puedes seguir navegando sin aceptar el aviso.</p><a href="/cookies.html">Ver cookies y duración</a> · <a href="/privacidad.html">Privacidad</a></div><div class="cookie-actions"><button type="button" data-ack>Aceptar necesarias</button><button type="button" data-close>Continuar sin aceptar</button></div><p class="cookie-status" role="status"></p>';
    document.body.append(panel);
    panel.querySelector('[data-ack]').onclick=()=>{try{localStorage.setItem(key,JSON.stringify({version,necessary:true,optional:false,at:Date.now()}));close();}catch{panel.querySelector('.cookie-status').textContent='El navegador no permite guardar la preferencia. Puedes cerrar este aviso y seguir navegando.';}};
    panel.querySelector('[data-close]').onclick=()=>{try{sessionStorage.setItem('bencho19-privacy-dismissed','true');}catch{}close();};
    if(focus)panel.querySelector('button').focus();
  }
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

