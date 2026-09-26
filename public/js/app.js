/**
 * SkillMesh - Frontend Application Logic (Phase 5C)
 * Wires frontend to the real Phase 2 backend investigation loop and Phase 4 governance gate.
 */

document.addEventListener("DOMContentLoaded", () => {
  let currentTicketIndex = 0;
  let currentProposal = null;
  let isProcessingAction = false;
  const investigationCache = {};

  // DOM Elements
  const ticketPickerContainer = document.getElementById("ticketPickerOptions");
  const ticketIdDisplay = document.getElementById("ticketIdDisplay");
  const ticketTitleDisplay = document.getElementById("ticketTitleDisplay");
  const tagStatus = document.getElementById("tagStatus");
  const tagPriority = document.getElementById("tagPriority");
  const tagSkill = document.getElementById("tagSkill");
  const ticketRequesterDisplay = document.getElementById("ticketRequesterDisplay");
  const ticketDescDisplay = document.getElementById("ticketDescDisplay");
  const btnInvestigate = document.getElementById("btnInvestigate");

  // Proficiency Elements
  const profSkillDisplay = document.getElementById("profSkillDisplay");
  const radialCircle = document.getElementById("radialCircle");
  const radialPctDisplay = document.getElementById("radialPctDisplay");
  const radialLabelDisplay = document.getElementById("radialLabelDisplay");
  const profNameDisplay = document.getElementById("profNameDisplay");
  const profBadgeDisplay = document.getElementById("profBadgeDisplay");
  const profNoteDisplay = document.getElementById("profNoteDisplay");
  const gradStop1 = document.getElementById("gradStop1");
  const gradStop2 = document.getElementById("gradStop2");
  const headerAgentName = document.getElementById("headerAgentName");
  const headerAgentAvatar = document.getElementById("headerAgentAvatar");

  // Trace Elements
  const traceListContainer = document.getElementById("traceListContainer");

  // Recommendation Elements
  const recTitleDisplay = document.getElementById("recTitleDisplay");
  const recBodyDisplay = document.getElementById("recBodyDisplay");
  const recConfidenceDisplay = document.getElementById("recConfidenceDisplay");
  const btnReviewRec = document.getElementById("btnReviewRec");

  // Approval Elements (Phase 5E)
  const approvalCard = document.getElementById("approvalCard");
  const approvalEyebrow = document.getElementById("approvalEyebrow");
  const priorityFromDisplay = document.getElementById("priorityFromDisplay");
  const priorityToDisplay = document.getElementById("priorityToDisplay");
  const proposedByDisplay = document.getElementById("proposedByDisplay");
  const approvalReasoningDisplay = document.getElementById("approvalReasoningDisplay");
  const approvalReasoningWrap = document.getElementById("approvalReasoningWrap");
  const governanceChain = document.getElementById("governanceChain");
  const govStepProposed = document.getElementById("govStepProposed");
  const govArrow1 = document.getElementById("govArrow1");
  const govStepDecision = document.getElementById("govStepDecision");
  const govArrow2 = document.getElementById("govArrow2");
  const govStepExecuted = document.getElementById("govStepExecuted");
  const approvalStatusDisplay = document.getElementById("approvalStatusDisplay");
  const approvalStatusText = document.getElementById("approvalStatusText");
  const approvalStatusDot = document.getElementById("approvalStatusDot");
  const approvalOutcomeList = document.getElementById("approvalOutcomeList");
  const approvalActionsContainer = document.getElementById("approvalActionsContainer");
  const btnReviewProposal = document.getElementById("btnReviewProposal");
  const btnApproveProposal = document.getElementById("btnApproveProposal");
  const btnRejectProposal = document.getElementById("btnRejectProposal");

  // Skill Gaps Elements
  const skillGapsList = document.getElementById("skillGapsList");

  // Metrics Elements
  const metricTicketsAnalyzed = document.getElementById("metricTicketsAnalyzed");
  const metricInvestigations = document.getElementById("metricInvestigations");
  const metricPendingApprovals = document.getElementById("metricPendingApprovals");
  const metricSkillGaps = document.getElementById("metricSkillGaps");

  // Modals
  const proposalModal = document.getElementById("proposalModal");
  const modalProposalClose = document.getElementById("modalProposalClose");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalApproveBtn = document.getElementById("modalApproveBtn");
  const modalRejectBtn = document.getElementById("modalRejectBtn");
  const modalProposalTitle = document.getElementById("modalProposalTitle");
  const modalProposalId = document.getElementById("modalProposalId");
  const modalProposalTicket = document.getElementById("modalProposalTicket");
  const modalProposalAction = document.getElementById("modalProposalAction");
  const modalProposalReasoning = document.getElementById("modalProposalReasoning");

  const gapModal = document.getElementById("gapModal");
  const modalGapClose = document.getElementById("modalGapClose");
  const modalGapCloseBtn = document.getElementById("modalGapCloseBtn");
  const modalGapApplyBtn = document.getElementById("modalGapApplyBtn");
  const modalGapTitle = document.getElementById("modalGapTitle");
  const modalGapDescription = document.getElementById("modalGapDescription");
  const modalGapTickets = document.getElementById("modalGapTickets");

  // Toast Container
  const toastContainer = document.getElementById("toastContainer");

  /**
   * Display a floating toast notification
   */
  function showToast(message, icon = "⚡", duration = 4000) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px) scale(0.95)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 320);
    }, duration);
  }

  /**
   * Initialize and render the Ticket Picker Strip
   */
  function renderTicketPicker() {
    ticketPickerContainer.innerHTML = "";
    MOCK_TICKETS.forEach((ticket, idx) => {
      const btn = document.createElement("button");
      btn.className = `picker-btn ${idx === currentTicketIndex ? "active" : ""}`;
      btn.innerHTML = `<span class="badge-num">#${ticket.id}</span> <span>${ticket.title.substring(0, 26)}...</span>`;
      btn.addEventListener("click", () => {
        selectTicket(idx);
      });
      ticketPickerContainer.appendChild(btn);
    });
  }

  /**
   * Switch the active ticket and update all dependent UI cards
   */
  function selectTicket(index) {
    currentTicketIndex = index;
    const ticket = MOCK_TICKETS[currentTicketIndex];

    // Update picker active states
    const buttons = ticketPickerContainer.querySelectorAll(".picker-btn");
    buttons.forEach((b, i) => b.classList.toggle("active", i === index));

    // Update Main Ticket Card
    ticketIdDisplay.textContent = `TICKET #${ticket.id}`;
    ticketTitleDisplay.textContent = ticket.title;
    tagStatus.textContent = `STATUS · ${ticket.status}`;
    tagPriority.textContent = `PRIORITY · ${ticket.priority}`;
    tagPriority.className = `tag ${ticket.priority === "LOW" ? "priority-low" : "priority-medium"}`;
    tagSkill.textContent = ticket.skill ? `SKILL · ${ticket.skill}` : "SKILL · AWAITING";
    ticketRequesterDisplay.textContent = ticket.requester;
    ticketDescDisplay.textContent = ticket.description;

    // Check if this ticket has a cached real investigation
    if (investigationCache[ticket.id]) {
      applyInvestigationData(investigationCache[ticket.id], ticket);
    } else {
      // Show initial ready state
      renderInitialProficiency(ticket);
      renderInitialTrace(ticket);
      renderInitialRecommendation(ticket);
      renderInitialApprovalCard(ticket);
    }
  }

  /**
   * Render initial/default proficiency card (unrated/awaiting state)
   */
  function renderInitialProficiency(ticket) {
    profSkillDisplay.textContent = "—";
    profNameDisplay.textContent = "Awaiting Investigation";
    profNoteDisplay.innerHTML = "Click 'INVESTIGATE TICKET →' to evaluate agent proficiency and skill alignment.";
    radialPctDisplay.textContent = "—";
    radialLabelDisplay.textContent = "UNRATED";
    radialLabelDisplay.style.color = "var(--text-faint)";
    radialCircle.style.strokeDashoffset = "440";
    radialCircle.style.filter = "none";

    if (gradStop1 && gradStop2) {
      gradStop1.setAttribute("stop-color", "rgba(255, 255, 255, 0.2)");
      gradStop2.setAttribute("stop-color", "rgba(255, 255, 255, 0.05)");
    }

    if (profBadgeDisplay) {
      profBadgeDisplay.textContent = "Proficiency data unavailable";
      profBadgeDisplay.className = "prof-badge unavailable";
    }

    if (headerAgentName) headerAgentName.textContent = "Awaiting Ticket";
    if (headerAgentAvatar) headerAgentAvatar.textContent = "--";
  }

  /**
   * Render initial trace before investigation is run
   */
  function renderInitialTrace(ticket) {
    traceListContainer.innerHTML = `
      <div class="trace-item">
        <div class="trace-dot"></div>
        <div class="trace-body">
          <span class="t-title">Ready for investigation</span>
          <span class="t-tag">IDLE</span>
          <div class="t-sub">Click "INVESTIGATE TICKET →" to trigger the Claude tool-use loop on Ticket #${ticket.id}.</div>
        </div>
      </div>
    `;
  }

  function renderInitialRecommendation(ticket) {
    recTitleDisplay.textContent = "Awaiting Investigation";
    recBodyDisplay.textContent = "Click 'INVESTIGATE TICKET →' to run live AI analysis, retrieve Freshservice data, and generate actionable recommendations.";
    recConfidenceDisplay.textContent = "—";
    btnReviewRec.disabled = true;
  }

  function renderInitialApprovalCard(ticket) {
    currentProposal = null;
    approvalEyebrow.textContent = `GOVERNANCE GATE — TICKET #${ticket.id}`;
    priorityFromDisplay.textContent = ticket.priority;
    priorityToDisplay.textContent = "—";
    proposedByDisplay.textContent = "Waiting for investigation";
    approvalStatusDisplay.className = "approval-status";
    approvalStatusText.textContent = "NO PENDING PROPOSALS YET";
    approvalCard.classList.remove("is-approved", "is-rejected");

    if (approvalReasoningDisplay) {
      approvalReasoningDisplay.textContent = "";
      approvalReasoningDisplay.style.display = "none";
    }
    if (approvalReasoningWrap) {
      approvalReasoningWrap.style.display = "none";
    }
    if (governanceChain) {
      governanceChain.style.display = "none";
    }
    if (approvalOutcomeList) {
      approvalOutcomeList.innerHTML = "";
      approvalOutcomeList.style.display = "none";
    }
    if (approvalActionsContainer) {
      approvalActionsContainer.style.display = "none";
    }

    btnApproveProposal.disabled = true;
    btnRejectProposal.disabled = true;
    btnReviewProposal.disabled = true;
    btnApproveProposal.textContent = "APPROVE";
    btnRejectProposal.textContent = "REJECT";
  }

  /**
   * Apply real backend investigation results to UI
   */
  function applyInvestigationData(data, ticket) {
    // 1. Update Personalization & Proficiency
    if (data.personalization) {
      const p = data.personalization;
      const skillName = p.skill || "General";
      const agentName = p.agent || "Assigned Agent";
      const profScore = Number(p.proficiency) || 0;
      const profLevel = p.level || "Unrated";
      const levelUpper = profLevel.toUpperCase();

      profSkillDisplay.textContent = skillName.toUpperCase();
      profNameDisplay.textContent = agentName;
      radialPctDisplay.textContent = `${profScore}%`;
      radialLabelDisplay.textContent = levelUpper;

      // Update Header Agent Chip
      if (headerAgentName) headerAgentName.textContent = agentName;
      if (headerAgentAvatar) {
        const initials = agentName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        headerAgentAvatar.textContent = initials || "AG";
      }

      // Update Natural Proficiency Badge (e.g. "Priya Sharma — Expert in Network")
      if (profBadgeDisplay) {
        profBadgeDisplay.textContent = `${agentName} — ${profLevel} in ${skillName}`;
        profBadgeDisplay.className = `prof-badge ${profLevel.toLowerCase()}`;
      }

      // Visual styling & Guidance Notes based on Level
      if (levelUpper === "EXPERT") {
        radialLabelDisplay.style.color = "var(--teal)";
        profNoteDisplay.innerHTML = "GUIDANCE LEVEL: CONCISE<br>DIRECT TECHNICAL RECOMMENDATIONS ENABLED";
        if (gradStop1 && gradStop2) {
          gradStop1.setAttribute("stop-color", "#2dd8c4");
          gradStop2.setAttribute("stop-color", "#17a693");
        }
        radialCircle.style.filter = "drop-shadow(0 0 8px rgba(45, 216, 196, 0.5))";
      } else if (levelUpper === "INTERMEDIATE") {
        radialLabelDisplay.style.color = "var(--magenta)";
        profNoteDisplay.innerHTML = "GUIDANCE LEVEL: FOCUSED<br>TARGETED RESOLUTION STEPS ENABLED";
        if (gradStop1 && gradStop2) {
          gradStop1.setAttribute("stop-color", "#c9679e");
          gradStop2.setAttribute("stop-color", "#2dd8c4");
        }
        radialCircle.style.filter = "drop-shadow(0 0 8px rgba(201, 103, 158, 0.5))";
      } else {
        radialLabelDisplay.style.color = "var(--coral)";
        profNoteDisplay.innerHTML = "GUIDANCE LEVEL: DETAILED<br>STEP-BY-STEP WALKTHROUGHS ENABLED";
        if (gradStop1 && gradStop2) {
          gradStop1.setAttribute("stop-color", "#ff6b5e");
          gradStop2.setAttribute("stop-color", "#c9679e");
        }
        radialCircle.style.filter = "drop-shadow(0 0 8px rgba(255, 107, 94, 0.5))";
      }

      const circumference = 440;
      const offset = circumference - (circumference * profScore / 100);
      radialCircle.style.strokeDashoffset = offset;

      tagSkill.textContent = `SKILL · ${skillName.toUpperCase()}`;
    }

    // 2. Render Real Investigation Trace
    renderRealTrace(data.steps || []);

    // 3. Update Recommendation Card
    if (data.proposal) {
      recTitleDisplay.textContent = `Proposed Update: Priority → ${data.proposal.updates?.priority === 2 ? "Medium (2)" : data.proposal.updates?.priority}`;
    } else {
      recTitleDisplay.textContent = "Investigation Complete";
    }

    // Excerpt first paragraph of Claude final response
    if (data.finalResponse) {
      const paragraphs = data.finalResponse.split("\n\n").filter(p => p.trim().length > 0);
      recBodyDisplay.textContent = paragraphs[0] || data.finalResponse.substring(0, 240) + "...";
    }
    recConfidenceDisplay.textContent = "92%";
    btnReviewRec.disabled = !data.proposal;

    // 4. Update Approval Card
    if (data.proposal) {
      currentProposal = data.proposal;
      approvalEyebrow.textContent = `GOVERNANCE GATE — PENDING APPROVAL (#${data.proposal.ticketId})`;
      priorityFromDisplay.textContent = ticket.priority;
      const targetPriority = data.proposal.updates?.priority === 2 ? "MEDIUM" : (data.proposal.updates?.priority || "—");
      priorityToDisplay.textContent = targetPriority;
      proposedByDisplay.textContent = `AI Investigation Engine (${data.proposal.proposalId})`;

      // Render real reasoning
      if (data.proposal.reasoning) {
        if (approvalReasoningDisplay) {
          approvalReasoningDisplay.textContent = data.proposal.reasoning;
          approvalReasoningDisplay.style.display = "block";
        }
        if (approvalReasoningWrap) approvalReasoningWrap.style.display = "block";
      } else {
        if (approvalReasoningDisplay) approvalReasoningDisplay.style.display = "none";
        if (approvalReasoningWrap) approvalReasoningWrap.style.display = "none";
      }

      // Show governance chain & action container
      if (governanceChain) governanceChain.style.display = "flex";
      if (approvalActionsContainer) approvalActionsContainer.style.display = "flex";
      btnReviewProposal.disabled = false;

      approvalCard.classList.remove("is-approved", "is-rejected");
      approvalStatusDisplay.className = "approval-status";

      if (data.proposal.status === "approved") {
        approvalCard.classList.add("is-approved");
        approvalStatusDisplay.classList.add("approved");
        approvalStatusText.textContent = "APPROVED BY HUMAN — FRESHSERVICE WRITE EXECUTED";

        if (govStepProposed) govStepProposed.className = "gov-step active-proposed";
        if (govStepDecision) {
          govStepDecision.className = "gov-step active-approved";
          govStepDecision.innerHTML = "APPROVED <small>(HUMAN)</small>";
        }
        if (govArrow2) govArrow2.style.display = "inline";
        if (govStepExecuted) {
          govStepExecuted.style.display = "inline-flex";
          govStepExecuted.className = "gov-step active-executed";
          govStepExecuted.innerHTML = "EXECUTED <small>(SYSTEM)</small>";
        }

        if (approvalOutcomeList) {
          approvalOutcomeList.style.display = "block";
          approvalOutcomeList.innerHTML = `
            <div class="outcome-item check">✓ Approved by human</div>
            <div class="outcome-item check">✓ Update authorized</div>
            <div class="outcome-item check">✓ Freshservice update executed (Priority → ${targetPriority})</div>
          `;
        }

        btnApproveProposal.disabled = true;
        btnRejectProposal.disabled = true;
        btnApproveProposal.textContent = "APPROVED ✓";
        btnRejectProposal.textContent = "REJECT";

        tagPriority.textContent = `PRIORITY · ${targetPriority}`;
        tagPriority.className = "tag priority-medium";
      } else if (data.proposal.status === "rejected") {
        approvalCard.classList.add("is-rejected");
        approvalStatusDisplay.classList.add("rejected");
        approvalStatusText.textContent = "REJECTED BY HUMAN — WRITE NOT EXECUTED";

        if (govStepProposed) govStepProposed.className = "gov-step active-proposed";
        if (govStepDecision) {
          govStepDecision.className = "gov-step active-rejected";
          govStepDecision.innerHTML = "REJECTED <small>(HUMAN)</small>";
        }
        if (govArrow2) govArrow2.style.display = "none";
        if (govStepExecuted) govStepExecuted.style.display = "none";

        if (approvalOutcomeList) {
          approvalOutcomeList.style.display = "block";
          approvalOutcomeList.innerHTML = `
            <div class="outcome-item cross">✕ Proposal rejected</div>
            <div class="outcome-item note">No Freshservice write was executed.</div>
          `;
        }

        btnApproveProposal.disabled = true;
        btnRejectProposal.disabled = true;
        btnApproveProposal.textContent = "APPROVE";
        btnRejectProposal.textContent = "REJECTED ✕";
      } else {
        // Pending status
        approvalStatusText.textContent = "● PROPOSED — WAITING FOR HUMAN APPROVAL";

        if (govStepProposed) govStepProposed.className = "gov-step active-proposed";
        if (govStepDecision) {
          govStepDecision.className = "gov-step";
          govStepDecision.innerHTML = "APPROVAL <small>(HUMAN)</small>";
        }
        if (govArrow2) govArrow2.style.display = "inline";
        if (govStepExecuted) {
          govStepExecuted.style.display = "inline-flex";
          govStepExecuted.className = "gov-step";
          govStepExecuted.innerHTML = "EXECUTE <small>(SYSTEM)</small>";
        }

        if (approvalOutcomeList) {
          approvalOutcomeList.innerHTML = "";
          approvalOutcomeList.style.display = "none";
        }

        btnApproveProposal.disabled = false;
        btnRejectProposal.disabled = false;
        btnApproveProposal.textContent = "APPROVE";
        btnRejectProposal.textContent = "REJECT";
      }
    } else {
      renderInitialApprovalCard(ticket);
      approvalStatusText.textContent = "NO WRITE PROPOSED — Human approval not required";
      if (approvalActionsContainer) approvalActionsContainer.style.display = "none";
    }
  }

  /**
   * Render real trace steps returned by Phase 2 backend
   */
  function renderRealTrace(steps) {
    traceListContainer.innerHTML = "";

    steps.forEach((step, idx) => {
      const el = document.createElement("div");
      el.className = `trace-item ${step.status === "pending" ? "pending" : ""}`;

      let detailsHtml = "";
      if (step.result || step.input) {
        const jsonStr = JSON.stringify(step.result || step.input, null, 2);
        detailsHtml = `
          <button class="trace-details-toggle" data-idx="${idx}">[view details]</button>
          <pre class="trace-raw-details" id="details-${idx}">${escapeHtml(jsonStr)}</pre>
        `;
      }

      const rawTag = (step.tag || "STEP").toUpperCase();
      const tagSlug = rawTag.toLowerCase().replace(/[^a-z0-9]/g, "-");

      el.innerHTML = `
        <div class="trace-dot"></div>
        <div class="trace-body">
          <div>
            <span class="t-title">${escapeHtml(step.title || step.type)}</span>
            <span class="t-tag tag-${tagSlug}">${escapeHtml(rawTag)}</span>
          </div>
          ${step.summary ? `<div class="t-sub">${escapeHtml(step.summary)}</div>` : ""}
          ${step.detail ? `<div class="t-sub">${escapeHtml(step.detail)}</div>` : ""}
          ${detailsHtml}
        </div>
      `;

      traceListContainer.appendChild(el);
    });

    // Attach toggle listeners for details
    traceListContainer.querySelectorAll(".trace-details-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = btn.getAttribute("data-idx");
        const detailsEl = document.getElementById(`details-${idx}`);
        if (detailsEl) {
          detailsEl.classList.toggle("open");
          btn.textContent = detailsEl.classList.contains("open") ? "[hide details]" : "[view details]";
        }
      });
    });
  }

  function escapeHtml(str) {
    if (typeof str !== "string") str = JSON.stringify(str);
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /**
   * Trigger Real Investigation via POST /api/investigate
   */
  async function handleInvestigate() {
    const ticket = MOCK_TICKETS[currentTicketIndex];

    // Set loading UI state
    btnInvestigate.classList.add("loading");
    btnInvestigate.disabled = true;
    btnInvestigate.innerHTML = `INVESTIGATING... <span class="arrow">⏳</span>`;

    if (profBadgeDisplay) {
      profBadgeDisplay.textContent = "Evaluating agent proficiency...";
      profBadgeDisplay.className = "prof-badge unavailable";
    }

    traceListContainer.innerHTML = `
      <div class="trace-item pending">
        <div class="trace-dot"></div>
        <div class="trace-body">
          <span class="t-title">INVESTIGATION RUNNING</span>
          <span class="t-tag">ACTIVE</span>
          <div class="t-sub">Running Claude tool-use loop via Freshservice MCP for Ticket #${ticket.id}...</div>
        </div>
      </div>
    `;

    try {
      console.log(`[Frontend] Sending investigation request for Ticket #${ticket.id}...`);

      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }

      console.log("[Frontend] Investigation succeeded:", data);

      // Cache and render real results
      investigationCache[ticket.id] = data;
      applyInvestigationData(data, ticket);

      showToast(`Real investigation complete for Ticket #${ticket.id}!`, "⚡");
    } catch (err) {
      console.error("[Frontend] Investigation failed:", err);

      if (profBadgeDisplay) {
        profBadgeDisplay.textContent = "Proficiency evaluation failed";
        profBadgeDisplay.className = "prof-badge unavailable";
      }

      traceListContainer.innerHTML = `
        <div class="trace-item">
          <div class="trace-dot" style="background:var(--coral); box-shadow:0 0 8px var(--coral);"></div>
          <div class="trace-body">
            <span class="t-title" style="color:var(--coral);">INVESTIGATION FAILED</span>
            <span class="t-tag" style="border-color:var(--coral); color:var(--coral);">ERROR</span>
            <div class="t-sub">Unable to complete investigation: ${escapeHtml(err.message)}</div>
            <button class="btn btn-sm btn-ghost" id="btnRetryInvestigate" style="margin-top:10px;">TRY AGAIN</button>
          </div>
        </div>
      `;

      const btnRetry = document.getElementById("btnRetryInvestigate");
      if (btnRetry) {
        btnRetry.addEventListener("click", handleInvestigate);
      }

      showToast(`Investigation failed: ${err.message}`, "❌");
    } finally {
      btnInvestigate.classList.remove("loading");
      btnInvestigate.disabled = false;
      btnInvestigate.innerHTML = `INVESTIGATE TICKET <span class="arrow">→</span>`;
    }
  }

  /**
   * Real Approval via POST /approve/:actionId
   */
  async function handleApprove() {
    if (isProcessingAction) return;
    if (!currentProposal || !currentProposal.proposalId) {
      showToast("No active proposal to approve", "⚠️");
      return;
    }
    if (currentProposal.status !== "pending") {
      showToast(`Proposal is already ${currentProposal.status}.`, "⚠️");
      return;
    }

    isProcessingAction = true;
    btnApproveProposal.disabled = true;
    btnRejectProposal.disabled = true;
    if (modalApproveBtn) modalApproveBtn.disabled = true;
    if (modalRejectBtn) modalRejectBtn.disabled = true;
    btnApproveProposal.textContent = "AUTHORIZING...";

    approvalStatusDisplay.className = "approval-status";
    approvalStatusText.textContent = "Authorizing update & executing Freshservice write...";

    const proposalId = currentProposal.proposalId;

    try {
      console.log(`[Frontend] Calling POST /approve/${proposalId}...`);

      const res = await fetch(`/approve/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      console.log("[Frontend] Approval executed successfully:", data);

      // Update proposal state
      currentProposal.status = "approved";
      if (investigationCache[currentProposal.ticketId]?.proposal) {
        investigationCache[currentProposal.ticketId].proposal.status = "approved";
      }

      approvalCard.classList.remove("is-rejected");
      approvalCard.classList.add("is-approved");
      approvalStatusDisplay.className = "approval-status approved";
      approvalStatusText.textContent = "APPROVED BY HUMAN — FRESHSERVICE WRITE EXECUTED";

      // Governance chain transition: PROPOSED -> APPROVED -> EXECUTED
      if (governanceChain) governanceChain.style.display = "flex";
      if (govStepProposed) govStepProposed.className = "gov-step active-proposed";
      if (govStepDecision) {
        govStepDecision.className = "gov-step active-approved";
        govStepDecision.innerHTML = "APPROVED <small>(HUMAN)</small>";
      }
      if (govArrow2) govArrow2.style.display = "inline";
      if (govStepExecuted) {
        govStepExecuted.style.display = "inline-flex";
        govStepExecuted.className = "gov-step active-executed";
        govStepExecuted.innerHTML = "EXECUTED <small>(SYSTEM)</small>";
      }

      const newPriority = currentProposal.updates?.priority === 2 ? "Medium" : (currentProposal.updates?.priority || "Updated");
      if (approvalOutcomeList) {
        approvalOutcomeList.style.display = "block";
        approvalOutcomeList.innerHTML = `
          <div class="outcome-item check">✓ Approved by human</div>
          <div class="outcome-item check">✓ Update authorized</div>
          <div class="outcome-item check">✓ Freshservice update executed (Priority → ${newPriority})</div>
        `;
      }

      btnApproveProposal.disabled = true;
      btnRejectProposal.disabled = true;
      btnApproveProposal.textContent = "APPROVED ✓";
      btnRejectProposal.textContent = "REJECT";

      tagPriority.textContent = `PRIORITY · ${newPriority.toUpperCase()}`;
      tagPriority.className = "tag priority-medium";

      closeProposalModal();
      showToast(`[GOVERNANCE] Real Freshservice update executed: Ticket #${currentProposal.ticketId} priority set to ${newPriority}!`, "✅");
    } catch (err) {
      console.error("[Frontend] Approval execution failed:", err);
      approvalStatusDisplay.className = "approval-status rejected";
      approvalStatusText.textContent = `Approval failed: ${err.message}. No ticket update was executed.`;
      showToast(`Approval failed: ${err.message}. No ticket update was executed.`, "❌");

      if (err.message && err.message.toLowerCase().includes("not pending")) {
        btnApproveProposal.disabled = true;
        btnRejectProposal.disabled = true;
      } else {
        btnApproveProposal.disabled = false;
        btnRejectProposal.disabled = false;
        btnApproveProposal.textContent = "APPROVE";
      }
    } finally {
      isProcessingAction = false;
      if (modalApproveBtn) modalApproveBtn.disabled = btnApproveProposal.disabled;
      if (modalRejectBtn) modalRejectBtn.disabled = btnRejectProposal.disabled;
    }
  }

  /**
   * Real Rejection via POST /reject/:actionId
   */
  async function handleReject() {
    if (isProcessingAction) return;
    if (!currentProposal || !currentProposal.proposalId) {
      showToast("No active proposal to reject", "⚠️");
      return;
    }
    if (currentProposal.status !== "pending") {
      showToast(`Proposal is already ${currentProposal.status}.`, "⚠️");
      return;
    }

    isProcessingAction = true;
    btnApproveProposal.disabled = true;
    btnRejectProposal.disabled = true;
    if (modalApproveBtn) modalApproveBtn.disabled = true;
    if (modalRejectBtn) modalRejectBtn.disabled = true;
    btnRejectProposal.textContent = "REJECTING...";

    approvalStatusDisplay.className = "approval-status";
    approvalStatusText.textContent = "Rejecting proposal...";

    const proposalId = currentProposal.proposalId;

    try {
      console.log(`[Frontend] Calling POST /reject/${proposalId}...`);

      const res = await fetch(`/reject/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      console.log("[Frontend] Proposal rejected:", data);

      // Update proposal state
      currentProposal.status = "rejected";
      if (investigationCache[currentProposal.ticketId]?.proposal) {
        investigationCache[currentProposal.ticketId].proposal.status = "rejected";
      }

      approvalCard.classList.remove("is-approved");
      approvalCard.classList.add("is-rejected");
      approvalStatusDisplay.className = "approval-status rejected";
      approvalStatusText.textContent = "REJECTED BY HUMAN — WRITE NOT EXECUTED";

      // Governance chain transition: PROPOSED -> REJECTED (SYSTEM EXECUTED omitted)
      if (governanceChain) governanceChain.style.display = "flex";
      if (govStepProposed) govStepProposed.className = "gov-step active-proposed";
      if (govStepDecision) {
        govStepDecision.className = "gov-step active-rejected";
        govStepDecision.innerHTML = "REJECTED <small>(HUMAN)</small>";
      }
      if (govArrow2) govArrow2.style.display = "none";
      if (govStepExecuted) govStepExecuted.style.display = "none";

      if (approvalOutcomeList) {
        approvalOutcomeList.style.display = "block";
        approvalOutcomeList.innerHTML = `
          <div class="outcome-item cross">✕ Proposal rejected</div>
          <div class="outcome-item note">No Freshservice write was executed.</div>
        `;
      }

      btnApproveProposal.disabled = true;
      btnRejectProposal.disabled = true;
      btnApproveProposal.textContent = "APPROVE";
      btnRejectProposal.textContent = "REJECTED ✕";

      closeProposalModal();
      showToast(`[GOVERNANCE] Proposal rejected: Freshservice was NOT modified.`, "🚫");
    } catch (err) {
      console.error("[Frontend] Rejection failed:", err);
      approvalStatusDisplay.className = "approval-status rejected";
      approvalStatusText.textContent = `Rejection failed: ${err.message}.`;
      showToast(`Failed to reject: ${err.message}`, "❌");

      if (err.message && err.message.toLowerCase().includes("not pending")) {
        btnApproveProposal.disabled = true;
        btnRejectProposal.disabled = true;
      } else {
        btnApproveProposal.disabled = false;
        btnRejectProposal.disabled = false;
        btnRejectProposal.textContent = "REJECT";
      }
    } finally {
      isProcessingAction = false;
      if (modalApproveBtn) modalApproveBtn.disabled = btnApproveProposal.disabled;
      if (modalRejectBtn) modalRejectBtn.disabled = btnRejectProposal.disabled;
    }
  }

  /**
   * Open Proposal Review Modal
   */
  function openProposalModal() {
    if (!currentProposal) {
      showToast("Run investigation first to generate a proposal.", "⚠️");
      return;
    }

    modalProposalTitle.textContent = `Proposal Review — Ticket #${currentProposal.ticketId}`;
    modalProposalId.textContent = currentProposal.proposalId;
    modalProposalTicket.textContent = `#${currentProposal.ticketId}`;
    modalProposalAction.textContent = `Update Priority → ${currentProposal.updates?.priority === 2 ? "Medium (2)" : JSON.stringify(currentProposal.updates)}`;
    modalProposalReasoning.textContent = currentProposal.reasoning || "Claude did not provide explicit reasoning.";

    if (currentProposal.status !== "pending") {
      modalApproveBtn.style.display = "none";
      modalRejectBtn.style.display = "none";
    } else {
      modalApproveBtn.style.display = "inline-flex";
      modalRejectBtn.style.display = "inline-flex";
    }

    proposalModal.classList.add("active");
  }

  function closeProposalModal() {
    proposalModal.classList.remove("active");
  }

  /**
   * Open Skill Gap Review Modal
   */
  function openGapModal(gap) {
    modalGapTitle.textContent = `Skill Gap — ${gap.name}`;
    modalGapDescription.textContent = gap.description;
    modalGapTickets.innerHTML = "";
    gap.tickets.forEach(t => {
      const badge = document.createElement("span");
      badge.className = "tag skill";
      badge.textContent = t;
      modalGapTickets.appendChild(badge);
    });
    gapModal.classList.add("active");
  }

  function closeGapModal() {
    gapModal.classList.remove("active");
  }

  /**
   * Render Skill Gaps list
   */
  function renderSkillGaps() {
    skillGapsList.innerHTML = "";
    MOCK_SKILL_GAPS.forEach(gap => {
      const row = document.createElement("div");
      row.className = "gap-row";
      row.innerHTML = `
        <div class="gap-name">${gap.name}</div>
        <div class="gap-count"><b>${gap.count}</b> untagged tickets</div>
        <div>
          <div class="gap-conf-bar"><span style="width:${gap.confidence}%"></span></div>
          <div class="gap-conf-label">CONFIDENCE ${gap.confidence}%</div>
        </div>
        <button class="btn-review-gap" data-gap-id="${gap.id}">REVIEW</button>
      `;

      row.querySelector(".btn-review-gap").addEventListener("click", () => {
        openGapModal(gap);
      });

      skillGapsList.appendChild(row);
    });
  }

  // Event Listeners
  btnInvestigate.addEventListener("click", handleInvestigate);

  btnApproveProposal.addEventListener("click", handleApprove);
  btnRejectProposal.addEventListener("click", handleReject);
  modalApproveBtn.addEventListener("click", handleApprove);
  modalRejectBtn.addEventListener("click", handleReject);

  btnReviewProposal.addEventListener("click", openProposalModal);
  btnReviewRec.addEventListener("click", openProposalModal);

  modalProposalClose.addEventListener("click", closeProposalModal);
  modalCloseBtn.addEventListener("click", closeProposalModal);

  modalGapClose.addEventListener("click", closeGapModal);
  modalGapCloseBtn.addEventListener("click", closeGapModal);
  modalGapApplyBtn.addEventListener("click", () => {
    closeGapModal();
    showToast("Automated Skill Runbook applied to untagged tickets", "🎯");
  });

  // Close modals on overlay click or Escape key
  [proposalModal, gapModal].forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeProposalModal();
      closeGapModal();
    }
  });

  // Micro-interactions for all clickable elements
  document.querySelectorAll(".btn, .picker-btn, .btn-review-gap").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.style.transform = "scale(0.97)";
      setTimeout(() => btn.style.transform = "", 140);
    });
  });

  // Initial Render
  renderTicketPicker();
  renderSkillGaps();
  selectTicket(0);

  // Set Metrics
  metricTicketsAnalyzed.textContent = MOCK_METRICS.ticketsAnalyzed;
  metricInvestigations.textContent = MOCK_METRICS.aiInvestigations;
  metricPendingApprovals.textContent = MOCK_METRICS.pendingApprovals;
  metricSkillGaps.textContent = MOCK_METRICS.skillGaps;
});
