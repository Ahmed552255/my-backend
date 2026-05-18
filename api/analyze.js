// Vercel Edge Function - ملف السيرفر الآمن
export const config = {
  runtime: 'edge', // تشغيل كـ Edge Function لضمان أقصى سرعة وأقل تكلفة
};

export default async function handler(request) {
  // إعدادات الـ CORS عشان الفرونت إند يعرف يكلم السيرفر بأمان
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // التعامل مع طلبات الاختبار المسبق من المتصفح (Preflight)
  if (request.method === 'OPTIONS') {
    return new Response('OK', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // استقبال الصورة والنص من الفرونت إند
    const { message, imageBase64 } = await request.json();

    // جلب المفتاح السري الآمن المتخزن في Vercel تلقائياً
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'مفتاح الـ API غير معرف في إعدادات Vercel' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // رابط البث المباشر لـ Gemini Flash (Streaming)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [
          { text: message || "قم باستخراج البيانات من الفاتورة العربية في جدول منظم جداً وبدون أي مقدمات." },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
        ]
      }]
    };

    // إرسال الطلب إلى جوجل
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: 'خطأ من خوادم جوجل', details: errText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // تمرير مجرى البث (Stream) مباشرة للفرونت إند كلمة بكلمة
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
