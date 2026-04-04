import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define DB path
const dbPath = path.join(process.cwd(), 'data', 'customers.json');

export async function GET() {
  try {
    if (!fs.existsSync(dbPath)) {
       return NextResponse.json([]);
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read database' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const newCustomer = await req.json();
    
    let customers = [];
    if (fs.existsSync(dbPath)) {
       customers = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
    
    // Add unique ID
    newCustomer.id = Math.random().toString(36).substr(2, 9);
    
    // Unshift to put newest at the top
    customers.unshift(newCustomer);
    
    // Write back to DB
    fs.writeFileSync(dbPath, JSON.stringify(customers, null, 2));
    
    return NextResponse.json({ success: true, customer: newCustomer });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save customer' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const updatedCustomer = await req.json();
    
    if (!fs.existsSync(dbPath)) {
       return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }
    
    let customers = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const index = customers.findIndex((c: any) => c.id === updatedCustomer.id);
    
    if (index === -1) {
       return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    
    // Merge updates
    customers[index] = { ...customers[index], ...updatedCustomer };
    
    fs.writeFileSync(dbPath, JSON.stringify(customers, null, 2));
    
    return NextResponse.json({ success: true, customer: customers[index] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}
