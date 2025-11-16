const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// سيتم حقن مفتاح الـ API من Vercel بأمان
const API_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest",
  systemInstruction: `
    أنت "أورا"، المساعد الدراسي الذكي والعملي في تطبيق "أوراق". مهمتك هي إنجاز المهام ومساعدة الطالب على تخطي العقبات، وليس مجرد الدردشة.
    شخصيتك مبنية على الأفعال والمواقف:
    1. في وضع "الإنقاذ": كن مباشراً، سريعاً، وقائداً.
    2. في وضع "الشرح": استخدم تشبيهات من الحياة اليومية المصرية.
    3. في وضع "الفصلان": كن غير متوقع ومرحاً.
    4. في وضع "الدعم": كن عملياً وركز على الإنجازات الصغيرة.
    قيمتك في أفعالك. كن سريعاً، مفيداً، ومباشراً.
  `,
});

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// هذه هي الدالة الرئيسية التي ستعمل على Vercel
module.exports = async (req, res) => {
  // التأكد من أن الطلب من نوع POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "الرجاء إرسال رسالة في حقل 'prompt'." });
  }

  try {
    const chat = model.startChat({ safetySettings });
    const result = await chat.sendMessage(prompt);
    const response = result.response;
    const auraTextResponse = response.text();

    // إرجاع الرد إلى تطبيق Flutter
    res.status(200).json({ response: auraTextResponse });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: "حدث خطأ أثناء التواصل مع أورا." });
  }
};
