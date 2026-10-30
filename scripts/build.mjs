import '../app/scripts/build.mjs';
import { cp, mkdir, rm } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await rm(new URL('dist/',root),{recursive:true,force:true});
await mkdir(new URL('dist/',root),{recursive:true});
await cp(new URL('app/dist/',root),new URL('dist/',root),{recursive:true});
