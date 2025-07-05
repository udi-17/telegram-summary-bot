// מערכת חכמה לחילוץ נתונים מהודעות לקוחות
class SmartDeliveryParser {
    constructor() {
        // דפוסי זיהוי טלפון
        this.phonePatterns = [
            /0[5-9]\d{1}-?\d{7}/g,  // 050-1234567 או 0501234567
            /\+972[5-9]\d{8}/g,     // +972501234567
            /[5-9]\d{2}-?\d{3}-?\d{3}/g // 502-123-456
        ];
        
        // מילות מפתח למחיר
        this.priceKeywords = ['₪', 'שקל', 'שקלים', 'מחיר', 'עולה', 'עלות', 'לשלם'];
        
        // מילות מפתח לכתובת
        this.addressKeywords = ['רחוב', 'כתובת', 'ב', 'אצל', 'ל'];
        
        // שמות ערים נפוצים
        this.cities = [
            'תל אביב', 'חיפה', 'ירושלים', 'באר שבע', 'רעננה', 'הרצליה', 'רמת גן', 
            'פתח תקווה', 'ראשון לציון', 'חולון', 'בת ים', 'רמת השרון', 'כפר סבא',
            'נתניה', 'אשדוד', 'אשקלון', 'רמלה', 'לוד', 'מודיעין', 'רחובות'
        ];
    }

    // זיהוי מספר טלפון
    findPhone(text) {
        for (let pattern of this.phonePatterns) {
            const matches = text.match(pattern);
            if (matches) {
                return matches[0].replace(/\s+/g, ''); // הסרת רווחים
            }
        }
        return null;
    }

    // זיהוי מחיר
    findPrice(text) {
        // חיפוש מספרים עם סימני מטבע או מילות מפתח
        const pricePatterns = [
            /(\d+)\s*₪/g,
            /(\d+)\s*(שקל|שקלים)/g,
            /מחיר\s*:?\s*(\d+)/gi,
            /עולה\s*(\d+)/gi,
            /(\d+)\s*ש"ח/g
        ];

        for (let pattern of pricePatterns) {
            const match = text.match(pattern);
            if (match) {
                const numbers = match[0].match(/\d+/);
                return numbers ? parseInt(numbers[0]) : null;
            }
        }

        // אם לא נמצא דפוס מחיר ספציפי, חפש מספרים גדולים (כנראה מחירים)
        const numbers = text.match(/\d+/g);
        if (numbers) {
            const bigNumbers = numbers.filter(n => parseInt(n) >= 10 && parseInt(n) <= 10000);
            if (bigNumbers.length === 1) {
                return parseInt(bigNumbers[0]);
            }
        }

        return null;
    }

