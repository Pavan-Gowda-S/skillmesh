/**
 * SkillMesh - Mock Data Layer (Phase 5B)
 * Static data for frontend demonstration only.
 * No real API or backend connections.
 */

const MOCK_TICKETS = [
  {
    id: 90,
    title: "Laptop is extremely slow after startup",
    status: "OPEN",
    priority: "LOW",
    skill: "SOFTWARE",
    requester: "Pavan Gowda S",
    description: '"My laptop takes almost 10 minutes to become usable after starting. Applications also take a long time to open. This started happening this week."',
    agent: {
      name: "Priya Sharma",
      avatar: "PS",
      role: "SUPPORT AGENT",
      skill: "SOFTWARE",
      proficiency: 35,
      level: "BEGINNER",
      guidanceNote: "GUIDANCE LEVEL: DETAILED<br>STEP-BY-STEP WALKTHROUGHS ENABLED",
      gradColors: ["#ff6b5e", "#c9679e"]
    },
    trace: [
      { title: "Ticket received", tag: "MCP", status: "completed" },
      { title: "Skill identified — Software", tag: "AI ANALYSIS", status: "completed" },
      { title: "Agent proficiency evaluated", tag: "AI ANALYSIS", status: "completed" },
      { title: "Ticket history retrieved", tag: "READ", status: "completed" },
      { title: "Requester context retrieved", tag: "READ", status: "completed" },
      { title: "Recommendation generated", tag: "PROPOSAL", status: "completed" },
      { title: "Approval required", tag: "PENDING", status: "pending" }
    ],
    recommendation: {
      title: "Raise priority to Medium",
      body: "The issue significantly impacts the user's productivity and appears related to another unresolved performance ticket (#81).",
      confidence: 86
    },
    proposal: {
      id: "proposal-179037-90",
      fromPriority: "LOW",
      toPriority: "MEDIUM",
      proposedBy: "AI Investigation Engine",
      status: "pending",
      reasoning: "Ticket #90 reports a severe startup slowdown causing daily productivity loss. Combined with open ticket #81 from the same user, this indicates an escalating endpoint issue warranting Medium priority."
    }
  },
  {
    id: 88,
    title: "VPN disconnects every few minutes",
    status: "OPEN",
    priority: "LOW",
    skill: "NETWORK",
    requester: "Pavan Gowda S",
    description: '"VPN connection drops every 5-10 minutes while working remotely. Restarted laptop and home router, but problem persists. Error code: TLS_HANDSHAKE_TIMEOUT."',
    agent: {
      name: "Priya Sharma",
      avatar: "PS",
      role: "SUPPORT AGENT",
      skill: "NETWORK",
      proficiency: 90,
      level: "EXPERT",
      guidanceNote: "GUIDANCE LEVEL: DIRECT<br>CONCISE TECHNICAL RECOMMENDATION ENABLED",
      gradColors: ["#2dd8c4", "#17a693"]
    },
    trace: [
      { title: "Ticket received", tag: "MCP", status: "completed" },
      { title: "Skill identified — Network", tag: "AI ANALYSIS", status: "completed" },
      { title: "Agent proficiency evaluated (Expert: 90%)", tag: "AI ANALYSIS", status: "completed" },
      { title: "Network gateway logs inspected", tag: "READ", status: "completed" },
      { title: "VPN concentrator health verified", tag: "READ", status: "completed" },
      { title: "Recommendation generated", tag: "PROPOSAL", status: "completed" },
      { title: "Approval required", tag: "PENDING", status: "pending" }
    ],
    recommendation: {
      title: "Reassign to Gateway Cluster & Raise to Medium",
      body: "Gateway latency logs indicate packet drop on Cluster-B. Since Priya is Expert in Network, direct tunnel reconfiguration commands are provided.",
      confidence: 94
    },
    proposal: {
      id: "proposal-179037-88",
      fromPriority: "LOW",
      toPriority: "MEDIUM",
      proposedBy: "AI Investigation Engine",
      status: "pending",
      reasoning: "Repeated TLS handshake timeouts correlate with high packet drops on Gateway B. Reconfiguring MTU and switching gateway tunnel priority will resolve dropped connections."
    }
  },
  {
    id: 87,
    title: "Unable to reset my Microsoft 365 password",
    status: "OPEN",
    priority: "LOW",
    skill: "IDENTITY & ACCESS",
    requester: "Pavan Gowda S",
    description: '"I forgot my Microsoft 365 password and the password reset option is not working. I tried using the self-service reset page twice but did not receive the verification code."',
    agent: {
      name: "Priya Sharma",
      avatar: "PS",
      role: "SUPPORT AGENT",
      skill: "IDENTITY & ACCESS",
      proficiency: 70,
      level: "INTERMEDIATE",
      guidanceNote: "GUIDANCE LEVEL: FOCUSED<br>TARGETED SSPR REMEDIATION ENABLED",
      gradColors: ["#c9679e", "#2dd8c4"]
    },
    trace: [
      { title: "Ticket received", tag: "MCP", status: "completed" },
      { title: "Skill identified — Identity & Access", tag: "AI ANALYSIS", status: "completed" },
      { title: "Agent proficiency evaluated (Intermediate: 70%)", tag: "AI ANALYSIS", status: "completed" },
      { title: "Azure AD SSPR logs queried", tag: "READ", status: "completed" },
      { title: "MFA verification methods checked", tag: "READ", status: "completed" },
      { title: "Recommendation generated", tag: "PROPOSAL", status: "completed" },
      { title: "Approval required", tag: "PENDING", status: "pending" }
    ],
    recommendation: {
      title: "Issue Temporary Access Pass (TAP)",
      body: "Self-service SSPR is blocked due to stale authentication phone number. Issuing a 1-hour TAP enables immediate user access.",
      confidence: 92
    },
    proposal: {
      id: "proposal-179037-87",
      fromPriority: "LOW",
      toPriority: "MEDIUM",
      proposedBy: "AI Investigation Engine",
      status: "pending",
      reasoning: "User is locked out of primary collaboration apps. SSPR failure requires admin TAP generation to unblock work."
    }
  },
  {
    id: 81,
    title: "Windows 11 lagging / slow performance",
    status: "OPEN",
    priority: "LOW",
    skill: "SOFTWARE",
    requester: "Pavan Gowda S",
    description: '"General system lag across Windows 11 after recent cumulative update. File Explorer and Teams freeze frequently. High CPU on Search Indexer."',
    agent: {
      name: "Priya Sharma",
      avatar: "PS",
      role: "SUPPORT AGENT",
      skill: "SOFTWARE",
      proficiency: 35,
      level: "BEGINNER",
      guidanceNote: "GUIDANCE LEVEL: DETAILED<br>STEP-BY-STEP WALKTHROUGHS ENABLED",
      gradColors: ["#ff6b5e", "#c9679e"]
    },
    trace: [
      { title: "Ticket received", tag: "MCP", status: "completed" },
      { title: "Skill identified — Software", tag: "AI ANALYSIS", status: "completed" },
      { title: "Agent proficiency evaluated", tag: "AI ANALYSIS", status: "completed" },
      { title: "Windows update history inspected", tag: "READ", status: "completed" },
      { title: "Correlated with Ticket #90", tag: "AI ANALYSIS", status: "completed" },
      { title: "Recommendation generated", tag: "PROPOSAL", status: "completed" },
      { title: "Approval required", tag: "PENDING", status: "pending" }
    ],
    recommendation: {
      title: "Link to Ticket #90 & Propose Priority Medium",
      body: "Both tickets #81 and #90 share root cause of Windows update KB5034441 indexer leak. Merge tickets for unified remediation.",
      confidence: 89
    },
    proposal: {
      id: "proposal-179037-81",
      fromPriority: "LOW",
      toPriority: "MEDIUM",
      proposedBy: "AI Investigation Engine",
      status: "pending",
      reasoning: "Correlated endpoint performance degradation impacting same user. Linking ticket to #90 avoids duplicate technician triage."
    }
  }
];

