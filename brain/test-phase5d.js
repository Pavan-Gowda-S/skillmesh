require("dotenv").config();
const http = require("http");
const app = require("../server.js");
const { callTool, executeUpdate } = require("../mcp/freshworks.js");
const fs = require("fs");
const path = require("path");

async function runPhase5DTest() {
  console.log("========================================");
  console.log("PHASE 5D — PROFICIENCY BADGE VERIFICATION TEST");
  console.log("========================================\n");

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Setup] In-process test server running at: ${baseUrl}\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Source Files & Static Data Integrity
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 1] Static Asset & Hardcoding Audit");
    console.log("----------------------------------------------------");

    const dataJsPath = path.join(__dirname, "../public/js/data.js");
    const dataJsContent = fs.readFileSync(dataJsPath, "utf-8");
    const appJsPath = path.join(__dirname, "../public/js/app.js");
    const appJsContent = fs.readFileSync(appJsPath, "utf-8");
    const indexHtmlPath = path.join(__dirname, "../public/index.html");
    const indexHtmlContent = fs.readFileSync(indexHtmlPath, "utf-8");
    const cssPath = path.join(__dirname, "../public/css/style.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // 1a. data.js must NOT have hardcoded agent objects in MOCK_TICKETS
    const hasHardcodedAgentInData = dataJsContent.includes('name: "Priya Sharma"') ||
      dataJsContent.includes("agent:") ||
      dataJsContent.includes("proficiency:");
    console.log(`data.js zero hardcoded agent/proficiency: ${!hasHardcodedAgentInData ? "PASS" : "FAIL"}`);

    // 1b. index.html must have #profBadgeDisplay and initial unrated state
    const hasBadgeInHtml = indexHtmlContent.includes('id="profBadgeDisplay"') &&
      indexHtmlContent.includes("Proficiency data unavailable");
    const hasUnratedInHtml = indexHtmlContent.includes("UNRATED") &&
      indexHtmlContent.includes("Awaiting Investigation");
    console.log(`index.html contains #profBadgeDisplay: ${hasBadgeInHtml ? "PASS" : "FAIL"}`);
    console.log(`index.html has unrated initial state: ${hasUnratedInHtml ? "PASS" : "FAIL"}`);

    // 1c. style.css must have .prof-badge and modifier classes
    const hasBadgeCss = cssContent.includes(".prof-badge") &&
      cssContent.includes(".prof-badge.expert") &&
      cssContent.includes(".prof-badge.intermediate") &&
      cssContent.includes(".prof-badge.beginner") &&
      cssContent.includes(".prof-badge.unavailable");
    console.log(`style.css contains .prof-badge styles: ${hasBadgeCss ? "PASS" : "FAIL"}`);

    // 1d. app.js must wire the natural badge
    const hasBadgeLogicInApp = appJsContent.includes("profBadgeDisplay") &&
      appJsContent.includes("Proficiency data unavailable") &&
      appJsContent.includes("${agentName} — ${profLevel} in ${skillName}");
    console.log(`app.js wires natural badge logic: ${hasBadgeLogicInApp ? "PASS" : "FAIL"}\n`);

    if (hasHardcodedAgentInData || !hasBadgeInHtml || !hasUnratedInHtml || !hasBadgeCss || !hasBadgeLogicInApp) {
      throw new Error("Static asset and hardcoding audit failed.");
    }

    // ----------------------------------------------------
    // TEST 2: Security Verification (Zero API Keys in public)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 2] Security Audit (Zero exposed secrets in public/)");
    console.log("----------------------------------------------------");

    const secrets = [
      process.env.ANTHROPIC_API_KEY,
      process.env.FRESHSERVICE_API_KEY
    ].filter(s => typeof s === "string" && s.length > 5);

    let exposed = false;
    for (const filePath of [indexHtmlPath, appJsPath, dataJsPath, cssPath]) {
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
    // TEST 3: Pre-check & Reset Ticket #90 Priority to 1
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 3] Freshservice Ticket #90 Pre-check");
    console.log("----------------------------------------------------");

    const initialT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const priorityT90 = (initialT90.data?.ticket || initialT90.ticket).priority;
    console.log(`Ticket #90 initial priority: ${priorityT90}`);
    if (priorityT90 !== 1) {
      console.log(`Resetting Ticket #90 priority to 1 before test...`);
      await executeUpdate(90, { priority: 1 });
    }
    console.log("Ticket #90 confirmed at Priority 1: PASS\n");

    // ----------------------------------------------------
    // TEST 4: Real Investigation — Ticket #88 (Expert in Network)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 4] Real Personalization: Ticket #88 (Network)");
    console.log("----------------------------------------------------");

    const t88Res = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: 88 })
    });
    const t88Data = await t88Res.json();

    console.log(`POST /api/investigate (Ticket #88): HTTP ${t88Res.status}`);
    console.log(`Success: ${t88Data.success}`);
    console.log(`Agent: ${t88Data.personalization?.agent}`);
    console.log(`Skill: ${t88Data.personalization?.skill}`);
    console.log(`Proficiency: ${t88Data.personalization?.proficiency}%`);
    console.log(`Level: ${t88Data.personalization?.level}`);

    const badgeT88 = `${t88Data.personalization?.agent} — ${t88Data.personalization?.level} in ${t88Data.personalization?.skill}`;
    console.log(`Rendered Badge string: "${badgeT88}"`);

    const passT88 = t88Res.status === 200 &&
      t88Data.success === true &&
      t88Data.ticketId === 88 &&
      t88Data.personalization?.agent === "Priya Sharma" &&
      t88Data.personalization?.skill === "Network" &&
      t88Data.personalization?.proficiency === 90 &&
      t88Data.personalization?.level === "Expert" &&
      badgeT88 === "Priya Sharma — Expert in Network";

    console.log(`Ticket #88 proficiency verification: ${passT88 ? "PASS" : "FAIL"}\n`);

    // ----------------------------------------------------
    // TEST 5: Real Investigation — Ticket #90 (Beginner in Software)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 5] Real Personalization: Ticket #90 (Software)");
    console.log("----------------------------------------------------");

    const t90Res = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: 90 })
    });
    const t90Data = await t90Res.json();

    console.log(`POST /api/investigate (Ticket #90): HTTP ${t90Res.status}`);
    console.log(`Success: ${t90Data.success}`);
    console.log(`Agent: ${t90Data.personalization?.agent}`);
    console.log(`Skill: ${t90Data.personalization?.skill}`);
    console.log(`Proficiency: ${t90Data.personalization?.proficiency}%`);
    console.log(`Level: ${t90Data.personalization?.level}`);

    const badgeT90 = `${t90Data.personalization?.agent} — ${t90Data.personalization?.level} in ${t90Data.personalization?.skill}`;
    console.log(`Rendered Badge string: "${badgeT90}"`);

    const passT90 = t90Res.status === 200 &&
      t90Data.success === true &&
      t90Data.ticketId === 90 &&
      t90Data.personalization?.agent === "Priya Sharma" &&
      t90Data.personalization?.skill === "Software" &&
      t90Data.personalization?.proficiency === 35 &&
      t90Data.personalization?.level === "Beginner" &&
      badgeT90 === "Priya Sharma — Beginner in Software";

    console.log(`Ticket #90 proficiency verification: ${passT90 ? "PASS" : "FAIL"}\n`);

    // ----------------------------------------------------
    // TEST 6: Dynamic Agent Switching: Rahul Mehta on Network
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 6] Agent Proficiency Variation: Rahul Mehta (Network)");
    console.log("----------------------------------------------------");

    const rahulRes = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: 88, agentName: "Rahul Mehta" })
    });
    const rahulData = await rahulRes.json();

    console.log(`POST /api/investigate (Ticket #88, Rahul Mehta): HTTP ${rahulRes.status}`);
    console.log(`Agent: ${rahulData.personalization?.agent}`);
    console.log(`Skill: ${rahulData.personalization?.skill}`);
    console.log(`Proficiency: ${rahulData.personalization?.proficiency}%`);
    console.log(`Level: ${rahulData.personalization?.level}`);

    const badgeRahul = `${rahulData.personalization?.agent} — ${rahulData.personalization?.level} in ${rahulData.personalization?.skill}`;
    console.log(`Rendered Badge string: "${badgeRahul}"`);

    const passRahul = rahulRes.status === 200 &&
      rahulData.success === true &&
      rahulData.personalization?.agent === "Rahul Mehta" &&
      rahulData.personalization?.skill === "Network" &&
      rahulData.personalization?.proficiency === 35 &&
      rahulData.personalization?.level === "Beginner" &&
      badgeRahul === "Rahul Mehta — Beginner in Network";

    console.log(`Rahul Mehta variation check: ${passRahul ? "PASS" : "FAIL"}\n`);

    // ----------------------------------------------------
    // TEST 7: Clean-up & Post-check (Ticket #90 priority: 1)
    // ----------------------------------------------------
    console.log("----------------------------------------------------");
    console.log("[TEST 7] Post-test Cleanup & Verification");
    console.log("----------------------------------------------------");

    console.log("Ensuring Ticket #90 is restored to priority 1...");
    await executeUpdate(90, { priority: 1 });
    const verifyT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const finalPriority = (verifyT90.data?.ticket || verifyT90.ticket).priority;
    console.log(`Freshservice Ticket #90 final priority: ${finalPriority}`);
    const passCleanup = finalPriority === 1;
    console.log(`Ticket #90 restoration check: ${passCleanup ? "PASS" : "FAIL"}\n`);

    // ----------------------------------------------------
    // Summary
    // ----------------------------------------------------
    const allPassed = !hasHardcodedAgentInData &&
      hasBadgeInHtml &&
      hasUnratedInHtml &&
      hasBadgeCss &&
      hasBadgeLogicInApp &&
      !exposed &&
      passT88 &&
      passT90 &&
      passRahul &&
      passCleanup;

    console.log("========================================");
    console.log("PHASE 5D VERIFICATION SUMMARY");
    console.log("========================================");
    console.log(`Static Asset & Audit:      PASS`);
    console.log(`Zero Exposed Secrets:      PASS`);
    console.log(`Ticket #88 (Expert: 90%):  ${passT88 ? "PASS" : "FAIL"}`);
    console.log(`Ticket #90 (Begin: 35%):   ${passT90 ? "PASS" : "FAIL"}`);
    console.log(`Rahul Mehta Variation:     ${passRahul ? "PASS" : "FAIL"}`);
    console.log(`Ticket #90 Restoration:    ${passCleanup ? "PASS" : "FAIL"}`);
    console.log("========================================");

    if (allPassed) {
      console.log("PHASE 5D: ALL TESTS PASSED");
      process.exitCode = 0;
    } else {
      console.log("PHASE 5D: TESTS FAILED");
      process.exitCode = 1;
    }

  } finally {
    server.close();
  }
}

runPhase5DTest().catch(err => {
  console.error("Phase 5D test failed with error:", err);
  process.exit(1);
});
