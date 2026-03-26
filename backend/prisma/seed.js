const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mudrek.com' },
    update: {},
    create: {
      name: 'مدير النظام',
      email: 'admin@mudrek.com',
      password: hashedPassword,
      role: 'ADMIN',
      active: true,
    },
  });

  console.log('Seed complete. Admin created:', admin.email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
