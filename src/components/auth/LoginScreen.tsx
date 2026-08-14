"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { AxerisLogo } from "@/components/ui/AxerisLogo";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your credentials");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError("The username or password is not recognized.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f4ef] flex items-center justify-center p-4 relative overflow-hidden">
      {/* aurora glow, matching the marketing site */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-30%",
          right: "-10%",
          width: 720,
          height: 620,
          borderRadius: "50%",
          filter: "blur(80px)",
          background:
            "radial-gradient(circle at 50% 50%, rgba(47,47,230,0.28) 0%, rgba(75,83,242,0.16) 40%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Brand */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <AxerisLogo size={34} />
            <span className="text-[1.5rem] font-medium tracking-[-0.02em] text-[#17140d]">Axeris</span>
          </div>
          <h1 className="text-[2rem] leading-[1.1] font-normal tracking-[-0.02em] text-[#17140d]">Welcome to Axeris.</h1>
          <p className="text-sm text-[#7c766c] mt-3">Sign in to the clinical decision support workspace.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[#5f5a50] block mb-1.5">Username</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a8a196]" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="access@axeris"
                autoComplete="username"
                className="w-full bg-[#fbfaf6] border border-[#e4dfd4] rounded-[9px] pl-10 pr-4 py-2.5 text-sm text-[#17140d] placeholder-[#a8a196] focus:outline-none focus:ring-2 focus:ring-[#2f2fe6] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#5f5a50] block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a8a196]" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-[#fbfaf6] border border-[#e4dfd4] rounded-[9px] pl-10 pr-10 py-2.5 text-sm text-[#17140d] placeholder-[#a8a196] focus:outline-none focus:ring-2 focus:ring-[#2f2fe6] focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a8a196] hover:text-[#5f5a50]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-[#dc4b45] bg-[#dc4b45]/[0.07] rounded-[9px] px-3 py-2 border border-[#dc4b45]/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#17140d] hover:bg-black text-white font-medium py-2.5 rounded-[9px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>

          <p className="text-center text-[11px] text-[#a8a196]">Axeris demo workspace · synthetic data</p>
        </form>

        {/* Footer */}
        <div className="mt-10 pt-5 border-t border-[#e4dfd4] flex items-center justify-between">
          <p className="text-[11px] text-[#a8a196]">HIPAA · SOC 2 Type II · HL7 FHIR R4</p>
          <p className="text-[11px] text-[#a8a196]">Simulated data</p>
        </div>
      </div>
    </div>
  );
}
