/* Presentation only: the original menu, pricing, checkout and admin logic remain in their own scripts. */
(()=>{
 'use strict';
 const cart=document.getElementById('cart-section');
 if(!cart){
  const password=document.getElementById('pass');
  password?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();document.getElementById('loginBtn').click();}});
  return;
 }
 const mobile=matchMedia('(min-width: 0px)'),backdrop=document.querySelector('.cart-backdrop');
 let returnFocus=null;
 function closeCart(restore=true){
  document.body.classList.remove('cart-is-open');backdrop.hidden=true;
  cart.removeAttribute('role');cart.removeAttribute('aria-modal');
  document.querySelectorAll('[data-cart-background]').forEach(element=>{element.inert=false;});
  if(restore&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
 }
 function openCart(trigger){
  if(!mobile.matches)return;
  returnFocus=trigger||document.activeElement;
  document.body.classList.add('cart-is-open');backdrop.hidden=false;
  cart.setAttribute('role','dialog');cart.setAttribute('aria-modal','true');
  document.querySelectorAll('[data-cart-background]').forEach(element=>{element.inert=true;});
  cart.querySelector('.cart-close').focus({preventScroll:true});
 }
 document.querySelectorAll('a[href="#cart-section"]').forEach(link=>link.addEventListener('click',event=>{if(mobile.matches){event.preventDefault();openCart(link);}}));
 cart.querySelector('.cart-close').addEventListener('click',()=>closeCart());backdrop.addEventListener('click',()=>closeCart());
 mobile.addEventListener('change',()=>closeCart(false));
 document.addEventListener('keydown',event=>{
  if(!document.body.classList.contains('cart-is-open'))return;
  if(event.key==='Escape'){event.preventDefault();closeCart();return;}
  if(event.key!=='Tab')return;
  const focusable=[...cart.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')].filter(element=>element.getClientRects().length);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 function syncCart(){
  let count=0;
  try{const saved=JSON.parse(localStorage.getItem('bencho19_cart')||'{}');count=Object.values(saved).reduce((sum,item)=>sum+(Number(item.qty)||0),0);}catch{}
  document.getElementById('nav-cart-count').textContent=String(count);
  const empty=document.querySelector('#cart-items-container > p');
  if(empty){const panel=document.createElement('div');panel.className='cart-empty';panel.innerHTML='<span class="empty-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg></span><strong>El antojo empieza aquí</strong><p>Agrega algo de la carta<br>y lo encontrarás en tu pedido.</p>';empty.replaceWith(panel);}
  document.querySelector('.checkout-divider').hidden=!count;document.querySelector('.checkout-fields').hidden=!count;
  cart.querySelectorAll('.cart-item-controls').forEach(controls=>{const name=controls.closest('.cart-item').querySelector('.item-name')?.textContent||'producto';controls.querySelectorAll('button').forEach((button,index)=>button.setAttribute('aria-label',(index?'Añadir una unidad de ':'Quitar una unidad de ')+name));});
 }
 const rows=document.getElementById('cart-items-container');new MutationObserver(syncCart).observe(rows,{childList:true});syncCart();
 const categories=document.getElementById('menu-container');
 function decorateMenu(){
  categories.querySelectorAll('.featured-badge').forEach(badge=>{badge.textContent='DESTACADO';});
  categories.querySelectorAll('.menu-category').forEach((category,index)=>{
   category.querySelector('.category-name').dataset.number=String(index+1).padStart(2,'0');
  });
 }
 new MutationObserver(decorateMenu).observe(categories,{childList:true});decorateMenu();
 const status=document.getElementById('store-status-badge');
 function decorateStatus(){const plain=status.textContent.replace(/^[^A-Za-zÁÉÍÓÚÜÑ0-9]+/,'');if(status.textContent!==plain)status.textContent=plain;}
 new MutationObserver(decorateStatus).observe(status,{childList:true,characterData:true,subtree:true});decorateStatus();
 function unavailable(img){if(img.matches('.header-logo,#watermark-logo,.item-img'))img.classList.add('image-unavailable');if(img.matches('.header-logo,#watermark-logo'))img.hidden=true;}
 document.addEventListener('load',event=>{if(event.target instanceof HTMLImageElement&&event.target.matches('.header-logo,#watermark-logo,.item-img')){event.target.hidden=false;event.target.classList.remove('image-unavailable');}},true);
 document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement)unavailable(event.target);},true);
 document.querySelectorAll('img').forEach(img=>{if(img.complete&&!img.naturalWidth)unavailable(img);});
})();

