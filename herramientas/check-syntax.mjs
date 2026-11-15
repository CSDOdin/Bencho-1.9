import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
for(const dir of ['netlify','public','herramientas']) for(const file of readdirSync(dir,{recursive:true})) if(/\.(mjs|js)$/.test(file)) execFileSync(process.execPath,['--check',dir+'/'+file],{stdio:'inherit'});

