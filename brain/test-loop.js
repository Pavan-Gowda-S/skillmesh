require("dotenv").config();
const { runInvestigation } = require("./agent.js");

async function main() {
  const prompt = process.argv[2] || "Investigate ticket #88";
  const agentName = process.argv[3]; // e.g. "Priya Sharma" or "Rahul Mehta"

  try {
    await runInvestigation(prompt, { agentName });
  } catch (error) {
    console.error("\n❌ Investigation failed:", error);
    process.exit(1);
  }
}

main();
