import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

async function testAudio3() {
  const ai = new GoogleGenAI({
    httpOptions: { apiVersion: "v1alpha" } // Using v1alpha
  });
  try {
    const session = await ai.live.connect({
      model: "gemini-2.0-flash", // Using 2.0-flash
      config: {
        responseModalities: ["AUDIO"] as any,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
        },
        systemInstruction: { parts: [{ text: "Hi" }] }
      },
      callbacks: {
        onmessage: (msg) => console.log("Msg"),
        onclose: (e) => console.log("Closed by server!", e),
        onerror: (err) => console.log("Error:", err)
      }
    });
    console.log("Connected to 2.0-flash v1alpha!");
    
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const pcm16 = new Int16Array(sampleRate * duration);
    const buffer = new ArrayBuffer(pcm16.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < pcm16.length; i++) {
      view.setInt16(i * 2, pcm16[i], true);
    }
    const base64Audio = Buffer.from(buffer).toString('base64');
    
    session.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: "audio/pcm;rate=16000"
      } as any
    });
    
    setTimeout(() => {
      console.log("Success! No error!");
      process.exit(0);
    }, 3000);
    
  } catch (err) {
    console.error("Catch:", err);
  }
}
testAudio3();
