const fs = require('fs');

const run = async () => {
    try {
        console.log("Fetching CSV from Google Sheets...");
        const res = await fetch('https://docs.google.com/spreadsheets/d/1-bvR8Jpc3jRCY9SCqYbJS40R2-7WQBu2BGz2nYSnPyY/export?format=csv');
        const text = await res.text();
        
        console.log("Parsing CSV...");
        const parseCSV = (str) => {
            const result = [];
            let row = [];
            let inQuote = false;
            let buf = '';
            for (let i = 0; i < str.length; i++) {
                let c = str[i], next = str[i+1];
                if (c === '"') {
                    if (inQuote && next === '"') { buf += '"'; i++; }
                    else { inQuote = !inQuote; }
                } else if (c === ',' && !inQuote) {
                    row.push(buf); buf = '';
                } else if ((c === '\n' || c === '\r') && !inQuote) {
                    if (c === '\r' && next === '\n') i++;
                    row.push(buf);
                    result.push(row);
                    row = []; buf = '';
                } else {
                    buf += c;
                }
            }
            if (buf) row.push(buf);
            if (row.length > 0) result.push(row);
            return result;
        };

        const rows = parseCSV(text);
        
        // Map to structured JSON
        const data = rows.slice(1).map(row => {
            return {
               id: Math.random().toString(36).substr(2, 9),
               busNo: row[12] ? row[12].trim() : 'N/A', // V. No.
               contactNo: row[3] ? row[3].trim() : 'N/A', // Contact No.
               wifiSn: row[15] ? row[15].trim() : 'N/A', // Device Serial No.
               packageApplied: row[23] ? row[23].trim() : 'N/A', // Internet Package Type
               installDate: row[21] ? row[21].trim() : 'N/A', // Internet Activation Date
               expiryDate: row[22] ? row[22].trim() : 'N/A', // Internet Expiry Date
               status: row[24] ? row[24].trim() : 'N/A' // STATUS
            };
        }).filter(r => r.busNo !== 'N/A' && r.busNo !== ''); // Exclude empty rows
        
        const dir = 'c:\\Users\\Hp\\Desktop\\BUS MANAGEMNET SYSTEM\\bus-wifi-app\\data';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(`${dir}\\customers.json`, JSON.stringify(data, null, 2));
        console.log(`Successfully migrated ${data.length} customer records to local JSON database!`);
    } catch(e) {
        console.error("Migration failed:", e);
    }
};
run();
