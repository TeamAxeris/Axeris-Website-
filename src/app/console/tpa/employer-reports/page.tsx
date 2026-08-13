"use client";

import { useEffect, useState } from "react";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { FileText } from "lucide-react";
import clsx from "clsx";
import { demoFetch } from "@/lib/demoFetch";

interface Employer {
  id: string; name: string; lives: number; state: string; industry: string;
  monthly_claims: number; flagged_pct: number; ytd_recovered_usd: number;
  pmpm_savings: number; fraud_referrals: number; open_disputes: number;
  asa_renewal_date: string; stewardship_report_status: string;
}

export default function TPAEmployerReportsPage() {
  const [employers, setEmployers] = useState<Employer[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    demoFetch("/api/v1/tpa/employers")
      .then((d: any) => setEmployers(d.items))
      .catch(() => setEmployers([]));
  }, []);

  useEffect(() => {
    if (selectedId) demoFetch(`/api/v1/tpa/employers/${selectedId}`).then(setDetail).catch(() => {});
    else setDetail(null);
  }, [selectedId]);

  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (!employers) return <div className="p-6"><TableSkeleton rows={8} cols={9} /></div>;

  const generateReport = () => {
    if (!detail) return;
    // Derive the current quarter instead of hardcoding it, and guard the
    // employer-number extraction so a malformed id can't produce
    // "...-undefined/download".
    const now = new Date();
    const quarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
    const empNum = detail.employer.id.includes("-") ? detail.employer.id.split("-")[1] : detail.employer.id;
    const reportId = `STW-${quarter}-${empNum}`;
    window.open(`/api/v1/tpa/stewardship-reports/${encodeURIComponent(reportId)}/download`, "_blank");
  };

  const emailPlanAdmin = () => {
    if (!detail) return;
    setActionMsg(
      `Email queued to ${detail.employer.name} plan administrator. ` +
      `Subject: "Quarterly stewardship · ${detail.employer.lives.toLocaleString()} lives". Delivery via secure portal.`
    );
  };

  const totalLives = employers.reduce((s, e) => s + e.lives, 0);
  const totalRecovered = employers.reduce((s, e) => s + e.ytd_recovered_usd, 0);
  const totalReferrals = employers.reduce((s, e) => s + e.fraud_referrals, 0);
  const totalDisputes = employers.reduce((s, e) => s + e.open_disputes, 0);

  const columns: Column<Employer>[] = [
    { key: "name", header: "Plan Sponsor",
      render: (e) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white text-[13px]">{e.name}</div>
          <div className="text-[11px] text-slate-500">{e.industry} · {e.state}</div>
        </div>
      )},
    { key: "lives", header: "Lives", width: "100px", align: "right",
      render: (e) => <span className="tabular-nums text-[13px]">{e.lives.toLocaleString()}</span> },
    { key: "claims", header: "Monthly Claims", width: "130px", align: "right",
      render: (e) => <span className="tabular-nums text-[13px]">{e.monthly_claims.toLocaleString()}</span> },
    { key: "flagrate", header: "Flag Rate", width: "100px", align: "right",
      render: (e) => <span className={clsx("tabular-nums text-[13px] font-semibold", e.flagged_pct > 7 ? "text-red-700 dark:text-red-300" : "text-slate-700 dark:text-slate-300")}>{e.flagged_pct}%</span> },
    { key: "recovered", header: "YTD Recovered", width: "130px", align: "right",
      render: (e) => <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">${e.ytd_recovered_usd.toLocaleString()}</span> },
    { key: "pmpm", header: "PMPM Savings", width: "120px", align: "right",
      render: (e) => <span className="tabular-nums text-[13px]">${e.pmpm_savings}</span> },
    { key: "fraud", header: "Fraud", width: "70px", align: "right",
      render: (e) => <span className={clsx("tabular-nums text-[13px]", e.fraud_referrals > 0 ? "text-red-700 font-semibold dark:text-red-300" : "text-slate-400")}>{e.fraud_referrals}</span> },
    { key: "disputes", header: "Disputes", width: "80px", align: "right",
      render: (e) => <span className={clsx("tabular-nums text-[13px]", e.open_disputes > 0 ? "text-amber-700 font-semibold dark:text-amber-300" : "text-slate-400")}>{e.open_disputes}</span> },
    { key: "stewardship", header: "Stewardship", width: "110px",
      render: (e) => <span className={clsx("text-[11px] px-2 py-0.5 rounded font-semibold border",
        e.stewardship_report_status === "sent" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20"
        : e.stewardship_report_status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
        : "bg-slate-50 text-slate-600 border-slate-200 dark:text-slate-400")}>{e.stewardship_report_status}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Plan Sponsors · Book of Business"
        subtitle={`${employers.length} self-funded employer groups · ${totalLives.toLocaleString()} lives covered`}
        meta={<DataSourceList sources={["Kythera", "Truveta"]} />}
      />

      <div className="mb-4">
        <StatRow items={[
          { label: "Plan Sponsors", value: employers.length },
          { label: "Lives Covered", value: totalLives.toLocaleString() },
          { label: "YTD Recovered", value: `$${(totalRecovered / 1_000_000).toFixed(2)}M`, severity: "ok" },
          { label: "Open Disputes", value: totalDisputes, severity: "warn" },
          { label: "Fraud Referrals", value: totalReferrals, severity: "alert" },
        ]} />
      </div>

      <DataTable columns={columns} rows={employers} rowKey={(e) => e.id} onRowClick={(e) => setSelectedId(e.id)}
        emptyMessage="No plan sponsor groups configured. Self-funded employer groups managed under this TPA will appear here." />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => { setSelectedId(null); setActionMsg(null); }}
        title={detail?.employer.name || "Loading…"}
        subtitle={detail ? `${detail.employer.industry} · ${detail.employer.state} · ${detail.employer.lives.toLocaleString()} lives` : undefined}
        actions={detail && (
          <>
            <button
              onClick={emailPlanAdmin}
              title="Send the quarterly stewardship summary to the employer's plan administrator"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50 text-slate-700 dark:text-slate-300"
            >
              Email Plan Admin
            </button>
            <button
              onClick={generateReport}
              title="Generate a downloadable PDF stewardship report for this employer"
              className="px-3 py-1.5 text-[13px] rounded bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" /> Generate Stewardship Report
            </button>
          </>
        )}
      >
        {detail && (
          <>
            {actionMsg && (
              <div className="mb-5 bg-emerald-50 border border-emerald-300 rounded-md px-4 py-3 text-[13px] text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
                {actionMsg}
              </div>
            )}
            <FieldGroup title="Plan Sponsor">
              <Field label="Employer ID" value={detail.employer.id} mono />
              <Field label="Name" value={detail.employer.name} />
              <Field label="Industry" value={detail.employer.industry} />
              <Field label="State" value={detail.employer.state} />
              <Field label="Lives Covered" value={detail.employer.lives.toLocaleString()} />
            </FieldGroup>

            <FieldGroup title="Monthly Performance (last 4 mo)">
              <table className="w-full text-[12px]">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr><th className="text-left py-1.5">Month</th><th className="text-right">Claims</th><th className="text-right">Flagged</th><th className="text-right">Recovered</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.monthly_metrics.map((m: any) => (
                    <tr key={m.month}>
                      <td className="py-1.5 font-mono">{m.month}</td>
                      <td className="text-right tabular-nums">{m.claims.toLocaleString()}</td>
                      <td className="text-right tabular-nums">{m.flagged}</td>
                      <td className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">${m.recovered_usd.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FieldGroup>

            <FieldGroup title="Top Drugs Flagged">
              {detail.top_drugs_flagged.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0 text-[13px]">
                  <span className="text-slate-900 dark:text-white">{d.drug}</span>
                  <span className="text-[11px] text-slate-500">{d.flagged_count} flagged · ${d.savings_usd.toLocaleString()} saved</span>
                </div>
              ))}
            </FieldGroup>

            <FieldGroup title="Top Prescribers Flagged">
              {detail.top_prescribers_flagged.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0 text-[13px]">
                  <span className="text-slate-900 dark:text-white">{p.name}</span>
                  <span className="text-[11px] text-slate-500">{p.rx_count} Rx · {p.flag_rate_pct}% flag rate</span>
                </div>
              ))}
            </FieldGroup>

            <FieldGroup title="Compliance">
              <Field label="ASA in force" value={detail.compliance.asa_in_force ? "Yes" : "No"} />
              <Field label="CAA 2026 attestation" value={detail.compliance.caa_2026_attestation_signed ? "Signed" : "Pending"} />
              <Field label="RxDC filing" value={detail.compliance.rxdc_filing_current ? "Current" : "Overdue"} />
              <Field label="ERISA § 404 audit pass" value={`${detail.compliance.erisa_404_audit_pass_pct}%`} />
              <Field label="Form 5500" value={detail.compliance.form_5500_status} />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
