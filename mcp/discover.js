require("dotenv").config();

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StreamableHTTPClientTransport
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

async function discoverTools() {
  const client = new Client({
    name: "freshservice-ai",
    version: "1.0.0"
  });

  const transport = new StreamableHTTPClientTransport(
    new URL(process.env.MCP_URL),
    {
      requestInit: {
        headers: {
          Authorization: process.env.FRESHSERVICE_API_KEY
        }
      }
    }
  );

  try {
    await client.connect(transport);

    const result = await client.listTools();

    console.log("\n=== MCP TOOLS ===\n");

    for (const tool of result.tools) {
      console.log(`TOOL: ${tool.name}`);
      console.log("DESCRIPTION:", tool.description || "No description");
      console.log(
        "INPUT:",
        JSON.stringify(tool.inputSchema, null, 2)
      );
      console.log("-----------------------------------");
    }

    await client.close();
  } catch (error) {
    console.log("\n❌ MCP CONNECTION FAILED");
    console.log("Error:", error.message);
  }
}

discoverTools();