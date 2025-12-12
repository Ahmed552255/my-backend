// api/barcode-scanner.js
const { db } = require('./init-firebase');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { user_id, barcode_id } = req.body;
    if (!user_id || !barcode_id) return res.status(400).json({ error: 'Missing data.' });

    try {
        // 1. البحث عن الصنف باستخدام الباركود
        // نفترض أن كل مستخدم لديه مجموعته الخاصة بـ Items
        const itemQuery = await db.collection('Users').doc(user_id)
            .collection('Items').where('barcode_id', '==', barcode_id).limit(1).get();

        if (itemQuery.empty) {
            // 2. إذا لم يتم العثور عليه، فهو صنف جديد.
            // نرسل ردًا يطلب فتح التطبيق لإكمال البيانات.
            return res.status(200).json({ 
                is_new: true,
                barcode: barcode_id,
                voice_reply: "صنف جديد! من فضلك افتح التطبيق لإدخال الاسم والسعر." 
            });
        }
        
        // 3. إذا تم العثور عليه، نسجل عملية بيع فورية (بيع قطعة واحدة)
        const itemData = itemQuery.docs[0].data();
        await db.collection('Users').doc(user_id).collection('Inventory_Movement').add({
            item_name: itemData.name_ar,
            change_qty: -1, // بيع قطعة واحدة
            price: itemData.sale_price,
            type: 'SALE',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({
            is_new: false,
            voice_reply: `تم تسجيل بيع قطعة من ${itemData.name_ar}.`
        });

    } catch (error) {
        console.error("Barcode Core Error:", error.message);
        res.status(500).json({ error: 'Failed to process barcode.' });
    }
};
