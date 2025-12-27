import { Pool } from 'pg';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import * as dotenv from 'dotenv'; // Requires npm install dotenv

// Load environment variables from .env file up one directory
const envPath = path.resolve(__dirname, '../.env');
console.log(`Loading .env from ${envPath}`);
dotenv.config({ path: envPath });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'powertrack',
});

async function seed() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        // 1. Get a valid property ID (First one found)
        const propRes = await client.query('SELECT id, name FROM properties LIMIT 1');
        if (propRes.rows.length === 0) {
            console.error('No properties found! Please create a property via the app first.');
            process.exit(1);
        }
        const propertyId = propRes.rows[0].id;
        console.log(`Seeding data for Property: ${propRes.rows[0].name} (${propertyId})`);

        // 2. Setup File Stream
        // Assuming dataset is in project root: backend/../dataset/household_power_consumption.txt
        const filePath = path.resolve(__dirname, '../../dataset/household_power_consumption.txt');
        console.log(`Reading dataset from: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            console.error('Dataset file not found!');
            process.exit(1);
        }

        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let isHeader = true;
        let batch: any[] = [];
        const BATCH_SIZE = 5000;
        let totalInserted = 0;

        for await (const line of rl) {
            if (isHeader) {
                isHeader = false;
                continue;
            }

            // Columns: Date;Time;Global_active_power;Global_reactive_power;Voltage;Global_intensity;Sub_metering_1;Sub_metering_2;Sub_metering_3
            const cols = line.split(';');
            if (cols.length < 3) continue;

            const dateStr = cols[0]; // 16/12/2006
            const timeStr = cols[1]; // 17:24:00
            const activePower = cols[2];

            // Handle invalid/missing data (?)
            if (activePower === '?' || !dateStr || !timeStr) continue;

            // Parse Date: DD/MM/YYYY -> YYYY-MM-DD
            const [day, month, year] = dateStr.split('/');
            const isoTimestamp = `${year}-${month}-${day}T${timeStr}.000Z`; // Assume UTC or Local? Dataset is usually local French time but let's treat as simple ISO for now.

            batch.push([propertyId, isoTimestamp, 'electric', parseFloat(activePower)]);

            if (batch.length >= BATCH_SIZE) {
                await insertBatch(client, batch);
                totalInserted += batch.length;
                process.stdout.write(`\rInserted: ${totalInserted.toLocaleString()} rows...`);
                batch = [];
            }
        }

        // Insert remaining
        if (batch.length > 0) {
            await insertBatch(client, batch);
            totalInserted += batch.length;
        }

        console.log(`\n\nSuccesfully inserted ${totalInserted} records.`);
        client.release();
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        await pool.end();
    }
}

async function insertBatch(client: any, rows: any[]) {
    if (rows.length === 0) return;

    // Construct query: INSERT INTO consumption (propertyId, date, type, amount) VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)...
    const values: any[] = [];
    const placeholders: string[] = [];

    let paramIdx = 1;
    rows.forEach(row => {
        placeholders.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`);
        values.push(row[0], row[1], row[2], row[3]);
        paramIdx += 4;
    });

    const query = `INSERT INTO consumption (propertyId, date, type, amount) VALUES ${placeholders.join(', ')}`;
    await client.query(query, values);
}

seed();
