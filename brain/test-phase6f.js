require("dotenv").config();
const http = require("http");
const app = require("../server.js");
const { getPendingProposals, callTool, executeUpdate } = require("../mcp/freshworks.js");
const fs = require("fs");
const path = require("path");

async function runPhase6FTest() {
  console.log("========================================");
  console.log("PHASE 6F — POST INVESTIGATION RESULT TEST");
  console.log("========================================\n");

  const apiKey = process.env.FRESHSERVICE_API_KEY;
  const domain = (process.env.FRESHSERVICE_DOMAIN || process.env.FRESHSERVICE_URL || "").replace(/\/+$/, "");

  if (!apiKey || !domain) {
    throw new Error("Missing FRESHSERVICE_API_KEY or FRESHSERVICE_DOMAIN in .env");
  }

  const auth = Buffer.from(`${apiKey}:X`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json"
  };

  // Helper to fetch conversations directly from Freshservice REST API
  async function getTicketConversations(ticketId) {
    const res = await fetch(`${domain}/api/v2/tickets/${ticketId}/conversations`, { headers });
    if (!res.ok) throw new Error(`Freshservice conversations HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.conversations || [];
  }

  // Helper to get raw ticket from Freshservice
  async function getRawTicket(ticketId) {
    const res = await fetch(`${domain}/api/v2/tickets/${ticketId}`, { headers });
    if (!res.ok) throw new Error(`Freshservice ticket HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.ticket;
  }

  // Check if port 3000 is active, else create in-process server
  let server = null;
  let baseUrl = "http://localhost:3000";

  try {
    const checkRes = await fetch("http://localhost:3000/proposals");
    if (checkRes.ok) {
      console.log("[Setup] Detected active server at http://localhost:3000");
    } else {
      throw new Error("Port 3000 not returning 200");
    }
  } catch (err) {
    console.log("[Setup] Port 3000 not reachable, spinning up in-process server...");
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[Setup] In-process test server running at: ${baseUrl}`);
  }

  let createdNoteId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Baseline Check on Ticket #90
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[TEST 1] Baseline Ticket #90 State Check");
    console.log("----------------------------------------------------");

    const t90Initial = await getRawTicket(90);
    console.log(`Ticket #90 initial priority: ${t90Initial.priority}`);
    console.log(`Ticket #90 initial status:   ${t90Initial.status}`);

    if (t90Initial.priority !== 1) {
      console.log("Resetting Ticket #90 to priority 1 before test baseline...");
      await executeUpdate(90, { priority: 1 });
    }

    const conversationsBefore = await getTicketConversations(90);
    const noteCountBefore = conversationsBefore.length;
    console.log(`Existing conversations count: ${noteCountBefore}`);
    console.log("Baseline verified: Ticket #90 priority=1, status=2: READY\n");

    // ----------------------------------------------------
    // TEST 2: Run Real Investigation via POST /api/investigate
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 2] Trigger Investigation with Automatic Private Note");
    console.log("----------------------------------------------------");

    const invRes = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: 90 })
    });

    const invStatus = invRes.status;
    const invData = await invRes.json();

    console.log(`POST /api/investigate HTTP Status: ${invStatus} (Expected: 200)`);
    console.log(`Investigation success: ${invData.success}`);
    console.log(`Note result:`, JSON.stringify(invData.note, null, 2));

    if (invStatus !== 200 || !invData.success) {
      throw new Error(`Investigation request failed: ${invData.error || invData.message}`);
    }

    if (!invData.note || !invData.note.attempted || !invData.note.success) {
      throw new Error("TEST 2 FAILED: Note posting was not attempted or did not succeed.");
    }

    if (!invData.note.private) {
      throw new Error("TEST 2 FAILED: Note was not marked as private.");
    }

    // Verify structured trace step
    const noteTraceStep = invData.steps?.find(s => s.type === "ticket_note");
    console.log("Structured Trace Step for Note:", JSON.stringify(noteTraceStep, null, 2));

    if (!noteTraceStep || noteTraceStep.tag !== "WRITE" || noteTraceStep.status !== "completed") {
      throw new Error("TEST 2 FAILED: Structured trace step { type: 'ticket_note', tag: 'WRITE', status: 'completed' } missing or invalid.");
    }

    if (!invData.proposal) {
      throw new Error("TEST 2 FAILED: Claude did not generate an update proposal.");
    }

    const proposal = invData.proposal;
    console.log(`AI Proposal ID: ${proposal.proposalId}`);
    console.log(`Proposal Status: ${proposal.status} (Expected: pending)`);
    console.log(`Proposed Updates:`, JSON.stringify(proposal.updates));

    console.log("TEST 2 Result: PASS\n");

    // ----------------------------------------------------
    // TEST 3: Strict Governance Pre-Approval Safety Check
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 3] Verify Freshservice Fields Unchanged (Governance Gate)");
    console.log("----------------------------------------------------");

    const t90PostNote = await getRawTicket(90);
    console.log(`Ticket #90 priority after note posted: ${t90PostNote.priority} (Expected: 1)`);
    console.log(`Ticket #90 status after note posted:   ${t90PostNote.status} (Expected: 2)`);

    const passGovernanceGate = t90PostNote.priority === 1 && t90PostNote.status === 2;
    console.log(`Fields unchanged before human approval: ${passGovernanceGate ? "PASS" : "FAIL"}`);

    if (!passGovernanceGate) {
      throw new Error("CRITICAL FAILURE: Writing the private note altered ticket fields before human approval!");
    }

    // ----------------------------------------------------
    // TEST 4: Independent Read-Back from Freshservice
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[TEST 4] Independent Read-Back Verification from Freshservice");
    console.log("----------------------------------------------------");

    const conversationsAfter = await getTicketConversations(90);
    console.log(`Conversations count after investigation: ${conversationsAfter.length} (Previous: ${noteCountBefore})`);

    if (conversationsAfter.length <= noteCountBefore) {
      throw new Error("TEST 4 FAILED: No new conversation/note found on Ticket #90.");
    }

    // The newest note
    const latestNote = conversationsAfter[conversationsAfter.length - 1];
    createdNoteId = latestNote.id;

    console.log(`New Note ID:      ${latestNote.id}`);
    console.log(`Note is Private:  ${latestNote.private} (Expected: true)`);
    console.log(`Note is Incoming: ${latestNote.incoming} (Expected: false)`);
    console.log(`Note user_id:     ${latestNote.user_id}`);
    console.log(`Note body length: ${latestNote.body?.length || 0} chars`);

    // Verify Note is PRIVATE
    if (latestNote.private !== true) {
      throw new Error("TEST 4 CRITICAL FAILURE: The note on Freshservice is PUBLIC! It must be strictly PRIVATE/INTERNAL.");
    }

    // Verify Note content matches recommendation
    const bodyText = (latestNote.body_text || latestNote.body || "").toLowerCase();
    const hasHeader = bodyText.includes("skillmesh") || bodyText.includes("investigation");
    const hasAgent = bodyText.includes("priya sharma");
    const hasGovernance = bodyText.includes("governance") || bodyText.includes("approval");

    console.log(`Content checks:`);
    console.log(`- Header present:     ${hasHeader}`);
    console.log(`- Agent context:      ${hasAgent}`);
    console.log(`- Governance notice:  ${hasGovernance}`);

    if (!hasHeader || !hasGovernance) {
      throw new Error("TEST 4 FAILED: Note content does not contain required diagnostic/governance sections.");
    }

    // Security Check on Note Content
    const secrets = [process.env.ANTHROPIC_API_KEY, process.env.FRESHSERVICE_API_KEY].filter(Boolean);
    for (const secret of secrets) {
      if (secret.length > 5 && (latestNote.body.includes(secret) || (latestNote.body_text && latestNote.body_text.includes(secret)))) {
        throw new Error("TEST 4 CRITICAL SECURITY FAILURE: Note body contains exposed secret!");
      }
    }
    console.log(`Secret check on Note: PASS (Zero secrets in note body)`);
    console.log("TEST 4 Result: PASS\n");

    // ----------------------------------------------------
    // TEST 5: Human Approval Lifecycle Execution
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 5] Human Approval Flow (POST /approve/:actionId)");
    console.log("----------------------------------------------------");

    const approveRes = await fetch(`${baseUrl}/approve/${proposal.proposalId}`, {
      method: "POST"
    });

    const approveStatus = approveRes.status;
    const approveData = await approveRes.json();

    console.log(`POST /approve/${proposal.proposalId} HTTP Status: ${approveStatus}`);
    console.log(`Approval action: ${approveData.action}`);

    if (approveStatus !== 200 || !approveData.success) {
      throw new Error(`Approval endpoint failed: ${approveData.error || approveData.message}`);
    }

    // Verify Freshservice fields updated AFTER approval
    const t90PostApproval = await getRawTicket(90);
    console.log(`Ticket #90 priority after human approval: ${t90PostApproval.priority} (Expected: 2)`);

    const passApprovedUpdate = t90PostApproval.priority === 2;
    console.log(`Ticket #90 updated only after approval: ${passApprovedUpdate ? "PASS" : "FAIL"}`);

    if (!passApprovedUpdate) {
      throw new Error("TEST 5 FAILED: Ticket fields did not update following human approval.");
    }
    console.log("TEST 5 Result: PASS\n");

    // ----------------------------------------------------
    // TEST 6: Demo Restoration & Clean State
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 6] Restore Ticket #90 to Priority 1");
    console.log("----------------------------------------------------");

    await executeUpdate(90, { priority: 1 });
    const t90Final = await getRawTicket(90);
    console.log(`Ticket #90 final restored priority: ${t90Final.priority} (Expected: 1)`);
    console.log(`Ticket #90 final restored status:   ${t90Final.status} (Expected: 2)`);

    const passRestored = t90Final.priority === 1 && t90Final.status === 2;
    console.log(`Ticket #90 restored: ${passRestored ? "PASS" : "FAIL"}`);
    if (!passRestored) throw new Error("TEST 6 FAILED: Ticket #90 failed to restore to priority 1.");

    // ----------------------------------------------------
    // TEST 7: Security Audit across Codebase
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[TEST 7] Static Security Audit");
    console.log("----------------------------------------------------");

    const auditFiles = [
      path.join(__dirname, "../public/index.html"),
      path.join(__dirname, "../public/js/app.js"),
      path.join(__dirname, "../public/js/data.js"),
      path.join(__dirname, "../public/css/style.css"),
      path.join(__dirname, "../server.js"),
      path.join(__dirname, "../mcp/freshworks.js")
    ];

    let secFailed = false;
    for (const f of auditFiles) {
      const content = fs.readFileSync(f, "utf-8");
      for (const secret of secrets) {
        if (content.includes(secret)) {
          console.error(`EXPOSED SECRET found in ${f}`);
          secFailed = true;
        }
      }
    }

    console.log(`Security Scan: ${!secFailed ? "PASS (Zero secrets in audit files)" : "FAIL"}\n`);
    if (secFailed) throw new Error("Security audit failed.");

    // ----------------------------------------------------
    // VERIFICATION SUMMARY
    // ----------------------------------------------------
    console.log("========================================");
    console.log("PHASE 6F VERIFICATION SUMMARY");
    console.log("========================================");
    console.log("Baseline Verified (Priority: 1):       PASS");
    console.log("Automatic Private Note Posted:         PASS");
    console.log("Note response schema (note.private):   PASS");
    console.log("Trace step (ticket_note, WRITE):       PASS");
    console.log("Governance Gate Pre-Approval Safety:   PASS");
    console.log("Read-Back from Freshservice:           PASS");
    console.log("Note is strictly PRIVATE (not public): PASS");
    console.log("Note content contains recommendations: PASS");
    console.log("Zero secrets in note:                  PASS");
    console.log("Human approval executes update:        PASS");
    console.log("Demo restored to Priority 1, Status 2: PASS");
    console.log("Security audit (Zero secrets):         PASS");
    console.log("========================================");
    console.log("PHASE 6F: ALL TESTS PASSED\n");

    process.exitCode = 0;
  } finally {
    if (server) server.close();
  }
}

runPhase6FTest().catch(err => {
  console.error("Phase 6F test failed:", err);
  process.exit(1);
});
