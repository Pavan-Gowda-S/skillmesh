require("dotenv").config();

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StreamableHTTPClientTransport
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const { logGovernanceRead, logGovernanceWrite } = require("../brain/governance.js");

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

async function callTool(name, args = {}, options = {}) {
  const mcp = await connectMCP();

  if (name === "fetchTicket" && !options.skipGovernanceLog) {
    logGovernanceRead({
      tool: "fetchTicket",
      input: args,
      result: "SUCCESS",
      actor: options.actor || "AI"
    });
  }

  return await mcp.callTool({
    name,
    arguments: args
  });
}

async function fetchTicket(ticketId, options = {}) {
  const res = await callTool("fetchTicket", { ticket_id: Number(ticketId) }, {
    ...options,
    skipGovernanceLog: true
  });

  if (!options.skipGovernanceLog) {
    logGovernanceRead({
      tool: "fetchTicket",
      input: { ticket_id: Number(ticketId) },
      result: "SUCCESS",
      actor: options.actor || "AI"
    });
  }

  return res;
}

async function searchTickets() {
  const res = await callTool("fetchTickets", {
    per_page: 10,
    order_type: "desc"
  });

  logGovernanceRead({
    tool: "searchTickets",
    input: {},
    result: "SUCCESS",
    actor: "AI"
  });

  return res;
}

async function lookupCustomer(requesterId) {
  const result = await callTool("fetchTickets", {
    per_page: 10,
    include: "requester"
  });

  const ticket = result.results?.find(
    t => t.requester_id === requesterId
  );

  const customer = ticket?.requester || null;

  logGovernanceRead({
    tool: "lookupCustomer",
    input: { requesterId },
    result: customer ? "SUCCESS" : "NOT_FOUND",
    actor: "AI"
  });

  return customer;
}

async function searchKnowledgeBase(categoryId) {
  const res = await callTool("fetchSolutionFolders", {
    category_id: categoryId,
    per_page: 10
  });

  logGovernanceRead({
    tool: "searchKnowledgeBase",
    input: { categoryId },
    result: "SUCCESS",
    actor: "AI"
  });

  return res;
}

const proposals = new Map();

/**
 * Phase 4B: Proposes a ticket update with reasoning without writing to Freshservice.
 * Marks the change as pending and records a proposal.
 *
 * @param {number|string} ticketId - ID of ticket
 * @param {object} updates - Updates proposed
 * @param {string} [reasoning] - Claude's rationale for the proposed update
 * @returns {{ proposalId: string, ticketId: number, updates: object, reasoning: string, status: "pending", createdAt: string }}
 */
function proposeUpdate(ticketId, updates, reasoning = "Claude did not provide explicit reasoning.") {
  const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const proposalReasoning = typeof reasoning === "string" && reasoning.trim().length > 0 ? reasoning : "Claude did not provide explicit reasoning.";
  const proposal = {
    proposalId,
    ticketId: Number(ticketId),
    updates,
    reasoning: proposalReasoning,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  proposals.set(proposalId, proposal);

  logGovernanceWrite({
    stage: "PROPOSED",
    proposalId,
    ticketId: Number(ticketId),
    updates,
    reasoning: proposalReasoning,
    actor: "AI",
    humanDecision: "PENDING",
    execution: "NOT EXECUTED"
  });

  console.log("--- UPDATE PROPOSED ---");
  console.log(`Proposal ID: ${proposalId}`);
  console.log(`Ticket: ${ticketId}`);
  console.log(`Updates: ${JSON.stringify(updates)}`);
  console.log(`Reasoning: ${proposal.reasoning}`);
  console.log("Status: pending");
  console.log("Freshservice write: NOT EXECUTED\n");

  return proposal;
}

/**
 * Phase 4B: Retrieves all stored proposals with "pending" status.
 *
 * @returns {Array<object>}
 */
function getPendingProposals() {
  return Array.from(proposals.values()).filter(p => p.status === "pending");
}

/**
 * Phase 4B: Retrieves a proposal by its ID or null if not found.
 *
 * @param {string} proposalId
 * @returns {object|null}
 */
function getProposal(proposalId) {
  return proposals.get(proposalId) || null;
}

/**
 * Phase 4C: Sets status for an existing proposal ("pending", "approved", "rejected").
 *
 * @param {string} proposalId
 * @param {"pending"|"approved"|"rejected"} status
 * @returns {object|null}
 */
function setProposalStatus(proposalId, status) {
  const proposal = proposals.get(proposalId);
  if (!proposal) return null;
  proposal.status = status;
  proposal.updatedAt = new Date().toISOString();
  return proposal;
}

/**
 * Phase 4A: Executes the real ticket update in Freshservice via MCP updateTicket.
 *
 * @param {number|string} ticketId - ID of ticket
 * @param {object} updates - Updates to execute
 * @param {string} [proposalId] - Optional associated proposal ID
 * @returns {Promise<object>} - Result from MCP tool
 */
async function executeUpdate(ticketId, updates, proposalId = null) {
  console.log("--- UPDATE EXECUTED ---");
  if (proposalId) {
    console.log(`Proposal ID: ${proposalId}`);
  }
  console.log(`Ticket: ${ticketId}`);
  console.log(`Updates: ${JSON.stringify(updates)}`);
  console.log("Freshservice write: EXECUTED\n");

  const result = await callTool("updateTicket", {
    ticket_id: Number(ticketId),
    ...updates
  });

  logGovernanceWrite({
    stage: "EXECUTED",
    proposalId: proposalId || undefined,
    ticketId: Number(ticketId),
    updates,
    actor: "SYSTEM",
    execution: "FRESHSERVICE_WRITE_COMPLETED",
    result: "SUCCESS"
  });

  return result;
}

module.exports = {
  connectMCP,
  callTool,
  fetchTicket,
  searchTickets,
  lookupCustomer,
  searchKnowledgeBase,
  updateTicket: executeUpdate,
  executeUpdate,
  proposeUpdate,
  getPendingProposals,
  getProposal,
  setProposalStatus,
  proposals
};