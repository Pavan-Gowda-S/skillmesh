require("dotenv").config();
const http = require("http");
const app = require("../server.js");
const { callTool, proposeUpdate, getProposal, executeUpdate } = require("../mcp/freshworks.js");

async function runPhase4CTests() {
  console.log("=== PHASE 4C APPROVAL & REJECTION ENDPOINT TESTS ===\n");

  // Start temporary server for testing
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test Express server running at: ${baseUrl}\n`);

  try {
    const testTicketId = 90;

    // 0. Initial verification of ticket state
    console.log(`[Setup] Verifying initial state of Ticket #${testTicketId}...`);
    const initialRes = await callTool("fetchTicket", { ticket_id: testTicketId });
    const initialTicket = initialRes.data?.ticket || initialRes.ticket;
    const originalPriority = initialTicket.priority;
    console.log(`Initial Ticket #${testTicketId} Priority: ${originalPriority}\n`);

    // ==========================================
    // TEST A — Create proposal
    // ==========================================
    console.log("--------------------------------------------------");
    console.log("TEST A: Create proposal");
    console.log("--------------------------------------------------");
    const proposalA = proposeUpdate(
      testTicketId,
      { priority: 2 },
      "Phase 4C rejection test."
    );
    console.log("Proposal A generated:", proposalA.proposalId, "Status:", proposalA.status);

    const testAPassed = proposalA && proposalA.status === "pending";
    console.log(`TEST A RESULT: ${testAPassed ? "PASS" : "FAIL"}\n`);

    // ==========================================
    // TEST B — Reject proposal via POST /reject/:actionId
    // ==========================================
    console.log("--------------------------------------------------");
    console.log("TEST B: Reject proposal via POST /reject/:actionId");
    console.log("--------------------------------------------------");
    const rejectResponse = await fetch(`${baseUrl}/reject/${proposalA.proposalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const rejectData = await rejectResponse.json();
    console.log("Rejection HTTP Status:", rejectResponse.status);
    console.log("Rejection Response:", JSON.stringify(rejectData, null, 2));

    // Verify proposal in-memory state
    const retrievedA = getProposal(proposalA.proposalId);
    console.log("Retrieved Proposal A Status in memory:", retrievedA?.status);

    // Independently verify Ticket #90 unchanged
    const verifyTicketB = await callTool("fetchTicket", { ticket_id: testTicketId });
    const ticketB = verifyTicketB.data?.ticket || verifyTicketB.ticket;
    console.log(`Ticket #${testTicketId} Priority in Freshservice after rejection: ${ticketB.priority}`);

    const testBPassed = rejectResponse.status === 200 &&
                        rejectData.success === true &&
                        rejectData.action === "rejected" &&
                        retrievedA?.status === "rejected" &&
                        ticketB.priority === originalPriority;

    console.log(`TEST B RESULT: ${testBPassed ? "PASS (Proposal rejected, Freshservice untouched)" : "FAIL"}\n`);

    // ==========================================
    // TEST C — Create another proposal
    // ==========================================
    console.log("--------------------------------------------------");
    console.log("TEST C: Create second proposal for approval execution");
    console.log("--------------------------------------------------");
    const proposalC = proposeUpdate(
      testTicketId,
      { priority: 2 },
      "Phase 4C approval execution test."
    );
    console.log("Proposal C generated:", proposalC.proposalId, "Status:", proposalC.status);

    const testCPassed = proposalC && proposalC.status === "pending";
    console.log(`TEST C RESULT: ${testCPassed ? "PASS" : "FAIL"}\n`);

    // ==========================================
    // TEST D — Approve proposal via POST /approve/:actionId
    // ==========================================
    console.log("--------------------------------------------------");
    console.log("TEST D: Approve proposal via POST /approve/:actionId");
    console.log("--------------------------------------------------");
    const approveResponse = await fetch(`${baseUrl}/approve/${proposalC.proposalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const approveData = await approveResponse.json();
    console.log("Approval HTTP Status:", approveResponse.status);
    console.log("Approval Action:", approveData.action);
    console.log("Approval Proposal Status:", approveData.proposal?.status);

    const retrievedC = getProposal(proposalC.proposalId);
    const testDPassed = approveResponse.status === 200 &&
                        approveData.success === true &&
                        approveData.action === "approved" &&
                        retrievedC?.status === "approved";

    console.log(`TEST D RESULT: ${testDPassed ? "PASS (Approval executed successfully)" : "FAIL"}\n`);

    // ==========================================
    // TEST E — Independently verify Freshservice update
    // ==========================================
    console.log("--------------------------------------------------");
    console.log("TEST E: Independently verify Freshservice update");
    console.log("--------------------------------------------------");
    const verifyTicketE = await callTool("fetchTicket", { ticket_id: testTicketId });
    const ticketE = verifyTicketE.data?.ticket || verifyTicketE.ticket;
    console.log(`Ticket #${testTicketId} Priority in Freshservice after approval: ${ticketE.priority}`);

    const testEPassed = ticketE.priority === 2;
    console.log(`TEST E RESULT: ${testEPassed ? "PASS (Freshservice confirmed updated to priority 2)" : "FAIL"}\n`);

    // ==========================================
    // TEST F — Restore ticket #90
    // ==========================================
    console.log("--------------------------------------------------");
    console.log("TEST F: Restore ticket #90 back to original priority");
    console.log("--------------------------------------------------");
    await executeUpdate(testTicketId, { priority: originalPriority });
    const verifyRestore = await callTool("fetchTicket", { ticket_id: testTicketId });
    const ticketRestored = verifyRestore.data?.ticket || verifyRestore.ticket;
    console.log(`Ticket #${testTicketId} Priority after restoration: ${ticketRestored.priority}`);

    const testFPassed = ticketRestored.priority === originalPriority;
    console.log(`TEST F RESULT: ${testFPassed ? "PASS (Restoration confirmed to priority 1)" : "FAIL"}\n`);

    // ==========================================
    // TEST G — Double approval protection
    // ==========================================
    console.log("--------------------------------------------------");
    console.log("TEST G: Double approval protection");
    console.log("--------------------------------------------------");
    const doubleApproveRes = await fetch(`${baseUrl}/approve/${proposalC.proposalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const doubleApproveData = await doubleApproveRes.json();
    console.log("Double approval HTTP Status:", doubleApproveRes.status);
    console.log("Double approval Error:", doubleApproveData.error);

    const testGPassed = doubleApproveRes.status === 400 && doubleApproveData.success === false;
    console.log(`TEST G RESULT: ${testGPassed ? "PASS (Blocked re-approval of approved proposal)" : "FAIL"}\n`);

    // ==========================================
    // TEST H — Reject already approved proposal
    // ==========================================
    console.log("--------------------------------------------------");
    console.log("TEST H: Reject already approved proposal protection");
    console.log("--------------------------------------------------");
    const rejectApprovedRes = await fetch(`${baseUrl}/reject/${proposalC.proposalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const rejectApprovedData = await rejectApprovedRes.json();
    console.log("Reject approved proposal HTTP Status:", rejectApprovedRes.status);
    console.log("Reject approved proposal Error:", rejectApprovedData.error);

    const testHPassed = rejectApprovedRes.status === 400 && rejectApprovedData.success === false;
    console.log(`TEST H RESULT: ${testHPassed ? "PASS (Blocked rejection of approved proposal)" : "FAIL"}\n`);

    // Summary
    const allPassed = testAPassed && testBPassed && testCPassed && testDPassed &&
                      testEPassed && testFPassed && testGPassed && testHPassed;

    if (allPassed) {
      console.log("=== PHASE 4C VERIFICATION: ALL TESTS (A-H) PASSED ===");
      process.exitCode = 0;
    } else {
      console.error("=== PHASE 4C VERIFICATION: FAILED ===");
      process.exitCode = 1;
    }
  } finally {
    server.close();
  }
}

runPhase4CTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
