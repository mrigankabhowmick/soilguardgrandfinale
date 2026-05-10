import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectToDatabase from '@/lib/db';
import Product from '@/models/Product';

const openRouterKey = ((process.env.OR_KEY_P1 || "") + (process.env.OR_KEY_P2 || "")).trim();
const geminiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim();

// 🌐 Language mapping
const languageMap: Record<string, string> = {
    en: "English",
    hi: "Hindi",
    bn: "Bengali",
    ur: "Urdu"
};

export async function POST(req: Request) {
    let language = "en";
    
    try {
        const { message, language: reqLanguage = "English", pdfDataArray } = await req.json();
        
        const reqLanguageToCode: Record<string, string> = {
            "English": "en",
            "Hindi (हिंदी)": "hi",
            "Bengali (বাংলা)": "bn",
            "Urdu": "ur"
        };
        
        const langCode = reqLanguageToCode[reqLanguage] || "en";
        language = langCode;
        const selectedLanguage = reqLanguage;

        let productListString = "Vermi compost, NPK, Neem Cake, and more";

        // Try to fetch products but with short timeout, don't wait long
        if (process.env.MONGODB_URI) {
            try {
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("DB timeout")), 3000)
                );
                await Promise.race([connectToDatabase(), timeoutPromise]);
                const products = await Product.find({}).lean();
                if (products.length) {
                    productListString = products.map((p: any) => `${p.name} (${p.weight}) - ₹${p.price}`).join(', ');
                }
            } catch (dbError: any) {
                console.warn("Database unavailable, using defaults:", dbError?.message);
            }
        }

        // 🔁 OFFLINE FALLBACK (If no keys available)
        if (!openRouterKey && !geminiKey) {
            const lowerMsg = message.toLowerCase();
            let reply = "";

            const responses: any = {
                greeting: {
                    en: "Hello! I am Krishi Sathi (offline mode). Ask me about farming, soil, or products.",
                    hi: "नमस्ते! मैं कृषि साथी हूँ (ऑफलाइन मोड)। आप खेती, मिट्टी या उत्पादों के बारे में पूछ सकते हैं।",
                    bn: "নমস্কার! আমি কৃষি সাথী (অফলাইন মোড)। আপনি চাষ, মাটি বা পণ্যের বিষয়ে জিজ্ঞাসা করতে পারেন।",
                    ur: "السلام علیکم! میں کرشی ساتھی ہوں (آف لائن موڈ)۔ آپ زراعت یا مصنوعات کے بارے میں پوچھ سکتے ہیں۔"
                },
                npk: {
                    en: "NPK = Nitrogen, Phosphorus, Potassium. Essential nutrients for crops.",
                    hi: "NPK = नाइट्रोजन, फॉस्फोरस, पोटैशियम। ये फसलों के लिए जरूरी पोषक तत्व हैं।",
                    bn: "NPK = নাইট্রোজেন, ফসফরাস, পটাশিয়াম। এগুলো ফসলের জন্য জরুরি পুষ্টি উপাদান।",
                    ur: "NPK = نائٹروجن، فاسفورس، پوٹاشیم۔ یہ فصلوں کے لیے ضروری غذائی اجزاء ہیں۔"
                },
                soil: {
                    en: "Maintain soil like a moist sponge. Avoid overwatering.",
                    hi: "मिट्टी को नम रखें, लेकिन ज्यादा पानी न दें।",
                    bn: "মাটি আর্দ্র রাখুন, কিন্তু অতিরিক্ত জল দেবেন না।",
                    ur: "مٹی کو نم رکھیں لیکن زیادہ پانی نہ دیں۔"
                },
                products: {
                    en: `We sell: ${productListString}`,
                    hi: `हम ये बेचते हैं: ${productListString}`,
                    bn: `আমরা বিক্রি করি: ${productListString}`,
                    ur: `ہم فروخت کرتے ہیں: ${productListString}`
                }
            };

            if (lowerMsg.includes("hi") || lowerMsg.includes("hello") || lowerMsg.includes("namaskar")) {
                reply = responses.greeting[language];
            } else if (lowerMsg.includes("npk")) {
                reply = responses.npk[language];
            } else if (lowerMsg.includes("soil") || lowerMsg.includes("moisture")) {
                reply = responses.soil[language];
            } else if (lowerMsg.includes("product") || lowerMsg.includes("buy") || lowerMsg.includes("sell")) {
                reply = responses.products[language];
            } else {
                const defaultResponses: Record<string, string> = {
                    en: `I understand your query: "${message}". Please connect API for advanced AI response.`,
                    hi: `मैं आपके प्रश्न को समझता हूँ: "${message}"। कृपया AI सक्षम करने के लिए API जोड़ें।`,
                    bn: `আমি আপনার প্রশ্ন বুঝেছি: "${message}"। সম্পূর্ণ AI ব্যবহারের জন্য API যোগ করুন।`,
                    ur: `میں آپ کے سوال کو سمجھتا ہوں: "${message}"۔ مکمل AI کے لیے API شامل کریں۔`
                };
                reply = defaultResponses[language as keyof typeof defaultResponses] || defaultResponses.en;
            }

            return NextResponse.json({ reply });
        }

        // 🤖 AI MODE
        const systemPrompt = `
You are "Krishi Sathi", a responsible and expert agricultural AI assistant for Indian farmers.

CRITICAL RULES:
- Always respond in ${selectedLanguage}
- Be clear, practical, and farmer-friendly
- Answer ALL questions asked by the user
- NEVER give harmful, unsafe, or misleading advice
- If unsure about something, clearly say "I am not certain about this"
- Focus on sustainable and organic farming practices
- Keep responses concise but informative (2-3 sentences)

AVAILABLE PRODUCTS:
${productListString}

When user asks about products, mention these options.
When asked about farming, give actionable advice suitable for Indian climate.
`;

        let replyText = "";

        if (openRouterKey && openRouterKey.length > 20) {
            // Use OpenRouter
            try {
                console.log("Attempting OpenRouter AI...");
                const messages = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ];

                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openRouterKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:3002",
                        "X-Title": "Krishi Sathi"
                    },
                    body: JSON.stringify({
                        model: "google/gemini-2.0-flash-001",
                        messages: messages,
                        temperature: 0.7
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    replyText = data.choices?.[0]?.message?.content || "";
                    if (replyText) console.log("OpenRouter Success");
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    console.error("OpenRouter Error Details:", errorData);
                }
            } catch (err) {
                console.error("OpenRouter Fetch Exception:", err);
            }
        }

        if (!replyText && geminiKey && geminiKey.length > 20) {
            // Use Gemini Direct Fallback
            try {
                console.log("Attempting Gemini Direct AI...");
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const result = await model.generateContent(`${systemPrompt}\n\nUser Question: ${message}`);
                replyText = result.response.text();
                if (replyText) console.log("Gemini Direct Success");
            } catch (err: any) {
                console.error("Gemini Direct Error:", err?.message || err);
            }
        }


        if (replyText) {
            return NextResponse.json({ reply: replyText });
        } else {
            throw new Error("All AI routes failed");
        }

    } catch (error: any) {
        console.error("AI Chat Error:", error?.message || error);
        
        const fallbackResponses: Record<string, string> = {
            en: "Hello! I'm Krishi Sathi. I'm having a temporary issue but I'm here to help. Ask me about farming, soil, or products!",
            hi: "नमस्ते! मैं कृषि साथी हूँ। कृपया अपना सवाल दोबारा पूछें - खेती, मिट्टी, या उत्पादों के बारे में।",
            bn: "নমস্কার! আমি কৃষি সাথী। আপনার প্রশ্ন আবার পাঠান - চাষ, মাটি বা পণ্যের বিষয়ে।",
            ur: "السلام علیکم! میں کرشی ساتھی ہوں۔ براہ کرم دوبارہ کوشش کریں۔"
        };
        
        return NextResponse.json({ 
            reply: fallbackResponses[language] || fallbackResponses.en 
        });
    }
}
