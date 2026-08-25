import { PrismaClient, UserRole, StoreType } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding OTLOB database...');

  // --- Store types -----------------------------------------------------
  const storeTypesData = [
    { nameAr: 'مطاعم', nameEn: 'Restaurants' },
    { nameAr: 'صيدليات', nameEn: 'Pharmacies' },
    { nameAr: 'سوبر ماركت', nameEn: 'Supermarkets' },
    { nameAr: 'كافيهات', nameEn: 'Cafes' },
    { nameAr: 'محلات', nameEn: 'Stores' },
  ];

  const storeTypes: StoreType[] = [];
  for (const st of storeTypesData) {
    const existing = await prisma.storeType.findFirst({ where: { nameEn: st.nameEn } });
    const created = existing ?? (await prisma.storeType.create({ data: st }));
    storeTypes.push(created);
  }

  // --- Zones / districts (New Administrative Capital) -------------------
  const existingZone = await prisma.zone.findFirst({ where: { nameEn: 'New Administrative Capital' } });
  const zone =
    existingZone ??
    (await prisma.zone.create({
      data: { nameAr: 'العاصمة الإدارية الجديدة', nameEn: 'New Administrative Capital' },
    }));

  const districtsData = [
    { nameAr: 'الحي السكني الأول', nameEn: 'Residential District R1' },
    { nameAr: 'الحي السكني الثالث', nameEn: 'Residential District R3' },
    { nameAr: 'الحي الحكومي', nameEn: 'Government District' },
  ];
  for (const d of districtsData) {
    const existingDistrict = await prisma.district.findFirst({
      where: { zoneId: zone.id, nameEn: d.nameEn },
    });
    if (!existingDistrict) {
      await prisma.district.create({ data: { zoneId: zone.id, ...d } });
    }
  }

  // --- Super admin account ----------------------------------------------
  const adminPassword = await argon2.hash('ChangeMe123!');
  await prisma.user.upsert({
    where: { email: 'admin@otlob.app' },
    update: {},
    create: {
      fullName: 'OTLOB Super Admin',
      email: 'admin@otlob.app',
      passwordHash: adminPassword,
      role: UserRole.SUPER_ADMIN,
      // Seeded accounts skip the email verification flow entirely — there's
      // no inbox to receive a code, and this account needs to be usable
      // immediately after seeding.
      isVerified: true,
    },
  });

  console.log('Seed complete. Super admin: admin@otlob.app / ChangeMe123! (change this immediately)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
