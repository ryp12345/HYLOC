const fs = require('fs');
const path = require('path');
const pool = require('./db');

const runMigrations = async () => {
  try {
    console.log('🚀 Starting database migrations...');

    // Read and execute migration files
    const migrationsDir = path.join(__dirname, '../../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        console.log(`⏳ Running migration: ${file}`);
        await pool.query(sql);
        console.log(`✅ Completed: ${file}`);
      }
    }

    // Read and execute seeder files
    const seedersDir = path.join(__dirname, '../../database/seeders');
    const seederFiles = fs.readdirSync(seedersDir).sort();

    for (const file of seederFiles) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(seedersDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        console.log(`⏳ Running seeder: ${file}`);
        await pool.query(sql);
        console.log(`✅ Completed: ${file}`);
      }
    }

    console.log('✨ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
