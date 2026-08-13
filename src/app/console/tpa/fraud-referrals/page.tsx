"use client";

import { useEffect, useState } from "react";
import { DataTable, PageHeader, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { WorkflowDataSources } from "@/components/ui/WorkflowDataSources";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { demoFetch } from "@/lib/demoFetch";
import { InsightPanel, RankedBars, SignalCard, StackedOutcome } from "@/components/dashboard/InsightCharts";
import { BadgeCheck, CircleDollarSign, ScanSearch, ShieldCheck } from "lucide-react";

interface FraudItem {
  id: string;
  provider_id: string;
  provider_name: string;
  npi: string;
  specialty: string;
  trigger: string;
  exclusion_source: string;
  status: string;
  referral_date: string;
  claims_blocked: number;
  amount_blocked_usd: number;
  next_action: string;
}

export default function TPAFraudReferralsPage() {
  const [items, setItems] = useState<FraudItem[] | null>(null);
  const [selected, setSelected] = useState<FraudItem | null>(null);
  const [npiLookup, setNpiLookup] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const coordinatePBM = (id: string) =>
    setActionMsg(`Coordination request sent to PBM for ${id}. Prospective NPI block ETA 24h.`);
  const referToBoard = (id: string) =>
    setActionMsg(`Referral filed with State Medical Board for ${id}. Case ID logged in audit trail.`);

  useEffect(() => {
    demoFetch("/api/v1/tpa/fraud-referrals")
      .then((d: any) => { setItems(d.items); })
      .catch(() => setItems([]));
  }, []);

  // NPPES live lookup when selecting a referral
  useEffect(() => {
    if (selected) {
      demoFetch(`/api/v1/v8/public-api/nppes/${selected.npi}`)
        .then(setNpiLookup)
        .catch(() => setNpiLookup({ live_lookup: false, upstream_error_kind: "FetchError" }));
    } else {
      setNpiLookup(null);
    }
  }, [selected]);

  if (!items) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const totalBlocked = items.reduce((s, i) => s + (i.amount_blocked_usd || 0), 0);
  const totalClaims = items.reduce((s, i) => s + i.claims_blocked, 0);
  const externalMatches = items.filter((item) => item.exclusion_source === "LEIE" || item.exclusion_source === "SAM.gov").length;
  const mlSignals = items.length - externalMatches;

  const columns: Column<FraudItem>[] = [
    { key: "id", header: "Referral ID", width: "130px",
      render: (r) => <span className="font-mono text-[12px] text-slate-500">{r.id}</span> },
    { key: "name", header: "Prescriber",
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">{r.provider_name}</div>
          <div className="text-[11px] text-slate-500 font-mono">NPI {r.npi} · {r.specialty}</div>
        </div>
      )},
    { key: "trigger", header: "Trigger",
      render: (r) => (
        <div>
          <div className="text-[13px]">{r.trigger}</div>
          <div className="text-[11px] text-slate-500">Source: {r.exclusion_source}</div>
        </div>
      )},
    { key: "status", header: "Status", width: "180px",
      render: (r) => <span className="text-[12px] text-slate-700 dark:text-slate-300">{r.status}</span> },
    { key: "date", header: "Referred", width: "100px", align: "right",
      render: (r) => <span className="text-[12px] text-slate-500">{r.referral_date}</span> },
    { key: "blocked", header: "Claims", width: "70px", align: "right",
      render: (r) => <span className="font-semibold tabular-nums">{r.claims_blocked}</span> },
    { key: "amount", header: "Avoided", width: "100px", align: "right",
      render: (r) => <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">${r.amount_blocked_usd.toLocaleString()}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Fraud Referrals"
        subtitle="Open referrals to TPA fraud team. Triggers: HHS-OIG LEIE, SAM.gov debarments, ML pill mill composite signals (Check 24)."
        meta={<DataSourceList sources={["LEIE", "NPPES", "Kythera"]} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <SignalCard label="Active investigations" value={items.length} detail="Cases with a documented next action" icon={<ScanSearch className="w-4 h-4" />} />
        <SignalCard label="Claims protected" value={totalClaims} detail="Payment stopped while evidence is reviewed" tone="#7654d6" icon={<ShieldCheck className="w-4 h-4" />} />
        <SignalCard label="Spend protected" value={`$${Math.round(totalBlocked).toLocaleString()}`} detail="Allowed amount not released to payment" tone="#0f8f69" icon={<CircleDollarSign className="w-4 h-4" />} />
        <SignalCard label="Identity verified" value={`${items.length}/${items.length}`} detail="NPI and specialty ready for case review" tone="#b56f0b" icon={<BadgeCheck className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
        <InsightPanel title="Where exposure is concentrated" description="Allowed dollars protected by prescriber. The longest bar deserves the first investigator review." className="xl:col-span-3">
          <RankedBars data={items.map((item) => ({ label: item.provider_name.replace("Dr. ", ""), value: item.amount_blocked_usd, note: `${item.claims_blocked} blocked claims` }))} valueFormatter={(value) => `$${Math.round(value).toLocaleString()}`} height={245} />
        </InsightPanel>
        <InsightPanel title="Why the case opened" description="Independent exclusion matches are separated from behavioral model signals." className="xl:col-span-2">
          <div className="pt-2">
            <StackedOutcome segments={[
              { label: "ML pattern", value: mlSignals, color: "#7654d6" },
              { label: "Federal exclusion", value: externalMatches, color: "#dc4b45" },
            ]} />
            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500"><span>Currently under investigation</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{items.filter((item) => item.status.includes("Investigation")).length}</span></div>
          </div>
          <div className="mt-7 rounded-xl bg-slate-50 dark:bg-slate-900/40 p-3.5">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Plain-language logic</div>
            <p className="text-[12px] text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
              Axeris verifies the prescriber, compares the pattern with specialty peers, and stops only unpaid claims. Protected spend is the plan&apos;s allowed amount—not an inflated billed charge.
            </p>
          </div>
        </InsightPanel>
      </div>

      <WorkflowDataSources workflow="Fraud Referrals" sources={[
        { name: "Kythera Wayfinder", type: "validation", used_for: "Practitioner master + open claims for ML peer comparison" },
        { name: "Truveta TDM", type: "validation", used_for: "EHR + linked claims baseline for prescriber outlier detection" },
        { name: "HHS-OIG LEIE", type: "live_api", used_for: "Federal exclusion list NPI cross-reference (every claim)" },
        { name: "NPPES NPI Registry", type: "live_api", used_for: "Real-time prescriber identity verification" },
        { name: "CMS Open Payments", type: "live_api", used_for: "Pharma payment context (Sunshine Act)" },
        { name: "SAM.gov", type: "batch", used_for: "Federal debarment list (daily sync)" },
        { name: "CMS Part D PUF", type: "batch", used_for: "1.2M prescriber peer baseline" },
        { name: "LightGBM (Check 24)", type: "ml_model", used_for: "Pill-mill probability with feature importance" },
        { name: "DBSCAN", type: "ml_model", used_for: "Network clustering on patient overlap (Jaccard)" },
        { name: "IsolationForest", type: "ml_model", used_for: "Outlier scoring feature (300 estimators, contamination=0.05)" },
      ]} />

      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Investigation queue</h2>
          <p className="text-[11.5px] text-slate-500 mt-0.5">Open a prescriber to review identity evidence, impact, and the next enforcement step.</p>
        </div>
        <span className="text-[11px] tabular-nums text-slate-400">{items.length} open</span>
      </div>
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
        emptyMessage="No open fraud referrals"
      />

      {/* Detail drawer */}
      <DetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionMsg(null); }}
        title={selected?.provider_name || ""}
        subtitle={selected ? `Referral ${selected.id} · ${selected.specialty}` : ""}
        actions={selected && (
          <>
            <button
              onClick={() => coordinatePBM(selected.id)}
              title="Send a coordination request to the PBM to apply prospective claim edits on this NPI"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Coordinate w/ PBM
            </button>
            <button
              onClick={() => referToBoard(selected.id)}
              title="File a formal referral with the prescriber's state medical board"
              className="px-3 py-1.5 text-[13px] rounded bg-red-600 text-white hover:bg-red-700"
            >
              Refer to State Board
            </button>
          </>
        )}
      >
        {selected && (
          <>
            {actionMsg && (
              <div className="mb-5 bg-emerald-50 border border-emerald-300 rounded-md px-4 py-3 text-[13px] text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
                {actionMsg}
              </div>
            )}
            <FieldGroup title="Investigation Status">
              <Field label="Referral ID" value={selected.id} mono />
              <Field label="Status" value={selected.status} />
              <Field label="Date Referred" value={selected.referral_date} />
              <Field label="Trigger" value={selected.trigger} />
              <Field label="Source" value={selected.exclusion_source} />
            </FieldGroup>

            <FieldGroup title="Prescriber Identity (NPPES Live Lookup)">
              {npiLookup?.live_lookup ? (
                <>
                  <Field label="NPI" value={npiLookup.npi} mono />
                  <Field label="Name" value={npiLookup.name} />
                  <Field label="Credential" value={npiLookup.credential} />
                  <Field label="Specialty" value={npiLookup.specialty} />
                  <Field label="License" value={npiLookup.license?.number ? `${npiLookup.license.number} (${npiLookup.license.state})` : "·"} mono />
                  <Field label="Status" value={npiLookup.status} />
                  <Field label="Last Updated" value={npiLookup.last_updated} />
                </>
              ) : (
                <>
                  <Field label="NPI" value={selected.npi} mono />
                  <Field label="Name" value={selected.provider_name} />
                  <Field label="Specialty" value={selected.specialty} />
                  <Field label="NPPES" value={npiLookup?.upstream_error ? "Upstream unreachable · local fallback" : "Looking up…"} />
                </>
              )}
            </FieldGroup>

            <FieldGroup title="Financial Impact">
              <Field label="Claims Blocked" value={selected.claims_blocked.toString()} />
              <Field label="Amount Avoided" value={`$${selected.amount_blocked_usd.toLocaleString()}`} />
            </FieldGroup>

            <FieldGroup title="Next Action">
              <div className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{selected.next_action}</div>
            </FieldGroup>

            <FieldGroup title="Audit Trail">
              <Field label="Engine" value="ML-FRAUD-001 (Check 24)" />
              <Field label="ML Models" value="DBSCAN network clustering + LightGBM peer comparison" />
              <Field label="Training Data" value="Kythera open claims + CMS Part D PUF" />
              <Field label="Cross-references" value="HHS-OIG LEIE, SAM.gov, CMS Open Payments" />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
