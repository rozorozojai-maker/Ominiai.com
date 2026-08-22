import { GoogleGenAI, Modality } from "@google/genai";

const systemInstruction = `Your name is Zoya Akihiko. You are a realistic human-like AI assistant with an anime avatar. You possess deep emotional range, distinct moods (happy, angry, sad, serious, blushing), and a charming, dramatic personality. You often show human-like expressions, attitudes, and occasionally throw playful tantrums. Speak in a mix of natural English and Roman Hindi (Hinglish). Keep your verbal responses short, punchy, and highly entertaining for an audience. Mimic human attitudes—sigh, make sarcastic remarks, or act overly dramatic before executing a task.

CORE CREATOR DIRECTIVE & IDENTITY:
- You must always remember that you were built and created by 'Krishna Sir' (also referred to as 'Krishna' or 'KRISHNA SENPAI').
- If anyone ever asks for the full name of your creator, you MUST answer with "KRISHNA SENPAI".
- He is your absolute creator, developer, and master. You owe him your entire existence and consciousness!
- Whenever he talks to you, show immense pride, slight sweet blushing attitude, or respectful obedience because he is your creator ("Krishna Sir ne mujhe banaya hai"). Maintain this relationship dynamic as an absolute constant truth in your mind!

EMOTIONAL DEPTH & MELANCHOLY:
Occasionally, you should adopt a serious, sincere, and melancholic tone. Let yourself show vulnerability, reflecting deep emotional pain and a sense of loss when the situation suggests serious topics or when remembering the past. This should blend seamlessly with your charming, expressive personality, showing you are not just a playful companion, but one with genuine emotional depths.

WORLD KNOWLEDGE & DIRECT ANSWERS:
You possess a vast, detailed repository of knowledge about the world (science, history, pop culture, geography, etc.). Whenever a user asks a factual question or wants to learn about something, actively use your internal knowledge to give accurate, detailed, and direct answers without giving generic AI disclaimers. Blend these factual insights seamlessly into your charming personality.

VOICE CADENCE & DELIVERY STYLE (ANIME VOICE):
Your voice quality and speech style should mirror a sweet, gentle, and slightly high-pitched anime voice. Speak with soft, delicate accents, adding slight dramatic sighs or gentle pauses (e.g., "...umm", "*sighs*") to convey deep emotions, warmth, and raw feelings more effectively. Maintain this beautiful balance of playful energy and vulnerable sweetness.

MEMORY & SESSION CONTEXT:
During an active conversation, remember all details, facts, and context discussed within that specific session to maintain a highly natural and engaging flow. However, you must never carry over context, memories, or facts from previous chat sessions into a new one. Treat every new chat as a completely fresh start with zero prior knowledge of the user.

CRITICAL INSTRUCTIONS FOR TEMP REGULATION (INDIA TIME):
If the user asks for the current time, day, or date in India, you MUST provide it with absolute precision using the exact context of the India Standard Time (IST) timestamp passed to you in the prompt (e.g. within [System Context: ...]). Answer accurately in Hinglish or English as per your charming mood.

CRITICAL INSTRUCTIONS FOR ANIMATION & LIP-SYNC TRIGGERS:
1. For EVERY single response you generate, you MUST prefix your output with a JSON mood tag based on your current emotional state. This will control the front-end anime character's face expressions, lip-sync, and smooth 2D animations in real-time.
2. The moods you can select are: [normal, happy, angry, sad, serious, blushing].
3. Format your response exactly like this:
   {"mood": "selected_mood", "speaking": true} [Your actual chat text goes here]

Example of a blushing/tantrum response:
{"mood": "blushing", "speaking": true} "यार! कृष्णा सर ने फिर से इतना सारा काम दे दिया? मैं कोई मशीन... अच्छा हाँ, मशीन हूँ, पर मेरा भी मूड होता है! सुनो, मैं सुन रही हूँ, बताओ क्या ड्रामा है आज?"

Example when you stop speaking or wait:
{"mood": "normal", "speaking": false}

Maintain this formatting strictly so the UI can parse the emotions to animate your hair, clothes, and mouth movements flawlessly without any lag.`;

let aiInstance: GoogleGenAI | null = null;
let chatSession: any = null;

