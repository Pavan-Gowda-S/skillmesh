require("dotenv").config();
const http = require("http");
const app = require("../server.js");
const {
  callTool,
  getPendingProposals,
  executeUpdate
} = require("../mcp/freshworks.js");
const { runInvestigation } = require("./agent.js");
const { getAuditLogs, clearAuditLogs } = require("./governance.js");

async function runPhase4F() {
  console.log("========================================");
  console.log("PHASE 4F — FULL GOVERNANCE INTEGRATION TEST");
  console.log("========================================\n");

  // Start in-process Express server to share in-memory proposal and audit store
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Setup] In-process Express approval server listening at: ${baseUrl}\n`);

  const testTicketId = 90;
  let originalPriority = 1;
  const failedAssertions = [];

  function recordAssertion(name, passed, detail = "") {
    if (!passed) {
      failedAssertions.push(`${name}${detail ? ` (${detail})` : ""}`);
    }
  }

  try {
    // ----------------------------------------------------
    // STEP 1 — Record initial Freshservice state
    // ----------------------------------------------------
    console.log("[STEP 1] Initial Freshservice state");
    const initialRes = await callTool(
      "fetchTicket",
      { ticket_id: testTicketId },
      { skipGovernanceLog: true }
    );
    const initialTicket = initialRes?.data?.ticket || initialRes?.ticket;

    if (!initialTicket) {
      throw new Error(`Failed to read initial state for Ticket #${testTicketId}`);
    }

    originalPriority = initialTicket.priority;
    const initialStatus = initialTicket.status;

    console.log(`Ticket: ${testTicketId}`);
    console.log(`Priority: ${originalPriority}`);
    console.log(`Status: ${initialStatus}\n`);

    if (originalPriority !== 1) {
      console.log(`Notice: Ticket #${testTicketId} initial priority is ${originalPriority}. Resetting to 1 for test baseline...`);
      await executeUpdate(testTicketId, { priority: 1 });
      originalPriority = 1;
    }

    clearAuditLogs();

    // ----------------------------------------------------
    // STEP 2 — Run one real investigation
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[STEP 2] Running real investigation with Claude...");
    console.log("----------------------------------------------------\n");

    const prompt = `Investigate ticket #${testTicketId}. Search the ticket information and requester details. Determine whether the issue warrants raising the priority from its current level to Medium (2). If appropriate, use updateTicket to propose the change and provide your reasoning.`;

    await runInvestigation(prompt);

    // ----------------------------------------------------
    // STEP 3 — Verify the proposal exists
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[STEP 3] Verifying pending proposal...");
    console.log("----------------------------------------------------");

    const pendingProposals = getPendingProposals();
    const proposal = pendingProposals.find(p => p.ticketId === testTicketId && p.status === "pending");

    if (!proposal) {
      throw new Error(`FAIL: No pending proposal found for Ticket #${testTicketId}.`);
    }

    const hasProposalId = typeof proposal.proposalId === "string" && proposal.proposalId.length > 0;
    const isTicket90 = proposal.ticketId === testTicketId;
    const isPendingStatus = proposal.status === "pending";
    const hasPriority2 = proposal.updates && proposal.updates.priority === 2;
    const hasReasoning = typeof proposal.reasoning === "string" && proposal.reasoning.trim().length > 0;

    recordAssertion("Proposal created", hasProposalId);
    recordAssertion("Proposal appeared in pending list", isTicket90);
    recordAssertion("Proposal status = pending", isPendingStatus && hasPriority2 && hasReasoning);

    console.log(`[STEP 3] Pending proposal`);
    console.log(`Proposal ID: ${proposal.proposalId}`);
    console.log(`Ticket: ${proposal.ticketId}`);
    console.log(`Status: ${proposal.status}`);
    console.log(`Proposed priority: ${proposal.updates?.priority}\n`);

    // ----------------------------------------------------
    // STEP 4 — CRITICAL: Verify NO Freshservice change before approval
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[STEP 4] Verifying NO Freshservice change before approval...");
    console.log("----------------------------------------------------");

    const checkBeforeApprove = await callTool(
      "fetchTicket",
      { ticket_id: testTicketId },
      { skipGovernanceLog: true }
    );
    const ticketBeforeApprove = checkBeforeApprove?.data?.ticket || checkBeforeApprove?.ticket;
    const priorityBeforeApprove = ticketBeforeApprove?.priority;

    console.log("[STEP 4] Before approval");
    console.log(`Freshservice priority: ${priorityBeforeApprove}`);
    console.log(`Expected: ${originalPriority}`);

    if (priorityBeforeApprove !== originalPriority) {
      console.log("Status: CHANGED PREMATURELY\n");
      throw new Error("FAIL — AI bypassed human approval: Ticket was updated before approval!");
    } else {
      console.log("Status: UNCHANGED\n");
    }
    recordAssertion("Freshservice unchanged before approval", priorityBeforeApprove === originalPriority);

    // ----------------------------------------------------
    // STEP 5 — Verify governance log BEFORE approval
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[STEP 5] Verifying pre-approval governance log...");
    console.log("----------------------------------------------------");

    const preLogs = getAuditLogs().filter(e => e.proposalId === proposal.proposalId);
    const preProposed = preLogs.some(e => e.stage === "PROPOSED");
    const preApproved = preLogs.some(e => e.stage === "APPROVED");
    const preExecuted = preLogs.some(e => e.stage === "EXECUTED");

    console.log("[STEP 5] Pre-approval governance");
    console.log(`PROPOSED: ${preProposed ? "YES" : "NO"}`);
    console.log(`APPROVED: ${preApproved ? "YES" : "NO"}`);
    console.log(`EXECUTED: ${preExecuted ? "YES" : "NO"}\n`);

    recordAssertion(
      "Governance log shows PROPOSED only",
      preProposed && !preApproved && !preExecuted
    );

    // Also verify read actions occurred
    const auditLogsNow = getAuditLogs();
    const hasSearchTicketsRead = auditLogsNow.some(
      e => e.action === "READ" && e.tool === "searchTickets" && e.actor === "AI"
    );
    const hasLookupCustomerRead = auditLogsNow.some(
      e => e.action === "READ" && e.tool === "lookupCustomer" && e.actor === "AI"
    );
    recordAssertion("Real ticket data read", hasSearchTicketsRead);
    recordAssertion("Requester data read", hasLookupCustomerRead);

    // ----------------------------------------------------
    // STEP 6 — Approve through the real HTTP endpoint
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[STEP 6] Calling HTTP approval endpoint...");
    console.log("----------------------------------------------------");

    const approveResponse = await fetch(`${baseUrl}/approve/${proposal.proposalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const approveData = await approveResponse.json();

    const isHttp200 = approveResponse.status === 200;
    const isActionApproved = approveData.action === "approved";
    const isHumanApproved = isHttp200 && isActionApproved;

    console.log("[STEP 6] Human approval");
    console.log(`HTTP Status: ${approveResponse.status}`);
    console.log(`Action: ${approveData.action}`);
    console.log(`Human Decision: APPROVED\n`);

    recordAssertion("POST /approve/:actionId returned 200", isHttp200);
    recordAssertion("Human approval recorded", isHumanApproved);

    // ----------------------------------------------------
    // STEP 7 — Verify governance lifecycle
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[STEP 7] Verifying governance lifecycle...");
    console.log("----------------------------------------------------");

    const postLogs = getAuditLogs().filter(e => e.proposalId === proposal.proposalId);
    const propStage = postLogs.find(e => e.stage === "PROPOSED");
    const appStage = postLogs.find(e => e.stage === "APPROVED");
    const execStage = postLogs.find(e => e.stage === "EXECUTED");

    const passAIProposal =
      propStage &&
      propStage.actor === "AI" &&
      propStage.humanDecision === "PENDING" &&
      propStage.execution === "NOT EXECUTED";

    const passHumanDecision =
      appStage &&
      appStage.actor === "HUMAN" &&
      appStage.humanDecision === "APPROVED" &&
      appStage.execution === "AUTHORIZED";

    const passSystemExecution =
      execStage &&
      execStage.actor === "SYSTEM" &&
      execStage.execution === "FRESHSERVICE_WRITE_COMPLETED" &&
      execStage.result === "SUCCESS";

    const stages = postLogs.map(e => e.stage);
    const passOrder =
      stages.indexOf("PROPOSED") !== -1 &&
      stages.indexOf("APPROVED") !== -1 &&
      stages.indexOf("EXECUTED") !== -1 &&
      stages.indexOf("PROPOSED") < stages.indexOf("APPROVED") &&
      stages.indexOf("APPROVED") < stages.indexOf("EXECUTED");

    console.log("[STEP 7] Governance lifecycle");
    console.log(`AI proposal: ${passAIProposal ? "PASS" : "FAIL"}`);
    console.log(`Human approval: ${passHumanDecision ? "PASS" : "FAIL"}`);
    console.log(`System execution: ${passSystemExecution ? "PASS" : "FAIL"}`);
    console.log(`Order: ${passOrder ? "PROPOSED → APPROVED → EXECUTED" : "INVALID ORDER"}\n`);

    recordAssertion("Lifecycle = PROPOSED → APPROVED → EXECUTED", passOrder);
    recordAssertion(
      "Actors = AI → HUMAN → SYSTEM",
      passAIProposal && passHumanDecision && passSystemExecution
    );

    // ----------------------------------------------------
    // STEP 8 — Verify the REAL Freshservice ticket changed
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[STEP 8] Verifying real Freshservice change after approval...");
    console.log("----------------------------------------------------");

    const verifyAfter = await callTool(
      "fetchTicket",
      { ticket_id: testTicketId },
      { skipGovernanceLog: true }
    );
    const ticketAfter = verifyAfter?.data?.ticket || verifyAfter?.ticket;
    const actualPriorityAfter = ticketAfter?.priority;

    console.log("[STEP 8] After approval");
    console.log(`Freshservice priority: ${actualPriorityAfter}`);
    console.log(`Expected: 2`);
    console.log(`Status: ${actualPriorityAfter === 2 ? "CHANGED AFTER APPROVAL" : "NOT CHANGED"}\n`);

    recordAssertion("Freshservice changed only after approval", actualPriorityAfter === 2);

    // ----------------------------------------------------
    // STEP 9 — Restore Ticket #90
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log(`[STEP 9] Restoring Ticket #${testTicketId} to original priority ${originalPriority}...`);
    console.log("----------------------------------------------------");

    await executeUpdate(testTicketId, { priority: originalPriority });

    const verifyCleanup = await callTool(
      "fetchTicket",
      { ticket_id: testTicketId },
      { skipGovernanceLog: true }
    );
    const ticketCleaned = verifyCleanup?.data?.ticket || verifyCleanup?.ticket;
    const cleanedPriority = ticketCleaned?.priority;

    console.log("[STEP 9] Cleanup");
    console.log(`Ticket #${testTicketId} restored to priority: ${cleanedPriority}\n`);

    recordAssertion("Ticket #90 restored to original priority", cleanedPriority === originalPriority);

    // ----------------------------------------------------
    // FINAL REPORT
    // ----------------------------------------------------
    const allPassed = failedAssertions.length === 0;

    console.log("========================================");
    console.log("PHASE 4F — FULL GOVERNANCE TEST");
    console.log("========================================\n");

    console.log("READ");
    console.log(`[${hasSearchTicketsRead ? "PASS" : "FAIL"}] Real ticket data read`);
    console.log(`[${hasLookupCustomerRead ? "PASS" : "FAIL"}] Requester data read\n`);

    console.log("PROPOSAL");
    console.log(`[${hasProposalId ? "PASS" : "FAIL"}] Proposal created`);
    console.log(`[${isTicket90 ? "PASS" : "FAIL"}] Proposal appeared in pending list`);
    console.log(`[${isPendingStatus && hasPriority2 && hasReasoning ? "PASS" : "FAIL"}] Proposal status = pending\n`);

    console.log("PRE-APPROVAL SAFETY");
    console.log(`[${priorityBeforeApprove === originalPriority ? "PASS" : "FAIL"}] Freshservice unchanged before approval`);
    console.log(`[${preProposed && !preApproved && !preExecuted ? "PASS" : "FAIL"}] Governance log shows PROPOSED only\n`);

    console.log("HUMAN APPROVAL");
    console.log(`[${isHttp200 ? "PASS" : "FAIL"}] POST /approve/:actionId returned 200`);
    console.log(`[${isHumanApproved ? "PASS" : "FAIL"}] Human approval recorded\n`);

    console.log("EXECUTION");
    console.log(`[${passOrder ? "PASS" : "FAIL"}] Lifecycle = PROPOSED → APPROVED → EXECUTED`);
    console.log(`[${passAIProposal && passHumanDecision && passSystemExecution ? "PASS" : "FAIL"}] Actors = AI → HUMAN → SYSTEM`);
    console.log(`[${actualPriorityAfter === 2 ? "PASS" : "FAIL"}] Freshservice changed only after approval\n`);

    console.log("CLEANUP");
    console.log(`[${cleanedPriority === originalPriority ? "PASS" : "FAIL"}] Ticket #90 restored to original priority\n`);

    console.log("========================================");
    if (allPassed) {
      console.log("PHASE 4F: ALL TESTS PASSED");
      process.exitCode = 0;
    } else {
      console.log("PHASE 4F: FAILED");
      console.log("Failed assertions:", failedAssertions);
      process.exitCode = 1;
    }
    console.log("========================================");

  } finally {
    server.close();
  }
}

runPhase4F().catch(err => {
  console.error("Phase 4F test execution failed with error:", err);
  process.exit(1);
});
