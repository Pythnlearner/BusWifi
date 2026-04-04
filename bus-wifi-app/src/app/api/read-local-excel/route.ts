import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { targetPath } = await req.json();
    
    if (!targetPath) {
      return NextResponse.json({ error: 'Target path required' }, { status: 400 });
    }

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: `File not found at target location: ${targetPath}` }, { status: 404 });
    }

    // Read the binary file directly and base64 encode it for safe JSON transport over the network
    const fileBuffer = fs.readFileSync(targetPath);
    const base64Data = fileBuffer.toString('base64');
    
    return NextResponse.json({ success: true, fileData: base64Data });
  } catch (error: any) {
    console.error('File parsing engine error:', error);
    return NextResponse.json({ error: `System cannot access file: ${error.message}` }, { status: 500 });
  }
}
