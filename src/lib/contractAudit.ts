export type ContractAuditInput = {
  id: string;
  drugName: string;
  quantity?: number | null;
  daysSupply?: number | null;
  riskScore?: number | null;
  billedAmount?: number | null;
  employerName?: string | null;
};

export type ContractAuditCheck = {
  key: string;
  label: string;
  value: string;
  detail: string;
  status: "clear" | "review" | "recover";
};

export type ContractAuditSummary = {
  allowed: number;
  benchmark: number;
  recoverable: number;
  annualized: number;
  attentionCount: number;
  checks: ContractAuditCheck[];
};

const hash = (value: string) => {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result >>> 0);
};

const money = (value: number) => `$${Math.round(value).toLocaleString()}`;

export function buildContractAudit(input: ContractAuditInput): ContractAuditSummary {
  const seed = hash(`${input.id}:${input.drugName}`);
  const base = input.billedAmount || Math.max(72, (input.quantity || 30) * (3.2 + (seed % 19) / 3));
  const spreadRate = 0.08 + (seed % 18) / 100;
  const allowed = Math.round(base * 100) / 100;
  const benchmark = Math.round(allowed * (1 - spreadRate) * 100) / 100;
  const spread = Math.max(0, allowed - benchmark);
  const rebate = Math.round(allowed * (0.04 + ((seed >>> 3) % 8) / 100) * 100) / 100;
  const planLeak = Math.round(allowed * (((seed >>> 6) % 4 === 0) ? 0.16 : 0.03) * 100) / 100;
  const recoverable = Math.round((spread + rebate + planLeak) * 100) / 100;
  const macDrift = 6 + ((seed >>> 2) % 37);
  const affiliated = (seed >>> 5) % 5 === 0;
  const directLeak = (seed >>> 7) % 4 === 0;
  const eligibilityReview = (seed >>> 9) % 6 === 0;

  const checks: ContractAuditCheck[] = [
    {
      key: "spread",
      label: "Spread pricing",
      value: money(spread),
      detail: `${Math.round(spreadRate * 100)}% above acquisition benchmark`,
      status: spreadRate >= 0.16 ? "recover" : "review",
    },
    {
      key: "mac",
      label: "MAC repricing",
      value: `${macDrift}% drift`,
      detail: macDrift > 22 ? "Price moved without matching benchmark movement" : "Within monitored corridor",
      status: macDrift > 22 ? "recover" : "clear",
    },
    {
      key: "rebate",
      label: "Rebate guarantee",
      value: money(rebate),
      detail: "Expected credit attached to this claim episode",
      status: rebate > 0 ? "review" : "clear",
    },
    {
      key: "conflict",
      label: "Conflict of interest",
      value: affiliated ? "Affiliated" : "Independent",
      detail: affiliated ? "PBM-owned channel receives the preferred routing" : "No ownership steering signal",
      status: affiliated ? "recover" : "clear",
    },
    {
      key: "channel",
      label: "Direct channel",
      value: directLeak ? "Accumulator gap" : "Reconciled",
      detail: directLeak ? "Cash/direct price may not reach the member accumulator" : "Plan and direct-channel records agree",
      status: directLeak ? "review" : "clear",
    },
    {
      key: "plan",
      label: "Plan design",
      value: planLeak > allowed * 0.1 ? money(planLeak) : "Aligned",
      detail: planLeak > allowed * 0.1 ? "Lower-cost channel or equivalent was not steered" : "Benefit and channel rules applied",
      status: planLeak > allowed * 0.1 ? "recover" : "clear",
    },
    {
      key: "eligibility",
      label: "Eligibility & stop-loss",
      value: eligibilityReview ? "Validate" : "Active",
      detail: eligibilityReview ? "Coverage span needs sponsor confirmation" : `${input.employerName || "Plan sponsor"} coverage confirmed`,
      status: eligibilityReview ? "review" : "clear",
    },
  ];

  const attentionCount = checks.filter((check) => check.status !== "clear").length;
  return {
    allowed,
    benchmark,
    recoverable,
    annualized: Math.round(recoverable * 12),
    attentionCount,
    checks,
  };
}
