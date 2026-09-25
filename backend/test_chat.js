const ragService = require('./services/ragService');

async function run() {
  try {
    const res = await ragService.generateChatResponse('hello can you explain this document to me?', [{ id: 1, text: 'This is a test document.' }]);
    console.log(res);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
