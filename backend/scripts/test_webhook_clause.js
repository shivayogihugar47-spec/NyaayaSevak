const axios = require('axios');

async function runRealWebhookTest() {
  console.log("=================================================");
  console.log("STRICT VAPI WEBHOOK METADATA & CLAUSE 2 PENALTY TEST");
  console.log("=================================================\n");

  const sampleDocumentText = `
RENTAL AGREEMENT
This agreement is made for a period of 11 months only.

CLAUSE 1: RENT & DEPOSIT
The monthly rent shall be Rs 25,000. The tenant shall deposit a security deposit of Rs 1,00,000.

CLAUSE 2: SECURITY DEPOSIT FORFEITURE AND PENALTY
If the tenant terminates the lease early before 11 months, the entire security deposit of Rs 1,00,000 shall be 100% forfeited as penalty without any deduction or proof of actual loss.

CLAUSE 3: MAINTENANCE & DAMAGE
The tenant is solely responsible for all structural repairs, building maintenance, and painting costs upon departure.
`;

  console.log("1. Uploading Document to Server (/api/upload)...");
  const uploadRes = await axios.post('http://localhost:3001/api/upload', {
    text: sampleDocumentText
  });

  const { sessionId, clauses, documentRisks } = uploadRes.data;
  console.log(`Uploaded! Generated Server Session ID: ${sessionId}`);
  console.log(`Document Risks Detected: ${documentRisks.length}`);

  // Analyze clause 2 on server
  console.log("2. Benchmarking Clause 2 (/api/analyze-clause)...");
  const clause2Res = await axios.post('http://localhost:3001/api/analyze-clause', {
    sessionId,
    clauseId: 'clause_2'
  });
  console.log("Server Clause 2 Analysis Risk:", clause2Res.data.analysis.risk_level);

  // 3. Construct realistic Vapi tool call payload with call metadata
  const vapiToolCallPayload = {
    message: {
      type: "tool-calls",
      toolCalls: [
        {
          id: "call_vapi_real_strict_777",
          type: "function",
          function: {
            name: "getClauseDetail",
            arguments: JSON.stringify({ clause_id: "2" })
          }
        }
      ],
      call: {
        id: "call_obj_888",
        metadata: {
          document_id: sessionId
        }
      }
    }
  };

  console.log("\n3. Posting Vapi Payload to Live Server Webhook (/api/voice/webhook)...");
  console.log("Strict Metadata Passed: message.call.metadata.document_id =", sessionId);
  console.log("Tool Function Called: getClauseDetail(clause_id: '2')\n");

  const webhookRes = await axios.post('http://localhost:3001/api/voice/webhook', vapiToolCallPayload);
  
  console.log("HTTP 200 WEBHOOK RESPONSE:");
  console.log(JSON.stringify(webhookRes.data, null, 2));

  const resultObj = JSON.parse(webhookRes.data.results[0].result);
  console.log("\nPARSED GROUNDED RESULT FOR VAPI VOICE SYNTHESIS:");
  console.log(`- Clause ID: ${resultObj.clauseId}`);
  console.log(`- Category: ${resultObj.category}`);
  console.log(`- Risk Level: ${resultObj.risk_level}`);
  console.log(`- Simple Explanation: ${resultObj.in_simple_terms}`);
  console.log(`- Legal Issue: ${resultObj.legal_issue}`);
  console.log(`- Cited Law: ${resultObj.cited_law}`);
  console.log(`- Sources:`, JSON.stringify(resultObj.sources, null, 2));

  // Strict Assertions
  const isHighRisk = resultObj.risk_level === 'High';
  const isSection74 = resultObj.cited_law && resultObj.cited_law.includes('Section 74');
  const isCorrectDocId = resultObj.found === true && resultObj.clauseId === 'clause_2';

  if (isHighRisk && isSection74 && isCorrectDocId) {
    console.log("\n=================================================");
    console.log("VERIFICATION SUCCESS: Metadata document_id strictly resolved to exact Clause 2 penalty (High Risk, Section 74)!");
    console.log("=================================================");
  } else {
    console.error("\nFAILED: Metadata resolution or clause analysis mismatch!", { isHighRisk, isSection74, isCorrectDocId });
  }
}

runRealWebhookTest().catch(err => {
  console.error("Test Error:", err.message);
  if (err.response) console.error("Response Data:", err.response.data);
});
