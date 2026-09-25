require("dotenv").config();
const { callTool, proposeUpdate, getPendingProposals, getProposal } = require("../mcp/freshworks.js");
const { executeTool } = require("./agent.js");

async function runPhase4BTests() {
  console.log("=== PHASE 4B PENDING ACTIONS & REASONING TESTS ===\n");
  const testTicketId = 90;

  // ----------------------------------------------------------------
  // Test A — Create proposal with reasoning
  // ----------------------------------------------------------------
  console.log("--------------------------------------------------");
  console.log("Test A: Create proposal with reasoning");
  console.log("--------------------------------------------------");

  const testReasoning = "The ticket describes a recurring issue that may require higher priority.";
  const proposalA = proposeUpdate(
    testTicketId,
    { priority: 2 },
    testReasoning
  );

  console.log("Proposal A generated:", JSON.stringify(proposalA, null, 2));

  const hasProposalId = typeof proposalA.proposalId === "string" && proposalA.proposalId.startsWith("proposal-");
  const hasTicketId = proposalA.ticketId === testTicketId;
  const hasPriority2 = proposalA.updates && proposalA.updates.priority === 2;
  const hasReasoningExact = proposalA.reasoning === testReasoning;
  const hasStatusPending = proposalA.status === "pending";
  const hasCreatedAt = typeof proposalA.createdAt === "string" && !isNaN(Date.parse(proposalA.createdAt));

  console.log("Check - proposalId valid:", hasProposalId);
  console.log("Check - ticketId === 90:", hasTicketId);
  console.log("Check - updates.priority === 2:", hasPriority2);
  console.log("Check - reasoning preserved exactly:", hasReasoningExact);
  console.log("Check - status === 'pending':", hasStatusPending);
  console.log("Check - createdAt valid timestamp:", hasCreatedAt);

  const testAPassed = hasProposalId && hasTicketId && hasPriority2 && hasReasoningExact && hasStatusPending && hasCreatedAt;
  console.log(`Test A Result: ${testAPassed ? "PASS" : "FAIL"}\n`);

  // ----------------------------------------------------------------
  // Test B — Retrieve pending proposals
  // ----------------------------------------------------------------
  console.log("--------------------------------------------------");
  console.log("Test B: Retrieve pending proposals");
  console.log("--------------------------------------------------");

  const pendingList = getPendingProposals();
  console.log(`Total pending proposals retrieved: ${pendingList.length}`);
  const foundProposalA = pendingList.find(p => p.proposalId === proposalA.proposalId);
  const singleLookup = getProposal(proposalA.proposalId);

  const testBPassed = !!foundProposalA && singleLookup?.proposalId === proposalA.proposalId;
  console.log("Check - Proposal A found in getPendingProposals():", !!foundProposalA);
  console.log("Check - Proposal A found via getProposal():", !!singleLookup);
  console.log(`Test B Result: ${testBPassed ? "PASS" : "FAIL"}\n`);

  // ----------------------------------------------------------------
  // Test C — Verify no Freshservice write
  // ----------------------------------------------------------------
  console.log("--------------------------------------------------");
  console.log("Test C: Verify no Freshservice write from Test A");
  console.log("--------------------------------------------------");

  console.log(`Fetching Ticket #${testTicketId} independently from Freshservice...`);
  const resC = await callTool("fetchTicket", { ticket_id: testTicketId });
  const ticketC = resC.data?.ticket || resC.ticket;
  console.log(`Ticket #${testTicketId} Priority in Freshservice: ${ticketC.priority}`);

  const testCPassed = ticketC.priority === 1;
  console.log("Check - Priority remains 1:", testCPassed);
  console.log(`Test C Result: ${testCPassed ? "PASS (Zero writes to Freshservice)" : "FAIL"}\n`);

  // ----------------------------------------------------------------
  // Test D — Verify Claude dispatcher passes reasoning
  // ----------------------------------------------------------------
  console.log("--------------------------------------------------");
  console.log("Test D: Verify Claude dispatcher passes reasoning");
  console.log("--------------------------------------------------");

  const dispatcherReasoning = "Testing Phase 4B proposal reasoning.";
  const dispatcherProposal = await executeTool("updateTicket", {
    ticketId: testTicketId,
    updates: {
      priority: 2
    },
    reasoning: dispatcherReasoning
  });

  console.log("Dispatcher returned proposal:", JSON.stringify(dispatcherProposal, null, 2));

  const hasDispatcherReasoning = dispatcherProposal.reasoning === dispatcherReasoning;
  const hasDispatcherPending = dispatcherProposal.status === "pending";
  const hasDispatcherId = typeof dispatcherProposal.proposalId === "string";

  console.log("Check - Dispatcher passed reasoning exactly:", hasDispatcherReasoning);
  console.log("Check - Dispatcher proposal status === 'pending':", hasDispatcherPending);
  console.log("Check - Dispatcher proposalId exists:", hasDispatcherId);

  const testDPassed = hasDispatcherReasoning && hasDispatcherPending && hasDispatcherId;
  console.log(`Test D Result: ${testDPassed ? "PASS" : "FAIL"}\n`);

  // ----------------------------------------------------------------
  // Test E — Verify no write through dispatcher
  // ----------------------------------------------------------------
  console.log("--------------------------------------------------");
  console.log("Test E: Verify no write through dispatcher");
  console.log("--------------------------------------------------");

  console.log(`Fetching Ticket #${testTicketId} independently from Freshservice again...`);
  const resE = await callTool("fetchTicket", { ticket_id: testTicketId });
  const ticketE = resE.data?.ticket || resE.ticket;
  console.log(`Ticket #${testTicketId} Priority in Freshservice: ${ticketE.priority}`);

  const testEPassed = ticketE.priority === 1;
  console.log("Check - Priority remains 1:", testEPassed);
  console.log(`Test E Result: ${testEPassed ? "PASS (Zero writes to Freshservice)" : "FAIL"}\n`);

  // Summary
  if (testAPassed && testBPassed && testCPassed && testDPassed && testEPassed) {
    console.log("=== PHASE 4B VERIFICATION: ALL TESTS (A-E) PASSED ===");
    process.exit(0);
  } else {
    console.error("=== PHASE 4B VERIFICATION: FAILED ===");
    process.exit(1);
  }
}

runPhase4BTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
