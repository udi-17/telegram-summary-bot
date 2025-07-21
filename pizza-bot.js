require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');

// יצירת מסד נתונים
const db = new sqlite3.Database('pizza.db');

// יצירת טבלאות במסד הנתונים
db.serialize(() => {
    // טבלת מוצרים
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        available BOOLEAN DEFAULT 1,
        image_url TEXT
    )`);

    // טבלת הזמנות
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_phone TEXT NOT NULL,
        customer_name TEXT,
        items TEXT NOT NULL,
        total_price REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivery_address TEXT,
        notes TEXT
    )`);

    // טבלת משתמשים
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        name TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // הכנסת מוצרי פיצריה לדוגמה
    const sampleProducts = [
        { name: 'פיצה מרגריטה', description: 'עגבניות, מוצרלה, בזיליקום', price: 45.0, category: 'pizza' },
        { name: 'פיצה פפרוני', description: 'פפרוני, מוצרלה, עגבניות', price: 52.0, category: 'pizza' },
        { name: 'פיצה יוונית', description: 'זיתים, פטה, עגבניות, בצל', price: 58.0, category: 'pizza' },
        { name: 'פיצה 4 גבינות', description: 'מוצרלה, פרמזן, רוקפור, גבינה כחולה', price: 65.0, category: 'pizza' },
        { name: 'פיצה ירקות', description: 'פלפלים, בצל, זיתים, עגבניות', price: 48.0, category: 'pizza' },
        { name: 'משקה קולה', description: 'משקה קולה 330 מ"ל', price: 8.0, category: 'drinks' },
        { name: 'משקה ספרייט', description: 'משקה ספרייט 330 מ"ל', price: 8.0, category: 'drinks' },
        { name: 'סלט יווני', description: 'סלט יווני טרי עם רוטב זיתים', price: 25.0, category: 'sides' },
        { name: 'לחם שום', description: 'לחם שום טרי מהתנור', price: 12.0, category: 'sides' },
        { name: 'צ\'יפס', description: 'צ\'יפס טרי עם מלח', price: 15.0, category: 'sides' }
    ];

    // בדיקה אם יש כבר מוצרים
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)");
            sampleProducts.forEach(product => {
                stmt.run(product.name, product.description, product.price, product.category);
            });
            stmt.finalize();
            console.log('✅ הוכנסו מוצרי דוגמה למסד הנתונים');
        }
    });
});

// יצירת בוט וואטסאפ
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// יצירת שרת Express
const app = express();
const PORT = process.env.PORT || 3000;

// הגדרת קבצים סטטיים
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// נתיב ראשי
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API לקבלת מוצרים
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products WHERE available = 1", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API לקבלת הזמנות
app.get('/api/orders', (req, res) => {
    db.all("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API לעדכון סטטוס הזמנה
app.post('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    db.run("UPDATE orders SET status = ? WHERE id = ?", [status, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, affectedRows: this.changes });
    });
});

// פונקציות עזר
function formatMenu() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM products WHERE available = 1 ORDER BY category, name", (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            let menu = "🍕 *תפריט הפיצריה שלנו:*\n\n";
            let currentCategory = '';

            rows.forEach(product => {
                if (product.category !== currentCategory) {
                    currentCategory = product.category;
                    switch (currentCategory) {
                        case 'pizza':
                            menu += "🍕 *פיצות:*\n";
                            break;
                        case 'drinks':
                            menu += "🥤 *משקאות:*\n";
                            break;
                        case 'sides':
                            menu += "🍟 *תוספות:*\n";
                            break;
                    }
                }
                menu += `• ${product.name} - ₪${product.price}\n`;
                if (product.description) {
                    menu += `  _${product.description}_\n`;
                }
                menu += '\n';
            });

            menu += "💡 *איך להזמין:*\n";
            menu += "• שלח את שם המוצר\n";
            menu += "• או שלח מספר המוצר\n";
            menu += "• שלח 'עגלה' לראות את ההזמנה שלך\n";
            menu += "• שלח 'סיים' לסיום ההזמנה";

            resolve(menu);
        });
    });
}

function getUserCart(phone) {
    return new Promise((resolve, reject) => {
        // כאן נוכל להוסיף לוגיקה לשמירת עגלת קניות
        // כרגע נשתמש בזיכרון פשוט
        resolve([]);
    });
}

