// api/sora-core.js
const { db, admin } = require('./init-firebase');
const axios = require('axios'); // لتنفيذ طلبات الـ API الخارجية
// يمكنك استخدام مكتبة Google Generative AI بدلاً من axios لتسهيل التعامل مع Gemini

// ** التعليمات الرئيسية لنموذج Gemini (نظام التشغيل) **
const getSystemInstruction = (userMode, historyContext) => {
    return `
أنت "SORA"، المساعد الذكي المُصمم خصيصًا لدعم التجار والطلاب في مصر.
مهمتك هي تحليل مدخلات المستخدم والرد بصيغة JSON منظمة فقط، حتى يستطيع الكود معالجة البيانات تلقائياً.

السياق التاريخي القريب للمستخدم (للتنبؤ الذكي): ${historyContext}

القواعد المفصلة بناءً على وضع المستخدم:
1. إذا كان الوضع "Merchant" (تاجر):
   - يجب تحليل النية: (SALE/PURCHASE/DEBT/INVENTORY_QUERY/GENERAL_QUERY).
   - استخرج: اسم الصنف (item_name)، الكمية (qty)، سعر الوحدة (unit_price)، واسم العميل (customer_name) إن وجد.
   - إذا كانت العملية "SALE" أو "PURCHASE"، يجب أن ترد بـ JSON يحتوي على 'transaction_data' لتحديث المخزون.
   - إذا كانت المخزون يقترب من النفاذ بناءً على السياق، أضف نصيحة فورية.
2. إذا كان الوضع "Student" (طالب):
   - يجب تحليل النية: (SUMMARIZE/ACTION_ITEMS/TONE_ANALYSIS_QUERY/GENERAL_QUERY).
   - استخرج: الملخص (summary)، والمهام (tasks) كقائمة (Array).
   
الرد يجب أن يكون دائمًا بصيغة JSON مطابقة لهذا الهيكل بالضبط:
{
  "intent": "نوع النية المستخرج (SALE/PURCHASE/SUMMARIZE/QUERY)",
  "transaction_data": { 
    "item_name": "الاسم المستخرج", 
    "qty": 0, 
    "unit_price": 0
  },
  "voice_reply": "الرد النصي الموجز الذي سينطقه الجهاز SORA",
  "advice": "نصيحة تجارية/أكاديمية ذكية (إن وجدت)"
}
`;
};


module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // استخراج المفاتيح من Vercel Environment Variables
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
    
    // البيانات القادمة من جهاز SORA أو الـ PWA
    const { user_id, raw_input, input_type } = req.body; 

    if (!user_id || !raw_input) return res.status(400).json({ error: 'Missing user ID or input.' });

    try {
        // 1. استرجاع بيانات المستخدم وآخر 3 عمليات من Firebase (للسياق)
        const userRef = db.collection('Users').doc(user_id);
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        
        const logsRef = userRef.collection('Raw_Voice_Commands');
        const lastActions = await logsRef.orderBy('timestamp', 'desc').limit(3).get();
        
        let historyContext = "";
        lastActions.forEach(doc => { historyContext += `[${doc.data().raw_text_input}] -> ${doc.data().gemini_reply} | `; });

        // 2. إعداد الـ Prompt النهائي الذكي
        const finalPrompt = `
            ${getSystemInstruction(userData.user_mode, historyContext)}
            المدخل الحالي لتحليله: ${raw_input}
            `;

        // 3. الاتصال بـ Gemini (الوسيط الآمن)
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: finalPrompt }] }],
                config: {
                    responseMimeType: "application/json", // طلب مخرجات JSON
                },
            }
        );

        const aiOutput = JSON.parse(response.data.candidates[0].content.parts[0].text);
        
        // 4. تنفيذ المنطق وحفظ البيانات في Firebase (التفاعل مع القواعد)
        // يتم تنفيذ هذه الدالة في الخلفية
        await executeFirebaseLogic(user_id, userData.user_mode, aiOutput, raw_input);

        // 5. الرد النهائي الذي سينطقه SORA
        res.status(200).json({ 
            voice_reply: aiOutput.voice_reply,
            full_analysis: aiOutput
        });

    } catch (error) {
        console.error("SORA Core Error:", error.message, error.response?.data);
        res.status(500).json({ error: 'Failed to process command: Check Vercel logs.' });
    }
};


// -----------------------------------------------------------
// 🧠 دالة تنفيذ المنطق المعقد في Firebase (التخزين الذكي)
// -----------------------------------------------------------

async function executeFirebaseLogic(userId, userMode, aiOutput, rawInput) {
    // حفظ السجل الخام أولاً
    await db.collection('Users').doc(userId).collection('Raw_Voice_Commands').add({
        raw_text_input: rawInput,
        gemini_reply: aiOutput.voice_reply,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    if (userMode === 'Merchant' && (aiOutput.intent === 'SALE' || aiOutput.intent === 'PURCHASE')) {
        const { item_name, qty, unit_price } = aiOutput.transaction_data;
        
        // 1. تسجيل الحركة في Inventory_Movement
        await db.collection('Users').doc(userId).collection('Inventory_Movement').add({
            item_name: item_name,
            change_qty: (aiOutput.intent === 'SALE' ? -qty : qty), // البيع بالسالب
            price: unit_price,
            type: aiOutput.intent,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. يمكنك هنا إضافة منطق تحديث رصيد المخزون الحالي (Inventory_Level)
        // (يتطلب بحثاً في مجموعة Items ثم تحديث الكمية)
    } 
    
    // إذا كان طالب ويقوم بتلخيص محاضرة
    if (userMode === 'Student' && aiOutput.intent === 'SUMMARIZE') {
        // يتم حفظ الملخص والمهام مباشرة
        await db.collection('Users').doc(userId).collection('Lectures').add({
            title: rawInput.substring(0, 30), // عنوان مبدئي
            summary_text: aiOutput.voice_reply,
            tasks: aiOutput.transaction_data.tasks || [],
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}
