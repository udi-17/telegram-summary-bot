require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');

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

// יצירת מסד נתונים
const db = new sqlite3.Database('pizza_orders.db');

// יצירת טבלאות
db.serialize(() => {
    // טבלת מוצרים
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        available BOOLEAN DEFAULT 1
    )`);

    // טבלת הזמנות
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_phone TEXT NOT NULL,
        customer_name TEXT,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivery_address TEXT,
        notes TEXT
    )`);

    // טבלת פריטי הזמנה
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    // הכנסת מוצרי פיצריה לדוגמה
    const products = [
        { name: 'פיצה מרגריטה', description: 'עגבניות, מוצרלה, בזיליקום', price: 45.00, category: 'pizza' },
        { name: 'פיצה פפרוני', description: 'פפרוני, מוצרלה, עגבניות', price: 52.00, category: 'pizza' },
        { name: 'פיצה יוונית', description: 'זיתים, גבינת פטה, עגבניות', price: 48.00, category: 'pizza' },
        { name: 'פיצה 4 גבינות', description: 'מוצרלה, פרמזן, ריקוטה, גבינה כחולה', price: 55.00, category: 'pizza' },
        { name: 'משקה קולה', description: 'משקה קולה 330 מ"ל', price: 8.00, category: 'drinks' },
        { name: 'משקה ספרייט', description: 'משקה ספרייט 330 מ"ל', price: 8.00, category: 'drinks' },
        { name: 'סלט יווני', description: 'עגבניות, מלפפונים, זיתים, גבינת פטה', price: 25.00, category: 'salads' },
        { name: 'סלט קיסר', description: 'חסה, קרוטונים, גבינת פרמזן, רוטב קיסר', price: 28.00, category: 'salads' }
    ];

    // בדיקה אם יש כבר מוצרים
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)");
            products.forEach(product => {
                stmt.run(product.name, product.description, product.price, product.category);
            });
            stmt.finalize();
            console.log('✅ מוצרי פיצריה נוספו למסד הנתונים');
        }
    });
});

// פונקציות עזר
function getProductsByCategory(category) {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM products WHERE category = ? AND available = 1", [category], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getAllProducts() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM products WHERE available = 1", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function createOrder(customerPhone, customerName, items, totalAmount, deliveryAddress = '', notes = '') {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO orders (customer_phone, customer_name, total_amount, delivery_address, notes) VALUES (?, ?, ?, ?, ?)",
            [customerPhone, customerName, totalAmount, deliveryAddress, notes],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    const orderId = this.lastID;
                    // הוספת פריטי ההזמנה
                    const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
                    items.forEach(item => {
                        stmt.run(orderId, item.productId, item.quantity, item.price);
                    });
                    stmt.finalize();
                    resolve(orderId);
                }
            });
    });
}

// מצב המשתמש
const userStates = new Map();

// יצירת QR קוד להתחברות
client.on('qr', (qr) => {
    console.log('📱 סרוק את ה-QR קוד להתחברות לוואטסאפ:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ בוט הפיצריה מוכן!');
    console.log('🍕 בוט וואטסאפ למכירת מוצרי פיצריה פועל');
});

// טיפול בהודעות
client.on('message', async (message) => {
    if (message.from === 'status@broadcast') return; // התעלם מהודעות סטטוס

    const chatId = message.from;
    const text = message.body.toLowerCase();
    const userName = message._data.notifyName || 'לקוח';

    console.log(`📨 קיבלתי הודעה מ-${userName}: ${text}`);

    // בדיקת מצב המשתמש
    const userState = userStates.get(chatId) || { state: 'main', cart: [] };

    try {
        if (text === 'התחל' || text === 'start' || text === '/start') {
            await sendMainMenu(chatId, userName);
            userStates.set(chatId, { state: 'main', cart: [] });
        }
        else if (text === 'תפריט' || text === 'menu') {
            await sendMenu(chatId);
            userStates.set(chatId, { state: 'menu', cart: userState.cart });
        }
        else if (text === 'הזמן' || text === 'order') {
            if (userState.cart.length === 0) {
                await client.sendMessage(chatId, '🛒 העגלה שלך ריקה! הוסף מוצרים מהתפריט תחילה.');
            } else {
                await sendOrderForm(chatId);
                userStates.set(chatId, { state: 'order_form', cart: userState.cart });
            }
        }
        else if (text === 'עגלה' || text === 'cart') {
            await sendCart(chatId, userState.cart);
        }
        else if (text === 'עזרה' || text === 'help') {
            await sendHelp(chatId);
        }
        else if (text === 'חזור' || text === 'back') {
            await sendMainMenu(chatId, userName);
            userStates.set(chatId, { state: 'main', cart: userState.cart });
        }
        else if (userState.state === 'menu') {
            await handleMenuSelection(chatId, text, userState);
        }
        else if (userState.state === 'order_form') {
            await handleOrderForm(chatId, text, userState);
        }
        else {
            await sendMainMenu(chatId, userName);
            userStates.set(chatId, { state: 'main', cart: [] });
        }
    } catch (error) {
        console.error('❌ שגיאה בטיפול בהודעה:', error);
        await client.sendMessage(chatId, '❌ אירעה שגיאה. אנא נסה שוב או שלח "עזרה" לקבלת תמיכה.');
    }
});

