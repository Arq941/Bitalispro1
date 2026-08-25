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

function collectAssetReferences(value,result=new Set()){
  if(typeof value==='string'){
    const normalized=value.replace(/^\//,'');
    if(normalized.startsWith('static/')&&(normalized.endsWith('.js')||normalized.endsWith('.css'))){
      result.add(normalized);
    }
    return result;
  }
  if(Array.isArray(value)){
    for(const item of value)collectAssetReferences(item,result);
    return result;
  }
  if(value&&typeof value==='object'){
    for(const item of Object.values(value))collectAssetReferences(item,result);
  }
  return result;
}

function verifyManifestAssets(targetNextDir){
  const manifestNames=['build-manifest.json','app-build-manifest.json'];
  const references=new Set();
  for(const manifestName of manifestNames){
    const manifestPath=path.join(nextDir,manifestName);
    if(!fs.existsSync(manifestPath)){
      throw new Error(`BITALIS: falta el manifiesto ${manifestName}.`);
    }
    collectAssetReferences(JSON.parse(fs.readFileSync(manifestPath,'utf8')),references);
  }
  if(references.size<1)throw new Error('BITALIS: los manifiestos no declararon assets estáticos.');
  const missing=[...references].filter(asset=>!fs.existsSync(path.join(targetNextDir,asset)));
  if(missing.length){
    throw new Error(`BITALIS: faltan ${missing.length} chunks declarados:\n${missing.slice(0,20).join('\n')}`);
  }
  return references.size;
}

assertDirectory(standaloneDir,'Salida standalone de Next.js');
assertDirectory(staticDir,'Assets .next/static');
assertDirectory(publicDir,'Directorio public');

const sourceManifestAssets=verifyManifestAssets(nextDir);
const standaloneStatic=path.join(standaloneDir,'.next','static');
const standalonePublic=path.join(standaloneDir,'public');
copyDirectory(staticDir,standaloneStatic);
copyDirectory(publicDir,standalonePublic);
const packagedManifestAssets=verifyManifestAssets(path.join(standaloneDir,'.next'));

const cssFiles=countFiles(standaloneStatic,file=>file.endsWith('.css'));
const jsFiles=countFiles(standaloneStatic,file=>file.endsWith('.js'));
const buildMarker=path.join(standalonePublic,'build-version.txt');
const serviceWorker=path.join(standalonePublic,'sw.js');

if(cssFiles<1)throw new Error('BITALIS: el build no produjo CSS dentro de .next/static.');
if(jsFiles<1)throw new Error('BITALIS: el build no produjo chunks JavaScript dentro de .next/static.');
if(!fs.existsSync(buildMarker))throw new Error('BITALIS: build-version.txt no fue copiado al standalone public.');
if(!fs.existsSync(serviceWorker))throw new Error('BITALIS: sw.js no fue copiado al standalone public.');
if(sourceManifestAssets!==packagedManifestAssets)throw new Error('BITALIS: el paquete standalone no coincide con los manifiestos.');

console.log(`BITALIS standalone listo: ${cssFiles} CSS, ${jsFiles} JS y ${packagedManifestAssets} assets de manifiesto verificados.`);
