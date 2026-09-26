const ragService = require("./services/ragService");

async function run() {
  try {
    const res = await ragService.generateChatResponse(
      "explain me this document in kannada",
      [{ id: 1, text: "This is a Non-Disclosure Agreement." }],
      "English"
    );
    console.log("Result:", res);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
