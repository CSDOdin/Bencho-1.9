import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/privacy.js',import.meta.url),'utf8');
function setup(saved=null){
  const local=new Map(),session=new Map(),panels=[];let current=null,openerFocused=0,buttonFocused=0,settingsClick;
  if(saved)local.set('bencho19-privacy-choice',JSON.stringify(saved));
  const opener={focus(){openerFocused++;},addEventListener(event,callback){settingsClick=callback;}};
  const makePanel=()=>{
    const nodes={'[data-ack]':{focus(){buttonFocused++;}},'[data-close]':{},'.cookie-status':{}};
    return {className:'',attributes:{},style:{setProperty(){}},setAttribute(key,value){this.attributes[key]=value;},querySelector:selector=>selector==='button'?nodes['[data-ack]']:nodes[selector],remove(){current=null;},nodes};
  };
  const storage=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
  const context={console,Date,localStorage:storage(local),sessionStorage:storage(session),innerHeight:844,addEventListener(){},
    document:{activeElement:opener,createElement:makePanel,body:{append(panel){panels.push(panel);current=panel;}},querySelectorAll:()=>[opener],querySelector:()=>null,getElementById:()=>null}};
  vm.runInNewContext(source,context);
  return {local,session,panels,current:()=>current,settings:()=>settingsClick(),focus:()=>({opener:openerFocused,button:buttonFocused})};
}
test('notice is mounted immediately, stays outside document flow and does not capture focus',()=>{
  const s=setup();assert.ok(s.current());assert.equal(s.current().className,'cookie-notice');
  assert.ok(Object.hasOwn(s.current().attributes,'data-cart-background'));
  assert.deepEqual(s.focus(),{opener:0,button:0});
  assert.match(s.current().innerHTML,/Sin publicidad ni analítica/);
});
test('accept stores only the necessary preference and valid consent suppresses the notice',()=>{
  const s=setup();s.current().nodes['[data-ack]'].onclick();assert.equal(s.current(),null);
  const saved=JSON.parse(s.local.get('bencho19-privacy-choice'));assert.equal(saved.necessary,true);assert.equal(saved.optional,false);
  assert.equal(setup(saved).current(),null);
});
test('dismiss and explicit preferences reopen safely and restore the opener focus',()=>{
  const s=setup();s.current().nodes['[data-close]'].onclick();assert.equal(s.current(),null);
  assert.equal(s.session.get('bencho19-privacy-dismissed'),'true');
  s.settings();assert.ok(s.current());assert.deepEqual(s.focus(),{opener:0,button:1});
  s.current().nodes['[data-close]'].onclick();assert.deepEqual(s.focus(),{opener:1,button:1});
});
