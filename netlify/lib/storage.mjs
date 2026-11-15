import { getStore as netlifyGetStore } from '@netlify/blobs';
// Guard the SDK conditional-write path: a failed PUT must never report success,
// even if an upstream error response happens to contain an ETag.
export function checkedFetch(transport = globalThis.fetch) {
  return async (url, init = {}) => {
    const response = await transport(url, init);
    const method=String(init.method || (url instanceof Request ? url.method : 'GET')).toUpperCase();
    if(method==='PUT' && response.status!==200 && response.status!==412) throw new Error('Blob write was not acknowledged');
    return response;
  };
}
export function getStore(options) {
  return netlifyGetStore({...options,fetch:checkedFetch(options.fetch || globalThis.fetch)});
}

