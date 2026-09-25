/**
 * SkillMesh - Frontend Application Logic (Phase 5B)
 * Static frontend demonstration and visual mock interactions.
 * Strictly local mock state - NO real API calls.
 */

document.addEventListener("DOMContentLoaded", () => {
  let currentTicketIndex = 0;
  let mockPendingApprovalsCount = MOCK_METRICS.pendingApprovals;
  const proposalStateByTicket = {};

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
  const profNoteDisplay = document.getElementById("profNoteDisplay");
  const gradStop1 = document.getElementById("gradStop1");
  const gradStop2 = document.getElementById("gradStop2");

  // Trace Elements
  const traceListContainer = document.getElementById("traceListContainer");

  // Recommendation Elements
  const recTitleDisplay = document.getElementById("recTitleDisplay");
  const recBodyDisplay = document.getElementById("recBodyDisplay");
  const recConfidenceDisplay = document.getElementById("recConfidenceDisplay");
  const btnReviewRec = document.getElementById("btnReviewRec");

  // Approval Elements
  const approvalCard = document.getElementById("approvalCard");
  const approvalEyebrow = document.getElementById("approvalEyebrow");
  const priorityFromDisplay = document.getElementById("priorityFromDisplay");
  const priorityToDisplay = document.getElementById("priorityToDisplay");
  const proposedByDisplay = document.getElementById("proposedByDisplay");
  const approvalStatusDisplay = document.getElementById("approvalStatusDisplay");
  const approvalStatusText = document.getElementById("approvalStatusText");
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
  function showToast(message, icon = "⚡", duration = 3600) {
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
   * Switch the active mock ticket and update all dependent UI cards
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
    tagSkill.textContent = `SKILL · ${ticket.skill}`;
    ticketRequesterDisplay.textContent = ticket.requester;
    ticketDescDisplay.textContent = ticket.description;

    // Update Agent Proficiency Radial
    profSkillDisplay.textContent = ticket.agent.skill;
    profNameDisplay.textContent = ticket.agent.name;
    profNoteDisplay.innerHTML = ticket.agent.guidanceNote;
    radialPctDisplay.textContent = `${ticket.agent.proficiency}%`;
    radialLabelDisplay.textContent = ticket.agent.level;

    if (ticket.agent.level === "EXPERT") {
      radialLabelDisplay.style.color = "var(--teal)";
    } else if (ticket.agent.level === "INTERMEDIATE") {
      radialLabelDisplay.style.color = "var(--magenta)";
    } else {
      radialLabelDisplay.style.color = "var(--coral)";
    }

    if (ticket.agent.gradColors && ticket.agent.gradColors.length === 2) {
      gradStop1.setAttribute("stop-color", ticket.agent.gradColors[0]);
      gradStop2.setAttribute("stop-color", ticket.agent.gradColors[1]);
    }

    // Circumference = 2 * PI * 70 ≈ 440
    const circumference = 440;
    const offset = circumference - (circumference * ticket.agent.proficiency / 100);
    radialCircle.style.strokeDashoffset = offset;

    // Update Trace List
    renderTrace(ticket.trace);

    // Update Recommendation Card
    recTitleDisplay.textContent = ticket.recommendation.title;
    recBodyDisplay.textContent = ticket.recommendation.body;
    recConfidenceDisplay.textContent = `${ticket.recommendation.confidence}%`;

    // Update Approval Card
    updateApprovalCardState(ticket);
  }

  /**
   * Render the Investigation Trace items
   */
  function renderTrace(traceItems) {
    traceListContainer.innerHTML = "";
    traceItems.forEach(item => {
      const el = document.createElement("div");
      el.className = `trace-item ${item.status === "pending" ? "pending" : ""}`;
      el.innerHTML = `
        <div class="trace-dot"></div>
        <div class="trace-body">
          <span class="t-title">${item.title}</span>
          <span class="t-tag">${item.tag}</span>
        </div>
      `;
      traceListContainer.appendChild(el);
    });
  }

  /**
   * Update Approval Card based on mock proposal status
   */
  function updateApprovalCardState(ticket) {
    const state = proposalStateByTicket[ticket.id] || "pending";
    approvalEyebrow.textContent = `PENDING APPROVAL — TICKET #${ticket.id}`;
    priorityFromDisplay.textContent = ticket.proposal.fromPriority;
    priorityToDisplay.textContent = ticket.proposal.toPriority;
    proposedByDisplay.textContent = ticket.proposal.proposedBy;

    approvalCard.classList.remove("is-approved", "is-rejected");
    approvalStatusDisplay.className = "approval-status";
    btnApproveProposal.disabled = false;
    btnRejectProposal.disabled = false;
    btnApproveProposal.textContent = "APPROVE";
    btnRejectProposal.textContent = "REJECT";

    if (state === "approved") {
      approvalCard.classList.add("is-approved");
      approvalStatusDisplay.classList.add("approved");
      approvalStatusText.textContent = "APPROVED BY HUMAN — EXECUTION COMPLETED";
      btnApproveProposal.disabled = true;
      btnRejectProposal.disabled = true;
      btnApproveProposal.textContent = "APPROVED ✓";
      tagPriority.textContent = `PRIORITY · ${ticket.proposal.toPriority}`;
      tagPriority.className = "tag priority-medium";
    } else if (state === "rejected") {
      approvalCard.classList.add("is-rejected");
      approvalStatusDisplay.classList.add("rejected");
      approvalStatusText.textContent = "REJECTED BY HUMAN — WRITE NOT EXECUTED";
      btnApproveProposal.disabled = true;
      btnRejectProposal.disabled = true;
      btnRejectProposal.textContent = "REJECTED ✕";
    } else {
      approvalStatusText.textContent = "WAITING FOR HUMAN APPROVAL";
    }
  }

  /**
   * Render the Skill Gaps Detected list
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

  /**
   * Open Proposal Review Modal
   */
  function openProposalModal() {
    const ticket = MOCK_TICKETS[currentTicketIndex];
    modalProposalTitle.textContent = `Proposal Review — Ticket #${ticket.id}`;
    modalProposalId.textContent = ticket.proposal.id;
    modalProposalTicket.textContent = `#${ticket.id} (${ticket.title})`;
    modalProposalAction.textContent = `Update Priority: ${ticket.proposal.fromPriority} → ${ticket.proposal.toPriority}`;
    modalProposalReasoning.textContent = ticket.proposal.reasoning;

    const state = proposalStateByTicket[ticket.id] || "pending";
    if (state !== "pending") {
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
   * Action Handlers
   */
  function handleApprove() {
    const ticket = MOCK_TICKETS[currentTicketIndex];
    if (proposalStateByTicket[ticket.id] === "approved") return;

    proposalStateByTicket[ticket.id] = "approved";
    if (mockPendingApprovalsCount > 0) {
      mockPendingApprovalsCount--;
      metricPendingApprovals.textContent = mockPendingApprovalsCount;
    }

    updateApprovalCardState(ticket);
    closeProposalModal();
    showToast(`Proposal for Ticket #${ticket.id} APPROVED (Mock write authorized)`, "✅");
  }

  function handleReject() {
    const ticket = MOCK_TICKETS[currentTicketIndex];
    if (proposalStateByTicket[ticket.id] === "rejected") return;

    proposalStateByTicket[ticket.id] = "rejected";
    if (mockPendingApprovalsCount > 0) {
      mockPendingApprovalsCount--;
      metricPendingApprovals.textContent = mockPendingApprovalsCount;
    }

    updateApprovalCardState(ticket);
    closeProposalModal();
    showToast(`Proposal for Ticket #${ticket.id} REJECTED (No write executed)`, "🚫");
  }

  function handleInvestigate() {
    const ticket = MOCK_TICKETS[currentTicketIndex];
    btnInvestigate.classList.add("loading");
    btnInvestigate.innerHTML = `ANALYZING... <span class="arrow">⏳</span>`;

    // Visual simulation of trace steps
    const traceItems = traceListContainer.querySelectorAll(".trace-item");
    traceItems.forEach(item => item.style.opacity = "0.35");

    let step = 0;
    const interval = setInterval(() => {
      if (step < traceItems.length) {
        traceItems[step].style.opacity = "1";
        traceItems[step].style.transform = "translateX(4px)";
        setTimeout(() => traceItems[step].style.transform = "", 180);
        step++;
      } else {
        clearInterval(interval);
        btnInvestigate.classList.remove("loading");
        btnInvestigate.innerHTML = `INVESTIGATE TICKET <span class="arrow">→</span>`;
        showToast(`AI Investigation complete for Ticket #${ticket.id} (${ticket.agent.level} guidance)`, "🔍");
      }
    }, 180);
  }

  // Event Listeners for Buttons
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
    showToast("Automated Skill Runbook applied to untagged tickets (Mock action)", "🎯");
  });

  btnInvestigate.addEventListener("click", handleInvestigate);

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
  metricPendingApprovals.textContent = mockPendingApprovalsCount;
  metricSkillGaps.textContent = MOCK_METRICS.skillGaps;
});
