import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {pbkdf2Sync} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const buckets=new Map(); let revision=0;
globalThis.__benchoTestGetStore=({name})=>{
  if(!buckets.has(name))buckets.set(name,new Map());
  const entries=buckets.get(name);
  return {
    async get(key){return structuredClone(entries.get(key)?.data??null);},
    async getWithMetadata(key){return structuredClone(entries.get(key)??null);},
    async setJSON(key,data,options={}){
      const old=entries.get(key);
      if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};
      const etag=String(++revision);entries.set(key,{data:structuredClone(data),etag,metadata:{}});return {modified:true,etag};
    },
    async delete(key){entries.delete(key);},
    async *list(){yield {blobs:[...entries.keys()].map(key=>({key}))};}
  };
};
registerHooks({resolve(specifier,context,next){
  if(specifier==='@netlify/blobs')return {url:'data:text/javascript,export const getStore=globalThis.__benchoTestGetStore;',shortCircuit:true};
  if(specifier==='sharp')return {url:'data:text/javascript,export default function(){throw new Error("Image conversion not exercised in these tests")}',shortCircuit:true};
  return next(specifier,context);
}});
const salt='b'.repeat(32),password='local-test-only';
process.env.ADMIN_USER='admin';process.env.ADMIN_SECRET='test-only-secret-'.repeat(4);
process.env.ADMIN_PASSWORD_HASH=`pbkdf2-sha256$600000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),600000,32,'sha256').toString('hex')}`;
const {default:venue}=await import('../netlify/functions/api.mjs');
const origin='https://test.example';
async function call(handler,path,method='GET',body,headers={}){
  return handler(new Request(origin+path,{method,headers:{origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),{ip:'192.0.2.1'});
}
let cookie,csrf,venueConfig;
test('standalone routes and initial menu',async()=>{
  assert.equal((await call(venue,'/api/health')).status,200);
  assert.equal((await call(venue,'/.netlify/functions/api/health')).status,200);
  const b=await (await call(venue,'/api/config')).json();
  assert.equal(b.restaurant.fullName,'Bencho 1:9');
  assert.equal(b.menuData.flatMap(c=>c.items).length,13);assert.ok(b.menuData.flatMap(c=>c.items).every(p=>p.price===0));
  assert.equal(b.restaurant.whatsapp,'');assert.equal(b.storeStatus.forceClose,true);assert.equal(b._revision,undefined);
  assert.equal((await call(venue,'/api/admin/config')).status,401);
});
test('isolated administrative session and CSRF validation',async()=>{
  const response=await call(venue,'/api/login','POST',{user:'admin',password});
  assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];
  csrf=(await response.json()).csrfToken;
  assert.match(cookie,/^__Host-bencho19_admin=/);
  const read=await call(venue,'/api/admin/config','GET',undefined,{cookie});
  assert.equal(read.status,200);venueConfig=await read.json();
  assert.equal((await call(venue,'/api/admin/config','PUT',venueConfig,{cookie})).status,403);
  assert.equal((await call(venue,'/api/admin/config','PUT',venueConfig,{cookie,'x-csrf-token':csrf,origin:'https://elsewhere.example'})).status,403);
});
test('saving menu and rejecting stale writes',async()=>{
  venueConfig.menuData[0].items[0].price=23000;
  const response=await call(venue,'/api/admin/config','PUT',venueConfig,{cookie,'x-csrf-token':csrf});
  assert.equal(response.status,200,await response.clone().text());
  assert.equal((await (await call(venue,'/api/config')).json()).menuData[0].items[0].price,23000);
  assert.equal((await call(venue,'/api/admin/config','PUT',venueConfig,{cookie,'x-csrf-token':csrf})).status,409);
  assert.ok(buckets.has('bencho19-config'));assert.equal(buckets.has('bencho-burger-config'),false);
});
test('logout revokes new venue session',async()=>{
  assert.equal((await call(venue,'/api/logout','POST',{}, {cookie,'x-csrf-token':csrf})).status,200);
  assert.equal((await (await call(venue,'/api/session','GET',undefined,{cookie})).json()).authenticated,false);
});
test('new menu renders descriptions and pending prices without inline script handlers',()=>{
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',querySelectorAll:()=>[],addEventListener(){}});return nodes.get(id)};
  const context=vm.createContext({console,structuredClone,URL,location:{href:origin+'/'},localStorage:{getItem:()=>null},document:{getElementById:node,addEventListener(){},querySelector(){return null}},addEventListener(){},setTimeout(){},setInterval(){}});
  context.window=context;
  vm.runInContext(readFileSync(new URL('../public/currency.js',import.meta.url),'utf8'),context);
  vm.runInContext(readFileSync(new URL('../public/script.js',import.meta.url),'utf8'),context);
  vm.runInContext('renderMenuHTML()',context);
  const rendered=nodes.get('menu-container').innerHTML;
  assert.equal((rendered.match(/Precio por confirmar/g)||[]).length,13);
  assert.match(rendered,/120 g de carne/);assert.match(rendered,/360 g de carne/);
  assert.doesNotMatch(rendered,/<button[^>]*data-menu-add/);assert.doesNotMatch(rendered,/\son\w+=/);
});

test('configured burger adds without legacy combo modal; sold-out and pending products stay blocked',()=>{
  const alerts=[];
  const context=vm.createContext({console,structuredClone,URL,location:{href:origin+'/'},localStorage:{getItem:()=>null},document:{getElementById:()=>null,addEventListener(){},querySelector(){return null}},addEventListener(){},setTimeout(){},setInterval(){},alert:message=>alerts.push(message)});
  context.window=context;
  vm.runInContext(readFileSync(new URL('../public/script.js',import.meta.url),'utf8'),context);
  vm.runInContext('isStoreOpen=()=>true; renderCart=()=>{}; CONFIG.menuData[0].items[0].price=23000; handleAddToCart("item-0-0",0,0,true); handleAddToCart("item-0-0",0,0,true);',context);
  assert.equal(vm.runInContext('cart[CONFIG.menuData[0].items[0].name].qty',context),2);
  vm.runInContext('CONFIG.menuData[0].items[0].outOfStock=true; handleAddToCart("item-0-0",0,0,true); handleAddToCart("item-0-1",0,1,false);',context);
  assert.equal(alerts.length,1);assert.equal(vm.runInContext('Object.keys(cart).length',context),1);
  assert.equal(vm.runInContext('cart[CONFIG.menuData[0].items[0].name].qty',context),2);
});