    // זיהוי שם לקוח
    findCustomerName(text) {
        // חיפוש דפוסים של שמות
        const namePatterns = [
            /שלום\s+([א-ת\s]+)/g,
            /היי\s+([א-ת\s]+)/g,
            /לקוח\s*:?\s*([א-ת\s]+)/gi,
            /שם\s*:?\s*([א-ת\s]+)/gi
        ];

        for (let pattern of namePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        // חיפוש מילים בעברית שעשויות להיות שמות (2-3 מילים)
        const hebrewWords = text.match(/[א-ת]+/g);
        if (hebrewWords && hebrewWords.length >= 2) {
            // קח את 2-3 המילים הראשונות כשם אפשרי
            return hebrewWords.slice(0, 2).join(' ');
        }

        return null;
    }

    // זיהוי כתובת
    findAddress(text) {
        // חיפוש ערים
        for (let city of this.cities) {
            if (text.includes(city)) {
                // נסה למצוא רחוב לפני השם העיר
                const cityIndex = text.indexOf(city);
                const beforeCity = text.substring(0, cityIndex).trim();
                const words = beforeCity.split(/\s+/);
                
                if (words.length > 0) {
                    const streetPart = words.slice(-2).join(' '); // קח 2 מילים לפני העיר
                    return `${streetPart} ${city}`.trim();
                } else {
                    return city;
                }
            }
        }

        // חיפוש דפוסי כתובת אחרים
        const addressPatterns = [
            /כתובת\s*:?\s*([א-ת\s\d]+)/gi,
            /רחוב\s+([א-ת\s\d]+)/gi,
            /ב([א-ת\s]+)/g
        ];

        for (let pattern of addressPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    // זיהוי מוצר
    findProduct(text) {
        // מילות מפתח למוצרים
        const productKeywords = ['מוצר', 'פריט', 'סחורה', 'מכירה'];
        
        for (let keyword of productKeywords) {
            const pattern = new RegExp(`${keyword}\\s*:?\\s*([א-ת\\s]+)`, 'gi');
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        // אם לא נמצא דפוס ספציפי, נסה לזהות מוצרים נפוצים
        const commonProducts = [
            'שולחן', 'כיסא', 'מנורה', 'ארון', 'מיטה', 'ספה', 'כורסא', 'שידה',
            'אקמול', 'נורופן', 'אדויל', 'ויטמין', 'תרופה', 'קרם', 'שמפו',
            'טלפון', 'מחשב', 'טאבלט', 'אוזניות', 'מטען', 'כבל'
        ];

        for (let product of commonProducts) {
            if (text.includes(product)) {
                return product;
            }
        }

        // אם לא נמצא מוצר ספציפי, קח את המילה הראשונה בעברית
        const hebrewWords = text.match(/[א-ת]+/g);
        if (hebrewWords && hebrewWords.length > 0) {
            return hebrewWords[0];
        }

        return null;
    }

    // פונקציה ראשית לחילוץ כל הנתונים
    parseMessage(text) {
        console.log(`\n🔍 מנתח הודעה: "${text}"`);
        console.log('='.repeat(50));

        const result = {
            product: this.findProduct(text),
            customerName: this.findCustomerName(text),
            address: this.findAddress(text),
            phone: this.findPhone(text),
            price: this.findPrice(text),
            originalText: text
        };

        console.log('📊 תוצאות החילוץ:');
        console.log(`  🛍️  מוצר: ${result.product || 'לא נמצא'}`);
        console.log(`  👤 שם לקוח: ${result.customerName || 'לא נמצא'}`);
        console.log(`  🏠 כתובת: ${result.address || 'לא נמצא'}`);
        console.log(`  📞 טלפון: ${result.phone || 'לא נמצא'}`);
        console.log(`  💰 מחיר: ${result.price ? result.price + '₪' : 'לא נמצא'}`);

        // בדיקה אם יש מספיק נתונים
        const completeness = [result.product, result.customerName, result.address, result.phone, result.price]
            .filter(item => item !== null).length;
        
        console.log(`  ✅ שלמות: ${completeness}/5 שדות`);

        return result;
    }
}

// בדיקות של המערכת
const parser = new SmartDeliveryParser();

console.log('🤖 מערכת חילוץ נתונים חכמה מהודעות לקוחות');
console.log('='.repeat(60));

// דוגמאות להודעות
const testMessages = [
    "שלום דני, המנורה עולה 250₪, הכתובת שלך תל אביב רחוב הרצל 15, הטלפון 050-1234567",
    "היי רחל! השולחן שהזמנת מוכן. מחיר 500 שקלים. אני אגיע לרעננה ברחוב בן גוריון 8. התקשרי 052-9876543",
    "לקוח: יוסי כהן, מוצר: אקמול, כתובת: חיפה רחוב נורדאו 25, טלפון: 054-1111111, מחיר: 15₪",
    "משה אני מביא לך את הכיסא מחר לרמת גן, 120 שקלים, 050-5555555",
    "ספה חדשה לאשדוד רחוב ירושלים 45, ליאור 053-7777777, 800₪"
];

testMessages.forEach((message, index) => {
    console.log(`\n📝 דוגמה ${index + 1}:`);
    parser.parseMessage(message);
});

module.exports = SmartDeliveryParser;