// node render-management.mjs /path/to/plantuml.jar
import { mkdirSync, readFileSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const jar = process.argv[2];
if (!jar) throw new Error('Truyền đường dẫn plantuml.jar.');
function run(cmd,args) {
  const r = spawnSync(cmd,args,{cwd:here,stdio:'inherit'});
  if(r.error) throw r.error;
  if(r.status!==0) throw new Error(cmd+': '+r.status);
}
const jobs=[];
for(const id of ['uc-gen-01','uc-gen-02','uc-gen-03']) {
  jobs.push([id,'use-case',id],['sequence-'+id,'sequence',id],['activity-'+id,'activity',id]);
}
for(const id of ['uc-ops-04','uc-ops-05']) {
  jobs.push([id,'use-case',id],['sequence-'+id,'sequence',id],['activity-'+id,'activity',id]);
}
jobs.push(['state-account','state','account'],['state-resource-service-status','state','resource-service-status']);
for(const [source,folder,target] of jobs) {
  const out=resolve(here,'..',folder);mkdirSync(out,{recursive:true});
  run(process.env.UML_JAVA_BIN||'java',['-Djava.awt.headless=true','-jar',jar,'-charset','UTF-8','-tsvg','-o',out,source+'.puml']);
  const src=resolve(out,source+'.svg'),dst=resolve(out,target+'.svg');
  if(/Syntax Error|Error line|An error has occurred/.test(readFileSync(src,'utf8'))) throw new Error(source);
  if(src!==dst)renameSync(src,dst);
  run(process.env.UML_RSVG_BIN||'rsvg-convert',['-f','pdf','-o',resolve(out,target+'.pdf'),dst]);
  console.log(source+' -> '+folder+'/'+target);
}
