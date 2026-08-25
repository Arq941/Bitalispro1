const {execSync}=require('node:child_process');
const {mkdirSync,readFileSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');

function resolveCommit(){
  const candidates=[
    process.env.GITHUB_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.CI_COMMIT_SHA,
    process.env.SOURCE_COMMIT,
  ].filter(Boolean);
  if(candidates.length) return candidates[0];
  try{
    return execSync('git rev-parse HEAD',{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  }catch{
    return 'unknown';
  }
}

const commit=resolveCommit();
const builtAt=new Date().toISOString();
const content=[
  'BITALIS BUILD',
  `commit=${commit}`,
  `built_at=${builtAt}`,
  'marker=client-build-coherence',
  '',
].join('\n');

writeFileSync(join(process.cwd(),'public','build-version.txt'),content,'utf8');

const serviceWorkerPath=join(process.cwd(),'public','sw.js');
const serviceWorker=readFileSync(serviceWorkerPath,'utf8');
const versionedServiceWorker=serviceWorker.replace(
  /const BUILD_COMMIT='[^']*';/,
  `const BUILD_COMMIT=${JSON.stringify(commit)};`,
);
if(versionedServiceWorker===serviceWorker&&!serviceWorker.includes(`const BUILD_COMMIT=${JSON.stringify(commit)};`)){
  throw new Error('BITALIS: no se encontró BUILD_COMMIT en public/sw.js.');
}
writeFileSync(serviceWorkerPath,versionedServiceWorker,'utf8');

const generatedDir=join(process.cwd(),'lib','generated');
mkdirSync(generatedDir,{recursive:true});
const generated=[
  '// Generado automáticamente por scripts/write-build-version.js. No editar durante el build.',
  `export const BITALIS_BUILD_COMMIT: string = ${JSON.stringify(commit)};`,
  '',
].join('\n');
writeFileSync(join(generatedDir,'buildInfo.ts'),generated,'utf8');
console.log(`BITALIS build marker y service worker: ${commit}`);