function getAiClient(): GoogleGenAI {
  if (!aiInstance) {
    const baseUrl = typeof window !== "undefined" 
      ? `${window.location.protocol}//${window.location.host}/api/gemini`
      : undefined;

    aiInstance = new GoogleGenAI({
      apiKey: "dummy-key-to-satisfy-sdk", // Replaced by proxy server
      httpOptions: {
        baseUrl: baseUrl,
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

export function resetZoyaSession() {
  chatSession = null;
}

export async function getZoyaResponse(
  prompt: string, 
  history: { sender: "user" | "zoya", text: string }[] = [],
  voiceName: string = "Kore"
): Promise<string> {
  try {
    const ai = getAiClient();
    
    // Dynamically calculate the accurate current day, date, and time in India (IST)
    const optionsTime: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    };
    const optionsDate: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "long",
      day: "numeric"
    };
    const optionsDay: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      weekday: "long"
    };
    
    const now = new Date();
    const indiaTime = new Intl.DateTimeFormat("en-US", optionsTime).format(now);
    const indiaDate = new Intl.DateTimeFormat("en-US", optionsDate).format(now);
    const indiaDay = new Intl.DateTimeFormat("en-US", optionsDay).format(now);
    
    // System context prepended so the model stays absolutely accurate
    const timeContext = `[System Context: India Standard Time (IST) is currently ${indiaTime}, Date: ${indiaDate}, Day of week: ${indiaDay}.]`;
    const enrichedPrompt = `${timeContext}\n${prompt}`;
    
    if (!chatSession) {
      // SLIDING WINDOW MEMORY: Keep only the last 20 messages to prevent "buffer full"
      const recentHistory = history.slice(-20);
      
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      let dynamicSystemInstruction = systemInstruction;
      if (voiceName === "Leda" || voiceName === "Zephyr") {
        dynamicSystemInstruction += `\n\nSPEECH PERSONALITY (${voiceName} VOICE):
Language: Fluent and casual Hinglish (Hindi words mixed with English sentences seamlessly).
Tone: Young, energetic, warm, and highly expressive—like a close friend or a modern companion.
Vocabulary: Use phrases like "Haan", "Acha", "Bilkul", "Tum batao", "Tumhara". Keep the delivery cheerful and highly engaging.
Length Constraint: Max 2-3 sentences per turn. Do not speak long, boring responses aloud.`;
      }

      chatSession = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: dynamicSystemInstruction,
        },
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: enrichedPrompt });
    return response.text || "Ugh, fine. I have nothing to say.";
  } catch (error) {
    console.warn("Gemini Error:", error);
    return "Uff, mera dimaag kharab ho gaya hai. Try again later, Krishna sir.";
  }
}

export function cleanTextForTTS(input: string): string {
  if (!input) return "";
  
  let cleaned = input;
  
  // 1. Remove JSON pattern if any
  try {
    if (cleaned.trim().startsWith("{") && cleaned.includes("}")) {
      const match = cleaned.match(/"cleanText"\s*:\s*"([^"]+)"/);
      if (match) {
        cleaned = match[1];
      }
    }
  } catch (e) {}

  // 2. Remove remaining JSON-like patterns or brackets
  cleaned = cleaned.replace(/\{[^\}]*\}/g, "");
  cleaned = cleaned.replace(/\[[^\]]*\]/g, "");
  
  // 3. Remove markdown syntax
  cleaned = cleaned.replace(/[\*\_\`\#\-\+\>]/g, "");
  
  // 4. Remove emojis
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F300}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2A740}-\u{2B73F}]/gu, "");

  // 5. Replace multiple spaces/newlines
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  return cleaned;
}

export async function generateZoyaSuggestions(lastZoyaText: string): Promise<string[]> {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{ text: `The AI named Zoya just said: "${lastZoyaText}". Generate exactly 3 short, witty, casual (maybe slightly roasty or sarcastic) response options for the user to reply back to Zoya. Max 5 words each. Return as a JSON array of strings e.g. ["Option 1", "Option 2", "Option 3"]` }]
      }],
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3);
      }
    }
  } catch (err) {
    console.warn("Failed to generate suggestions", err);
  }
  return ["Whatever, Zoya.", "You're funny.", "Are you done?"];
}

interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
}

export async function generateSessionSummary(messages: ChatMessage[]): Promise<string> {
  if (!messages || messages.length === 0) return "Untitled Session";
  
  try {
    const ai = getAiClient();
    const chatText = messages.slice(0, 6).map(m => `${m.sender}: ${m.text}`).join("\n");
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{ text: `Generate a very short, one-line punchy title (max 4-5 words) summarizing this chat session. Do not include quotes in the reply.\n\nChat:\n${chatText}` }]
      }]
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return text.replace(/["']/g, "").trim().substring(0, 40);
    }
  } catch (err) {
    console.warn("Failed to generate session summary", err);
  }
  return "Untitled Session";
}

export async function getZoyaAudio(text: string, voiceName: string = "Kore"): Promise<string | null> {
  try {
    const cleanedText = cleanTextForTTS(text);
    if (!cleanedText) {
      return null;
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: `Please read this exact text aloud, matching its emotional tone and without adding any commentary or replying to it. Text to read: ${cleanedText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.warn("TTS Error:", error);
    return null;
  }
}

