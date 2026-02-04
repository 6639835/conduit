/**
 * Seed script to create an admin user
 *
 * Usage:
 *   npm run db:seed                                    # Interactive mode
 *   npm run db:seed -- --email admin@example.com --password securepass --name "Admin User"
 *   echo -n "securepass" | npm run db:seed -- --email admin@example.com --password-stdin --name "Admin User"
 *   npm run db:seed -- --email admin@example.com       # Will prompt for password and name
 *   npm run db:seed -- --email admin@example.com --skip-if-exists
 *   npm run db:seed -- --email admin@example.com --update-if-exists --password-stdin --name "New Name"
 */

// Load environment variables from .env.local BEFORE any other imports
import { config } from 'dotenv';
import * as fs from 'node:fs';
import { dirname, resolve } from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(scriptDir, '../.env.local');
const envPath = fs.existsSync(envLocalPath) ? envLocalPath : resolve(scriptDir, '../.env');
config({ path: envPath });

interface AdminInput {
  email: string;
  password: string;
  name: string;
}

type SeedArgs = Partial<AdminInput> & { passwordStdin?: boolean };
type SeedModeArgs = { skipIfExists?: boolean; updateIfExists?: boolean };

// Parse command line arguments
function parseArgs(): SeedArgs & SeedModeArgs {
  const args: SeedArgs & SeedModeArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--email' && argv[i + 1]) {
      args.email = argv[i + 1];
      i++;
    } else if (argv[i] === '--password' && argv[i + 1]) {
      args.password = argv[i + 1];
      i++;
    } else if (argv[i] === '--password-stdin') {
      args.passwordStdin = true;
    } else if (argv[i] === '--skip-if-exists') {
      args.skipIfExists = true;
    } else if (argv[i] === '--update-if-exists') {
      args.updateIfExists = true;
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

function promptHidden(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const anyRl = rl as unknown as { stdoutMuted?: boolean; _writeToOutput?: (s: string) => void; output: NodeJS.WriteStream };
  anyRl.stdoutMuted = true;
  anyRl._writeToOutput = (stringToWrite: string) => {
    if (anyRl.stdoutMuted) {
      if (stringToWrite.trim() !== '') anyRl.output.write('*');
      return;
    }
    anyRl.output.write(stringToWrite);
  };

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      anyRl.stdoutMuted = false;
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error('--password-stdin requires piped stdin'));
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
  });
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function getAdminEmail(args: { email?: string }): Promise<string> {
  const email = args.email ?? (await prompt('Enter admin email: '));
  if (!isValidEmail(email)) {
    console.error('❌ Invalid email format');
    process.exit(1);
  }
  return email;
}

async function getAdminName(args: { name?: string }, email: string): Promise<string> {
  if (args.name) return args.name;
  const nameInput = await prompt('Enter admin name (optional, press Enter to skip): ');
  return nameInput || email.split('@')[0];
}

async function getAdminPassword(args: { password?: string; passwordStdin?: boolean }): Promise<string> {
  if (args.password) return args.password;
  if (args.passwordStdin) return readPasswordFromStdin();
  if (process.stdin.isTTY) return promptHidden('Enter admin password: ');
  return readPasswordFromStdin();
}

function validatePassword(password: string) {
  if (password.length < 6) {
    console.error('❌ Password must be at least 6 characters long');
    process.exit(1);
  }
}

