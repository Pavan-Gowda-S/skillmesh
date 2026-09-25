require("dotenv").config();

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StreamableHTTPClientTransport
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

let client;
let transport;

async function connectMCP() {
  if (client) return client;

  client = new Client({
    name: "freshservice-ai",
    version: "1.0.0"
  });

  transport = new StreamableHTTPClientTransport(
    new URL(process.env.MCP_URL),
    {
      requestInit: {
        headers: {
          Authorization: process.env.FRESHSERVICE_API_KEY
        }
      }
    }
  );

  await client.connect(transport);

  return client;
}

async function callTool(name, args = {}) {
  const mcp = await connectMCP();

  return await mcp.callTool({
    name,
    arguments: args
  });
}

async function searchTickets() {
  return await callTool("fetchTickets", {
    per_page: 10,
    order_type: "desc"
  });
}

async function lookupCustomer(requesterId) {
  const result = await callTool("fetchTickets", {
    per_page: 10,
    include: "requester"
  });

  const ticket = result.results?.find(
    t => t.requester_id === requesterId
  );

  return ticket?.requester || null;
}

async function searchKnowledgeBase(categoryId) {
  return await callTool("fetchSolutionFolders", {
    category_id: categoryId,
    per_page: 10
  });
}

async function updateTicket(ticketId, updates) {
  return await callTool("updateTicket", {
    ticket_id: ticketId,
    ...updates
  });
}

module.exports = {
  connectMCP,
  callTool,
  searchTickets,
  lookupCustomer,
  searchKnowledgeBase,
  updateTicket
};