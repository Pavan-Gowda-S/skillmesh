require("dotenv").config();
const http = require("http");
const app = require("../server.js");
const { getPendingProposals, callTool } = require("../mcp/freshworks.js");

async function runPhase6BTest() {
  console.log("========================================");
  console.log("PHASE 6B — WEBHOOK RECEIVER VERIFICATION TEST");
  console.log("========================================\n");

  let server = null;
  let baseUrl = "http://localhost:3000";

  // Check if port 3000 is active, else create in-process server
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

  try {
    // ----------------------------------------------------
    // TEST 1: Baseline Governance & Freshservice State
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[TEST 1] Baseline State Verification");
    console.log("----------------------------------------------------");

    const proposalsBefore = getPendingProposals();
    const countBefore = proposalsBefore.length;
    console.log(`Initial pending proposals count: ${countBefore}`);

function extractTicket(res) {
  if (!res) return {};
  if (res.data?.ticket) return res.data.ticket;
  if (res.ticket) return res.ticket;
  if (res.content?.[0]?.text) {
    try {
      const parsed = JSON.parse(res.content[0].text);
      return parsed.data?.ticket || parsed.ticket || parsed;
    } catch (e) {}
  }
  return res;
}

    async function getTicket90Priority() {
      try {
        const t90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
        const p = extractTicket(t90)?.priority;
        if (p !== undefined) return p;
      } catch (e) {}

      const apiKey = process.env.FRESHSERVICE_API_KEY;
      const domain = process.env.FRESHSERVICE_DOMAIN || process.env.FRESHSERVICE_URL;
      const res = await fetch(`${domain}/api/v2/tickets/90`, {
        headers: {
          Authorization: "Basic " + Buffer.from(apiKey + ":X").toString("base64"),
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      return data.ticket?.priority;
    }

    const priorityBefore = await getTicket90Priority();
    console.log(`Ticket #90 baseline priority: ${priorityBefore}`);
    if (priorityBefore !== 1) {
      throw new Error(`Baseline failed: Ticket #90 priority is ${priorityBefore}, expected 1.`);
    }

    // ----------------------------------------------------
    // TEST 2: POST /webhook/ticket-created with fake payload
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[TEST 2] POST /webhook/ticket-created");
    console.log("----------------------------------------------------");

    const payload = {
      event: "ticket_created",
      ticket: {
        id: 99999,
        subject: "Phase 6B webhook test"
      }
    };

    console.log(`Target URL: ${baseUrl}/webhook/ticket-created`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    const res = await fetch(`${baseUrl}/webhook/ticket-created`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const status = res.status;
    const data = await res.json();

    console.log(`\nResponse HTTP Status: ${status} (Expected: 200)`);
    console.log("Response Body:", JSON.stringify(data, null, 2));

    const passStatus = status === 200;
    const passSuccess = data.success === true;
    const passReceived = data.received === true;

    console.log(`Status is 200:        ${passStatus ? "PASS" : "FAIL"}`);
    console.log(`data.success is true: ${passSuccess ? "PASS" : "FAIL"}`);
    console.log(`data.received is true:${passReceived ? "PASS" : "FAIL"}`);

    if (!passStatus || !passSuccess || !passReceived) {
      throw new Error("Webhook endpoint response verification failed!");
    }

    // ----------------------------------------------------
    // TEST 3: Confirm NO Brain / Claude / MCP / Writes Triggered
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[TEST 3] No Business Logic / No Side Effects Verification");
    console.log("----------------------------------------------------");

    const proposalsAfter = getPendingProposals();
    const countAfter = proposalsAfter.length;
    console.log(`Pending proposals count after webhook: ${countAfter} (Expected: ${countBefore})`);
    const passNoProposal = countAfter === countBefore;
    console.log(`No proposal created:  ${passNoProposal ? "PASS" : "FAIL"}`);

    const priorityAfter = await getTicket90Priority();
    console.log(`Ticket #90 priority after webhook: ${priorityAfter} (Expected: 1)`);
    const passNoFreshserviceWrite = priorityAfter === 1;
    console.log(`No Freshservice write:${passNoFreshserviceWrite ? "PASS" : "FAIL"}`);

    if (!passNoProposal || !passNoFreshserviceWrite) {
      throw new Error("Side effects detected! Webhook must not trigger business logic or writes.");
    }

    console.log("\n========================================");
    console.log("PHASE 6B VERIFICATION SUMMARY");
    console.log("========================================");
    console.log("Endpoint Exists & Accessible: PASS");
    console.log("HTTP 200 OK:                  PASS");
    console.log("success === true:             PASS");
    console.log("received === true:            PASS");
    console.log("Zero Brain / Claude Triggers: PASS");
    console.log("Zero Freshservice Writes:     PASS");
    console.log("========================================");
    console.log("PHASE 6B: ALL TESTS PASSED\n");

    process.exitCode = 0;
  } finally {
    if (server) server.close();
  }
}

runPhase6BTest().catch(err => {
  console.error("Phase 6B test failed:", err);
  process.exit(1);
});
