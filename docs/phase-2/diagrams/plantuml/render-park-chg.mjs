import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),base=resolve(here,'..'),jar=process.argv[2];
if(!jar)throw Error('Truyền đường dẫn plantuml.jar.');
function run(cmd,args){const r=spawnSync(cmd,args,{cwd:here,stdio:'inherit'});if(r.error||r.status!==0)throw r.error||Error(cmd+' '+r.status);}
// Giữ các SVG gốc còn lại; chỉ render hình được sửa hoặc bổ sung.
for(const [src,folder,target]of[
 ['sequence-uc-park-01','sequence','uc-park-01'],
 ['sequence-uc-park-02','sequence','uc-park-02'],
 ['activity-uc-park-01','activity','uc-park-01'],
 ['activity-uc-park-02','activity','uc-park-02'],
 ['sequence-uc-chg-01','sequence','uc-chg-01'],
 ['sequence-uc-chg-02','sequence','uc-chg-02'],
 ['sequence-uc-chg-03','sequence','uc-chg-03'],
 ['activity-uc-chg-01','activity','uc-chg-01'],
 ['activity-uc-chg-02','activity','uc-chg-02'],
 ['activity-uc-chg-03','activity','uc-chg-03'],
 ['state-parking-reservation','state','parking-reservation'],
 ['state-parking-space','state','parking-space'],
 ['state-charging-session','state','charging-session'],
 ['state-charging-point','state','charging-point']
]){
 const out=resolve(base,folder);
 run('java',['-Djava.awt.headless=true','-jar',jar,'-charset','UTF-8','-tsvg','-o',out,src+'.puml']);
 const generated=resolve(out,src+'.svg'),dest=resolve(out,target+'.svg');
 if(/Syntax Error|An error has occurred/.test(readFileSync(generated,'utf8')))throw Error(src);
 if(generated!==dest)renameSync(generated,dest);
 // Bỏ text chỉ chứa khoảng trắng: tránh lỗi nhúng glyph rỗng của Cairo.
 if(target==='uc-chg-02'){
  const svg=readFileSync(dest,'utf8').replace(/<text\b[^>]*>(?:\s|\u00a0|&#160;|&nbsp;)*<\/text>/gu,'');
  writeFileSync(dest,svg);
 }
}
for(const sub of ['park','chg'])for(let n=1;n<=3;n++)for(const folder of ['sequence','activity']){
 const name='uc-'+sub+'-'+String(n).padStart(2,'0');
 let source=resolve(base,folder,name+'.svg');
 if(folder==='sequence'&&name==='uc-chg-02'){
  // Cairo không nhúng được một font của hình này; đổi glyph sang path vector.
  const outlined=resolve(mkdtempSync(resolve(tmpdir(),'semh-chg-outline-')),'diagram.svg');
  run('rsvg-convert',['-f','svg','-o',outlined,source]);
  source=outlined;
 }
 run('rsvg-convert',['-f','pdf','-o',resolve(base,folder,name+'.pdf'),source]);
 console.log(folder+'/'+name);
}
for(const name of ['parking-reservation','parking-space','charging-request','charging-session','charging-point']){
 run('rsvg-convert',['-f','pdf','-o',resolve(base,'state',name+'.pdf'),resolve(base,'state',name+'.svg')]);
 console.log('state/'+name);
}
