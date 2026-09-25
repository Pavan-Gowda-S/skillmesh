/**
 * Governance Audit Execution Log
 * Phase 4E - Records AI read actions and governs the write lifecycle.
 */

const auditLogs = [];

/**
 * Redacts any sensitive values (API keys, authorization headers, passwords, secrets)
 * from objects, strings, or arrays before logging.
 */
function sanitize(value) {
  if (value === null || value === undefined) return value;

  const secrets = [
    process.env.ANTHROPIC_API_KEY,
    process.env.FRESHSERVICE_API_KEY
  ].filter(Boolean);

  if (typeof value === "string") {
    let cleaned = value;
    for (const secret of secrets) {
      if (secret && secret.length > 5) {
        cleaned = cleaned.split(secret).join("[REDACTED_SECRET]");
      }
    }
    cleaned = cleaned.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [REDACTED]");
    cleaned = cleaned.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
    return cleaned;
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === "object") {
    const sensitiveKeys = ["authorization", "apikey", "password", "token", "secret", "cookie"];
    const sanitizedObj = {};
    for (const [k, v] of Object.entries(value)) {
      if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
        sanitizedObj[k] = "[REDACTED]";
      } else {
        sanitizedObj[k] = sanitize(v);
      }
    }
    return sanitizedObj;
  }

  return value;
}

/**
 * Log a READ operation performed by the brain.
 *
 * @param {object} params
 * @param {string} params.tool - Tool name (e.g. searchTickets, lookupCustomer, searchKnowledgeBase, fetchTicket)
 * @param {object} [params.input] - Input parameters (sanitized)
 * @param {"SUCCESS"|"ERROR"|"NOT_FOUND"} [params.result="SUCCESS"]
 * @param {string} [params.actor="AI"]
 * @returns {object} The logged entry
 */
function logGovernanceRead({ tool, input = {}, result = "SUCCESS", actor = "AI" }) {
  const timestamp = new Date().toISOString();
  const safeInput = sanitize(input);

  const entry = {
    timestamp,
    action: "READ",
    tool,
    input: safeInput,
    result,
    actor
  };

  auditLogs.push(entry);

  console.log("\n=== GOVERNANCE READ ===");
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Action: READ`);
  console.log(`Tool: ${tool}`);
  console.log(`Input: ${JSON.stringify(safeInput)}`);
  console.log(`Result: ${result}`);
  console.log(`Actor: ${actor}\n`);

  return entry;
}

/**
 * Log a WRITE lifecycle stage event.
 *
 * @param {object} params
 * @param {"PROPOSED"|"APPROVED"|"EXECUTED"|"REJECTED"|"BLOCKED"} params.stage
 * @param {string} [params.proposalId]
 * @param {number|string} [params.ticketId]
 * @param {object} [params.updates]
 * @param {string} [params.reasoning]
 * @param {string} [params.reason]
 * @param {"AI"|"HUMAN"|"SYSTEM"} [params.actor]
 * @param {"PENDING"|"APPROVED"|"REJECTED"} [params.humanDecision]
 * @param {"NOT EXECUTED"|"AUTHORIZED"|"FRESHSERVICE_WRITE_COMPLETED"} [params.execution]
 * @param {"SUCCESS"|"FAILED"|"BLOCKED"} [params.result]
 * @returns {object} The logged entry
 */
function logGovernanceWrite({
  stage,
  proposalId,
  ticketId,
  updates,
  reasoning,
  reason,
  actor,
  humanDecision,
  execution,
  result
}) {
  const timestamp = new Date().toISOString();
  const safeUpdates = updates ? sanitize(updates) : undefined;
  const safeReasoning = reasoning ? sanitize(reasoning) : undefined;

  const entry = {
    timestamp,
    action: "WRITE",
    stage,
    proposalId,
    ticketId: ticketId ? Number(ticketId) : undefined,
    updates: safeUpdates,
    reasoning: safeReasoning,
    reason,
    actor,
    humanDecision,
    execution,
    result
  };

  auditLogs.push(entry);

  console.log("\n=== GOVERNANCE WRITE ===");
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Action: WRITE`);
  console.log(`Stage: ${stage}`);
  if (proposalId) console.log(`Proposal ID: ${proposalId}`);
  if (ticketId) console.log(`Ticket: ${ticketId}`);
  if (safeUpdates) console.log(`Updates: ${JSON.stringify(safeUpdates)}`);
  if (safeReasoning) console.log(`Reasoning: ${safeReasoning}`);
  if (reason) console.log(`Reason: ${reason}`);
  if (actor) console.log(`Actor: ${actor}`);
  if (humanDecision) console.log(`Human Decision: ${humanDecision}`);
  if (execution) console.log(`Execution: ${execution}`);
  if (result) console.log(`Result: ${result}`);
  console.log("");

  return entry;
}

/**
 * Returns a shallow copy of all audit log events recorded so far.
 */
function getAuditLogs() {
  return [...auditLogs];
}

/**
 * Clears all stored audit log events.
 */
function clearAuditLogs() {
  auditLogs.length = 0;
}

module.exports = {
  logGovernanceRead,
  logGovernanceWrite,
  getAuditLogs,
  clearAuditLogs,
  sanitize,
  auditLogs
};
