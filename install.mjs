import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const cfg=JSON.parse(await readFile(path.join(root,'config.json'),'utf8'));
let token;try{token=(await readFile(path.join(root,'bridge-token.txt'),'utf8')).trim()}catch{token=randomBytes(32).toString('hex');await writeFile(path.join(root,'bridge-token.txt'),token,{mode:0o600})}
const code=(await readFile(path.join(root,'plugin.template.js'),'utf8')).replace('__CONFIG__',JSON.stringify({origin:`http://127.0.0.1:${cfg.port}`,token}));
for(const dir of [path.join(root,'desktop-plugins','cowart-hermes'),path.join(cfg.hermesHome,'desktop-plugins','cowart-hermes')]){await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'plugin.js'),code);console.log('Installed '+path.join(dir,'plugin.js'))}