// פונקציות שליחת הודעות
async function sendMainMenu(chatId, userName) {
    const welcomeMessage = `🍕 שלום ${userName}! ברוכים הבאים לפיצריה שלנו!

🎯 מה תרצה לעשות?

📋 *תפריט* - לראות את כל המוצרים שלנו
🛒 *הזמן* - להזמין את המוצרים שבחרת
📦 *עגלה* - לראות את העגלה שלך
❓ *עזרה* - לקבלת עזרה

💡 שלח את המילה הרצויה כדי להתחיל!`;

    await client.sendMessage(chatId, welcomeMessage);
}

async function sendMenu(chatId) {
    try {
        const products = await getAllProducts();
        let menuMessage = `🍕 *תפריט הפיצריה שלנו:*\n\n`;

        // קיבוץ לפי קטגוריות
        const categories = {};
        products.forEach(product => {
            if (!categories[product.category]) {
                categories[product.category] = [];
            }
            categories[product.category].push(product);
        });

        for (const [category, categoryProducts] of Object.entries(categories)) {
            const categoryName = getCategoryName(category);
            menuMessage += `*${categoryName}:*\n`;
            
            categoryProducts.forEach(product => {
                menuMessage += `• ${product.name} - ₪${product.price}\n`;
                if (product.description) {
                    menuMessage += `  _${product.description}_\n`;
                }
            });
            menuMessage += '\n';
        }

        menuMessage += `💡 *איך להזמין:*
שלח את שם המוצר כדי להוסיף אותו לעגלה.
לדוגמה: "פיצה מרגריטה" או "משקה קולה"

🛒 שלח "עגלה" כדי לראות את העגלה שלך
📋 שלח "חזור" לחזרה לתפריט הראשי`;

        await client.sendMessage(chatId, menuMessage);
    } catch (error) {
        console.error('❌ שגיאה בשליחת התפריט:', error);
        await client.sendMessage(chatId, '❌ אירעה שגיאה בטעינת התפריט. אנא נסה שוב.');
    }
}

async function handleMenuSelection(chatId, text, userState) {
    try {
        const products = await getAllProducts();
        const selectedProduct = products.find(p => 
            p.name.toLowerCase().includes(text) || 
            text.includes(p.name.toLowerCase())
        );

        if (selectedProduct) {
            // הוספה לעגלה
            const existingItem = userState.cart.find(item => item.productId === selectedProduct.id);
            
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                userState.cart.push({
                    productId: selectedProduct.id,
                    name: selectedProduct.name,
                    price: selectedProduct.price,
                    quantity: 1
                });
            }

            userStates.set(chatId, userState);
            
            await client.sendMessage(chatId, 
                `✅ הוספתי *${selectedProduct.name}* לעגלה שלך!\n\n` +
                `🛒 שלח "עגלה" כדי לראות את העגלה שלך\n` +
                `📋 שלח "הזמן" כדי להשלים את ההזמנה`
            );
        } else {
            await client.sendMessage(chatId, 
                `❌ לא מצאתי מוצר בשם "${text}"\n\n` +
                `📋 שלח "תפריט" כדי לראות את כל המוצרים הזמינים`
            );
        }
    } catch (error) {
        console.error('❌ שגיאה בבחירת מוצר:', error);
        await client.sendMessage(chatId, '❌ אירעה שגיאה. אנא נסה שוב.');
    }
}

async function sendCart(chatId, cart) {
    if (cart.length === 0) {
        await client.sendMessage(chatId, '🛒 העגלה שלך ריקה! הוסף מוצרים מהתפריט.');
        return;
    }

    let cartMessage = `🛒 *העגלה שלך:*\n\n`;
    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        cartMessage += `${index + 1}. ${item.name} x${item.quantity} - ₪${itemTotal}\n`;
    });

    cartMessage += `\n💰 *סה"כ לתשלום: ₪${total}*\n\n`;
    cartMessage += `💡 *פעולות זמינות:*\n`;
    cartMessage += `• שלח "הזמן" כדי להשלים את ההזמנה\n`;
    cartMessage += `• שלח "תפריט" להוספת מוצרים נוספים\n`;
    cartMessage += `• שלח "חזור" לחזרה לתפריט הראשי`;

    await client.sendMessage(chatId, cartMessage);
}

