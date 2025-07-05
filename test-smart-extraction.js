const SmartDeliveryParser = require('./smart-parser');

// יצירת מפענח חכם
const parser = new SmartDeliveryParser();

console.log('🧪 בדיקת מערכת חילוץ נתונים חכמה');
console.log('='.repeat(50));

// מערך הודעות לבדיקה
const testMessages = [
    {
        name: "הודעה פשוטה",
        text: "שלום דני, המנורה עולה 250₪, הכתובת שלך תל אביב רחוב הרצל 15, הטלפון 050-1234567"
    },
    {
        name: "הודעה מפורטת",
        text: "היי רחל! השולחן שהזמנת מוכן. מחיר 500 שקלים. אני אגיע לרעננה ברחוב בן גוריון 8. התקשרי 052-9876543"
    },
    {
        name: "פורמט מובנה",
        text: "לקוח: יוסי כהן, מוצר: אקמול, כתובת: חיפה רחוב נורדאו 25, טלפון: 054-1111111, מחיר: 15₪"
    },
    {
        name: "הודעה קצרה",
        text: "משה אני מביא לך את הכיסא מחר לרמת גן, 120 שקלים, 050-5555555"
    },
    {
        name: "הודעה עם מספר בינלאומי",
        text: "ספה חדשה לאשדוד רחוב ירושלים 45, ליאור +972-53-7777777, 800₪"
    },
    {
        name: "הודעה עם ש\"ח",
        text: "שלום מירי, הארון מחיר 1200 ש\"ח, אני אגיע לפתח תקווה רחוב הרצל 20, 054-9999999"
    },
    {
        name: "הודעה חסרה מידע",
        text: "שלום, המוצר מוכן"
    },
    {
        name: "הודעה עם מחיר בלבד",
        text: "הכיסא עולה 300 שקלים"
    }
];

// בדיקת כל הודעה
testMessages.forEach((testCase, index) => {
    console.log(`\n📝 בדיקה ${index + 1}: ${testCase.name}`);
    console.log(`📄 טקסט: "${testCase.text}"`);
    console.log('-'.repeat(40));
    
    const result = parser.parseMessage(testCase.text);
    
    // ספירת שדות שנמצאו
    const foundFields = Object.keys(result).filter(key => 
        key !== 'originalText' && result[key] !== null && result[key] !== undefined
    );
    
    console.log(`📊 נמצאו ${foundFields.length}/5 שדות:`);
    foundFields.forEach(field => {
        console.log(`  ✅ ${field}: ${result[field]}`);
    });
    
    const missingFields = ['product', 'customerName', 'address', 'phone', 'price']
        .filter(field => !result[field]);
    
    if (missingFields.length > 0) {
        console.log(`❌ חסרים: ${missingFields.join(', ')}`);
    }
    
    // הערכת איכות החילוץ
    const quality = foundFields.length / 5;
    let qualityText = '';
    if (quality >= 0.8) qualityText = '🟢 מצוין';
    else if (quality >= 0.6) qualityText = '🟡 טוב';
    else if (quality >= 0.4) qualityText = '🟠 בינוני';
    else qualityText = '🔴 חלש';
    
    console.log(`🎯 איכות חילוץ: ${qualityText} (${Math.round(quality * 100)}%)`);
});

// סיכום
console.log('\n' + '='.repeat(50));
console.log('📈 סיכום הבדיקות');
console.log('='.repeat(50));

let totalSuccess = 0;
let totalTests = testMessages.length;

testMessages.forEach((testCase, index) => {
    const result = parser.parseMessage(testCase.text);
    const foundFields = Object.keys(result).filter(key => 
        key !== 'originalText' && result[key] !== null && result[key] !== undefined
    );
    
    const quality = foundFields.length / 5;
    if (quality >= 0.6) totalSuccess++;
    
    console.log(`בדיקה ${index + 1}: ${testCase.name} - ${Math.round(quality * 100)}%`);
});

console.log(`\n🎯 סך הכל: ${totalSuccess}/${totalTests} בדיקות מוצלחות (${Math.round(totalSuccess/totalTests * 100)}%)`);

// המלצות לשיפור
console.log('\n💡 המלצות לשיפור:');
console.log('- הוסף יותר דפוסים לזיהוי שמות');
console.log('- שפר זיהוי כתובות ללא שמות ערים');
console.log('- הוסף טיפול בקיצורים נפוצים');
console.log('- שפר זיהוי מחירים בפורמטים שונים');

console.log('\n✅ בדיקת המערכת הושלמה!');