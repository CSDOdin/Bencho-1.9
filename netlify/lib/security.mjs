import { getStore } from './storage.mjs';
import { createHash, createHmac, randomBytes, timingSafeEqual, pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
import { isIP } from 'node:net';
const derive = promisify(pbkdf2);
export const SITE = 'bencho19';
export const TTL = 12 * 60 * 60 * 1000;
export class HttpError extends Error {
  constructor(status, message, headers = {}) { super(message); this.status = status; this.headers = headers; }
}
export const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a,b) => { const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y); };
const parts = () => String(process.env.ADMIN_PASSWORD_HASH || '').match(/^pbkdf2-sha256\$(\d+)\$([a-f0-9]{32,128})\$([a-f0-9]{64})$/i);
export function configured() {
  const p = parts();
  return Boolean(process.env.ADMIN_USER?.trim() && process.env.ADMIN_USER.length<=120 && process.env.ADMIN_SECRET?.length>=32 && p && p[2].length%2===0 && +p[1]>=600000 && +p[1]<=2000000);
}
const binding = () => createHmac('sha256',process.env.ADMIN_SECRET).update(`${SITE}:${process.env.ADMIN_USER}:${process.env.ADMIN_PASSWORD_HASH}`).digest('hex');
export const secureStore = () => getStore({ name: `${SITE}-security-v2`, consistency: 'strong' });
export function clientKey(context) {
  if (!context || !isIP(context.ip || '')) throw new HttpError(503,'No se pudo verificar la conexión.');
  if (!configured()) throw new HttpError(503,'Configura la autenticación en Netlify.');
  return createHmac('sha256',process.env.ADMIN_SECRET).update(context.ip).digest('hex');
}
export async function conditionalJSON(store,key,data,options) {
  const result = await store.setJSON(key,data,options);
  if (result?.modified === false) return result;
  if (result?.modified !== true || !result.etag) throw new HttpError(503,'El almacenamiento no confirmó la operación.');
  return result;
}
// One atomic key per fixed time window. No process-local counters or header identities.
export async function limit(key, max, period, now = Date.now()) {
  const start = Math.floor(now/period)*period;
  const recordKey = `rate/${start}/${digest(key)}`;
  const s = secureStore();
  for(let i=0;i<12;i++) {
    const entry = await s.getWithMetadata(recordKey,{type:'json'});
    const count = entry?.data?.count || 0;
    if(count>=max) throw new HttpError(429,'Demasiadas solicitudes. Intenta más tarde.',{'Retry-After':String(Math.max(1,Math.ceil((start+period-now)/1000)))});
    const r = await conditionalJSON(s,recordKey,{count:count+1,expires:start+period+86400000},entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
    if(r.modified) return;
  }
  throw new HttpError(429,'Hay solicitudes simultáneas. Intenta nuevamente.',{'Retry-After':'2'});
}
function rawCookie(request) {
  const name = `__Host-${SITE}_admin`;
  const values = (request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));
  if(values.length!==1) return null;
  const raw=values[0].slice(name.length+1);
  return /^[a-f0-9]{64}$/.test(raw)?raw:null;
}
export function cookie(value,age=TTL/1000) { return `__Host-${SITE}_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
export async function session(request) {
  if(!configured()) return null;
  const raw=rawCookie(request);
  if(!raw) return null;
  const key=`session/${digest(raw)}`;
  const record=await secureStore().get(key,{type:'json'});
  const now=Date.now();
  if(!record || record.role!=='admin' || !Number.isFinite(record.iat) || record.iat>now || !Number.isFinite(record.expires) || record.expires<=now || record.expires-record.iat!==TTL || !equal(record.binding||'',binding())) return null;
  return {...record,key};
}
export async function login(request,context) {
  if(!configured()) throw new HttpError(503,'Configura ADMIN_USER, ADMIN_PASSWORD_HASH (PBKDF2 de al menos 600000 iteraciones) y ADMIN_SECRET en Netlify.');
  const ip=clientKey(context);
  await limit('login:account',30,600000);
  await limit(`login:ip:${ip}`,5,600000);
  const body=await readJSON(request,4096);
  if(typeof body.user!=='string'||typeof body.password!=='string'||body.password.length>256||body.user.length>120) throw new HttpError(401,'Credenciales incorrectas.');
  const [,iterations,salt,expected]=parts();
  const computed=await derive(body.password,Buffer.from(salt,'hex'),+iterations,32,'sha256');
  const passwordOK=equal(computed,Buffer.from(expected,'hex'));
  if(!passwordOK || !equal(body.user,process.env.ADMIN_USER)) throw new HttpError(401,'Credenciales incorrectas.');
  const raw=randomBytes(32).toString('hex'), csrf=randomBytes(32).toString('hex'), now=Date.now();
  const result=await conditionalJSON(secureStore(),`session/${digest(raw)}`,{role:'admin',iat:now,expires:now+TTL,binding:binding(),csrf},{onlyIfNew:true});
  if(!result.modified) throw new HttpError(503,'No se pudo iniciar la sesión.');
  return {raw,csrf};
}
export async function logout(request) {
  const raw=rawCookie(request);
  if(raw) await secureStore().delete(`session/${digest(raw)}`);
}
export function sameOrigin(request) {
  const origin=request.headers.get('origin');
  if(origin!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site') throw new HttpError(403,'Origen no permitido.');
}
export function csrfCheck(request,auth) {
  if(!auth || !equal(request.headers.get('x-csrf-token')||'',auth.csrf)) throw new HttpError(403,'Sesión de seguridad inválida. Recarga el panel.');
}
export async function boundedRequest(request,max) {
  const declared=Number(request.headers.get('content-length'));
  if(declared>max) throw new HttpError(413,'Solicitud demasiado grande.');
  if(request.headers.has('content-encoding') && request.headers.get('content-encoding')!=='identity') throw new HttpError(415,'Codificación no permitida.');
  const reader=request.body?.getReader();
  if(!reader) return request;
  const chunks=[];let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>max){await reader.cancel();throw new HttpError(413,'Solicitud demasiado grande.');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  return new Request(request.url,{method:request.method,headers:request.headers,body:Buffer.concat(chunks,size)});
}
export function safeTree(value,depth=0) {
  if(depth>20) throw new HttpError(400,'Estructura demasiado profunda.');
  if(!value || typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)) {
    if(['__proto__','prototype','constructor'].includes(key)) throw new HttpError(400,'Propiedad no permitida.');
    safeTree(child,depth+1);
  }
}
export async function readJSON(request,max=1000000) {
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json') throw new HttpError(415,'Se requiere application/json.');
  const bounded=await boundedRequest(request,max);
  let body;try{body=await bounded.json();}catch{throw new HttpError(400,'JSON inválido.');}
  if(!body || typeof body!=='object' || Array.isArray(body)) throw new HttpError(400,'Se requiere un objeto.');
  safeTree(body);return body;
}
export function secureResponse(response) {
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('X-Frame-Options','DENY');
  response.headers.set('Referrer-Policy','no-referrer');
  response.headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; sandbox");
  return response;
}
export async function cleanupExpired(now=Date.now()) {
  let examined=0,deleted=0;
  const s=secureStore();
  for await(const page of s.list({paginate:true})) {
    for(const {key} of page.blobs) {
      if(++examined>1000) return {examined:1000,deleted,capped:true};
      if(!/^(rate|session)\//.test(key))continue;
      const entry=await s.get(key,{type:'json'});
      if(Number.isFinite(entry?.expires)&&entry.expires<now-3600000){await s.delete(key);deleted++;}
    }
  }
  return {examined,deleted,capped:false};
}

