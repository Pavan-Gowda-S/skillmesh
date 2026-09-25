require("dotenv").config();
const { runInvestigation } = require("./agent.js");

async function main() {
  const prompt = process.argv[2] || "Investigate ticket #2";
  try {
    await runInvestigation(prompt);
  } catch (error) {
    console.error("\n❌ Investigation failed:", error);
    process.exit(1);
  }
}

main();