async function seed() {
  console.log('🌱 Creating admin user...\n');

  try {
    // Import db and related modules AFTER dotenv is loaded
    const { db } = await import('../src/lib/db');
    const { admins } = await import('../src/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const { hash } = await import('bcryptjs');

    const args = parseArgs();
    if (args.skipIfExists && args.updateIfExists) {
      console.error('❌ Choose only one: --skip-if-exists or --update-if-exists');
      process.exit(1);
    }

    const email = await getAdminEmail(args);

    const existingAdmins = await db
      .select({ id: admins.id, isActive: admins.isActive, createdAt: admins.createdAt })
      .from(admins)
      .where(eq(admins.email, email));
    const existing = existingAdmins[0];

    if (existing) {
      if (args.skipIfExists) {
        console.log('ℹ️  Admin already exists; skipping.');
        console.log('┌─────────────────────────────────────────');
        console.log('│ Email:   ', email);
        console.log('│ ID:      ', existing.id);
        console.log('│ Active:  ', existing.isActive);
        console.log('│ Created: ', new Date(existing.createdAt as unknown as string | number | Date).toISOString());
        console.log('└─────────────────────────────────────────');
        process.exit(0);
      }

      if (args.updateIfExists) {
        const password = await getAdminPassword(args);
        validatePassword(password);
        const name = await getAdminName(args, email);

        console.log('\n🔒 Hashing password...');
        const passwordHash = await hash(password, 10);

        console.log('💾 Updating admin in database...');
        const [admin] = await db
          .update(admins)
          .set({
            passwordHash,
            name,
            updatedAt: new Date(),
          })
          .where(eq(admins.id, existing.id))
          .returning();

        console.log('\n✅ Admin user updated successfully!');
        console.log('┌─────────────────────────────────────────');
        console.log('│ Email:   ', email);
        console.log('│ Name:    ', name);
        console.log('│ ID:      ', admin.id);
        console.log('│ Active:  ', admin.isActive);
        console.log('│ Created: ', new Date(admin.createdAt as unknown as string | number | Date).toISOString());
        console.log('└─────────────────────────────────────────');

        if (password === 'admin123' || password.includes('password')) {
          console.log('\n⚠️  WARNING: You are using a weak password!');
          console.log('   Please change it after first login in production!');
        }

        console.log('\n📝 You can now login at: http://localhost:3000/login');
        process.exit(0);
      }

      console.error('\n❌ Admin user with this email already exists');
      console.log('💡 Re-run with --skip-if-exists, or --update-if-exists to rotate credentials');
      process.exit(1);
    }

    const password = await getAdminPassword(args);
    validatePassword(password);
    const name = await getAdminName(args, email);

    // Hash password
    console.log('\n🔒 Hashing password...');
    const passwordHash = await hash(password, 10);

    // Create admin user
    console.log('💾 Creating admin in database...');
    const [admin] = await db.insert(admins).values({
      email,
      passwordHash,
      name,
    }).returning();

    console.log('\n✅ Admin user created successfully!');
    console.log('┌─────────────────────────────────────────');
    console.log('│ Email:   ', email);
    console.log('│ Name:    ', name);
    console.log('│ ID:      ', admin.id);
    console.log('│ Active:  ', admin.isActive);
    console.log('│ Created: ', new Date(admin.createdAt as unknown as string | number | Date).toISOString());
    console.log('└─────────────────────────────────────────');

    if (password === 'admin123' || password.includes('password')) {
      console.log('\n⚠️  WARNING: You are using a weak password!');
      console.log('   Please change it after first login in production!');
    }

    console.log('\n📝 You can now login at: http://localhost:3000/login');

    process.exit(0);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      const args = parseArgs();
      if (args.skipIfExists) {
        console.log('\nℹ️  Admin already exists; skipping.');
        process.exit(0);
      }
      if (args.updateIfExists) {
        console.log('\nℹ️  Admin already exists; updating (detected during insert).');
        try {
          const { db } = await import('../src/lib/db');
          const { admins } = await import('../src/lib/db/schema');
          const { eq } = await import('drizzle-orm');
          const { hash } = await import('bcryptjs');

          const email = await getAdminEmail(args);
          const password = await getAdminPassword(args);
          validatePassword(password);
          const name = await getAdminName(args, email);

          console.log('\n🔒 Hashing password...');
          const passwordHash = await hash(password, 10);

          console.log('💾 Updating admin in database...');
          const [admin] = await db
            .update(admins)
            .set({
              passwordHash,
              name,
              updatedAt: new Date(),
            })
            .where(eq(admins.email, email))
            .returning();

          console.log('\n✅ Admin user updated successfully!');
          console.log('┌─────────────────────────────────────────');
          console.log('│ Email:   ', email);
          console.log('│ Name:    ', name);
          console.log('│ ID:      ', admin.id);
          console.log('│ Active:  ', admin.isActive);
          console.log('│ Created: ', new Date(admin.createdAt as unknown as string | number | Date).toISOString());
          console.log('└─────────────────────────────────────────');
          process.exit(0);
        } catch (updateError: unknown) {
          console.error('\n❌ Failed to update existing admin after unique violation:', updateError);
          process.exit(1);
        }
      }
      console.error('\n❌ Admin user with this email already exists');
      console.log('💡 Re-run with --skip-if-exists, or --update-if-exists to rotate credentials');
      process.exit(1);
    }
    console.error('\n❌ Error creating admin user:', error);
    process.exit(1);
  }
}

seed();
