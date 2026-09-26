require("dotenv").config();
const express = require("express");
const path = require("path");
const {
  getProposal,
  setProposalStatus,
  getPendingProposals,
  executeUpdate,
  createPrivateNote
} = require("./mcp/freshworks.js");
const { logGovernanceWrite } = require("./brain/governance.js");
const { runInvestigation } = require("./brain/agent.js");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * POST /approve/:actionId
 * Executes a pending proposal by updating Freshservice and marking the proposal as approved.
 */
app.post("/approve/:actionId", async (req, res) => {
  const { actionId } = req.params;
  const proposal = getProposal(actionId);

  if (!proposal) {
    return res.status(404).json({
      success: false,
      error: "Proposal not found"
    });
  }

  if (proposal.status !== "pending") {
    logGovernanceWrite({
      stage: "BLOCKED",
      proposalId: actionId,
      ticketId: proposal.ticketId,
      reason: "Proposal is not pending",
      execution: "NOT EXECUTED",
      result: "BLOCKED"
    });
    return res.status(400).json({
      success: false,
      error: "Proposal is not pending"
    });
  }

  logGovernanceWrite({
    stage: "APPROVED",
    proposalId: proposal.proposalId,
    ticketId: proposal.ticketId,
    actor: "HUMAN",
    humanDecision: "APPROVED",
    execution: "AUTHORIZED"
  });

  console.log("\n--- APPROVAL REQUEST ---");
  console.log(`Proposal ID: ${proposal.proposalId}`);
  console.log(`Ticket: ${proposal.ticketId}`);
  console.log(`Status: ${proposal.status}\n`);

  try {
    const result = await executeUpdate(
      proposal.ticketId,
      proposal.updates,
      proposal.proposalId
    );

    setProposalStatus(proposal.proposalId, "approved");

    console.log("--- APPROVAL EXECUTED ---");
    console.log(`Proposal ID: ${proposal.proposalId}`);
    console.log(`Ticket: ${proposal.ticketId}`);
    console.log("Freshservice write: EXECUTED");
    console.log("Status: approved\n");

    return res.status(200).json({
      success: true,
      action: "approved",
      proposal,
      result
    });
  } catch (error) {
    console.error(`Approval execution failed: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: `Failed to execute Freshservice update: ${error.message}`
    });
  }
});

/**
 * POST /reject/:actionId
 * Rejects a pending proposal without modifying Freshservice.
 */
app.post("/reject/:actionId", (req, res) => {
  const { actionId } = req.params;
  const proposal = getProposal(actionId);

  if (!proposal) {
    return res.status(404).json({
      success: false,
      error: "Proposal not found"
    });
  }

  if (proposal.status !== "pending") {
    logGovernanceWrite({
      stage: "BLOCKED",
      proposalId: actionId,
      ticketId: proposal.ticketId,
      reason: "Proposal is not pending",
      execution: "NOT EXECUTED",
      result: "BLOCKED"
    });
    return res.status(400).json({
      success: false,
      error: "Proposal is not pending"
    });
  }

  logGovernanceWrite({
    stage: "REJECTED",
    proposalId: proposal.proposalId,
    ticketId: proposal.ticketId,
    actor: "HUMAN",
    humanDecision: "REJECTED",
    execution: "NOT EXECUTED"
  });

  console.log("\n--- REJECTION REQUEST ---");
  console.log(`Proposal ID: ${proposal.proposalId}`);
  console.log(`Ticket: ${proposal.ticketId}`);
  console.log(`Status: ${proposal.status}`);

  setProposalStatus(proposal.proposalId, "rejected");

  console.log("Freshservice write: NOT EXECUTED");
  console.log("Status: rejected\n");

  return res.status(200).json({
    success: true,
    action: "rejected",
    proposal
  });
});

/**
 * Format the private investigation note for Freshservice in clean HTML.
 */
function formatInvestigationNote({ ticketId, personalization, finalResponse, proposal }) {
  const agentStr = personalization
    ? `${personalization.agent} (${personalization.level} in ${personalization.skill} • ${personalization.proficiency}% proficiency)`
    : "Assigned Agent";

  let governanceStatus = "No ticket field changes proposed. Ticket fields remain unchanged.";
  if (proposal && proposal.updates) {
    const updatesDesc = Object.entries(proposal.updates)
      .map(([k, v]) => `${k} → ${v}`)
      .join(", ");
    governanceStatus = `Proposed field update: ${updatesDesc} (Status: PENDING approval in SkillMesh dashboard — NOT executed until human agent approves).`;
  }

  const escapeHtml = (str) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const safeAgent = escapeHtml(agentStr);
  const safeGovernance = escapeHtml(governanceStatus);
  const safeResponse = escapeHtml(finalResponse);

  return `<div>
  <h3 style="color: #1e3a8a; margin-top: 0; margin-bottom: 8px;">SkillMesh AI Investigation Report</h3>
  <p><strong>Ticket ID:</strong> #${ticketId}</p>
  <p><strong>Assigned Agent Context:</strong> ${safeAgent}</p>
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
  <h4 style="color: #334155; margin-bottom: 6px;">Investigation Findings &amp; Recommendation:</h4>
  <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 10px 12px; white-space: pre-wrap; font-family: sans-serif; font-size: 13px; line-height: 1.5; color: #1e293b;">${safeResponse}</div>
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
  <p><strong>Governance Status:</strong> ${safeGovernance}</p>
  <p style="font-size: 11px; color: #64748b; margin-bottom: 0;"><em>Note: This is an internal private diagnostic note posted by SkillMesh AIPair. Field changes require human approval and do not execute automatically.</em></p>
</div>`;
}

/**
 * POST /api/investigate
 * Runs the Phase 2 Claude investigation loop for a specified ticketId.
 */
app.post("/api/investigate", async (req, res) => {
  const { ticketId, agentName, agent } = req.body;

  if (!ticketId) {
    return res.status(400).json({
      success: false,
      error: "ticketId is required"
    });
  }

  const numericTicketId = Number(ticketId);
  if (isNaN(numericTicketId)) {
    return res.status(400).json({
      success: false,
      error: "ticketId must be a valid number"
    });
  }

  console.log(`\n========================================`);
  console.log(`[API] Received investigation request for Ticket #${numericTicketId}`);
  console.log(`========================================\n`);

  try {
    const prompt = `Investigate ticket #${numericTicketId}. Search the ticket information and requester details. Determine root cause and whether the issue warrants a priority change. If appropriate, use updateTicket to propose the change with clear technical reasoning. Provide a clear recommendation.`;

    const result = await runInvestigation(prompt, {
      ticketId: numericTicketId,
      agentName: agentName || agent,
      returnStructuredTrace: true
    });

    // Check if a proposal was created for this ticket
    const pendingProposals = getPendingProposals();
    const latestProposal = pendingProposals
      .filter(p => p.ticketId === numericTicketId)
      .pop() || null;

    // Phase 6F: Post investigation recommendation back to ticket as a private note
    let noteResult = {
      attempted: true,
      success: false,
      private: true
    };

    try {
      const noteBody = formatInvestigationNote({
        ticketId: numericTicketId,
        personalization: result.personalization,
        finalResponse: result.finalResponse,
        proposal: latestProposal
      });

      const noteRes = await createPrivateNote(numericTicketId, noteBody);
      noteResult.success = !!noteRes.success;
      if (noteRes.conversationId) {
        noteResult.conversationId = noteRes.conversationId;
      }

      // Add structured trace step
      if (Array.isArray(result.steps)) {
        result.steps.push({
          type: "ticket_note",
          title: "Investigation result posted to ticket",
          tag: "WRITE",
          status: noteRes.success ? "completed" : "error",
          summary: noteRes.success
            ? `Private investigation note added to ticket #${numericTicketId}${noteRes.conversationId ? ` (ID: ${noteRes.conversationId})` : ""}`
            : `Failed to post private note: ${noteRes.error || "Unknown error"}`
        });
      }
    } catch (noteErr) {
      console.error(`[API] Note posting error for Ticket #${numericTicketId}:`, noteErr.message);
      noteResult.success = false;
      noteResult.error = noteErr.message;

      if (Array.isArray(result.steps)) {
        result.steps.push({
          type: "ticket_note",
          title: "Investigation result note error",
          tag: "WRITE",
          status: "error",
          summary: `Could not post private note: ${noteErr.message}`
        });
      }
    }

    return res.status(200).json({
      success: true,
      ticketId: numericTicketId,
      personalization: result.personalization,
      steps: result.steps,
      finalResponse: result.finalResponse,
      proposal: latestProposal,
      note: noteResult
    });
  } catch (error) {
    console.error(`[API] Investigation failed: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: "Investigation failed",
      message: error.message
    });
  }
});

/**
 * POST /webhook/ticket-created
 * Webhook receiver for Freshservice ticket creation events.
 * Phase 6B: Receiver only - does not trigger brain/investigation.
 */
app.post("/webhook/ticket-created", (req, res) => {
  console.log("\n[WEBHOOK] ticket-created received");
  console.log("[WEBHOOK] payload:");
  console.log(JSON.stringify(req.body || {}, null, 2));

  return res.status(200).json({
    success: true,
    received: true
  });
});

/**
 * GET /proposals
 * Returns all pending proposals.
 */
app.get("/proposals", (req, res) => {
  return res.status(200).json({
    success: true,
    proposals: getPendingProposals()
  });
});

/**
 * GET /proposals/:actionId
 * Retrieves a proposal by ID.
 */
app.get("/proposals/:actionId", (req, res) => {
  const proposal = getProposal(req.params.actionId);
  if (!proposal) {
    return res.status(404).json({
      success: false,
      error: "Proposal not found"
    });
  }
  return res.status(200).json({
    success: true,
    proposal
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Freshservice-AI Approval Server running on port ${PORT}`);
  });
}

module.exports = app;
