"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { InsightPanel, RankedBars, StackedOutcome } from "@/components/dashboard/InsightCharts";

type ViewKey = "vertical" | "broker" | "independence";

interface SteeringItem {
  drug_id: string;
  drug_name: string;
  brand_name: string;
  affiliated_unit_usd: number;
  independent_unit_usd: number;
  differential_pct: number;
  affiliated_units: number;
  excess_usd: number;
}

interface BrokerItem {
  employer_id: string;
  employer_name: string;
  service: string;
  pmpm_usd: number;
  annual_usd: number;
  disclosed: boolean;
  conflict: string | null;
  disclosure_requested: boolean;
}

interface Attestation {
  item: string;
  position: string;
}

const GET_URL = "/api/v1/tpa/conflict-audit";

const money = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;

export default function TPAConflictAuditPage() {
  const [data, setData] = useState<any>(null);
  const [view, setView] = useState<ViewKey>("vertical");
  const [selectedDrug, setSelectedDrug] = useState<SteeringItem | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<BrokerItem | null>(null);
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={6} /></div>;

  const vi = data.vertical_integration || {};
  const bc = data.broker_compensation || {};
  const ind = data.independence || {};

  const steering: SteeringItem[] = vi.items || [];
  const brokers: BrokerItem[] = bc.items || [];
  const attestations: Attestation[] = ind.attestations || [];

  const employerCount = new Set(brokers.map((b) => b.employer_id)).size;
  const disclosedCount = brokers.filter((b) => b.disclosed).length;
  const undisclosedCount = brokers.filter((b) => !b.disclosed).length;

  const tabs: { key: ViewKey; label: string }[] = [
    { key: "vertical", label: "Vertical Integration" },
    { key: "broker", label: "Broker Compensation" },
    { key: "independence", label: "Independence" },
  ];

  const requestDisclosure = async (b: BrokerItem) => {
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/tpa/conflict-audit/${b.employer_id}/request-broker-disclosure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employer_id: b.employer_id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((d: any) =>
        d
          ? {
              ...d,
              broker_compensation: {
                ...(d.broker_compensation || {}),
                items: ((d.broker_compensation || {}).items || []).map((x: BrokerItem) =>
                  x.employer_id === b.employer_id ? { ...x, disclosure_requested: true } : x
                ),
              },
            }
          : d
      );
      setSelectedBroker((cur) =>
        cur && cur.employer_id === b.employer_id ? { ...cur, disclosure_requested: true } : cur
      );
      setActionErr(false);
      setActionMsg(
        `Compensation disclosure demanded from the broker of record for ${b.employer_name}. CAA 2021 §202 amended ERISA §408(b)(2)(B) to require covered service providers to disclose direct, indirect, contingent, and referral compensation to the plan fiduciary.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Disclosure request could not be submitted · backend unreachable. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const steeringColumns: Column<SteeringItem>[] = [
    {
      key: "drug",
      header: "Drug",
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">{r.drug_name}</div>
          <div className="text-[12px] text-slate-500 dark:text-slate-400">{r.brand_name}</div>
        </div>
      ),
    },
    {
      key: "aff_unit",
      header: "Affiliated Unit Price",
      width: "140px",
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-slate-800 dark:text-slate-200">${r.affiliated_unit_usd.toFixed(4)}</span>
      ),
    },
    {
      key: "ind_unit",
      header: "Independent Unit Price",
      width: "150px",
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-300">${r.independent_unit_usd.toFixed(4)}</span>
      ),
    },
    {
      key: "differential",
      header: "Differential",
      width: "100px",
      align: "right",
      render: (r) => (
        <span className="tabular-nums font-bold text-red-600 dark:text-red-400">+{r.differential_pct}%</span>
      ),
    },
    {
      key: "units",
      header: "Affiliated Units",
      width: "120px",
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-300">{r.affiliated_units.toLocaleString()}</span>
      ),
    },
    {
      key: "excess",
      header: "Excess",
      width: "110px",
      align: "right",
      render: (r) => <span className="tabular-nums font-bold text-slate-900 dark:text-white">{money(r.excess_usd)}</span>,
    },
  ];

  const brokerColumns: Column<BrokerItem>[] = [
    {
      key: "employer",
      header: "Employer",
      render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{r.employer_name}</span>,
    },
    {
      key: "service",
      header: "Service",
      render: (r) => <span className="text-[13px] text-slate-800 dark:text-slate-200">{r.service}</span>,
    },
    {
      key: "pmpm",
      header: "PMPM",
      width: "90px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-300">${r.pmpm_usd.toFixed(2)}</span>,
    },
    {
      key: "annual",
      header: "Annual",
      width: "110px",
      align: "right",
      render: (r) => <span className="tabular-nums font-bold text-slate-900 dark:text-white">{money(r.annual_usd)}</span>,
    },
    {
      key: "disclosed",
      header: "Disclosed",
      width: "120px",
      render: (r) =>
        r.disclosed ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Disclosed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400">
            <XCircle className="w-3.5 h-3.5" /> Undisclosed
          </span>
        ),
    },
    {
      key: "conflict",
      header: "Conflict",
      render: (r) =>
        r.conflict ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-400">{r.conflict}</span>
        ) : (
          <span className="text-[12px] text-slate-400 dark:text-slate-500">·</span>
        ),
    },
    {
      key: "requested",
      header: "Requested",
      width: "110px",
      render: (r) =>
        r.disclosure_requested ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Requested ✓
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">·</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Conflict of Interest Audit"
        subtitle="The question underneath every other line item: who profits when the claim is paid. Vertical-integration steering, broker compensation under CAA 2021 §202, and Axeris's own independence position."
        meta={<DataSourceList sources={["NPPES", "Internal"]} />}
      />

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setView(t.key);
              setActionMsg(null);
              setActionErr(false);
            }}
            title={`Show the ${t.label} view`}
            className={clsx(
              "text-[13px] px-4 py-2 rounded-md border font-semibold transition-colors",
              view === t.key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "vertical" && (
        <>
          <div className="mb-3">
            <StatRow
              items={[
                {
                  label: "PBM-Affiliated Share",
                  value: `${vi.affiliated_share_pct ?? 0}%`,
                  sub: "of plan drug spend",
                  severity: "alert",
                },
                { label: "Affiliated Dollars", value: money(vi.affiliated_dollars_usd), sub: "Paid to PBM-owned pharmacies" },
                { label: "Independent Dollars", value: money(vi.independent_dollars_usd), sub: "Paid to unaffiliated pharmacies" },
                {
                  label: "Excess vs Independents",
                  value: money(vi.excess_usd),
                  sub: `${vi.drugs_with_differential ?? 0} drugs`,
                  severity: "alert",
                },
                {
                  label: "Dispensing HHI",
                  value: vi.dispensing_hhi ?? 0,
                  sub: vi.concentrated_market ? "Concentrated market" : "Competitive",
                  severity: vi.concentrated_market ? "alert" : undefined,
                },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
            <InsightPanel title="Price differential by drug" description="Excess allowed cost when the fill moves through a PBM-affiliated pharmacy." className="xl:col-span-3">
              <RankedBars data={steering.slice(0, 8).map((row) => ({ label: row.drug_name, value: row.excess_usd, note: `+${row.differential_pct}% vs independent` }))} valueFormatter={money} height={270} color="#dc4b45" />
            </InsightPanel>
            <InsightPanel title="Network concentration" description="A higher affiliated share means the PBM controls more of the dollars it is supposed to administer independently." className="xl:col-span-2">
              <StackedOutcome segments={[
                { label: "PBM affiliated", value: Math.round(vi.affiliated_dollars_usd || 0), color: "#dc4b45" },
                { label: "Independent", value: Math.round(vi.independent_dollars_usd || 0), color: "#0f8f69" },
                { label: "Excess", value: Math.round(vi.excess_usd || 0), color: "#c98a12" },
              ]} />
              <div className="mt-6 text-[2rem] leading-none tracking-[-0.04em] tabular-nums text-slate-900 dark:text-white">{vi.affiliated_share_pct || 0}%</div>
              <div className="text-[11px] text-slate-500 mt-2">of plan drug spend flowed through affiliated pharmacies</div>
            </InsightPanel>
          </div>

          <div className="flex items-end justify-between mb-3"><div><h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Drugs behind the differential</h2><p className="text-[11.5px] text-slate-500 mt-0.5">Open a row to compare affiliated and independent unit pricing.</p></div></div>

          <DataTable
            columns={steeringColumns}
            rows={steering}
            rowKey={(r) => r.drug_id}
            onRowClick={(r) => {
              setSelectedDrug(r);
              setActionMsg(null);
              setActionErr(false);
            }}
            emptyMessage="No drugs show an affiliated-vs-independent price differential"
          />
        </>
      )}

      {view === "broker" && (
        <>
          <div className="mb-3">
            <StatRow
              items={[
                {
                  label: "Undisclosed Annual Comp",
                  value: money(bc.undisclosed_annual_usd),
                  sub: "Not reported to the plan fiduciary",
                  severity: "alert",
                },
                { label: "Services Tracked", value: bc.services_tracked ?? 0, sub: "Compensation categories" },
                { label: "Employers", value: employerCount, sub: "Plan sponsors in scope" },
                { label: "Disclosed Services", value: disclosedCount, sub: "Reported under §408(b)(2)" },
                { label: "Undisclosed Services", value: undisclosedCount, sub: "Disclosure gap", severity: "alert" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
            <InsightPanel title="Undisclosed compensation by employer" description="Annual broker compensation that has not been reported to the plan fiduciary." className="xl:col-span-3">
              <RankedBars data={Object.values(brokers.filter((row) => !row.disclosed).reduce((acc, row) => { const current = acc[row.employer_name] || { label: row.employer_name, value: 0 }; current.value += row.annual_usd; acc[row.employer_name] = current; return acc; }, {} as Record<string, { label: string; value: number }>))} valueFormatter={money} height={270} color="#7654d6" />
            </InsightPanel>
            <InsightPanel title="Disclosure posture" description="A quick view of arrangements that are documented versus those that need a request." className="xl:col-span-2">
              <StackedOutcome segments={[
                { label: "Disclosed", value: disclosedCount, color: "#0f8f69" },
                { label: "Undisclosed", value: undisclosedCount, color: "#dc4b45" },
                { label: "Requested", value: brokers.filter((row) => row.disclosure_requested).length, color: "#c98a12" },
              ]} />
            </InsightPanel>
          </div>

          <div className="flex items-end justify-between mb-3"><div><h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Compensation arrangements</h2><p className="text-[11.5px] text-slate-500 mt-0.5">Prioritized by annual dollars and disclosure status.</p></div></div>

          <DataTable
            columns={brokerColumns}
            rows={brokers}
            rowKey={(r) => `${r.employer_id}:${r.service}`}
            onRowClick={(r) => {
              setSelectedBroker(r);
              setActionMsg(null);
              setActionErr(false);
            }}
            emptyMessage="No broker compensation arrangements on file"
          />
        </>
      )}

      {view === "independence" && (
        <div className="max-w-4xl">
          <div className="rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-6 py-6 mb-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold font-heading text-emerald-700 dark:text-emerald-400 mb-1.5">
                  Independence Attestation
                </div>
                <p className="text-[19px] leading-snug font-bold font-heading text-emerald-900 dark:text-emerald-100">
                  {ind.statement || "·"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm mb-5">
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold font-heading text-slate-500 dark:text-slate-400">
                Position on each conflict vector
              </div>
            </div>
            <dl className="divide-y divide-slate-200 dark:divide-slate-700">
              {attestations.map((a, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 px-5 py-3.5">
                  <dt className="text-[13.5px] font-semibold text-slate-900 dark:text-white">{a.item}</dt>
                  <dd className="sm:col-span-2 text-[13.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {a.position}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {ind.economics && (
            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
              <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold font-heading text-slate-500 dark:text-slate-400 mb-3">
                How Axeris is paid
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">Base</div>
                  <div className="text-[17px] font-bold tabular-nums text-slate-900 dark:text-white">
                    ${ind.economics.pepm_base_low_usd?.toFixed(2)}-${ind.economics.pepm_base_high_usd?.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">per employee per month</div>
                </div>
                <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400">Performance</div>
                  <div className="text-[17px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {ind.economics.performance_share_pct}%
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">of documented savings</div>
                </div>
              </div>
              <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">{ind.economics.note}</p>
            </div>
          )}

          <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-5 py-4">
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold font-heading text-blue-700 dark:text-blue-300 mb-1.5">
              Why it matters
            </div>
            <p className="text-[13.5px] leading-relaxed text-blue-900 dark:text-blue-100">{ind.why_it_matters || "·"}</p>
          </div>
        </div>
      )}

      <DetailDrawer
        open={!!selectedDrug}
        onClose={() => setSelectedDrug(null)}
        title={selectedDrug ? selectedDrug.drug_name : ""}
        subtitle={selectedDrug ? `${selectedDrug.brand_name} · +${selectedDrug.differential_pct}% at affiliated pharmacies` : ""}
      >
        {selectedDrug && (
          <>
            <div className="mb-5 rounded-md px-4 py-3 text-[13px] border leading-relaxed bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
              <span className="font-semibold">Why this is flagged: </span>
              the plan pays materially more for this exact drug when it is dispensed by a pharmacy the PBM owns. That
              differential is not a clinical difference and not a dispensing-cost difference · it is a transfer from the
              plan to the PBM&apos;s own pharmacy line of business.
            </div>

            <FieldGroup title="Drug">
              <Field label="Drug ID" value={selectedDrug.drug_id} mono />
              <Field label="Generic Name" value={selectedDrug.drug_name} />
              <Field label="Brand Name" value={selectedDrug.brand_name} />
            </FieldGroup>

            <FieldGroup title="Price Differential">
              <Field label="Affiliated Unit Price" value={`$${selectedDrug.affiliated_unit_usd.toFixed(4)}`} mono />
              <Field label="Independent Unit Price" value={`$${selectedDrug.independent_unit_usd.toFixed(4)}`} mono />
              <Field
                label="Differential"
                value={
                  <span className="font-bold text-red-600 dark:text-red-400">+{selectedDrug.differential_pct}%</span>
                }
              />
              <Field label="Affiliated Units Dispensed" value={selectedDrug.affiliated_units.toLocaleString()} mono />
              <Field label="Excess Paid" value={money(selectedDrug.excess_usd)} mono />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>

      <DetailDrawer
        open={!!selectedBroker}
        onClose={() => {
          setSelectedBroker(null);
          setActionMsg(null);
          setActionErr(false);
        }}
        title={selectedBroker ? selectedBroker.employer_name : ""}
        subtitle={selectedBroker ? `${selectedBroker.service} · ${selectedBroker.disclosed ? "Disclosed" : "Undisclosed"}` : ""}
        actions={
          selectedBroker && (
            <button
              onClick={() => requestDisclosure(selectedBroker)}
              disabled={posting || selectedBroker.disclosure_requested}
              title={
                selectedBroker.disclosure_requested
                  ? "A compensation disclosure has already been demanded for this employer"
                  : "Demand full broker and consultant compensation disclosure under CAA 2021 §202"
              }
              className={clsx(
                "px-3 py-1.5 text-[13px] rounded text-white",
                posting || selectedBroker.disclosure_requested
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {selectedBroker.disclosure_requested ? "Requested ✓" : posting ? "Requesting…" : "Request Disclosure"}
            </button>
          )
        }
      >
        {selectedBroker && (
          <>
            {actionMsg && (
              <div
                className={clsx(
                  "mb-5 rounded-md px-4 py-3 text-[13px] border leading-relaxed",
                  actionErr
                    ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200"
                    : "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200"
                )}
              >
                {actionMsg}
              </div>
            )}

            {selectedBroker.conflict && (
              <div className="mb-5 rounded-md px-4 py-3 text-[13px] border leading-relaxed bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
                <span className="font-semibold">Conflict: </span>
                {selectedBroker.conflict}. This compensation rises as plan cost rises, which points the broker&apos;s
                incentive away from the employer paying them · the adviser earns more from the arrangement that costs
                the plan more.
              </div>
            )}

            <FieldGroup title="Employer">
              <Field label="Employer ID" value={selectedBroker.employer_id} mono />
              <Field label="Employer Name" value={selectedBroker.employer_name} />
            </FieldGroup>

            <FieldGroup title="Compensation">
              <Field label="Service" value={selectedBroker.service} />
              <Field label="PMPM" value={`$${selectedBroker.pmpm_usd.toFixed(2)}`} mono />
              <Field label="Annual" value={money(selectedBroker.annual_usd)} mono />
              <Field
                label="Disclosed"
                value={
                  selectedBroker.disclosed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Disclosed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-semibold">
                      <XCircle className="w-3.5 h-3.5" /> Undisclosed
                    </span>
                  )
                }
              />
              <Field label="Conflict" value={selectedBroker.conflict || "·"} />
              <Field
                label="Disclosure Requested"
                value={selectedBroker.disclosure_requested ? "Yes · demand issued under CAA §202" : "No"}
              />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
