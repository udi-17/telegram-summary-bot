const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('./database');

// יצירת לקוח WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// מסד נתונים של המוצרים
const pizzaMenu = {
    pizzas: [
        { id: 1, name: 'מרגריטה', sizes: { 'אישית': 25, 'בינונית': 45, 'משפחתית': 65 }, description: 'רוטב עגבניות, מוצרלה ובזיליקום' },
        { id: 2, name: 'ירקות', sizes: { 'אישית': 30, 'בינונית': 50, 'משפחתית': 70 }, description: 'פלפלים, בצל, זיתים, פטריות ועגבניות' },
        { id: 3, name: 'טונה', sizes: { 'אישית': 35, 'בינונית': 55, 'משפחתית': 75 }, description: 'טונה, בצל ומוצרלה' },
        { id: 4, name: 'פרושוטו', sizes: { 'אישית': 40, 'בינונית': 60, 'משפחתית': 80 }, description: 'פרושוטו, רוקט ופרמזן' },
        { id: 5, name: 'ארבע גבינות', sizes: { 'אישית': 40, 'בינונית': 60, 'משפחתית': 80 }, description: 'מוצרלה, פרמזן, גורגונזולה וריקוטה' }
    ],
    extras: [
        { id: 1, name: 'זיתים', price: 5 },
        { id: 2, name: 'פטריות', price: 5 },
        { id: 3, name: 'בצל', price: 5 },
        { id: 4, name: 'גבינה נוספת', price: 10 },
        { id: 5, name: 'טונה', price: 15 }
    ],
    drinks: [
        { id: 1, name: 'קוקה קולה 1.5 ליטר', price: 12 },
        { id: 2, name: 'ספרייט 1.5 ליטר', price: 12 },
        { id: 3, name: 'מים מינרליים', price: 8 },
        { id: 4, name: 'בירה גולדסטאר', price: 15 }
    ]
};

// ניהול הזמנות פעילות
const activeOrders = new Map();

// פונקציות עזר
function formatMenu() {
    let menu = '🍕 *ברוכים הבאים לפיצריה שלנו!* 🍕\n\n';
    menu += '*תפריט פיצות:*\n';
    
    pizzaMenu.pizzas.forEach(pizza => {
        menu += `\n*${pizza.id}. ${pizza.name}*\n`;
        menu += `   ${pizza.description}\n`;
        menu += `   מחירים: `;
        Object.entries(pizza.sizes).forEach(([size, price], index) => {
            menu += `${size} - ₪${price}`;
            if (index < Object.entries(pizza.sizes).length - 1) menu += ' | ';
        });
        menu += '\n';
    });
    
    menu += '\n*תוספות (לכל פיצה):*\n';
    pizzaMenu.extras.forEach(extra => {
        menu += `${extra.id}. ${extra.name} - ₪${extra.price}\n`;
    });
    
    menu += '\n*משקאות:*\n';
    pizzaMenu.drinks.forEach(drink => {
        menu += `${drink.id}. ${drink.name} - ₪${drink.price}\n`;
    });
    
    menu += '\n📝 *להזמנה שלח "הזמנה"*\n';
    menu += '📞 *לתמיכה שלח "עזרה"*';
    
    return menu;
}

function startOrder(userId) {
    activeOrders.set(userId, {
        stage: 'select_pizza',
        items: [],
        currentItem: {},
        total: 0
    });
}

function formatOrderSummary(order) {
    let summary = '📋 *סיכום הזמנה:*\n\n';
    
    order.items.forEach((item, index) => {
        summary += `${index + 1}. ${item.name} (${item.size}) - ₪${item.price}\n`;
        if (item.extras && item.extras.length > 0) {
            summary += `   תוספות: ${item.extras.join(', ')}\n`;
        }
    });
    
    summary += `\n💰 *סה"כ לתשלום: ₪${order.total}*\n\n`;
    summary += 'להמשך הזמנה שלח "אישור"\n';
    summary += 'לביטול שלח "ביטול"';
    
    return summary;
}

