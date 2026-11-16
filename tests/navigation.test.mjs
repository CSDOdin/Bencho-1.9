import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/category-nav.js',import.meta.url),'utf8');
function setup(hash=''){
  const events={},frames=new Map(),timers=new Map();let sequence=0,requested=null;
  const links=[0,1,2,3].map(index=>({hash:'#cat-section-'+index,attributes:{},active:false,
    classList:{toggle(name,value){links[index].active=value;}},
    setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},
    getBoundingClientRect:()=>({left:15+index*130-nav.scrollLeft,right:135+index*130-nav.scrollLeft})}));
  const sections=[300,1200,1500,1800].map((position,index)=>({id:'cat-section-'+index,getBoundingClientRect:()=>({top:position-context.scrollY,height:300})}));
  const nav={scrollLeft:0,getBoundingClientRect:()=>({left:0,right:390,height:60}),querySelectorAll:()=>links,scrollTo({left}){this.scrollLeft=Math.max(0,left);}};
  const menu={querySelectorAll:()=>sections};
  const context={console,scrollY:0,innerHeight:900,location:{hash},history:{state:null,replaceState(state,title,next){context.location.hash=next;}},matchMedia:()=>({matches:false}),
    document:{getElementById:id=>id==='category-nav-bar'?nav:id==='menu-container'?menu:null,querySelector:()=>({getBoundingClientRect:()=>({height:80})}),documentElement:{scrollHeight:3000,style:{setProperty(){}}}},
    addEventListener:(type,callback)=>events[type]=callback,requestAnimationFrame:callback=>{const id=++sequence;frames.set(id,callback);return id;},
    setTimeout:(callback)=>{const id=++sequence;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
    scrollTo:options=>{requested=options;},MutationObserver:class{observe(){}},
  };
  context.window=context;vm.createContext(context);vm.runInContext(source,context);
  const flush=()=>{for(const [id,callback] of [...frames]){frames.delete(id);callback();}};
  const selected=()=>links.filter(link=>link.active).map(link=>link.hash);
  const scroll=y=>{context.scrollY=y;events.scroll();flush();};flush();
  return {context,events,links,nav,sections,flush,selected,scroll,requested:()=>requested,expire:()=>{for(const callback of timers.values())callback();timers.clear();flush();}};
}
test('co-visible sections produce one stable active category from the header reference line',()=>{
  const s=setup();s.scroll(1380);assert.deepEqual(s.selected(),['#cat-section-2']);
  s.events.scroll();s.flush();assert.deepEqual(s.selected(),['#cat-section-2']);
  s.scroll(1320);assert.deepEqual(s.selected(),['#cat-section-1']);
  assert.equal(s.links.filter(l=>l.attributes['aria-current']==='location').length,1);
});
test('clicked category stays selected while smooth scroll crosses other sections',()=>{
  const s=setup();let prevented=false;
  s.context.BenchoCategories.navigate({preventDefault(){prevented=true;}},'cat-section-3');
  assert.equal(prevented,true);assert.equal(s.requested().top,1636);assert.equal(s.requested().behavior,'smooth');
  s.scroll(700);assert.deepEqual(s.selected(),['#cat-section-3']);
  s.scroll(1636);assert.deepEqual(s.selected(),['#cat-section-3']);
  s.scroll(1000);assert.deepEqual(s.selected(),['#cat-section-0']);
});
test('manual scrolling cancels a pending selection and returns control to the reader',()=>{
  const s=setup();s.context.BenchoCategories.navigate(null,'cat-section-3');s.scroll(1200);
  s.events.wheel();s.flush();assert.deepEqual(s.selected(),['#cat-section-1']);
  s.context.BenchoCategories.navigate(null,'cat-section-3');s.events.touchstart();s.flush();assert.deepEqual(s.selected(),['#cat-section-1']);
});
test('deep links, clamped page end, keyboard intent and rebuilt menu remain consistent',()=>{
  const s=setup('#cat-section-2');assert.equal(s.requested().top,1336);assert.deepEqual(s.selected(),['#cat-section-2']);
  s.scroll(1336);s.context.document.documentElement.scrollHeight=2000;
  s.context.BenchoCategories.navigate(null,'cat-section-3');assert.equal(s.requested().top,1100);
  s.scroll(1100);s.events.scroll();s.flush();assert.deepEqual(s.selected(),['#cat-section-3']);
  s.events.keydown({key:'PageUp'});s.scroll(1000);assert.deepEqual(s.selected(),['#cat-section-0']);
  s.context.BenchoCategories.refresh();s.flush();assert.equal(s.selected().length,1);
});
test('modifier clicks keep native links and active pill scrolling never moves the page',()=>{
  const s=setup();s.context.BenchoCategories.navigate({ctrlKey:true,preventDefault(){throw Error('modified click intercepted');}},'cat-section-3');
  assert.equal(s.requested(),null);s.scroll(1800);assert.ok(s.nav.scrollLeft>0);assert.equal(s.requested(),null);
});
