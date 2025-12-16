/**
 * Seed script to create the first admin user
 * Run with: npm run db:seed
 */

import { db } from '../src/lib/db';
import { admins } from '../src/lib/db/schema';
import { hash } from 'bcryptjs';

async function seed() {
  console.log('Seeding database...');

  try {
    // Create admin user
    const passwordHash = await hash('admin123', 10);

    const [admin] = await db.insert(admins).values({
      email: 'admin@conduit.local',
      passwordHash,
      name: 'Admin User',
    }).returning();

    console.log('✅ Admin user created successfully!');
    console.log('   Email: admin@conduit.local');
    console.log('   Password: admin123');
    console.log('   ID:', admin.id);
    console.log('\n⚠️  IMPORTANT: Change the admin password in production!');

    process.exit(0);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      console.log('ℹ️  Admin user already exists');
      process.exit(0);
    }
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
