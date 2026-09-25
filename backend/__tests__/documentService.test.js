const { segmentClauses } = require('../services/documentService');

describe('Document Service', () => {
  test('segmentClauses segments simple text properly', () => {
    const rawText = "1. First clause.\n2. Second clause.";
    const clauses = segmentClauses(rawText);
    expect(clauses).toHaveLength(2);
    expect(clauses[0].text).toContain("First clause");
    expect(clauses[1].text).toContain("Second clause");
  });

  test('segmentClauses handles headers and whitespace', () => {
    const rawText = "RENTAL AGREEMENT\n\n1. Rent is 15000.\n\n\n2. Pets are not allowed.";
    const clauses = segmentClauses(rawText);
    expect(clauses).toHaveLength(3); 
    // RENTAL AGREEMENT might be treated as a clause or header depending on logic
    expect(clauses[0].text).toContain("RENTAL AGREEMENT");
    expect(clauses[1].text).toContain("Rent is 15000");
    expect(clauses[2].text).toContain("Pets are not allowed");
  });

  test('segmentClauses handles extremely short text safely', () => {
    const clauses = segmentClauses("Short.");
    expect(clauses).toHaveLength(1);
    expect(clauses[0].text).toBe("Short.");
  });

  test('segmentClauses handles empty string', () => {
    const clauses = segmentClauses("");
    expect(clauses).toHaveLength(1);
    expect(clauses[0].text).toBe("");
  });
});
