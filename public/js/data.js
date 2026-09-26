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
    requester: "Pavan Gowda S",
    description: '"My laptop takes almost 10 minutes to become usable after starting. Applications also take a long time to open. This started happening this week."'
  },
  {
    id: 88,
    title: "VPN disconnects every few minutes",
    status: "OPEN",
    priority: "LOW",
    requester: "Pavan Gowda S",
    description: '"VPN connection drops every 5-10 minutes while working remotely. Restarted laptop and home router, but problem persists. Error code: TLS_HANDSHAKE_TIMEOUT."'
  },
  {
    id: 87,
    title: "Unable to reset my Microsoft 365 password",
    status: "OPEN",
    priority: "LOW",
    requester: "Pavan Gowda S",
    description: '"I forgot my Microsoft 365 password and the password reset option is not working. I tried using the self-service reset page twice but did not receive the verification code."'
  },
  {
    id: 81,
    title: "Windows 11 lagging / slow performance",
    status: "OPEN",
    priority: "LOW",
    requester: "Pavan Gowda S",
    description: '"General system lag across Windows 11 after recent cumulative update. File Explorer and Teams freeze frequently. High CPU on Search Indexer."'
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
