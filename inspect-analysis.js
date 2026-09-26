const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function main() {
  const results = await db.analysisResult.findMany({
    include: { mediaAsset: true }
  });

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
