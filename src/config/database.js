const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

process.on("SIGINT", async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDatabase();
  process.exit(0);
});

module.exports = {
  prisma,
  checkDatabaseConnection,
  disconnectDatabase,
};
