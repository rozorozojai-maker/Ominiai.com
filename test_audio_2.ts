import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

async function testAudio2() {
  const ai = new GoogleGenAI({});
  try {
    const session = await ai.live.connect({
      model: "gemini-2.0-flash-exp",
      callbacks: {
        onmessage: (msg) => console.log("Msg"),
        onclose: (e) => console.log("Closed by server!", e),
        onerror: (err) => console.log("Error:", err)
      }
    });
    console.log("Connected to 2.0-flash!");
    
    const silentAudio = new Uint8Array(16000 * 2);
    const base64Audio = Buffer.from(silentAudio).toString('base64');
    
    // The problem code
    session.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: "audio/pcm;rate=16000"
      } as any
    });
    
  } catch (err) {
    console.error("Catch:", err);
  }
}
testAudio2();
