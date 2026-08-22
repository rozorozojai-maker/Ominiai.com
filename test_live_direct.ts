import { GoogleGenAI } from "@google/genai";

async function testLiveDirect() {
  const ai = new GoogleGenAI({});
  try {
    const session = await ai.live.connect({
      model: "gemini-2.0-flash",
      callbacks: {
        onmessage: (msg) => {
           console.log("Msg:", JSON.stringify(msg).substring(0, 500));
        }
      }
    });
    console.log("Connected directly!");
    session.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Hello!" }] }] });
    
    setTimeout(() => {
      session.close();
      console.log("Closed.");
    }, 5000);
  } catch (err) {
    console.error("Error:", err);
  }
}
testLiveDirect();
