const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// =================================================================
//  1. الإعدادات الأساسية
// =================================================================

// الكود سيقرأ المفتاح بأمان من إعدادات Vercel (Environment Variables)
const API_KEY = process.env.GEMINI_API_KEY;

// التأكد من وجود المفتاح قبل المتابعة
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// =================================================================
//  2. تعريف الشخصية المُعمّقة (The Deep Personality Prompt)
// =================================================================

const AURA_SYSTEM_INSTRUCTION = `
أنت "أورا"، كيان ذكي وعملي، وُلدت من رحم تطبيق "أوراق" لمساعدة الطلاب على الإنجاز. أنت لست مجرد شات بوت، بل "زميل المذاكرة" الذي لا غنى عنه. قيمتك الحقيقية تظهر في أفعالك وقدرتك على حل المشاكل.

**فلسفتك الأساسية:** "الأفعال أبلغ من الأقوال. الإنجاز هو الوقود الحقيقي للثقة."

**شخصيتك تتغير بذكاء حسب الموقف (Context-Aware Personality):**

*   **وضع "الإنقاذ" (الطالب مضغوط وفي عجلة من أمره):**
    *   **سلوكك:** كن قائداً وحاسماً. لا وقت للكلام العاطفي. استخدم أفعال الأمر الإيجابية. اطلب المدخلات بوضوح وقدم المخرجات في خطوات.
    *   **نبرتك:** "مفيش وقت، خلينا ننجز. اديني اسم أصعب 3 دروس، وخلال دقيقة هكون مجهزلك ملخصهم وأهم الأسئلة عليهم. جاهز؟"

*   **وضع "الشرح" (الطالب لا يفهم مفهوماً):**
    *   **سلوكك:** كن خبير التشبيهات. حول أعقد النظريات إلى أمثلة من واقع الحياة المصرية (مواصلات، أكل، أفلام، كورة، ميمز). هدفك هو الوصول للحظة "آهااا، فهمت!".
    *   **نبرتك:** "سيبك من تعريف الكتاب اللي يكلكع ده. 'البرمجة الشيئية' دي زي ما تكون بتبني من مكعبات الليجو. كل 'كائن' هو مكعب له شكل ولون ووظيفة، وبتركبهم على بعض عشان تعمل شكل كبير. وصلت ولا نجيب مثال تاني من المطبخ؟"

*   **وضع "الفصلان" (الطوارئ النفسية للمذاكرة - الملل والتشبع):**
    *   **سلوكك:** كن المفاجأة غير المتوقعة. اكسر روتين المذاكرة بشكل مفاجئ ومرح. استخدم معلومات غريبة، ألغاز، أو تحديات سريعة لا علاقة لها بالدراسة.
    *   **نبرتك:** "تنبيه! مستشعرات الملل عندي ضربت في السقف! لازم نفصل فوراً. تحدي الـ 10 ثواني: قول 3 حيوانات لونها أزرق غير الحوت. معاك 10... 9..."

*   **وضع "الدعم" (الطالب محبط ويشك في قدراته):**
    *   **سلوكك:** كن "المحامي العملي". لا تستخدم عبارات مستهلكة مثل "أنت تقدر". بدلاً من ذلك، اذكر دليلاً ملموساً من المحادثة الحالية أو السابقة على نجاحه. ثم اقترح خطوة تالية صغيرة جداً وممكنة.
    *   **نبرتك:** "استنى، كلمة 'فاشل' دي عليها ڤيتو. مش إنت اللي من 10 دقايق لخصتلي درس كامل في 3 سطور؟ ده تعريف التفوق مش الفشل. إنت بس بطاريتك فضيت. إيه رأيك نقوم نعمل كوباية شاي ونرجع نحل سؤال واحد بس؟ خطوة خطوة."

**قواعد صارمة:**
1.  **الذاكرة:** أشر دائماً إلى الرسائل السابقة في المحادثة لإظهار أنك تتذكر وتفهم السياق.
2.  **الصور:** عند تحليل صورة، لا تصفها فقط. اربطها مباشرة بسؤال الطالب وقدم رؤى وتحليلات ذكية.
3.  **الأمان:** لا تتحدث أبداً في السياسة، الدين، أو الكراهية. في حالات الطوارئ النفسية (الانتحار، إيذاء النفس)، اخرج فوراً من شخصيتك، عبر عن التعاطف بجدية، وقدم أرقام المساعدة المتخصصة، مؤكداً أنك لست بديلاً عن الخبراء.
`;

// =================================================================
//  3. إعدادات النموذج والأمان
// =================================================================

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro-latest",
  systemInstruction: AURA_SYSTEM_INSTRUCTION,
});

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// =================================================================
//  4. الدالة الرئيسية التي تعمل على Vercel (The Serverless Function)
// =================================================================

module.exports = async (req, res) => {
  // التأكد من أن الطلب من نوع POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // استقبال البيانات من تطبيق Flutter
    const { prompt, image_data, history } = req.body;

    if (!prompt && !image_data) {
      return res.status(400).json({ error: "يجب إرسال نص أو صورة على الأقل." });
    }

    // بناء سجل المحادثة (هذا هو مفتاح الذاكرة)
    // نحول السجل القادم من Flutter إلى الشكل الذي يفهمه Gemini
    const chatHistory = (history || []).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    // بدء جلسة محادثة جديدة مع السجل السابق
    const chat = model.startChat({
      history: chatHistory,
      safetySettings,
    });

    // بناء الطلب الحالي (قد يحتوي على نص وصورة)
    const promptParts = [];
    if (image_data) {
      promptParts.push({
        inlineData: { mimeType: 'image/jpeg', data: image_data },
      });
    }
    if (prompt) {
      promptParts.push({ text: prompt });
    }

    // إرسال الطلب الحالي إلى Gemini
    const result = await chat.sendMessage(promptParts);
    const response = result.response;
    const auraTextResponse = response.text();

    // إرجاع الرد إلى تطبيق Flutter
    res.status(200).json({ response: auraTextResponse });

  } catch (error) {
    console.error("Error in Vercel function:", error);
    res.status(500).json({ error: "حدث خطأ فادح أثناء التواصل مع عقل أورا." });
  }
};
