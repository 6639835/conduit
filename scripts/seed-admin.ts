/**
 * Seed script to create an admin user
 *
 * Usage:
 *   npm run db:seed                                    # Interactive mode
 *   npm run db:seed -- --email admin@example.com --password securepass --name "Admin User"
 *   npm run db:seed -- --email admin@example.com       # Will prompt for password and name
 */

import { db } from '../src/lib/db';
import { admins } from '../src/lib/db/schema';
import { hash } from 'bcryptjs';
import * as readline from 'readline';

interface AdminInput {
  email: string;
  password: string;
  name: string;
}

// Parse command line arguments
function parseArgs(): Partial<AdminInput> {
  const args: Partial<AdminInput> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--email' && argv[i + 1]) {
      args.email = argv[i + 1];
      i++;
    } else if (argv[i] === '--password' && argv[i + 1]) {
      args.password = argv[i + 1];
      i++;
    } else if (argv[i] === '--name' && argv[i + 1]) {
      args.name = argv[i + 1];
      i++;
    }
  }

  return args;
}

// Prompt user for input
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Get admin input (from args or prompts)
async function getAdminInput(): Promise<AdminInput> {
  const args = parseArgs();
  const input: Partial<AdminInput> = { ...args };

  // Get email
  if (!input.email) {
    input.email = await prompt('Enter admin email: ');
  }

  // Validate email
  if (!isValidEmail(input.email)) {
    console.error('❌ Invalid email format');
    process.exit(1);
  }

  // Get password
  if (!input.password) {
    input.password = await prompt('Enter admin password: ');
  }

  // Validate password
  if (input.password.length < 6) {
    console.error('❌ Password must be at least 6 characters long');
    process.exit(1);
  }

  // Get name
  if (!input.name) {
    const nameInput = await prompt('Enter admin name (optional, press Enter to skip): ');
    input.name = nameInput || input.email.split('@')[0];
  }

  return input as AdminInput;
}

async function seed() {
  console.log('🌱 Creating admin user...\n');

  try {
    // Get admin input
    const adminInput = await getAdminInput();

    // Hash password
    console.log('\n🔒 Hashing password...');
    const passwordHash = await hash(adminInput.password, 10);

    // Create admin user
    console.log('💾 Creating admin in database...');
    const [admin] = await db.insert(admins).values({
      email: adminInput.email,
      passwordHash,
      name: adminInput.name,
    }).returning();

    console.log('\n✅ Admin user created successfully!');
    console.log('┌─────────────────────────────────────────');
    console.log('│ Email:   ', adminInput.email);
    console.log('│ Name:    ', adminInput.name);
    console.log('│ ID:      ', admin.id);
    console.log('│ Active:  ', admin.isActive);
    console.log('│ Created: ', admin.createdAt.toISOString());
    console.log('└─────────────────────────────────────────');

    if (adminInput.password === 'admin123' || adminInput.password.includes('password')) {
      console.log('\n⚠️  WARNING: You are using a weak password!');
      console.log('   Please change it after first login in production!');
    }

    console.log('\n📝 You can now login at: http://localhost:3000/login');

    process.exit(0);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      console.error('\n❌ Admin user with this email already exists');
      console.log('💡 Try using a different email address');
      process.exit(1);
    }
    console.error('\n❌ Error creating admin user:', error);
    process.exit(1);
  }
}

seed();
