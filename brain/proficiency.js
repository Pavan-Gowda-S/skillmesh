/**
 * Demo Agent Proficiency Data Layer
 * 
 * Provides hardcoded agent proficiency records for demo purposes.
 */

const DEMO_PROFICIENCY_DATA = {
  "Priya Sharma": {
    Network: {
      proficiency: 90,
      history: {
        resolved: 8,
        escalated: 0
      }
    }
  },
  "Rahul Mehta": {
    Network: {
      proficiency: 35,
      history: {
        resolved: 1,
        escalated: 1
      }
    }
  }
};

const DEFAULT_RECORD = {
  proficiency: 50,
  history: {
    resolved: 0,
    escalated: 0
  }
};

/**
 * Retrieve an agent's proficiency record for a specific skill (Phase 3C).
 *
 * @param {string} agentName - Name of the agent (e.g. "Priya Sharma", "Rahul Mehta")
 * @param {string} skill - Technical skill category (e.g. "Network")
 * @returns {{ agent: string, skill: string, proficiency: number, history: { resolved: number, escalated: number }, source: "demo_hardcoded" }}
 */
function getAgentProficiency(agentName, skill) {
  const agentRecords = DEMO_PROFICIENCY_DATA[agentName];
  const skillRecord = agentRecords?.[skill] || DEFAULT_RECORD;

  return {
    agent: agentName,
    skill,
    proficiency: skillRecord.proficiency,
    history: {
      resolved: skillRecord.history.resolved,
      escalated: skillRecord.history.escalated
    },
    source: "demo_hardcoded"
  };
}

/**
 * Turn an agent's resolution history into a proficiency score and label (Phase 3D).
 * Consumes the Phase 3C getAgentProficiency data layer.
 *
 * @param {string} agentName - Name of the agent
 * @param {string} skill - Technical skill category
 * @returns {{ agent: string, skill: string, proficiency: number, level: string }}
 */
function getProficiency(agentName, skill) {
  const record = getAgentProficiency(agentName, skill);
  const resolved = record.history?.resolved ?? 0;
  const escalated = record.history?.escalated ?? 0;

  let proficiency;
  let level;

  if (resolved >= 5 && escalated === 0) {
    proficiency = 90;
    level = "Expert";
  } else if (resolved >= 3 && escalated <= 1) {
    proficiency = 70;
    level = "Intermediate";
  } else {
    proficiency = 35;
    level = "Beginner";
  }

  return {
    agent: agentName,
    skill,
    proficiency,
    level
  };
}

module.exports = {
  getAgentProficiency,
  getProficiency,
  DEMO_PROFICIENCY_DATA
};
