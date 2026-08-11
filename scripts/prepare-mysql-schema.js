const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const target = path.join(__dirname, '..', 'prisma', 'schema.mysql.prisma');

if (!fs.existsSync(source)) {
  throw new Error(`No se encontró ${source}`);
}

const schema = fs.readFileSync(source, 'utf8');
const mysqlSchema = schema.replace(
  /datasource db \{([\s\S]*?)provider\s*=\s*"postgresql"([\s\S]*?)\}/m,
  (_match, beforeProvider, afterProvider) =>
    `datasource db {${beforeProvider}provider = "mysql"${afterProvider}}`
);

if (mysqlSchema === schema) {
  throw new Error('No se encontró provider = "postgresql" en prisma/schema.prisma');
}

fs.writeFileSync(target, mysqlSchema, 'utf8');
console.log(`MySQL Prisma schema generado: ${target}`);
