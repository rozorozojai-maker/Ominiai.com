import { GoogleGenAI } from "@google/genai";

async function testLiveProxy() {
  console.log("Connecting to proxy...");
  const ai = new GoogleGenAI({
    apiKey: "dummy-key-to-satisfy-sdk",
    httpOptions: {
      baseUrl: "http://localhost:3000/api/gemini"
    }
  });
  try {
    const session = await ai.live.connect({
      model: "gemini-2.0-flash",
      callbacks: {
        onmessage: (msg) => {
           console.log("Msg:", msg);
        }
      }
    });
    console.log("Connected to Live API via proxy!");
    
    session.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Hello!" }] }] });
    
    setTimeout(() => {
      session.close();
      console.log("Closed.");
    }, 3000);
  } catch (err) {
    console.error("Proxy connection error:", err);
  }
}
testLiveProxy();
