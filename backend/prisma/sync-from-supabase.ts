/**
 * One-time sync: copies companies + users from Supabase Postgres → local Docker Postgres.
 * Run once after switching DATABASE_URL to Docker.
 *
 * Usage:
 *   cd backend
 *   npx ts-node -r tsconfig-paths/register prisma/sync-from-supabase.ts
 */

import { PrismaClient } from '@prisma/client';

const supabase = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.fnvdggypgnsximoomeme:X0HjhwaSeLFjHesv@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
    },
  },
});

const local = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://reviewly:reviewly@localhost:5433/reviewly',
    },
  },
});

async function main() {
  console.log('🔄 Syncing Supabase → local Docker Postgres\n');

  // ── 1. Companies ────────────────────────────────────────────────
  const companies = await (supabase as any).company.findMany();
  console.log(`Found ${companies.length} companies in Supabase`);

  for (const c of companies) {
    await (local as any).company.upsert({
      where: { id: c.id },
      create: c,
      update: c,
    });
  }
  console.log(`✅ Companies synced\n`);

  // ── 2. Users (no FK on managerId yet — insert all first) ────────
  const users = await (supabase as any).user.findMany();
  console.log(`Found ${users.length} users in Supabase`);

  // Insert without managerId to avoid FK issues
  for (const u of users) {
    const { managerId, ...rest } = u;
    await (local as any).user.upsert({
      where: { id: u.id },
      create: { ...rest, managerId: null },
      update: { ...rest, managerId: null },
    });
  }

  // Second pass: set managerId
  for (const u of users) {
    if (u.managerId) {
      await (local as any).user.update({
        where: { id: u.id },
        data: { managerId: u.managerId },
      });
    }
  }
  console.log(`✅ Users synced\n`);

  // ── 3. Summary ──────────────────────────────────────────────────
  const localCompanyCount = await (local as any).company.count();
  const localUserCount = await (local as any).user.count();
  console.log('🎉 Sync complete!');
  console.log(`   Companies: ${localCompanyCount}`);
  console.log(`   Users:     ${localUserCount}`);
  console.log('\nYour existing credentials should now work against local Docker.');
}

main()
  .catch((e) => {
    console.error('❌ Sync failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await supabase.$disconnect();
    await local.$disconnect();
  });
