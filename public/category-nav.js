/* One scroll position owns the active category, even when sections share a viewport. */
(() => {
  'use strict';
  const nav=document.getElementById('category-nav-bar');
  const menu=document.getElementById('menu-container');
  if(!nav||!menu)return;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let sections=[],links=[],active='',pending=null,frame=0,settleTimer=0,initialHashHandled=false;
  function anchorLine(){
    const header=document.querySelector('.site-nav');
    return (header?.getBoundingClientRect().height||0)+nav.getBoundingClientRect().height+24;
  }
  function keepLinkVisible(link){
    const item=link.getBoundingClientRect(),box=nav.getBoundingClientRect();
    let shift=0;
    if(item.left<box.left+8)shift=item.left-box.left-8;
    else if(item.right>box.right-8)shift=item.right-box.right+8;
    if(shift)nav.scrollTo({left:nav.scrollLeft+shift,behavior:'instant'});
  }
  function select(id){
    if(!id||active===id)return;
    active=id;
    for(const link of links){
      const current=link.hash==='#'+id;
      link.classList.toggle('active',current);
      if(current){link.setAttribute('aria-current','location');keepLinkVisible(link);}
      else link.removeAttribute('aria-current');
    }
  }
  function positionCategory(){
    if(!sections.length)return '';
    const pageEnd=Math.max(0,document.documentElement.scrollHeight-innerHeight);
    if(pageEnd>0&&scrollY>=pageEnd-2)return sections.at(-1).id;
    const line=anchorLine();let selected=sections[0].id;
    for(const section of sections){
      if(section.getBoundingClientRect().top>line+2)break;
      selected=section.id;
    }
    return selected;
  }
  function update(){
    frame=0;
    if(pending){
      select(pending.id);
      if(Math.abs(scrollY-pending.top)<=2){pending=null;clearTimeout(settleTimer);}
      return;
    }
    select(positionCategory());
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  function cancelPending(){pending=null;clearTimeout(settleTimer);schedule();}
  function navigate(event,id,behavior){
    if(event&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button>0))return;
    const section=sections.find(item=>item.id===id);if(!section)return;
    event?.preventDefault();
    const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
    const top=Math.max(0,Math.min(max,scrollY+section.getBoundingClientRect().top-anchorLine()));
    pending={id,top};clearTimeout(settleTimer);select(id);
    history.replaceState(history.state,'','#'+id);
    scrollTo({top,behavior:behavior||(reducedMotion.matches?'instant':'smooth')});
    // A fallback for browsers without scrollend; user input cancels immediately.
    settleTimer=setTimeout(()=>{pending=null;schedule();},1600);
    schedule();
  }
  function refresh(){
    sections=[...menu.querySelectorAll('.menu-category')];
    links=[...nav.querySelectorAll('.cat-pill')];active='';pending=null;
    document.documentElement.style.setProperty('--category-anchor',anchorLine()+'px');
    if(!initialHashHandled&&sections.length){
      initialHashHandled=true;
      const id=location.hash.slice(1);
      if(sections.some(section=>section.id===id)){navigate(null,id,'instant');return;}
    }
    schedule();
  }
  window.BenchoCategories={navigate,refresh};
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('wheel',cancelPending,{passive:true});
  addEventListener('touchstart',cancelPending,{passive:true});
  addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))cancelPending();});
  addEventListener('resize',refresh,{passive:true});
  addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(sections.some(s=>s.id===id))navigate(null,id,'instant');});
  new MutationObserver(refresh).observe(menu,{childList:true});
  if('ResizeObserver' in window){const observer=new ResizeObserver(()=>{document.documentElement.style.setProperty('--category-anchor',anchorLine()+'px');schedule();});observer.observe(nav);const header=document.querySelector('.site-nav');if(header)observer.observe(header);}
  document.fonts?.ready.then(refresh);
  refresh();
})();
