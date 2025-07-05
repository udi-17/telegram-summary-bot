// בדיקת לוגיקת עיבוד שליחות
function testDeliveryProcessing(text) {
    console.log(`\n🧪 בדיקת טקסט: "${text}"`);
    console.log('================================');
    
    const parts = text.split(/\s+/);
    console.log('חלקים:', parts);
    
    let amountIndex = -1;
    for (let i = 0; i < parts.length; i++) {
        const num = parseFloat(parts[i]);
        if (!isNaN(num) && isFinite(num) && num > 0) {
            amountIndex = i;
            break;
        }
    }
    
    console.log('מיקום סכום:', amountIndex);
    
    if (amountIndex > 0 && amountIndex < parts.length - 2) {
        const item = parts.slice(0, amountIndex).join(' ');
        const amount = parseFloat(parts[amountIndex]);
        const remainingParts = parts.slice(amountIndex + 1);
        
        console.log('פריט:', item);
        console.log('סכום:', amount);
        console.log('חלקים נותרים:', remainingParts);
        
        // Find phone number (looks for pattern with digits and dashes/spaces)
        let phoneIndex = -1;
        for (let i = 0; i < remainingParts.length; i++) {
            if (/[\d\-\s]{7,}/.test(remainingParts[i])) {
                phoneIndex = i;
                console.log(`נמצא דפוס טלפון במיקום ${i}: "${remainingParts[i]}"`);
                break;
            }
        }
        
        let address, phone;
        if (phoneIndex > 0) {
            address = remainingParts.slice(0, phoneIndex).join(' ');
            phone = remainingParts.slice(phoneIndex).join(' ');
        } else {
            // If no phone pattern found, assume last part is phone
            address = remainingParts.slice(0, -1).join(' ');
            phone = remainingParts[remainingParts.length - 1];
        }
        
        console.log('✅ תוצאה:');
        console.log('  כתובת:', address);
        console.log('  טלפון:', phone);
        
        return { success: true, item, amount, address, phone };
    } else {
        console.log('❌ פורמט לא תקין');
        return { success: false };
    }
}

// בדיקות
console.log('🔍 בדיקת לוגיקת עיבוד שליחות');
console.log('===================================');

testDeliveryProcessing('אקמול 50 תל אביב 050-1234567');
testDeliveryProcessing('שולחן 500 רעננה 052-9876543');
testDeliveryProcessing('כיסא 120 חיפה 0541234567');
testDeliveryProcessing('מנורה 250 ראשון לציון 054-555-5555');
testDeliveryProcessing('אקמול 50 רעננה'); // בלי טלפון
testDeliveryProcessing('שולחן 500'); // חסר כתובת וטלפון