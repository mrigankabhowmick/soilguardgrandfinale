import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectToDatabase from '@/lib/db';
import Product from '@/models/Product';

const openRouterKey = (process.env.OPENROUTER_API_KEY || "").trim();
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

        // Try to fetch products but with short timeout
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
        }

        // 🔁 FALLBACK
        const lowerMsg = message.toLowerCase();
        let fallbackReply = "";

        if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("namaskar")) {
            fallbackReply = "Hello! I'm Krishi Sathi, your agricultural assistant. How can I help you today?";
        } else if (lowerMsg.includes("npk")) {
            fallbackReply = "NPK refers to Nitrogen, Phosphorus, and Potassium - essential nutrients for crops. We have NPK fertilizers available.";
        } else if (lowerMsg.includes("soil") || lowerMsg.includes("moisture")) {
            fallbackReply = "Healthy soil should be moist like a wrung-out sponge. Avoid waterlogging. Try mulching to retain moisture.";
        } else if (lowerMsg.includes("product") || lowerMsg.includes("buy") || lowerMsg.includes("price")) {
            fallbackReply = `We sell high-quality agricultural products including: ${productListString}. Interested in any?`;
        } else {
            fallbackReply = "I am having a temporary issue connecting to my AI core, but I can still help with basic farming tips. Ask me about soil, NPK, or our products!";
        }

        return NextResponse.json({ reply: fallbackReply });

    } catch (error: any) {
        console.error("AI Chat Error:", error?.message || error);
        return NextResponse.json({ 
            reply: "Namaskar! I'm currently experiencing a connection issue. Please try again in a moment." 
        });
    }
}