const MOCK_SKILL_GAPS = [
  {
    id: "gap-1",
    name: "Software Performance",
    count: 12,
    confidence: 91,
    description: "12 incoming incidents report startup lag or freezing without an assigned Software category or resolution runbook.",
    tickets: ["#90 (Startup Lag)", "#81 (Win 11 Freezes)", "#74 (App Crash)", "#69 (Memory Leak)"]
  },
  {
    id: "gap-2",
    name: "Network Troubleshooting",
    count: 8,
    confidence: 78,
    description: "8 tickets describe intermittent VPN disconnects or gateway timeouts without categorized routing paths.",
    tickets: ["#88 (VPN Drops)", "#78 (Gateway 504)", "#62 (DNS Flap)", "#55 (WiFi Roaming)"]
  },
  {
    id: "gap-3",
    name: "Microsoft 365 Administration",
    count: 5,
    confidence: 64,
    description: "5 tickets involve SSPR failures, license provisioning, or MFA registration blockers.",
    tickets: ["#87 (SSPR Code Missing)", "#64 (Outlook Auth)", "#58 (Teams Sync)"]
  }
];

const MOCK_METRICS = {
  ticketsAnalyzed: 128,
  aiInvestigations: 94,
  pendingApprovals: 7,
  skillGaps: 12
};
