import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { filename, fileData } = await req.json();
    
    // Extract base64 content
    const base64Data = fileData.split(';base64,').pop();
    
    // Explicit target directory
    const targetDir = 'c:\\Users\\Hp\\Desktop\\BUS MANAGEMNET SYSTEM\\bus-wifi-app\\Invoices';
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const filePath = path.join(targetDir, filename);
    
    // Write directly to local file system
    fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
    
    return NextResponse.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error saving invoice:', error);
    return NextResponse.json({ error: 'Failed to save the invoice' }, { status: 500 });
  }
}
