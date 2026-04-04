import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'customers.json');

export async function POST(req: Request) {
  try {
    const bulkData = await req.json();
    
    // Ensure data dir exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // Automated Backup System Integration
    if (fs.existsSync(dbPath)) {
        const backupPath = path.join(dir, `customers_backup_${Date.now()}.json`);
        fs.copyFileSync(dbPath, backupPath);
    }
    
    fs.writeFileSync(dbPath, JSON.stringify(bulkData, null, 2));
    
    return NextResponse.json({ success: true, count: bulkData.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to bulk save database' }, { status: 500 });
  }
}