// טיפול בהודעות
client.on('message', async msg => {
    const userId = msg.from;
    const messageBody = msg.body.toLowerCase();
    
    // הצגת תפריט
    if (messageBody === 'תפריט' || messageBody === 'menu') {
        await msg.reply(formatMenu());
        return;
    }
    
    // התחלת הזמנה
    if (messageBody === 'הזמנה' || messageBody === 'order') {
        startOrder(userId);
        await msg.reply('🍕 *בואו נתחיל את ההזמנה!*\n\nאיזו פיצה תרצו? (שלחו מספר)\n\nלדוגמה: 1 עבור מרגריטה');
        return;
    }
    
    // טיפול בהזמנה פעילה
    if (activeOrders.has(userId)) {
        const order = activeOrders.get(userId);
        
        switch (order.stage) {
            case 'select_pizza':
                const pizzaId = parseInt(messageBody);
                const selectedPizza = pizzaMenu.pizzas.find(p => p.id === pizzaId);
                
                if (selectedPizza) {
                    order.currentItem = {
                        type: 'pizza',
                        id: pizzaId,
                        name: selectedPizza.name,
                        extras: []
                    };
                    order.stage = 'select_size';
                    
                    let sizeOptions = 'איזה גודל תרצו?\n\n';
                    Object.entries(selectedPizza.sizes).forEach(([size, price], index) => {
                        sizeOptions += `${index + 1}. ${size} - ₪${price}\n`;
                    });
                    await msg.reply(sizeOptions);
                } else {
                    await msg.reply('❌ מספר פיצה לא תקין. אנא בחרו מספר מהתפריט.');
                }
                break;
                
            case 'select_size':
                const sizeIndex = parseInt(messageBody) - 1;
                const pizza = pizzaMenu.pizzas.find(p => p.id === order.currentItem.id);
                const sizes = Object.entries(pizza.sizes);
                
                if (sizeIndex >= 0 && sizeIndex < sizes.length) {
                    const [size, price] = sizes[sizeIndex];
                    order.currentItem.size = size;
                    order.currentItem.price = price;
                    order.stage = 'select_extras';
                    
                    let extrasMsg = 'רוצים תוספות? (שלחו מספרים מופרדים בפסיק, או 0 לבלי תוספות)\n\n';
                    pizzaMenu.extras.forEach(extra => {
                        extrasMsg += `${extra.id}. ${extra.name} - ₪${extra.price}\n`;
                    });
                    await msg.reply(extrasMsg);
                } else {
                    await msg.reply('❌ גודל לא תקין. אנא בחרו מספר מהרשימה.');
                }
                break;
                
            case 'select_extras':
                if (messageBody === '0') {
                    order.items.push(order.currentItem);
                    order.total += order.currentItem.price;
                    order.stage = 'add_more';
                    
                    await msg.reply('✅ הפיצה נוספה להזמנה!\n\nרוצים להוסיף עוד משהו?\n1. כן\n2. לא, לסיום הזמנה');
                } else {
                    const extraIds = messageBody.split(',').map(id => parseInt(id.trim()));
                    const validExtras = extraIds.filter(id => pizzaMenu.extras.find(e => e.id === id));
                    
                    if (validExtras.length > 0) {
                        validExtras.forEach(extraId => {
                            const extra = pizzaMenu.extras.find(e => e.id === extraId);
                            order.currentItem.extras.push(extra.name);
                            order.currentItem.price += extra.price;
                        });
                        
                        order.items.push(order.currentItem);
                        order.total += order.currentItem.price;
                        order.stage = 'add_more';
                        
                        await msg.reply('✅ הפיצה עם התוספות נוספה להזמנה!\n\nרוצים להוסיף עוד משהו?\n1. כן\n2. לא, לסיום הזמנה');
                    } else {
                        await msg.reply('❌ תוספות לא תקינות. אנא בחרו מספרים מהרשימה או 0.');
                    }
                }
                break;
                
            case 'add_more':
                if (messageBody === '1') {
                    order.stage = 'select_type';
                    await msg.reply('מה תרצו להוסיף?\n1. פיצה\n2. משקה\n3. סיום הזמנה');
                } else if (messageBody === '2') {
                    await msg.reply(formatOrderSummary(order));
                    order.stage = 'confirm_order';
                }
                break;
                
            case 'select_type':
                if (messageBody === '1') {
                    order.stage = 'select_pizza';
                    await msg.reply('איזו פיצה תרצו? (שלחו מספר)');
                } else if (messageBody === '2') {
                    order.stage = 'select_drink';
                    let drinkOptions = 'איזה משקה תרצו?\n\n';
                    pizzaMenu.drinks.forEach(drink => {
                        drinkOptions += `${drink.id}. ${drink.name} - ₪${drink.price}\n`;
                    });
                    await msg.reply(drinkOptions);
                } else if (messageBody === '3') {
                    await msg.reply(formatOrderSummary(order));
                    order.stage = 'confirm_order';
                }
                break;
                
            case 'select_drink':
                const drinkId = parseInt(messageBody);
                const selectedDrink = pizzaMenu.drinks.find(d => d.id === drinkId);
                
                if (selectedDrink) {
                    order.items.push({
                        type: 'drink',
                        name: selectedDrink.name,
                        price: selectedDrink.price
                    });
                    order.total += selectedDrink.price;
                    order.stage = 'add_more';
                    
                    await msg.reply('✅ המשקה נוסף להזמנה!\n\nרוצים להוסיף עוד משהו?\n1. כן\n2. לא, לסיום הזמנה');
                } else {
                    await msg.reply('❌ מספר משקה לא תקין. אנא בחרו מספר מהרשימה.');
                }
                break;
                
            case 'confirm_order':
                if (messageBody === 'אישור' || messageBody === 'confirm') {
                    order.stage = 'get_details';
                    
                    // בדיקה אם הלקוח הזמין בעבר
                    const existingCustomer = await db.getCustomer(userId);
                    if (existingCustomer) {
                        order.isReturningCustomer = true;
                        order.customerData = existingCustomer;
                        
                        let returningMsg = '🎉 שמחים לראות אותך שוב!\n\n';
                        returningMsg += '📋 הפרטים השמורים שלך:\n';
                        returningMsg += `👤 ${existingCustomer.name}\n`;
                        returningMsg += `📍 ${existingCustomer.address}\n`;
                        returningMsg += `📞 ${existingCustomer.phone}\n\n`;
                        returningMsg += 'להשתמש בפרטים האלה? (כן/לא)';
                        
                        await msg.reply(returningMsg);
                        order.stage = 'confirm_details';
                    } else {
                        await msg.reply('🏠 נצטרך את הפרטים שלך למשלוח:\n\nאנא שלח את השם המלא:');
                    }
                } else if (messageBody === 'ביטול' || messageBody === 'cancel') {
                    activeOrders.delete(userId);
                    await msg.reply('❌ ההזמנה בוטלה. תודה!');
                }
                break;
                
            case 'confirm_details':
                if (messageBody === 'כן' || messageBody === 'yes') {
                    // שימוש בפרטים השמורים
                    order.customerName = order.customerData.name;
                    order.address = order.customerData.address;
                    order.phone = order.customerData.phone;
                    
                    // סיום ההזמנה
                    let finalMessage = '✅ *ההזמנה התקבלה בהצלחה!*\n\n';
                    finalMessage += formatOrderSummary(order);
                    finalMessage += '\n📦 *פרטי משלוח:*\n';
                    finalMessage += `שם: ${order.customerName}\n`;
                    finalMessage += `כתובת: ${order.address}\n`;
                    finalMessage += `טלפון: ${order.phone}\n\n`;
                    finalMessage += '⏱️ זמן משלוח משוער: 30-45 דקות\n\n';
                    finalMessage += '🙏 תודה על ההזמנה!';
                    
                    await msg.reply(finalMessage);
                    
                    // שמירת ההזמנה למסד נתונים
                    try {
                        order.userId = userId;
                        const savedOrder = await db.saveOrder(order);
                        console.log('New order saved:', savedOrder);
                    } catch (error) {
                        console.error('Error saving order:', error);
                    }
                    
                    activeOrders.delete(userId);
                } else {
                    order.stage = 'get_details';
                    await msg.reply('🏠 אנא שלח את השם המלא:');
                }
                break;
                
            case 'get_details':
                if (!order.customerName) {
                    order.customerName = msg.body;
                    await msg.reply('📍 עכשיו שלח את הכתובת המלאה למשלוח:');
                } else if (!order.address) {
                    order.address = msg.body;
                    await msg.reply('📞 ולבסוף, שלח מספר טלפון ליצירת קשר:');
                } else if (!order.phone) {
                    order.phone = msg.body;
                    
                    // סיום ההזמנה
                    let finalMessage = '✅ *ההזמנה התקבלה בהצלחה!*\n\n';
                    finalMessage += formatOrderSummary(order);
                    finalMessage += '\n📦 *פרטי משלוח:*\n';
                    finalMessage += `שם: ${order.customerName}\n`;
                    finalMessage += `כתובת: ${order.address}\n`;
                    finalMessage += `טלפון: ${order.phone}\n\n`;
                    finalMessage += '⏱️ זמן משלוח משוער: 30-45 דקות\n\n';
                    finalMessage += '🙏 תודה על ההזמנה!';
                    
                    await msg.reply(finalMessage);
                    
                    // שמירת ההזמנה למסד נתונים
                    try {
                        order.userId = userId;
                        const savedOrder = await db.saveOrder(order);
                        console.log('New order saved:', savedOrder);
                        
                        // הודעה למנהל (אופציונלי)
                        // await notifyAdmin(savedOrder);
                    } catch (error) {
                        console.error('Error saving order:', error);
                    }
                    
                    activeOrders.delete(userId);
                }
                break;
        }
    } else {
        // הודעת ברירת מחדל
        await msg.reply('שלום! 👋\n\nאני הבוט של הפיצריה.\n\n🍕 לתפריט שלח "תפריט"\n📝 להזמנה שלח "הזמנה"\n📞 לעזרה שלח "עזרה"');
    }
});

