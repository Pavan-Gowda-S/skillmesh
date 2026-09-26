require("dotenv").config();
const http = require("http");
const app = require("../server.js");
const { callTool, executeUpdate } = require("../mcp/freshworks.js");
const { getAuditLogs, clearAuditLogs } = require("./governance.js");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

async function runPhase5ETest() {
  console.log("========================================");
  console.log("PHASE 5E — FRONTEND GOVERNANCE INTEGRATION TEST");
  console.log("========================================\n");

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Setup] In-process test server running at: ${baseUrl}\n`);

  try {
    // ----------------------------------------------------
    // PRE-CHECK: Ensure Ticket #90 is at priority 1
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[SETUP] Initial Ticket #90 State Check");
    console.log("----------------------------------------------------");

    const setupT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const initialPriority = (setupT90.data?.ticket || setupT90.ticket).priority;
    console.log(`Ticket #90 initial priority: ${initialPriority}`);
    if (initialPriority !== 1) {
      console.log("Resetting Ticket #90 to priority 1 before test...");
      await executeUpdate(90, { priority: 1 });
    }
    console.log("Ticket #90 confirmed at priority 1: READY\n");

    // ----------------------------------------------------
    // TEST A: PROPOSAL DISPLAY (Real Investigation on Ticket #90)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST A] Real Investigation & Proposal Generation");
    console.log("----------------------------------------------------");

    const inv1Res = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: 90 })
    });
    const inv1Data = await inv1Res.json();

    console.log(`POST /api/investigate HTTP ${inv1Res.status}`);
    console.log(`Investigation success: ${inv1Data.success}`);
    console.log(`Proposal received: ${inv1Data.proposal ? "YES" : "NO"}`);

    if (!inv1Data.proposal) {
      throw new Error("TEST A FAILED: Investigation did not produce an AI proposal for Ticket #90.");
    }

    const prop1 = inv1Data.proposal;
    console.log(`Proposal ID: ${prop1.proposalId}`);
    console.log(`Ticket ID: ${prop1.ticketId}`);
    console.log(`Updates: ${JSON.stringify(prop1.updates)}`);
    console.log(`Reasoning: ${prop1.reasoning?.substring(0, 80)}...`);
    console.log(`Status: ${prop1.status}`);

    const passA = inv1Res.status === 200 &&
      inv1Data.success === true &&
      typeof prop1.proposalId === "string" && prop1.proposalId.startsWith("proposal-") &&
      prop1.ticketId === 90 &&
      prop1.updates && typeof prop1.updates.priority !== "undefined" &&
      typeof prop1.reasoning === "string" && prop1.reasoning.length > 10 &&
      prop1.status === "pending";

    console.log(`TEST A Result: ${passA ? "PASS" : "FAIL"}\n`);
    if (!passA) throw new Error("TEST A validation failed.");

    // ----------------------------------------------------
    // TEST B: PRE-APPROVAL SAFETY (Freshservice MUST be unchanged)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST B] Pre-Approval Safety Verification");
    console.log("----------------------------------------------------");

    const preApproveT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const prePriority = (preApproveT90.data?.ticket || preApproveT90.ticket).priority;
    console.log(`Ticket #90 priority before approval: ${prePriority}`);
    console.log(`Proposed priority: ${prop1.updates.priority}`);

    const passB = prePriority === 1;
    console.log(`Freshservice unchanged before approval: ${passB ? "PASS (Priority is still 1)" : "FAIL"}\n`);
    if (!passB) throw new Error("TEST B FAILED: Freshservice ticket was modified before human approval!");

    // ----------------------------------------------------
    // TEST C: APPROVE (POST /approve/:actionId)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST C] Human Approval via POST /approve/:actionId");
    console.log("----------------------------------------------------");

    const approveRes = await fetch(`${baseUrl}/approve/${prop1.proposalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const approveData = await approveRes.json();

    console.log(`POST /approve/${prop1.proposalId} HTTP ${approveRes.status}`);
    console.log(`Action: ${approveData.action}`);
    console.log(`Proposal status: ${approveData.proposal?.status}`);
    console.log(`Execution result exists: ${approveData.result ? "YES" : "NO"}`);

    // Independently verify Freshservice changed
    const postApproveT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const postPriority = (postApproveT90.data?.ticket || postApproveT90.ticket).priority;
    console.log(`Freshservice Ticket #90 new priority: ${postPriority}`);

    const passC = approveRes.status === 200 &&
      approveData.success === true &&
      approveData.action === "approved" &&
      approveData.proposal?.status === "approved" &&
      postPriority === prop1.updates.priority;

    console.log(`TEST C Result: ${passC ? "PASS" : "FAIL"}\n`);
    if (!passC) throw new Error("TEST C FAILED: Approval execution did not update Freshservice.");

    // ----------------------------------------------------
    // TEST D: GOVERNANCE LIFECYCLE (PROPOSED -> APPROVED -> EXECUTED)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST D] Governance Audit Log Verification");
    console.log("----------------------------------------------------");

    const auditLogs = getAuditLogs();
    const propLogs = auditLogs.filter(l => l.proposalId === prop1.proposalId);
    console.log(`Found ${propLogs.length} audit entries for ${prop1.proposalId}:`);

    const hasProposed = propLogs.some(l => l.stage === "PROPOSED" && l.actor === "AI");
    const hasApproved = propLogs.some(l => l.stage === "APPROVED" && l.actor === "HUMAN" && l.humanDecision === "APPROVED");
    const hasExecuted = propLogs.some(l => l.stage === "EXECUTED" && l.actor === "SYSTEM" && l.execution === "FRESHSERVICE_WRITE_COMPLETED");

    console.log(`PROPOSED (AI):     ${hasProposed ? "PASS" : "FAIL"}`);
    console.log(`APPROVED (HUMAN):  ${hasApproved ? "PASS" : "FAIL"}`);
    console.log(`EXECUTED (SYSTEM): ${hasExecuted ? "PASS" : "FAIL"}`);

    const passD = hasProposed && hasApproved && hasExecuted;
    console.log(`TEST D Result: ${passD ? "PASS" : "FAIL"}\n`);
    if (!passD) throw new Error("TEST D FAILED: Incomplete governance lifecycle.");

    // ----------------------------------------------------
    // TEST E: REJECT FLOW (PROPOSED -> REJECTED, Zero Write)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST E] Proposal Rejection Flow");
    console.log("----------------------------------------------------");

    // Reset priority back to 1 for the rejection test
    console.log("Resetting Ticket #90 priority to 1 for rejection test...");
    await executeUpdate(90, { priority: 1 });

    // Run new investigation to generate fresh proposal
    console.log("Running second investigation to create fresh proposal...");
    const inv2Res = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: 90 })
    });
    const inv2Data = await inv2Res.json();
    const prop2 = inv2Data.proposal;

    if (!prop2) {
      throw new Error("TEST E FAILED: Second investigation did not produce a proposal.");
    }
    console.log(`Generated fresh Proposal ID: ${prop2.proposalId}`);
    console.log(`Status before reject: ${prop2.status}`);

    // Confirm ticket is priority 1 before rejection
    const preRejectT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    console.log(`Ticket #90 priority before reject call: ${(preRejectT90.data?.ticket || preRejectT90.ticket).priority}`);

    // Call POST /reject/:actionId
    const rejectRes = await fetch(`${baseUrl}/reject/${prop2.proposalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const rejectData = await rejectRes.json();

    console.log(`POST /reject/${prop2.proposalId} HTTP ${rejectRes.status}`);
    console.log(`Action: ${rejectData.action}`);
    console.log(`Proposal status: ${rejectData.proposal?.status}`);

    // Independently confirm Freshservice priority is STILL 1 (unchanged)
    const postRejectT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const postRejectPriority = (postRejectT90.data?.ticket || postRejectT90.ticket).priority;
    console.log(`Freshservice Ticket #90 priority after rejection: ${postRejectPriority}`);

    // Verify rejection governance log
    const rejectLogs = getAuditLogs().filter(l => l.proposalId === prop2.proposalId);
    const hasRejectStage = rejectLogs.some(l => l.stage === "REJECTED" && l.actor === "HUMAN" && l.execution === "NOT EXECUTED");
    const hasNoExecutionWrite = !rejectLogs.some(l => l.stage === "EXECUTED");

    console.log(`Governance log stage REJECTED (HUMAN, NOT EXECUTED): ${hasRejectStage ? "PASS" : "FAIL"}`);
    console.log(`No Freshservice write executed: ${hasNoExecutionWrite ? "PASS" : "FAIL"}`);

    const passE = rejectRes.status === 200 &&
      rejectData.success === true &&
      rejectData.action === "rejected" &&
      rejectData.proposal?.status === "rejected" &&
      postRejectPriority === 1 &&
      hasRejectStage &&
      hasNoExecutionWrite;

    console.log(`TEST E Result: ${passE ? "PASS" : "FAIL"}\n`);
    if (!passE) throw new Error("TEST E FAILED: Rejection failed or modified Freshservice.");

    // ----------------------------------------------------
    // TEST F: DOUBLE ACTION PROTECTION
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST F] Double-Action Re-entrancy Protection");
    console.log("----------------------------------------------------");

    // Attempt second approval on already-approved prop1
    console.log(`Attempting duplicate approval on ${prop1.proposalId} (already approved)...`);
    const dupApproveRes = await fetch(`${baseUrl}/approve/${prop1.proposalId}`, { method: "POST" });
    const dupApproveData = await dupApproveRes.json();
    console.log(`Duplicate approve HTTP ${dupApproveRes.status}: "${dupApproveData.error}"`);

    // Attempt second rejection on already-rejected prop2
    console.log(`Attempting duplicate rejection on ${prop2.proposalId} (already rejected)...`);
    const dupRejectRes = await fetch(`${baseUrl}/reject/${prop2.proposalId}`, { method: "POST" });
    const dupRejectData = await dupRejectRes.json();
    console.log(`Duplicate reject HTTP ${dupRejectRes.status}: "${dupRejectData.error}"`);

    const passF = dupApproveRes.status === 400 &&
      dupApproveData.success === false &&
      dupRejectRes.status === 400 &&
      dupRejectData.success === false;

    console.log(`TEST F Result: ${passF ? "PASS" : "FAIL"}\n`);
    if (!passF) throw new Error("TEST F FAILED: Duplicate actions not rejected with HTTP 400.");

    // ----------------------------------------------------
    // TEST G: REGRESSION (Phase 4F and Phase 5D)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST G] Regression Tests");
    console.log("----------------------------------------------------");

    console.log("Running Phase 4F 9-step governance regression...");
    execSync("node brain/test-phase4f.js", { cwd: path.join(__dirname, ".."), stdio: "inherit" });
    console.log("Phase 4F Regression: PASS\n");

    console.log("Running Phase 5D proficiency badge regression...");
    execSync("node brain/test-phase5d.js", { cwd: path.join(__dirname, ".."), stdio: "inherit" });
    console.log("Phase 5D Regression: PASS\n");

    // ----------------------------------------------------
    // RESTORE DEMO DATA & VERIFY
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[CLEANUP] Restoring Demo Data");
    console.log("----------------------------------------------------");

    await executeUpdate(90, { priority: 1 });
    const finalT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const finalPriority = (finalT90.data?.ticket || finalT90.ticket).priority;
    console.log(`Freshservice Ticket #90 final confirmed priority: ${finalPriority}`);
    if (finalPriority !== 1) {
      throw new Error("DEMO RESTORATION FAILED: Ticket #90 priority is not 1.");
    }
    console.log("Demo data restored: PASS\n");

    // ----------------------------------------------------
    // FINAL STATIC SECURITY AUDIT
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[SECURITY AUDIT] Final Static Security Scan");
    console.log("----------------------------------------------------");

    const auditFiles = [
      path.join(__dirname, "../public/index.html"),
      path.join(__dirname, "../public/js/app.js"),
      path.join(__dirname, "../public/js/data.js"),
      path.join(__dirname, "../public/css/style.css"),
      path.join(__dirname, "../server.js")
    ];

    const secrets = [
      process.env.ANTHROPIC_API_KEY,
      process.env.FRESHSERVICE_API_KEY
    ].filter(s => typeof s === "string" && s.length > 5);

    let secFailed = false;

    // Check public files specifically for no secrets and no direct write calls
    for (const f of auditFiles) {
      const content = fs.readFileSync(f, "utf-8");
      for (const secret of secrets) {
        if (content.includes(secret)) {
          console.error(`EXPOSED SECRET found in ${f}`);
          secFailed = true;
        }
      }
      if (f.includes("public")) {
        if (content.includes("executeUpdate") || content.includes("updateTicket")) {
          console.error(`Direct write function found in public file: ${f}`);
          secFailed = true;
        }
        if (content.includes("https://freshservice") || content.includes("mcp/freshworks")) {
          console.error(`MCP URL found in public file: ${f}`);
          secFailed = true;
        }
      }
    }

    console.log(`Security Scan: ${!secFailed ? "PASS (Zero secrets, zero direct writes in public)" : "FAIL"}\n`);
    if (secFailed) throw new Error("Security audit failed.");

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log("========================================");
    console.log("PHASE 5E VERIFICATION SUMMARY");
    console.log("========================================");
    console.log("TEST A — Proposal Display:      PASS");
    console.log("TEST B — Pre-Approval Safety:   PASS");
    console.log("TEST C — Approve Execution:     PASS");
    console.log("TEST D — Governance Lifecycle:  PASS");
    console.log("TEST E — Reject Flow:           PASS");
    console.log("TEST F — Double Action Guard:   PASS");
    console.log("TEST G — Regression Tests:      PASS");
    console.log("DEMO RESTORATION:               PASS");
    console.log("SECURITY SCAN:                  PASS");
    console.log("========================================");
    console.log("PHASE 5E: ALL TESTS PASSED");

    process.exitCode = 0;
  } finally {
    server.close();
  }
}

runPhase5ETest().catch(err => {
  console.error("Phase 5E test failed with error:", err);
  process.exit(1);
});
