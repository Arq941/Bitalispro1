const fs=require('fs');
const path=require('path');

const target=process.env.BITALIS_UPLOAD_DIR||path.join(process.env.HOME||path.resolve(process.cwd(),'..'),'.bitalis','media');
const sources=[
 path.join(process.cwd(),'storage','client-media'),
 path.join(process.cwd(),'.next','standalone','storage','client-media'),
];
let copied=0;
for(const source of sources){
 if(!fs.existsSync(source)||path.resolve(source)===path.resolve(target))continue;
 fs.mkdirSync(target,{recursive:true});
 fs.cpSync(source,target,{recursive:true,force:false,errorOnExist:false});
 copied++;
}
console.log(copied?`BITALIS media migration: ${copied} source(s) copied to persistent storage.`:`BITALIS media migration: persistent directory ready at ${target}.`);
