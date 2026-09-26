require("dotenv").config();
const http = require("http");
const app = require("../server.js");
const { callTool, executeUpdate } = require("../mcp/freshworks.js");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.ready = new Promise(resolve => (this.ws.onopen = resolve));
  }

  send(method, params = {}) {
    return new Promise(async (resolve, reject) => {
      await this.ready;
      const curId = this.id++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === curId) {
          this.ws.removeEventListener("message", handler);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      };
      this.ws.addEventListener("message", handler);
      this.ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async screenshot(filePath) {
    const res = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false
    });
    fs.writeFileSync(filePath, Buffer.from(res.data, "base64"));
    console.log(`[Screenshot Saved] -> ${path.relative(process.cwd(), filePath)}`);
  }

  close() {
    try {
      this.ws.close();
    } catch (e) {}
  }
}

async function runScreenshotAutomation() {
  console.log("==================================================");
  console.log("PHASE 5F — AUTOMATED REAL SCREENSHOT GENERATION");
  console.log("==================================================\n");

  const screenshotsDir = path.join(__dirname, "../screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Ensure Ticket #90 initial priority is 1
  console.log("[Setup] Checking initial Freshservice state for Ticket #90...");
  const t90Initial = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
  const pInitial = (t90Initial.data?.ticket || t90Initial.ticket).priority;
  console.log(`Ticket #90 initial priority: ${pInitial}`);
  if (pInitial !== 1) {
    console.log("Resetting Ticket #90 priority to 1...");
    await executeUpdate(90, { priority: 1 });
  }
  console.log("Ticket #90 confirmed at Priority 1: Ready\n");

  // 2. Start in-process Express server
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Setup] In-process server listening at ${baseUrl}\n`);

  // 3. Launch Chrome Headless
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const userDataDir = path.join(__dirname, "../tmp-chrome-screens");
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    `--user-data-dir=${userDataDir}`,
    "--window-size=1440,900",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    baseUrl
  ]);

  let cdp;

  try {
    // Wait for Chrome remote debugging to come up
    let connected = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const res = await fetch("http://127.0.0.1:9222/json/list");
        const targets = await res.json();
        const pageTarget = targets.find(t => t.type === "page");
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
          connected = true;
          break;
        }
      } catch (e) {}
    }

    if (!connected || !cdp) {
      throw new Error("Could not connect to Chrome DevTools Protocol");
    }

    console.log("[Chrome] Connected via CDP. Initializing protocol domains...");
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await new Promise(r => setTimeout(r, 1500));

    // ----------------------------------------------------
    // STATE 1: Ticket picker / initial view
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[STATE 1] Capturing: 01-ticket-picker.png");
    console.log("----------------------------------------------------");

    await cdp.evaluate("window.scrollTo(0, 0)");
    await new Promise(r => setTimeout(r, 600));
    await cdp.screenshot(path.join(screenshotsDir, "01-ticket-picker.png"));

    // ----------------------------------------------------
    // Trigger Real AI Investigation on Ticket #90
    // ----------------------------------------------------
    console.log("\n[Action] Triggering real AI investigation on Ticket #90 via UI...");
    await cdp.evaluate('document.getElementById("btnInvestigate").click()');

    // Poll until investigation finishes and results are rendered
    console.log("[Action] Waiting for Claude tool-use loop & proposal generation...");
    let invDone = false;
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const status = await cdp.evaluate(`
        (() => {
          const btn = document.getElementById("btnInvestigate");
          const targetP = document.getElementById("priorityToDisplay");
          const traceItems = document.querySelectorAll(".trace-item");
          return {
            isLoading: btn.classList.contains("loading"),
            hasProposal: targetP && targetP.textContent !== "—",
            traceCount: traceItems.length
          };
        })()
      `);

      if (status && !status.isLoading && status.traceCount > 2) {
        console.log(`[Action] Investigation completed! Traces rendered: ${status.traceCount}, Proposal: ${status.hasProposal}`);
        invDone = true;
        break;
      }
    }

    if (!invDone) {
      throw new Error("Investigation timed out or failed to render trace in UI");
    }

    await new Promise(r => setTimeout(r, 800));

    // ----------------------------------------------------
    // STATE 2: Investigation trace / tool calls
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[STATE 2] Capturing: 02-investigation-trace.png");
    console.log("----------------------------------------------------");

    await cdp.evaluate("window.scrollTo(0, 360)");
    await new Promise(r => setTimeout(r, 600));
    await cdp.screenshot(path.join(screenshotsDir, "02-investigation-trace.png"));

    // ----------------------------------------------------
    // STATE 3: Personalization / proficiency
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[STATE 3] Capturing: 03-proficiency.png");
    console.log("----------------------------------------------------");

    await cdp.evaluate("window.scrollTo(0, 0)");
    await new Promise(r => setTimeout(r, 600));
    await cdp.screenshot(path.join(screenshotsDir, "03-proficiency.png"));

    // ----------------------------------------------------
    // STATE 4: Proposal pending approval
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[STATE 4] Capturing: 04-approval-pending.png");
    console.log("----------------------------------------------------");

    await cdp.evaluate(`
      (() => {
        const tc = document.getElementById("toastContainer");
        if (tc) tc.innerHTML = "";
        const card = document.getElementById("approvalCard");
        if (card) card.scrollIntoView({ block: "center", behavior: "instant" });
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    await cdp.screenshot(path.join(screenshotsDir, "04-approval-pending.png"));

    // ----------------------------------------------------
    // STATE 5: Approved & executed
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[STATE 5] Capturing: 05-approved-executed.png");
    console.log("----------------------------------------------------");

    console.log("[Action] Clicking APPROVE button in UI...");
    await cdp.evaluate('document.getElementById("btnApproveProposal").click()');

    // Poll until approved state renders
    let approvedDone = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const approvedText = await cdp.evaluate('document.getElementById("btnApproveProposal").textContent');
      if (approvedText && approvedText.includes("APPROVED")) {
        console.log(`[Action] Approval executed: ${approvedText}`);
        approvedDone = true;
        break;
      }
    }

    if (!approvedDone) throw new Error("Approval execution failed in UI");

    await new Promise(r => setTimeout(r, 500));
    await cdp.evaluate(`
      (() => {
        const tc = document.getElementById("toastContainer");
        if (tc) tc.innerHTML = "";
        const card = document.getElementById("approvalCard");
        if (card) card.scrollIntoView({ block: "center", behavior: "instant" });
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    await cdp.screenshot(path.join(screenshotsDir, "05-approved-executed.png"));

    // Verify Freshservice ticket was updated to 2
    const postApproveT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const pApproved = (postApproveT90.data?.ticket || postApproveT90.ticket).priority;
    console.log(`[Freshservice Verification] Ticket #90 priority after approval: ${pApproved} (Expected 2: ${pApproved === 2 ? "YES" : "NO"})`);

    // ----------------------------------------------------
    // STATE 6: Rejected
    // ----------------------------------------------------
    console.log("\n----------------------------------------------------");
    console.log("[STATE 6] Capturing: 06-rejected.png");
    console.log("----------------------------------------------------");

    // Reset Ticket #90 to 1 before running second investigation
    console.log("[Action] Resetting Ticket #90 to priority 1 before rejection run...");
    await executeUpdate(90, { priority: 1 });

    // Reload page to start fresh
    console.log("[Action] Reloading page to execute clean rejection cycle...");
    await cdp.evaluate("window.location.reload()");
    await new Promise(r => setTimeout(r, 2000));

    // Run investigation on Ticket #90
    console.log("[Action] Running investigation for rejection test...");
    await cdp.evaluate('document.getElementById("btnInvestigate").click()');

    let rejInvDone = false;
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const status = await cdp.evaluate(`
        (() => {
          const btn = document.getElementById("btnInvestigate");
          const targetP = document.getElementById("priorityToDisplay");
          return !btn.classList.contains("loading") && targetP && targetP.textContent !== "—";
        })()
      `);
      if (status) {
        rejInvDone = true;
        break;
      }
    }

    if (!rejInvDone) throw new Error("Second investigation for rejection timed out");

    await new Promise(r => setTimeout(r, 800));

    // Click REJECT
    console.log("[Action] Clicking REJECT button in UI...");
    await cdp.evaluate('document.getElementById("btnRejectProposal").click()');

    // Poll until rejected state renders
    let rejectDone = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const rejectText = await cdp.evaluate('document.getElementById("btnRejectProposal").textContent');
      if (rejectText && rejectText.includes("REJECTED")) {
        console.log(`[Action] Rejection executed: ${rejectText}`);
        rejectDone = true;
        break;
      }
    }

    if (!rejectDone) throw new Error("Rejection execution failed in UI");

    await new Promise(r => setTimeout(r, 500));
    await cdp.evaluate(`
      (() => {
        const tc = document.getElementById("toastContainer");
        if (tc) tc.innerHTML = "";
        const card = document.getElementById("approvalCard");
        if (card) card.scrollIntoView({ block: "center", behavior: "instant" });
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    await cdp.screenshot(path.join(screenshotsDir, "06-rejected.png"));

    // Verify Freshservice ticket was NOT updated (still 1)
    const postRejectT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
    const pRejected = (postRejectT90.data?.ticket || postRejectT90.ticket).priority;
    console.log(`[Freshservice Verification] Ticket #90 priority after rejection: ${pRejected} (Expected 1: ${pRejected === 1 ? "YES" : "NO"})`);

    console.log("\n==================================================");
    console.log("ALL 6 SCREENSHOTS SUCCESSFULLY CAPTURED!");
    console.log("==================================================");
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {}

    // Final safety restoration: ensure Ticket #90 is at priority 1
    console.log("\n[Final Cleanup] Restoring Freshservice Ticket #90 to Priority 1...");
    try {
      await executeUpdate(90, { priority: 1 });
      const finalT90 = await callTool("fetchTicket", { ticket_id: 90 }, { skipGovernanceLog: true });
      const finalP = (finalT90.data?.ticket || finalT90.ticket).priority;
      console.log(`Ticket #90 verified final priority: ${finalP}`);
    } catch (e) {
      console.error("Cleanup error:", e.message);
    }
  }
}

runScreenshotAutomation().catch(err => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
