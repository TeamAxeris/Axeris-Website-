"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useMode } from "@/context/ModeContext";
import {
  LayoutDashboard, Pill, Users, Stethoscope, Settings,
  ClipboardList, FileText, BookOpen, LogOut, Moon, Sun,
  Building2, Scale, AlertOctagon, Radio, Phone, Layers,
  HeartPulse, Network, Activity, ChevronRight, Database, TrendingUp,
  Receipt, Syringe, UserMinus, Gauge, Cpu, BadgeCheck, Scissors,
  ClipboardCheck, CalendarCheck, Home, Truck,
  LineChart, Landmark, ShoppingBag, SlidersHorizontal,
} from "lucide-react";
import { AxerisLogo } from "@/components/ui/AxerisLogo";
import { useState } from "react";
import clsx from "clsx";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number | string;
};

type NavSection = {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
};

// TPA Mode · primary workflow first; clinical reference embedded under "Reference"
const TPA_SECTIONS: NavSection[] = [
  {
    label: "Workflow",
    items: [
      { href: "/tpa/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tpa/pend-queue", label: "Pend Queue", icon: ClipboardList },
      { href: "/tpa/asa-disputes", label: "Disputes", icon: Scale },
      { href: "/tpa/fraud-referrals", label: "Fraud & Abuse", icon: AlertOctagon },
    ],
  },
  {
    label: "Contract Integrity",
    items: [
      { href: "/tpa/pbm-audit", label: "PBM Pricing Audit", icon: Receipt },
      { href: "/tpa/mac-repricing", label: "Generic Pricing", icon: LineChart },
      { href: "/tpa/conflict-audit", label: "Conflict of Interest", icon: Landmark },
      { href: "/tpa/dtc-leakage", label: "Direct Channels", icon: ShoppingBag },
      { href: "/tpa/plan-design", label: "Plan Design", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Cost Containment",
    items: [
      { href: "/tpa/glp1-watch", label: "GLP-1 Oversight", icon: Syringe },
      { href: "/tpa/eligibility-leakage", label: "Eligibility", icon: UserMinus },
      { href: "/tpa/high-cost-forecast", label: "Stop-Loss Forecast", icon: Gauge },
      { href: "/tpa/pa-gold-card", label: "Prior Authorization", icon: BadgeCheck },
    ],
  },
  {
    label: "Clinical Programs",
    items: [
      { href: "/tpa/med-optimization", label: "Medication Review", icon: ClipboardCheck },
      { href: "/tpa/adherence", label: "Adherence", icon: CalendarCheck },
    ],
  },
  {
    label: "Plan Sponsors",
    items: [
      { href: "/tpa/employer-reports", label: "Employers", icon: Building2 },
      { href: "/tpa/stewardship", label: "Stewardship Reports", icon: FileText },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/prescriptions", label: "Claims", icon: Pill },
      { href: "/patients", label: "Members", icon: Users },
      { href: "/providers", label: "Prescribers", icon: Stethoscope },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/engines", label: "AI Engines", icon: Cpu },
      { href: "/data-sources", label: "Data Sources", icon: Database },
      { href: "/audit", label: "Audit Trail", icon: ClipboardList },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

// PBA Mode · real-time adjudication first
const PBA_SECTIONS: NavSection[] = [
  {
    label: "Adjudication",
    items: [
      { href: "/pba/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pba/live-transactions", label: "Live Transactions", icon: Radio },
      { href: "/pba/ncpdp-rejects", label: "Pre-Dispense Stops", icon: AlertOctagon },
      { href: "/pba/callbacks", label: "Pharmacist Callbacks", icon: Phone },
    ],
  },
  {
    label: "Value",
    items: [
      { href: "/pba/savings", label: "Savings Opportunities", icon: TrendingUp },
      { href: "/pba/split-fill", label: "Split Fill", icon: Scissors },
      { href: "/pba/site-of-care", label: "Site of Care", icon: Home },
      { href: "/pba/mail-order", label: "Mail Order", icon: Truck },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/pba/pharmacy-network", label: "Pharmacy Network", icon: Network },
      { href: "/pba/formulary-mgmt", label: "Formulary", icon: Layers },
    ],
  },
  {
    label: "Members",
    items: [
      { href: "/patients", label: "Members", icon: Users },
      { href: "/pba/member-safety", label: "Member Safety", icon: HeartPulse },
      { href: "/providers", label: "Prescribers", icon: Stethoscope },
      { href: "/prescriptions", label: "Claims", icon: Pill },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/engines", label: "AI Engines", icon: Cpu },
      { href: "/data-sources", label: "Data Sources", icon: Database },
      { href: "/audit", label: "Adjudication Log", icon: ClipboardList },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { mode } = useMode();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sections = mode === "TPA" ? TPA_SECTIONS : PBA_SECTIONS;

  return (
    <aside data-tour="nav" className="w-[248px] flex flex-col min-h-screen border-r"
      style={{ background: "radial-gradient(circle at 15% 0%, rgba(47,47,230,0.16), transparent 22%), linear-gradient(180deg, #181511 0%, #12100d 100%)", color: "#cfc9bd", borderColor: "#302b24" }}>
      {/* Brand */}
      <div className="px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-[0_8px_24px_-10px_rgba(111,116,243,0.8)]">
            <AxerisLogo size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold tracking-[-0.02em] font-heading text-white">Axeris</div>
            <div className="text-[9px] uppercase tracking-[0.16em] mt-0.5" style={{ color: "#8f897e" }}>
              {mode === "TPA" ? "Plan Sponsor Console" : "PBA Adjudication"}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section) => {
          const isCollapsed = section.collapsible && collapsed[section.label];
          return (
            <div key={section.label} className="mb-2">
              <button
                onClick={() => section.collapsible && setCollapsed(c => ({ ...c, [section.label]: !c[section.label] }))}
                className="w-full px-4 py-1.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.15em] font-medium text-[#746f66] hover:text-[#a8a196]"
              >
                {section.collapsible && (
                  <ChevronRight className={clsx("w-3 h-3 transition", !isCollapsed && "rotate-90")} />
                )}
                <span>{section.label}</span>
              </button>
              {!isCollapsed && (
                <div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={clsx(
                          "relative mx-2 flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] transition-all duration-150",
                          isActive
                            ? "text-white bg-gradient-to-r from-[#2f2fe6]/25 to-white/[0.06] shadow-[inset_0_0_0_1px_rgba(111,116,243,0.18)]"
                            : "text-[#aaa399] hover:bg-white/[0.055] hover:text-white"
                        )}
                      >
                        <Icon className={clsx("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-[#8f94ff]" : "text-[#777168]")} strokeWidth={2} />
                        <span className="truncate flex-1">{item.label}</span>
                        {isActive && <span className="absolute right-2.5 w-1 h-1 rounded-full bg-[#7f85ff] shadow-[0_0_8px_rgba(127,133,255,0.9)]" />}
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{item.badge}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t space-y-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11.5px] text-[#8f897e] hover:bg-white/[0.05] hover:text-white"
        >
          {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        {user && (
          <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="w-8 h-8 bg-gradient-to-br from-[#35312b] to-[#24211d] border border-white/10 rounded-full flex items-center justify-center text-[10px] font-semibold text-slate-300">
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-slate-200 truncate">{user.name}</div>
            </div>
            <button onClick={logout} className="p-1 text-slate-500 hover:text-slate-200" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="text-[9px] text-[#575249] px-2 pt-1">Axeris · v0.8.0</div>
      </div>
    </aside>
  );
}
