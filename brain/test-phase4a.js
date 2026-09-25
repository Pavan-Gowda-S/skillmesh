require("dotenv").config();
const { callTool, proposeUpdate, executeUpdate } = require("../mcp/freshworks.js");
const { executeTool } = require("./agent.js");

async function runPhase4ATests() {
  console.log("=== PHASE 4A GOVERNANCE & APPROVAL GATE TESTS ===\n");
  const testTicketId = 90;

  // 0. Fetch initial state
  console.log(`[Setup] Fetching initial state for Ticket #${testTicketId}...`);
  const initialRes = await callTool("fetchTicket", { ticket_id: testTicketId });
  const initialTicket = initialRes.data?.ticket || initialRes.ticket;
  const originalPriority = initialTicket.priority;
  console.log(`Initial Ticket #${testTicketId} Priority: ${originalPriority}\n`);

  // ==========================================
  // TEST 1 — Proposal does NOT modify Freshservice
  // ==========================================
  console.log("--------------------------------------------------");
  console.log("TEST 1: Proposal does NOT modify Freshservice");
  console.log("--------------------------------------------------");

  const proposedUpdates = { priority: 2 };
  console.log("Calling proposeUpdate(90, { priority: 2 })...");
  const proposal = proposeUpdate(testTicketId, proposedUpdates);

  console.log("Proposal returned:", JSON.stringify(proposal, null, 2));

  // Verify structure
  const hasProposalId = typeof proposal.proposalId === "string" && proposal.proposalId.startsWith("proposal-");
  const hasCorrectId = proposal.ticketId === testTicketId;
  const hasPendingStatus = proposal.status === "pending";
  const hasUpdates = proposal.updates && proposal.updates.priority === 2;

  console.log("Verification - proposalId valid:", hasProposalId);
  console.log("Verification - ticketId valid:", hasCorrectId);
  console.log("Verification - status === 'pending':", hasPendingStatus);
  console.log("Verification - updates preserved:", hasUpdates);

  // Fetch ticket independently
  console.log("\nFetching Ticket #90 independently from Freshservice to verify no write occurred...");
  const verifyRes1 = await callTool("fetchTicket", { ticket_id: testTicketId });
  const ticketAfterProposal = verifyRes1.data?.ticket || verifyRes1.ticket;
  console.log(`Ticket #${testTicketId} Priority in Freshservice after proposal: ${ticketAfterProposal.priority}`);

  const test1Passed = hasProposalId &&
                      hasCorrectId &&
                      hasPendingStatus &&
                      hasUpdates &&
                      ticketAfterProposal.priority === originalPriority;

  console.log(`TEST 1 RESULT: ${test1Passed ? "PASS (Freshservice remained completely unmodified)" : "FAIL"}\n`);

  // Verify dispatcher routing
  console.log("Verifying Claude dispatcher routing: executeTool('updateTicket', ...)");
  const dispatcherRes = await executeTool("updateTicket", {
    ticketId: testTicketId,
    updates: { priority: 3 }
  });
  console.log("Dispatcher returned status:", dispatcherRes.status);
  console.log("Dispatcher returned proposalId:", dispatcherRes.proposalId);
  const dispatcherCheck = dispatcherRes.status === "pending";
  console.log(`Dispatcher Routing Check: ${dispatcherCheck ? "PASS" : "FAIL"}\n`);

  // ==========================================
  // TEST 2 — Execute path DOES modify Freshservice
  // ==========================================
  console.log("--------------------------------------------------");
  console.log("TEST 2: Execute path DOES modify Freshservice");
  console.log("--------------------------------------------------");

  console.log(`Calling executeUpdate(90, { priority: 2 })...`);
  const execRes = await executeUpdate(testTicketId, { priority: 2 }, proposal.proposalId);
  console.log("MCP executeUpdate response status:", execRes.status || execRes.status_code || "OK");

  // Fetch ticket independently
  console.log("\nFetching Ticket #90 independently from Freshservice to verify write occurred...");
  const verifyRes2 = await callTool("fetchTicket", { ticket_id: testTicketId });
  const ticketAfterExecute = verifyRes2.data?.ticket || verifyRes2.ticket;
  console.log(`Ticket #${testTicketId} Priority in Freshservice after executeUpdate: ${ticketAfterExecute.priority}`);

  const test2Passed = ticketAfterExecute.priority === 2;
  console.log(`TEST 2 RESULT: ${test2Passed ? "PASS (Freshservice successfully modified)" : "FAIL"}\n`);

  // ==========================================
  // RESTORE TICKET
  // ==========================================
  console.log("--------------------------------------------------");
  console.log("[Cleanup] Restoring original ticket state");
  console.log("--------------------------------------------------");
  console.log(`Restoring Ticket #${testTicketId} priority to original value: ${originalPriority}...`);
  await executeUpdate(testTicketId, { priority: originalPriority });

  const restoreRes = await callTool("fetchTicket", { ticket_id: testTicketId });
  const restoredTicket = restoreRes.data?.ticket || restoreRes.ticket;
  console.log(`Ticket #${testTicketId} Priority in Freshservice after restoration: ${restoredTicket.priority}`);

  const restored = restoredTicket.priority === originalPriority;
  console.log(`Restoration Check: ${restored ? "CONFIRMED RESTORED" : "FAILED RESTORATION"}\n`);

  if (test1Passed && dispatcherCheck && test2Passed && restored) {
    console.log("=== PHASE 4A VERIFICATION: ALL TESTS PASSED ===");
    process.exit(0);
  } else {
    console.error("=== PHASE 4A VERIFICATION: FAILED ===");
    process.exit(1);
  }
}

runPhase4ATests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
