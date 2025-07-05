const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('data.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('✅ Connected to the SQLite database.');
});

// בדיקת מבנה הטבלה
db.all("PRAGMA table_info(transactions)", [], (err, rows) => {
    if (err) {
        console.error('Error getting table info:', err.message);
        return;
    }
    
    console.log('\n📋 מבנה טבלת transactions:');
    console.log('================================');
    rows.forEach(row => {
        console.log(`${row.name} (${row.type}) - ${row.notnull ? 'NOT NULL' : 'NULL'}`);
    });
});

// בדיקת נתונים אחרונים
db.all("SELECT * FROM transactions ORDER BY id DESC LIMIT 3", [], (err, rows) => {
    if (err) {
        console.error('Error getting recent transactions:', err.message);
        return;
    }
    
    console.log('\n📊 3 השליחויות האחרונות:');
    console.log('================================');
    if (rows.length === 0) {
        console.log('אין שליחויות במסד הנתונים');
    } else {
        rows.forEach((row, index) => {
            console.log(`${index + 1}. ID: ${row.id}`);
            console.log(`   נמען: ${row.recipient}`);
            console.log(`   פריט: ${row.item}`);
            console.log(`   סכום: ${row.amount}`);
            console.log(`   כתובת: ${row.address || 'לא קיים'}`);
            console.log(`   טלפון: ${row.phone || 'לא קיים'}`);
            console.log(`   יעד (ישן): ${row.destination || 'לא קיים'}`);
            console.log(`   זמן: ${row.timestamp}`);
            console.log('   ---');
        });
    }
    
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('\n✅ Database connection closed.');
        }
    });
});