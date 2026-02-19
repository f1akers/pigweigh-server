import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from '../src/utils/prisma';

async function main() {
  const password = await bcrypt.hash('admin123', 10);

  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password,
      name: 'Default Admin',
    },
  });

  console.log(`✅ Seeded admin: ${admin.username} (id: ${admin.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
