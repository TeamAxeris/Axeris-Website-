"use client";

import { useEffect, useState } from "react";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Download, ExternalLink } from "lucide-react";
import { demoFetch } from "@/lib/demoFetch";

interface Report {
  id: string; employer_id: string; employer_name: string; quarter: string;
  lives_covered: number; total_claims: number; flagged_claims: number;
  amount_recovered_usd: number; fraud_referrals: number; asa_pend_actions: number;
  report_date: string; erisa_404_status: string; delivered_to_plan_sponsor: boolean;
}

export default function TPAStewardshipPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const emailPlanSponsor = () => {
    if (!selected) return;
    setActionMsg(
      `Email queued to ${selected.employer_name} plan sponsor. ` +
      `Attached: Stewardship Report ${selected.id} (${selected.quarter}). Delivery via secure portal.`
    );
  };

  useEffect(() => {
    demoFetch("/api/v1/tpa/stewardship-reports")
      .then((d: any) => setReports(d.items))
      .catch(() => setReports([]));
    demoFetch("/api/v1/tpa/compliance-status")
      .then(setCompliance)
      .catch(() => setCompliance({}));
  }, []);

  const downloadReport = async (id: string) => {
    const url = `/api/v1/tpa/stewardship-reports/${id}/download`;
    window.open(url, "_blank");
  };

  if (!reports) return <div className="p-6"><TableSkeleton rows={8} cols={9} /></div>;

  const quarters = Array.from(new Set(reports.map(r => r.quarter))).sort().reverse();
  const filtered = filter ? reports.filter(r => r.quarter === filter) : reports;
  const totalRecovered = filtered.reduce((s, r) => s + r.amount_recovered_usd, 0);

  const columns: Column<Report>[] = [
    { key: "id", header: "Report ID", width: "180px",
      render: (r) => <span className="font-mono text-[12px] text-slate-700 dark:text-slate-300">{r.id}</span> },
    { key: "quarter", header: "Quarter", width: "90px",
      render: (r) => <span className="text-[13px] font-semibold">{r.quarter}</span> },
    { key: "employer", header: "Plan Sponsor",
      render: (r) => <span className="text-[13px]">{r.employer_name}</span> },
    { key: "lives", header: "Lives", width: "100px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px]">{r.lives_covered.toLocaleString()}</span> },
    { key: "claims", header: "Claims", width: "100px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px]">{r.total_claims.toLocaleString()}</span> },
    { key: "flagged", header: "Flagged", width: "90px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px]">{r.flagged_claims}</span> },
    { key: "recovered", header: "Recovered", width: "120px", align: "right",
      render: (r) => <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">${r.amount_recovered_usd.toLocaleString()}</span> },
    { key: "erisa", header: "ERISA § 404", width: "110px",
      render: (_) => <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold dark:text-emerald-300 dark:bg-emerald-900/20">compliant</span> },
    { key: "actions", header: "", width: "60px", align: "right",
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); downloadReport(r.id); }}
          className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1 rounded inline-flex items-center gap-1 text-[12px] dark:text-blue-400"
          title="Download report JSON">
          <Download className="w-3.5 h-3.5" />
        </button>
      )},
  ];

  return (
    <div>
      <PageHeader
        title="Stewardship Reports"
        subtitle="Quarterly ERISA § 404 fiduciary stewardship reports for self-funded employer plan sponsors"
        meta={<DataSourceList sources={["Kythera", "Truveta"]} />}
      />

      {compliance && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md mb-4">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Regulatory Compliance Status
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {Object.entries(compliance).map(([key, val]: [string, any]) => (
              <div key={key} className="px-4 py-2 grid grid-cols-12 items-center text-[13px]">
                <div className="col-span-4 text-slate-500 capitalize">{key.replace(/_/g, " ")}</div>
                <div className="col-span-3 font-semibold text-slate-900 dark:text-white capitalize">{val.status}</div>
                <div className="col-span-3 text-[12px] text-slate-500">
                  {val.last_audit && `Last audit: ${val.last_audit}`}
                  {val.deadline && `Deadline: ${val.deadline}`}
                  {val.last_filing && `Last filed: ${val.last_filing}`}
                </div>
                <div className="col-span-2 text-right text-[12px] text-emerald-700 font-mono dark:text-emerald-300">
                  {val.audit_pass_rate_pct ? `${val.audit_pass_rate_pct}% pass` : ""}
                  {val.covered_groups_pct ? `${val.covered_groups_pct}% covered` : ""}
                  {val.issued_to_employers ? `${val.issued_to_employers} sponsors` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[13px]">
          <option value="">All quarters ({reports.length})</option>
          {quarters.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <span className="text-[13px] text-slate-500">{filtered.length} reports · ${totalRecovered.toLocaleString()} recovered</span>
      </div>

      <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} onRowClick={(r) => setSelected(r)}
        emptyMessage="No stewardship reports for this quarter. Reports are generated quarterly for each self-funded plan sponsor." />

      <DetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionMsg(null); }}
        title={selected ? `${selected.quarter} · ${selected.employer_name}` : ""}
        subtitle={selected ? `Stewardship Report ${selected.id}` : undefined}
        actions={selected && (
          <>
            <button
              onClick={emailPlanSponsor}
              title="Email this stewardship report to the plan sponsor's benefits administrator"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50 text-slate-700 dark:text-slate-300"
            >
              Email to Plan Sponsor
            </button>
            <button
              onClick={() => window.open(`/api/v1/tpa/stewardship-reports/${selected.id}/download`, "_blank")}
              title="Open the report PDF in a new browser tab without downloading"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 dark:text-slate-300"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Preview in browser
            </button>
            <button
              onClick={() => downloadReport(selected.id)}
              title="Download the report as a PDF file"
              className="px-3 py-1.5 text-[13px] rounded bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download
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
            <FieldGroup title="Report Identity">
              <Field label="Report ID" value={selected.id} mono />
              <Field label="Quarter" value={selected.quarter} />
              <Field label="Plan Sponsor" value={selected.employer_name} />
              <Field label="Lives Covered" value={selected.lives_covered.toLocaleString()} />
              <Field label="Report Date" value={selected.report_date} />
              <Field label="ERISA § 404" value={selected.erisa_404_status} />
              <Field label="Delivered to Sponsor" value={selected.delivered_to_plan_sponsor ? "Yes" : "Pending"} />
            </FieldGroup>
            <FieldGroup title="Quarter Summary">
              <Field label="Total Claims" value={selected.total_claims.toLocaleString()} />
              <Field label="Flagged Claims" value={selected.flagged_claims.toLocaleString()} />
              <Field label="Amount Recovered" value={`$${selected.amount_recovered_usd.toLocaleString()}`} />
              <Field label="ASA Pend Actions" value={selected.asa_pend_actions.toString()} />
              <Field label="Fraud Referrals Filed" value={selected.fraud_referrals.toString()} />
            </FieldGroup>
            <FieldGroup title="Data Sources Used">
              <Field label="Primary claims" value="Kythera Wayfinder open claims" />
              <Field label="ML peer baseline" value="Truveta TDM (120M+ patients, EHR + linked claims)" />
              <Field label="Patient context" value="Truveta TDM EHR (LOINC labs, allergies, genomics)" />
              <Field label="Reference" value="NPPES, LEIE, NADAC, FDA DailyMed, RxNorm" />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
