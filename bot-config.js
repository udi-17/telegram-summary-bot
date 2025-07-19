// קובץ הגדרות לבוט החדש
module.exports = {
    // הגדרות יוזר מומלץ
    targetUser: '@your_target_user', // שנה לשם המשתמש הרצוי
    
    // הגדרות תמונה
    welcomeImage: {
        url: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Welcome+Bot',
        // אפשרויות נוספות לתמונה:
        // url: 'https://picsum.photos/400/300', // תמונה רנדומלית
        // url: 'https://source.unsplash.com/400x300/?business', // תמונה מעסקית
    },
    
    // הגדרות יצירת קשר
    contact: {
        email: 'info@example.com',
        phone: '050-1234567',
        website: 'https://example.com',
        address: 'תל אביב, ישראל'
    },
    
    // הודעות תגובה אוטומטית
    autoResponses: [
        '👍 תודה על ההודעה!',
        '🤝 קיבלנו את פנייתך',
        '⚡ נחזור אליך בהקדם',
        '📞 ליצירת קשר מיידית, השתמש בכפתורים למעלה',
        '🌟 נעים להכיר! איך נוכל לעזור?',
        '💼 הצוות שלנו ישמח לסייע'
    ],
    
    // הגדרות בוט כלליות
    botInfo: {
        name: 'בוט הפניות מתקדם',
        version: '1.0.0',
        description: 'בוט לשירות לקוחות עם הפניות חכמות',
        features: [
            'מסך ברכה עם תמונה',
            'כפתורי הפניה חכמים', 
            'תגובה אוטומטית להודעות',
            'ממשק ידידותי בעברית'
        ]
    },
    
    // הגדרות כפתורים
    buttons: {
        goToUser: '👤 עבור לחשבון המומלץ',
        contact: '📞 צור קשר',
        info: 'ℹ️ מידע נוסף',
        help: '🆘 עזרה'
    }
};