async function sendOrderForm(chatId) {
    const orderMessage = `📝 *טופס הזמנה*\n\n` +
        `אנא שלח את הפרטים הבאים (שורה אחרי שורה):\n\n` +
        `1️⃣ *שם מלא:*\n` +
        `2️⃣ *כתובת למשלוח:*\n` +
        `3️⃣ *הערות (אופציונלי):*\n\n` +
        `💡 שלח "ביטול" כדי לבטל את ההזמנה`;

    await client.sendMessage(chatId, orderMessage);
}

async function handleOrderForm(chatId, text, userState) {
    if (text === 'ביטול') {
        await client.sendMessage(chatId, '❌ ההזמנה בוטלה.');
        userStates.set(chatId, { state: 'main', cart: [] });
        return;
    }

    if (!userState.orderData) {
        userState.orderData = {};
    }

    if (!userState.orderData.name) {
        userState.orderData.name = text;
        await client.sendMessage(chatId, '✅ שם התקבל! עכשיו שלח את כתובת המשלוח:');
    } else if (!userState.orderData.address) {
        userState.orderData.address = text;
        await client.sendMessage(chatId, '✅ כתובת התקבלה! שלח הערות (או "ללא" אם אין):');
    } else if (!userState.orderData.notes) {
        userState.orderData.notes = text === 'ללא' ? '' : text;
        
        // חישוב הסכום הכולל
        const total = userState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // יצירת ההזמנה
        try {
            const orderId = await createOrder(
                chatId,
                userState.orderData.name,
                userState.cart,
                total,
                userState.orderData.address,
                userState.orderData.notes
            );

            // שליחת אישור הזמנה
            let confirmationMessage = `✅ *ההזמנה התקבלה בהצלחה!*\n\n`;
            confirmationMessage += `🆔 *מספר הזמנה:* ${orderId}\n`;
            confirmationMessage += `👤 *שם:* ${userState.orderData.name}\n`;
            confirmationMessage += `📍 *כתובת:* ${userState.orderData.address}\n`;
            if (userState.orderData.notes) {
                confirmationMessage += `📝 *הערות:* ${userState.orderData.notes}\n`;
            }
            confirmationMessage += `💰 *סכום כולל:* ₪${total}\n\n`;
            confirmationMessage += `⏰ זמן משלוח משוער: 30-45 דקות\n`;
            confirmationMessage += `📞 נציג יצור איתך קשר בקרוב!\n\n`;
            confirmationMessage += `🍕 תודה שהזמנת אצלנו!`;

            await client.sendMessage(chatId, confirmationMessage);
            
            // איפוס העגלה והמצב
            userStates.set(chatId, { state: 'main', cart: [] });
            
        } catch (error) {
            console.error('❌ שגיאה ביצירת ההזמנה:', error);
            await client.sendMessage(chatId, '❌ אירעה שגיאה ביצירת ההזמנה. אנא נסה שוב.');
        }
    }
}

async function sendHelp(chatId) {
    const helpMessage = `❓ *עזרה - בוט הפיצריה*

🍕 *איך להזמין:*
1. שלח "תפריט" לראות את המוצרים
2. שלח את שם המוצר להוספה לעגלה
3. שלח "עגלה" לראות את העגלה שלך
4. שלח "הזמן" להשלמת ההזמנה

📋 *פקודות זמינות:*
• *תפריט* - לראות את כל המוצרים
• *הזמן* - להזמין את המוצרים שבחרת
• *עגלה* - לראות את העגלה שלך
• *עזרה* - הצגת עזרה זו
• *חזור* - חזרה לתפריט הראשי

💡 *טיפים:*
• אפשר להוסיף כמה מוצרים לעגלה
• זמן משלוח משוער: 30-45 דקות
• תשלום במזומן או כרטיס אשראי

📞 *תמיכה:* אם יש בעיה, צור קשר עם הצוות שלנו!`;

    await client.sendMessage(chatId, helpMessage);
}

function getCategoryName(category) {
    const categoryNames = {
        'pizza': '🍕 פיצות',
        'drinks': '🥤 משקאות',
        'salads': '🥗 סלטים'
    };
    return categoryNames[category] || category;
}

// נתיב ראשי לממשק ניהול
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// נתיבי API לניהול
app.get('/api/orders', (req, res) => {
    db.all("SELECT * FROM orders ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// הפעלת השרת
app.listen(PORT, () => {
    console.log(`🚀 שרת הבוט פועל בכתובת: http://localhost:${PORT}`);
});

// הפעלת הבוט
client.initialize();

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

console.log('🍕 בוט הפיצריה מתחיל לפעול...');