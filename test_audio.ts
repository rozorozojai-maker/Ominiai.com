import { GoogleGenAI } from "@google/genai";

async function testAudio() {
  const ai = new GoogleGenAI({
    httpOptions: { apiVersion: "v1alpha" }
  });
  try {
    const session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
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
    console.log("Connected!");
    
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const pcm16 = new Int16Array(sampleRate * duration);
    for (let i = 0; i < pcm16.length; i++) {
      const s = Math.sin((i / sampleRate) * 440 * Math.PI * 2); // A4
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
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
    }); // Wait, sendRealtimeInput takes a Blob in the SDK? No, the type signature says it takes an object. Let's see!
    
    setTimeout(() => {
      console.log("Success! No error!");
      process.exit(0);
    }, 3000);
    
  } catch (err) {
    console.error("Catch:", err);
  }
}
testAudio();
