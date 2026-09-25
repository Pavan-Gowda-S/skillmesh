require("dotenv").config();

const Anthropic = require("@anthropic-ai/sdk");

async function testConnections() {
  console.log("\n=== CONNECTION TEST ===\n");

  // 1. Test Freshservice
  try {
    const auth = Buffer.from(`${process.env.FRESHSERVICE_API_KEY}:X`).toString("base64");

    const response = await fetch(
      `${process.env.FRESHSERVICE_DOMAIN}/api/v2/tickets`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Freshservice HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    console.log("✅ FRESHSERVICE: SUCCESS");
    console.log("Tickets returned:", data.tickets?.length ?? 0);
  } catch (error) {
    console.log("❌ FRESHSERVICE: FAILED");
    console.log("Error:", error.message);
  }

  // 2. Test Claude
  try {
    const anthropic = new Anthropic.default({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const message = await anthropic.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: Claude connection successful."
        }
      ]
    });

    console.log("\n✅ CLAUDE: SUCCESS");
    console.log("Reply:", message.content[0].text);
  } catch (error) {
    console.log("\n❌ CLAUDE: FAILED");
    console.log("Error:", error.message);
  }

  console.log("\n=== TEST COMPLETE ===");
}

testConnections();