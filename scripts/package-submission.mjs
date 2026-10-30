import { cp, mkdir, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, basename, dirname } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=resolve(root,'submission','03_投资事件情报与证据时间线');
await mkdir(dirname(target),{recursive:true});await rm(target,{recursive:true,force:true});
const excluded=new Set(['node_modules','dist','.git','.sites-runtime','.DS_Store','submission','output','outputs','assets.generated.js']);
await mkdir(target,{recursive:true});
const filter=async src=>{
 const n=basename(src),rel=relative(root,src);
 if(!rel)return true;
 return !rel.split('/').some(p=>excluded.has(p)) && !(n.startsWith('.env')&&n!=='.env.example') && !/\.(?:log|tmp|pem|key)$/.test(n);
};
for (const entry of await readdir(root)) {
 const source=resolve(root,entry);
 if(await filter(source)) await cp(source,resolve(target,entry),{recursive:true,filter});
}
console.log(`Prepared clean submission: ${target}`);
