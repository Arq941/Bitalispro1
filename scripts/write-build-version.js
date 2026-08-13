const {execSync}=require('node:child_process');
const {writeFileSync}=require('node:fs');
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
  'marker=ux-legacy-cleanup',
  '',
].join('\n');

writeFileSync(join(process.cwd(),'public','build-version.txt'),content,'utf8');
console.log(`BITALIS build marker: ${commit}`);