function saveOrder(phone, items, totalPrice, address = '', notes = '') {
    return new Promise((resolve, reject) => {
        const itemsJson = JSON.stringify(items);
        db.run(
            "INSERT INTO orders (customer_phone, items, total_price, delivery_address, notes) VALUES (?, ?, ?, ?, ?)",
            [phone, itemsJson, totalPrice, address, notes],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.lastID);
            }
        );
    });
}

// משתנים גלובליים
const userStates = new Map();
const userCarts = new Map();

// טיפול בהודעות נכנסות
client.on('message', async (message) => {
    const phone = message.from;
    const text = message.body.toLowerCase();
    
    console.log(`📨 קיבלתי הודעה מ-${phone}: ${text}`);

    // בדיקת מצב המשתמש
    const userState = userStates.get(phone) || 'main';
    
    if (text === '!start' || text === '/start' || text === 'התחל') {
        const welcomeMessage = `🍕 *ברוכים הבאים לפיצריה שלנו!*

אני בוט וואטסאפ חכם שיעזור לכם להזמין פיצה טעימה!

📋 *מה אני יכול לעשות:*
• הצגת תפריט - שלח 'תפריט'
• הזמנת מוצרים - שלח שם המוצר
• צפייה בעגלה - שלח 'עגלה'
• סיום הזמנה - שלח 'סיים'
• עזרה - שלח 'עזרה'

🎯 בואו נתחיל! שלח 'תפריט' לראות את התפריט שלנו...`;

        userStates.set(phone, 'main');
        await client.sendMessage(phone, welcomeMessage);
    }
    else if (text === 'תפריט' || text === 'menu') {
        try {
            const menu = await formatMenu();
            await client.sendMessage(phone, menu);
        } catch (error) {
            console.error('שגיאה בהצגת התפריט:', error);
            await client.sendMessage(phone, '❌ שגיאה בטעינת התפריט. נסה שוב מאוחר יותר.');
        }
    }
    else if (text === 'עזרה' || text === 'help') {
        const helpMessage = `📚 *עזרה - בוט הפיצריה*

🔹 *פקודות זמינות:*
• תפריט - הצגת התפריט המלא
• עגלה - צפייה בעגלת הקניות
• סיים - סיום הזמנה
• עזרה - הצגת עזרה זו

🔹 *איך להזמין:*
1. שלח 'תפריט' לראות את המוצרים
2. שלח את שם המוצר או מספרו
3. שלח 'עגלה' לראות את ההזמנה שלך
4. שלח 'סיים' לסיום ההזמנה

🔹 *דוגמאות:*
• "פיצה מרגריטה"
• "משקה קולה"
• "סלט יווני"

💡 *טיפ:* אפשר להזמין כמה מוצרים בבת אחת!`;

        await client.sendMessage(phone, helpMessage);
    }
    else if (text === 'עגלה' || text === 'cart') {
        const cart = userCarts.get(phone) || [];
        
        if (cart.length === 0) {
            await client.sendMessage(phone, '🛒 העגלה שלך ריקה.\n\nשלח "תפריט" לראות את המוצרים הזמינים.');
            return;
        }

        let cartMessage = '🛒 *העגלה שלך:*\n\n';
        let total = 0;

        cart.forEach(item => {
            cartMessage += `• ${item.name} x${item.quantity} - ₪${(item.price * item.quantity).toFixed(2)}\n`;
            total += item.price * item.quantity;
        });

        cartMessage += `\n💰 *סה"כ לתשלום: ₪${total.toFixed(2)}*\n\n`;
        cartMessage += '💡 שלח "סיים" לסיום ההזמנה או "תפריט" להמשך קניות';

        await client.sendMessage(phone, cartMessage);
    }
    else if (text === 'סיים' || text === 'finish') {
        const cart = userCarts.get(phone) || [];
        
        if (cart.length === 0) {
            await client.sendMessage(phone, '🛒 העגלה שלך ריקה. שלח "תפריט" לראות את המוצרים הזמינים.');
            return;
        }

        // מעבר למצב הזמנה
        userStates.set(phone, 'ordering');
        userCarts.set(phone, cart);

        const orderMessage = `📋 *סיום הזמנה*

העגלה שלך כוללת:
${cart.map(item => `• ${item.name} x${item.quantity}`).join('\n')}

💰 *סה"כ לתשלום: ₪${cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}*

📍 *אנא שלח את כתובת המשלוח שלך:*`;

        await client.sendMessage(phone, orderMessage);
    }
    else if (userState === 'ordering') {
        // המשתמש במצב הזמנה - מחכים לכתובת
        const address = message.body;
        const cart = userCarts.get(phone) || [];
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        try {
            const orderId = await saveOrder(phone, cart, total, address);
            
            const confirmationMessage = `✅ *ההזמנה שלך התקבלה בהצלחה!*

📋 *מספר הזמנה:* #${orderId}
📍 *כתובת:* ${address}
💰 *סה"כ לתשלום:* ₪${total.toFixed(2)}

📦 *המוצרים:*
${cart.map(item => `• ${item.name} x${item.quantity}`).join('\n')}

⏰ *זמן משלוח משוער:* 30-45 דקות

📞 *לשאלות:* 03-1234567

תודה שהזמנת אצלנו! 🍕✨`;

            await client.sendMessage(phone, confirmationMessage);
            
            // איפוס המצב והעגלה
            userStates.set(phone, 'main');
            userCarts.set(phone, []);
            
        } catch (error) {
            console.error('שגיאה בשמירת ההזמנה:', error);
            await client.sendMessage(phone, '❌ שגיאה בשמירת ההזמנה. נסה שוב מאוחר יותר.');
            userStates.set(phone, 'main');
        }
    }
    else {
        // חיפוש מוצר לפי שם
        db.get("SELECT * FROM products WHERE available = 1 AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)", 
            [`%${text}%`, `%${text}%`], async (err, product) => {
            
            if (err) {
                console.error('שגיאה בחיפוש מוצר:', err);
                await client.sendMessage(phone, '❌ שגיאה בחיפוש המוצר. נסה שוב.');
                return;
            }

            if (product) {
                // הוספה לעגלה
                const cart = userCarts.get(phone) || [];
                const existingItem = cart.find(item => item.id === product.id);
                
                if (existingItem) {
                    existingItem.quantity += 1;
                } else {
                    cart.push({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        quantity: 1
                    });
                }
                
                userCarts.set(phone, cart);
                
                const addMessage = `✅ *${product.name} נוסף לעגלה!*

💰 *מחיר:* ₪${product.price}
📦 *כמות בעגלה:* ${cart.find(item => item.id === product.id).quantity}

🛒 שלח "עגלה" לראות את העגלה שלך
📋 שלח "סיים" לסיום ההזמנה`;

                await client.sendMessage(phone, addMessage);
            } else {
                const notFoundMessage = `❌ לא נמצא מוצר בשם "${text}"

💡 *נסה:*
• שלח "תפריט" לראות את כל המוצרים
• בדוק את האיות
• שלח "עזרה" לקבלת עזרה`;

                await client.sendMessage(phone, notFoundMessage);
            }
        });
    }
});

// טיפול בשגיאות
client.on('error', (error) => {
    console.error('❌ שגיאה בבוט:', error);
});

// הפעלת השרת
app.listen(PORT, () => {
    console.log(`🚀 שרת הבוט פועל בכתובת: http://localhost:${PORT}`);
    console.log(`🤖 בוט וואטסאפ מוכן!`);
    console.log(`📱 סרוק את ה-QR Code כדי להתחבר לוואטסאפ`);
});

// התחברות לוואטסאפ
client.on('qr', (qr) => {
    console.log('📱 סרוק את ה-QR Code כדי להתחבר:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ בוט וואטסאפ מחובר ומוכן!');
    console.log('🍕 בוט הפיצריה פועל בהצלחה!');
});

client.on('authenticated', () => {
    console.log('🔐 אימות וואטסאפ הושלם בהצלחה!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ שגיאה באימות וואטסאפ:', msg);
});

// טיפול בסגירה מסודרת
process.on('SIGINT', () => {
    console.log('\n👋 סוגר את הבוט...');
    client.destroy();
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 סוגר את הבוט...');
    client.destroy();
    db.close();
    process.exit(0);
});

// התחלת הבוט
client.initialize();

console.log('🤖 בוט הפיצריה מתחיל לפעול...');