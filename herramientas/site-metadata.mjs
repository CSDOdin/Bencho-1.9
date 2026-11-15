import {readFileSync,writeFileSync} from 'node:fs';
const raw=process.env.SITE_URL||process.env.URL||process.env.DEPLOY_PRIME_URL||'http://localhost:4173';
const url=new URL(raw);
if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('SITE_URL must be an HTTP(S) origin');
const base=url.origin;
const path='public/index.html';let html=readFileSync(path,'utf8');
html=html.replace(/(<link rel="canonical" href=")[^"]*(")/,`$1${base}/$2`)
  .replace(/(<meta property="og:url" content=")[^"]*(")/,`$1${base}/$2`)
  .replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*(")/g,`$1${base}/images/bencho19-burger.jpg$2`)
  .replace(/(<script type="application\/ld\+json" id="restaurant-schema">)(.*?)(<\/script>)/s,(_,a,json,b)=>{
    const schema=JSON.parse(json);Object.assign(schema,{'@id':base+'/#restaurant',url:base+'/',hasMenu:base+'/#menu-heading',image:base+'/images/bencho19-burger.jpg'});
    return a+JSON.stringify(schema)+b;
  });
if(html.includes('__SITE_URL__'))throw new Error('Unresolved site URL');
writeFileSync(path,html);
const pages=['/','/privacidad.html','/cookies.html','/terminos.html'];
writeFileSync('public/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.map(page=>'<url><loc>'+base+page+'</loc></url>').join('\n')+'\n</urlset>\n');
writeFileSync('public/robots.txt',`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /.netlify/\nSitemap: ${base}/sitemap.xml\n`);
console.log('Site metadata generated for '+base);
