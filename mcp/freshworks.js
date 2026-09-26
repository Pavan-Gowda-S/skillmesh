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

async function executeRestFallback(name, args) {
  const domain = (process.env.FRESHSERVICE_DOMAIN || process.env.FRESHSERVICE_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.FRESHSERVICE_API_KEY;
  if (!domain || !apiKey) {
    throw new Error("Freshservice domain or API key missing in environment.");
  }
  const auth = Buffer.from(`${apiKey}:X`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json"
  };

  if (name === "fetchTicket") {
    const ticketId = args.ticket_id || args.id;
    const res = await fetch(`${domain}/api/v2/tickets/${ticketId}`, { headers });
    if (!res.ok) throw new Error(`Freshservice REST error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
      ticket: data.ticket,
      data: { ticket: data.ticket },
      content: [{ type: "text", text: JSON.stringify(data) }]
    };
  }

  if (name === "fetchTickets") {
    const perPage = args.per_page || 10;
    const orderType = args.order_type || "desc";
    let url = `${domain}/api/v2/tickets?per_page=${perPage}&order_type=${orderType}`;
    if (args.include) url += `&include=${args.include}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Freshservice REST error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
      results: data.tickets || [],
      tickets: data.tickets || [],
      data: { tickets: data.tickets || [] },
      content: [{ type: "text", text: JSON.stringify(data) }]
    };
  }

  if (name === "fetchSolutionFolders") {
    let url = `${domain}/api/v2/solutions/folders`;
    if (args.category_id) url += `?category_id=${args.category_id}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Freshservice REST error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const folders = data.folders || data.solution_folders || [];
    return {
      results: folders,
      solution_folders: folders,
      data: { solution_folders: folders },
      content: [{ type: "text", text: JSON.stringify(data) }]
    };
  }

  if (name === "updateTicket") {
    const ticketId = args.ticket_id || args.id;
    const { ticket_id, id, ...bodyFields } = args;
    const res = await fetch(`${domain}/api/v2/tickets/${ticketId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(bodyFields)
    });
    if (!res.ok) throw new Error(`Freshservice REST error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
      ticket: data.ticket,
      data: { ticket: data.ticket },
      content: [{ type: "text", text: JSON.stringify(data) }]
    };
  }

  if (name === "createTicketNote") {
    const ticketId = args.ticket_id || args.id;
    const bodyPayload = {
      body: args.body,
      private: args.private !== undefined ? args.private : true,
      incoming: !!args.incoming
    };
    if (args.notify_emails) bodyPayload.notify_emails = args.notify_emails;
    const res = await fetch(`${domain}/api/v2/tickets/${ticketId}/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload)
    });
    if (!res.ok) throw new Error(`Freshservice REST error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
      conversation: data.conversation,
      data: { conversation: data.conversation },
      content: [{ type: "text", text: JSON.stringify(data) }]
    };
  }

  throw new Error(`Unsupported tool in REST fallback: ${name}`);
}

async function callTool(name, args = {}, options = {}) {
  if (name === "fetchTicket" && !options.skipGovernanceLog) {
    logGovernanceRead({
      tool: "fetchTicket",
      input: args,
      result: "SUCCESS",
      actor: options.actor || "AI"
    });
  }

  try {
    const mcp = await connectMCP();
    const res = await mcp.callTool({
      name,
      arguments: args
    });

    const isMcpError = res?.isError === true;
    const errorText = res?.content?.[0]?.text || "";
    const isQuota = errorText.toLowerCase().includes("quota exceeded");

    if (!isMcpError && !isQuota) {
      return res;
    }
  } catch (_) {}

  return await executeRestFallback(name, args);
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

/**
 * Phase 6F: Posts an informational investigation recommendation back to the ticket as a private note.
 * Does NOT alter ticket status/priority/SLA and does NOT require human approval, but is logged to governance.
 *
 * @param {number|string} ticketId - ID of ticket
 * @param {string} body - HTML or text of the private note
 * @param {object} [options] - Additional options
 * @returns {Promise<{ success: boolean, conversationId?: number, isPrivate: boolean, error?: string }>}
 */
async function createPrivateNote(ticketId, body, options = {}) {
  const numericId = Number(ticketId);
  try {
    console.log("--- CREATING PRIVATE NOTE ---");
    console.log(`Ticket: ${numericId}`);
    console.log(`Private: true`);
    console.log(`Body preview: ${body.substring(0, 100)}...`);

    const result = await callTool("createTicketNote", {
      ticket_id: numericId,
      body,
      private: true,
      incoming: false
    });

    const conversation = result?.conversation || result?.data?.conversation;
    const conversationId = conversation?.id;

    logGovernanceWrite({
      stage: "INVESTIGATION_NOTE",
      ticketId: numericId,
      actor: options.actor || "AI",
      execution: "FRESHSERVICE_WRITE_COMPLETED",
      result: "SUCCESS",
      reasoning: "AI investigation diagnostic recommendation posted as private internal note.",
      updates: {
        noteType: "private_note",
        conversationId,
        private: true
      }
    });

    console.log(`Private note created successfully on Ticket #${numericId}${conversationId ? ` (ID: ${conversationId})` : ""}\n`);

    return {
      success: true,
      conversationId,
      isPrivate: true,
      result
    };
  } catch (err) {
    console.error(`Failed to create private note on Ticket #${numericId}:`, err.message);

    logGovernanceWrite({
      stage: "INVESTIGATION_NOTE",
      ticketId: numericId,
      actor: options.actor || "AI",
      execution: "NOT EXECUTED",
      result: "FAILED",
      reason: err.message,
      reasoning: "Attempted to post AI investigation private note but encountered error."
    });

    return {
      success: false,
      isPrivate: true,
      error: err.message
    };
  }
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
  createTicketNote: createPrivateNote,
  createPrivateNote,
  proposeUpdate,
  getPendingProposals,
  getProposal,
  setProposalStatus,
  proposals
};