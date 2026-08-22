import { GoogleGenAI } from "@google/genai";

async function testLiveOnOpen() {
  console.log("Connecting...");
  const ai = new GoogleGenAI({});
  try {
    const session = await ai.live.connect({
      model: "gemini-2.0-flash",
      callbacks: {
        onopen: () => console.log("onopen called!"),
        onmessage: () => {}
      }
    });
    console.log("Resolved connect()");
    session.close();
  } catch (err) {
    console.error("Error:", err);
  }
}
testLiveOnOpen();
