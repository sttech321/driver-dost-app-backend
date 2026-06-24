import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Drivers around Mohali/Sector 91-92 area shown in the designs.
const drivers = [
  { code: 'DDO023', name: 'Sunil Kumar', title: 'Master Driver', rating: 4.7, ratingCount: 56, lat: 30.69, lng: 76.72, phone: '+919000000023' },
  { code: 'DDO024', name: 'Rajesh Singh', title: 'Master Driver', rating: 4.5, ratingCount: 1012, lat: 30.7, lng: 76.71, phone: '+919000000024' },
  { code: 'DDO025', name: 'Amit Sharma', title: 'Verified Driver', rating: 4.8, ratingCount: 230, lat: 30.71, lng: 76.73, phone: '+919000000025' },
  { code: 'DDO026', name: 'Vikram Yadav', title: 'Verified Driver', rating: 4.6, ratingCount: 145, lat: 30.68, lng: 76.7, phone: '+919000000026' },
  { code: 'DDO027', name: 'Harpreet Gill', title: 'Master Driver', rating: 4.9, ratingCount: 502, lat: 30.72, lng: 76.74, phone: '+919000000027' },
];

async function main() {
  for (const d of drivers) {
    await prisma.driver.upsert({
      where: { code: d.code },
      update: d,
      create: d,
    });
  }
  console.log(`[seed] Upserted ${drivers.length} drivers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
