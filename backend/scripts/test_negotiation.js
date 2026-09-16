const path = require('path');
const { generateNegotiationMessage } = require('../services/ragService');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runNegotiationTest() {
  const clauseText = "The Tenant shall deposit a security amount of Rs. 1,00,000 (One Lakh Rupees) before moving in. If the Tenant terminates the agreement before the 11-month lock-in period, the entire deposit will be forfeited by the Landlord as an absolute penalty.";
  
  const analysis = {
    legal_issue: "The clause imposes an absolute penalty of Rs. 1,00,000 for early termination, which exceeds the statutory cap of 2 months' rent for residential premises under the Model Tenancy Act. Additionally, under the Indian Contract Act, penalties must be proportionate to actual loss, not arbitrary absolute amounts.",
    cited_law: "Model Tenancy Act, 2021 Sec 11; Indian Contract Act, Sec 74",
    recommended_action: "Request the landlord to amend the clause to limit the security deposit to 2 months' rent and restrict forfeiture to actual damages incurred rather than an absolute penalty."
  };

  console.log("Generating Negotiation Message...\n");
  
  try {
    const message = await generateNegotiationMessage(clauseText, analysis);
    console.log(message);
  } catch (err) {
    console.error("Error generating message:", err);
  }
  
  process.exit(0);
}

runNegotiationTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
