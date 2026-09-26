require("dotenv").config();
const http = require("http");
const app = require("../server.js");
const { callTool, executeUpdate } = require("../mcp/freshworks.js");
const fs = require("fs");
const path = require("path");

async function runPhase5CTest() {
  console.log("========================================");
  console.log("PHASE 5C — FRONTEND & INVESTIGATION API INTEGRATION TEST");
  console.log("========================================\n");

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Setup] Test server running at: ${baseUrl}\n`);

  try {
    // ----------------------------------------------------
    // 1. Static Frontend Asset Checks
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 1] Verifying frontend static assets");
    console.log("----------------------------------------------------");

    const indexRes = await fetch(`${baseUrl}/`);
    const indexHtml = await indexRes.text();
    const appJsRes = await fetch(`${baseUrl}/js/app.js`);
    const appJs = await appJsRes.text();
    const dataJsRes = await fetch(`${baseUrl}/js/data.js`);
    const cssRes = await fetch(`${baseUrl}/css/style.css`);

    console.log(`GET / : HTTP ${indexRes.status} (length: ${indexHtml.length})`);
    console.log(`GET /js/app.js : HTTP ${appJsRes.status}`);
    console.log(`GET /js/data.js : HTTP ${dataJsRes.status}`);
    console.log(`GET /css/style.css : HTTP ${cssRes.status}`);

    const hasInvestigateFetch = appJs.includes('fetch("/api/investigate"') || appJs.includes("fetch('/api/investigate'");
    const hasApproveFetch = appJs.includes("fetch(`/approve/") || appJs.includes('fetch("/approve/');
    const hasRejectFetch = appJs.includes("fetch(`/reject/") || appJs.includes('fetch("/reject/');

    console.log(`Frontend calls /api/investigate: ${hasInvestigateFetch ? "PASS" : "FAIL"}`);
    console.log(`Frontend calls /approve/:actionId: ${hasApproveFetch ? "PASS" : "FAIL"}`);
    console.log(`Frontend calls /reject/:actionId: ${hasRejectFetch ? "PASS" : "FAIL"}\n`);

    if (!hasInvestigateFetch || !hasApproveFetch || !hasRejectFetch) {
      throw new Error("Frontend JavaScript missing required backend API calls.");
    }

    // ----------------------------------------------------
    // 2. Security Check (No exposed API keys in public directory)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 2] Security check (No exposed keys in public files)");
    console.log("----------------------------------------------------");

    const publicFiles = [
      path.join(__dirname, "../public/index.html"),
      path.join(__dirname, "../public/js/app.js"),
      path.join(__dirname, "../public/js/data.js"),
      path.join(__dirname, "../public/css/style.css")
    ];

    const secrets = [
      process.env.ANTHROPIC_API_KEY,
      process.env.FRESHSERVICE_API_KEY
    ].filter(s => typeof s === "string" && s.length > 5);

    let exposed = false;
    for (const filePath of publicFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (content.includes("process.env") || content.includes("sk-ant-") || content.includes("Bearer ")) {
        exposed = true;
        console.error(`Potential secret exposure in ${filePath}`);
      }
      for (const secret of secrets) {
        if (content.includes(secret)) {
          exposed = true;
          console.error(`Exposed secret in ${filePath}`);
        }
      }
    }

    console.log(`Security verification: ${!exposed ? "PASS (Zero secrets in public)" : "FAIL"}\n`);
    if (exposed) throw new Error("Security verification failed!");

    // ----------------------------------------------------
    // 3. API Validation: Error handling
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 3] Testing POST /api/investigate validation");
    console.log("----------------------------------------------------");

    const errRes = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const errData = await errRes.json();
    console.log(`POST /api/investigate with empty body: HTTP ${errRes.status}, error: "${errData.error}"`);
    const passValidation = errRes.status === 400 && errData.success === false;
    console.log(`Validation check: ${passValidation ? "PASS" : "FAIL"}\n`);

    // ----------------------------------------------------
    // 4. Real Investigation: Ticket #90
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 4] Real Investigation for Ticket #90");
    console.log("----------------------------------------------------");

    // Check initial priority of Ticket #90
    const initialT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const priorityT90 = (initialT90.data?.ticket || initialT90.ticket).priority;
    if (priorityT90 !== 1) {
      console.log(`Resetting Ticket #90 priority to 1 before test...`);
      await executeUpdate(90, { priority: 1 });
    }

    const t90Res = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: 90 })
    });
    const t90Data = await t90Res.json();

    console.log(`POST /api/investigate (Ticket #90): HTTP ${t90Res.status}`);
    console.log(`Success: ${t90Data.success}`);
    console.log(`Ticket ID: ${t90Data.ticketId}`);
    console.log(`Skill: ${t90Data.personalization?.skill}`);
    console.log(`Proficiency: ${t90Data.personalization?.proficiency}% (${t90Data.personalization?.level})`);
    console.log(`Steps count: ${t90Data.steps?.length}`);
    console.log(`Proposal generated: ${t90Data.proposal?.proposalId || "None"}`);

    const passT90 = t90Res.status === 200 &&
      t90Data.success === true &&
      t90Data.ticketId === 90 &&
      t90Data.personalization?.skill === "Software" &&
      t90Data.personalization?.level === "Beginner" &&
      Array.isArray(t90Data.steps) && t90Data.steps.length > 0 &&
      typeof t90Data.finalResponse === "string";

    console.log(`Ticket #90 investigation: ${passT90 ? "PASS" : "FAIL"}\n`);

    // If proposal was generated, test the Phase 4 approval endpoint
    if (t90Data.proposal?.proposalId) {
      console.log(`Testing Phase 4 approval endpoint for ${t90Data.proposal.proposalId}...`);
      const approveRes = await fetch(`${baseUrl}/approve/${t90Data.proposal.proposalId}`, {
        method: "POST"
      });
      const approveData = await approveRes.json();
      console.log(`Approval HTTP ${approveRes.status}: action = ${approveData.action}`);

      // Restore Ticket #90 to priority 1
      console.log(`Restoring Ticket #90 to priority 1...`);
      await executeUpdate(90, { priority: 1 });
      const verifyT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
      const cleanedPriority = (verifyT90.data?.ticket || verifyT90.ticket).priority;
      console.log(`Ticket #90 restored priority: ${cleanedPriority}\n`);
    }

    // ----------------------------------------------------
    // 5. Real Investigation: Ticket #88
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 5] Real Investigation for Ticket #88");
    console.log("----------------------------------------------------");

    const t88Res = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: 88 })
    });
    const t88Data = await t88Res.json();

    console.log(`POST /api/investigate (Ticket #88): HTTP ${t88Res.status}`);
    console.log(`Success: ${t88Data.success}`);
    console.log(`Ticket ID: ${t88Data.ticketId}`);
    console.log(`Skill: ${t88Data.personalization?.skill}`);
    console.log(`Proficiency: ${t88Data.personalization?.proficiency}% (${t88Data.personalization?.level})`);
    console.log(`Steps count: ${t88Data.steps?.length}`);

    const passT88 = t88Res.status === 200 &&
      t88Data.success === true &&
      t88Data.ticketId === 88 &&
      t88Data.personalization?.skill === "Network" &&
      t88Data.personalization?.level === "Expert" &&
      Array.isArray(t88Data.steps) && t88Data.steps.length > 0;

    console.log(`Ticket #88 investigation: ${passT88 ? "PASS" : "FAIL"}\n`);

    // ----------------------------------------------------
    // 6. Real Investigation: Ticket #87
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 6] Real Investigation for Ticket #87");
    console.log("----------------------------------------------------");

    const t87Res = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: 87 })
    });
    const t87Data = await t87Res.json();

    console.log(`POST /api/investigate (Ticket #87): HTTP ${t87Res.status}`);
    console.log(`Success: ${t87Data.success}`);
    console.log(`Ticket ID: ${t87Data.ticketId}`);
    console.log(`Steps count: ${t87Data.steps?.length}`);

    const passT87 = t87Res.status === 200 &&
      t87Data.success === true &&
      t87Data.ticketId === 87 &&
      Array.isArray(t87Data.steps) && t87Data.steps.length > 0;

    console.log(`Ticket #87 investigation: ${passT87 ? "PASS" : "FAIL"}\n`);

    // ----------------------------------------------------
    // Summary
    // ----------------------------------------------------
    const allPassed = !exposed && passValidation && passT90 && passT88 && passT87;

    console.log("========================================");
    console.log("PHASE 5C VERIFICATION SUMMARY");
    console.log("========================================");
    console.log(`Frontend Static Assets: PASS`);
    console.log(`Zero Exposed Secrets:   PASS`);
    console.log(`API Validation:         ${passValidation ? "PASS" : "FAIL"}`);
    console.log(`Ticket #90 Real Run:    ${passT90 ? "PASS" : "FAIL"}`);
    console.log(`Ticket #88 Real Run:    ${passT88 ? "PASS" : "FAIL"}`);
    console.log(`Ticket #87 Real Run:    ${passT87 ? "PASS" : "FAIL"}`);
    console.log("========================================");

    if (allPassed) {
      console.log("PHASE 5C: ALL TESTS PASSED");
      process.exitCode = 0;
    } else {
      console.log("PHASE 5C: TESTS FAILED");
      process.exitCode = 1;
    }

  } finally {
    server.close();
  }
}

runPhase5CTest().catch(err => {
  console.error("Phase 5C test failed with error:", err);
  process.exit(1);
});
