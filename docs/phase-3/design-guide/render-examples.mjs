// node render-examples.mjs /path/to/plantuml.jar
import {readdirSync,readFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),figures=join(here,'figures');
const jar=process.argv[2];
if(!jar)throw new Error('Truyền đường dẫn PlantUML JAR đã cài.');
mkdirSync(join(figures,'output'),{recursive:true});
const sources=readdirSync(figures).filter(n=>/^example-.*\.puml$/.test(n)).sort();
function run(cmd,args){const p=spawnSync(cmd,args,{cwd:figures,stdio:'inherit'});if(p.error||p.status!==0)throw p.error||new Error(cmd+' thất bại: '+p.status);}
run(process.env.UML_JAVA_BIN||'java',['-Djava.awt.headless=true','-jar',jar,'-charset','UTF-8','-tsvg','-o','output',...sources]);
for(const src of sources){const stem=src.replace(/\.puml$/,'');const svg=join('output',stem+'.svg');
  if(/Syntax Error|An error has occurred/.test(readFileSync(join(figures,svg),'utf8')))throw new Error('Sơ đồ lỗi: '+src);
  run(process.env.UML_RSVG_BIN||'rsvg-convert',['-f','pdf','-o',join('output',stem+'.pdf'),svg]);
  console.log(stem);
}
