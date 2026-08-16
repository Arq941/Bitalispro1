const fs=require('node:fs');
const path=require('node:path');

const root=process.cwd();
const nextDir=path.join(root,'.next');
const standaloneDir=path.join(nextDir,'standalone');
const staticDir=path.join(nextDir,'static');
const publicDir=path.join(root,'public');

function assertDirectory(dir,label){
  if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory()){
    throw new Error(`${label} no existe: ${dir}`);
  }
}

function copyDirectory(source,target){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.rmSync(target,{recursive:true,force:true});
  fs.cpSync(source,target,{recursive:true,force:true});
}

function countFiles(dir,predicate){
  let count=0;
  const walk=(current)=>{
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const full=path.join(current,entry.name);
      if(entry.isDirectory())walk(full);
      else if(predicate(full))count++;
    }
  };
  walk(dir);
  return count;
}

assertDirectory(standaloneDir,'Salida standalone de Next.js');
assertDirectory(staticDir,'Assets .next/static');
assertDirectory(publicDir,'Directorio public');

const standaloneStatic=path.join(standaloneDir,'.next','static');
const standalonePublic=path.join(standaloneDir,'public');
copyDirectory(staticDir,standaloneStatic);
copyDirectory(publicDir,standalonePublic);

const cssFiles=countFiles(standaloneStatic,file=>file.endsWith('.css'));
const jsFiles=countFiles(standaloneStatic,file=>file.endsWith('.js'));
const buildMarker=path.join(standalonePublic,'build-version.txt');

if(cssFiles<1)throw new Error('BITALIS: el build no produjo CSS dentro de .next/static.');
if(jsFiles<1)throw new Error('BITALIS: el build no produjo chunks JavaScript dentro de .next/static.');
if(!fs.existsSync(buildMarker))throw new Error('BITALIS: build-version.txt no fue copiado al standalone public.');

console.log(`BITALIS standalone listo: ${cssFiles} CSS, ${jsFiles} JS; public y .next/static incluidos.`);
