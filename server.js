require("dotenv").config();
const express = require("express");
const path = require("path");
const {
  getProposal,
  setProposalStatus,
  getPendingProposals,
  executeUpdate
} = require("./mcp/freshworks.js");
const { logGovernanceWrite } = require("./brain/governance.js");

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