// עזרה
client.on('message', async msg => {
    if (msg.body.toLowerCase() === 'עזרה' || msg.body.toLowerCase() === 'help') {
        const helpMessage = `
📞 *מרכז עזרה*

*פקודות זמינות:*
• תפריט - הצגת התפריט המלא
• הזמנה - התחלת הזמנה חדשה
• עזרה - הצגת הודעה זו

*בזמן הזמנה:*
• בחרו מספרים מהאפשרויות המוצגות
• לביטול הזמנה שלחו "ביטול"

*שעות פעילות:*
ראשון-חמישי: 11:00-23:00
שישי: 11:00-15:00
מוצ"ש: 20:00-23:00

*טלפון:* 03-1234567
*כתובת:* רחוב הפיצה 10, תל אביב
        `;
        
        await msg.reply(helpMessage);
    }
});

// פקודות מנהל
client.on('message', async msg => {
    const adminNumbers = ['972501234567', '972502345678']; // הוסף מספרי מנהלים כאן
    const senderNumber = msg.from.replace('@c.us', '');
    
    if (adminNumbers.includes(senderNumber)) {
        const command = msg.body.toLowerCase();
        
        // סטטיסטיקות
        if (command === 'סטטיסטיקות' || command === 'stats') {
            try {
                const stats = await db.getOrderStats();
                const statsMessage = `
📊 *סטטיסטיקות הזמנות*

🛒 סה"כ הזמנות: ${stats.totalOrders}
📅 הזמנות היום: ${stats.todayOrders}
💰 הכנסות היום: ₪${stats.todayRevenue}
📈 ממוצע הזמנה: ₪${stats.averageOrderValue.toFixed(2)}
                `;
                await msg.reply(statsMessage);
            } catch (error) {
                await msg.reply('❌ שגיאה בטעינת סטטיסטיקות');
            }
        }
        
        // הזמנות היום
        if (command === 'הזמנות היום' || command === 'today') {
            try {
                const orders = await db.getTodayOrders();
                if (orders.length === 0) {
                    await msg.reply('📭 אין הזמנות להיום');
                } else {
                    let ordersMessage = `📋 *הזמנות היום (${orders.length})*\n\n`;
                    
                    orders.forEach((order, index) => {
                        const time = new Date(order.timestamp).toLocaleTimeString('he-IL');
                        ordersMessage += `${index + 1}. *${order.orderId}*\n`;
                        ordersMessage += `   ⏰ ${time}\n`;
                        ordersMessage += `   👤 ${order.customerName}\n`;
                        ordersMessage += `   💰 ₪${order.total}\n\n`;
                    });
                    
                    await msg.reply(ordersMessage);
                }
            } catch (error) {
                await msg.reply('❌ שגיאה בטעינת הזמנות');
            }
        }
        
        // ייצוא לאקסל
        if (command === 'ייצוא' || command === 'export') {
            try {
                const filename = await db.exportOrdersToCSV();
                await msg.reply(`✅ ההזמנות יוצאו בהצלחה לקובץ:\n${filename}`);
            } catch (error) {
                await msg.reply('❌ שגיאה בייצוא הזמנות');
            }
        }
        
        // עזרה למנהלים
        if (command === 'עזרה מנהל' || command === 'admin help') {
            const adminHelp = `
👨‍💼 *פקודות מנהל*

• סטטיסטיקות - הצגת סטטיסטיקות כלליות
• הזמנות היום - רשימת כל ההזמנות להיום
• ייצוא - ייצוא הזמנות לקובץ CSV
• עזרה מנהל - הצגת הודעה זו
            `;
            await msg.reply(adminHelp);
        }
    }
});

// אירועים של החיבור
client.on('qr', qr => {
    console.log('QR Code received, scan it with WhatsApp:');
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('✅ WhatsApp Pizza Bot is ready!');
    console.log('Bot is connected and waiting for messages...');
});

client.on('authenticated', () => {
    console.log('✅ Authenticated successfully');
});

client.on('auth_failure', msg => {
    console.error('❌ Authentication failure', msg);
});

client.on('disconnected', (reason) => {
    console.log('❌ Client was disconnected', reason);
});

// התחלת הבוט
console.log('🚀 Starting WhatsApp Pizza Bot...');
client.initialize();