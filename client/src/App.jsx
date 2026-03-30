import { useState } from "react";

const QUESTIONS = [
  { id: "offerName", label: "What are you calling this offer or product?", placeholder: "e.g. Product Data Enrichment Service", type: "text", required: true },
  { id: "problem", label: "What problem does it solve? From the customer's perspective.", placeholder: "e.g. Distributors can't get products online fast enough because their product data is incomplete or wrong", type: "textarea", required: true },
  { id: "targetCustomer", label: "Who is the target customer?", placeholder: "e.g. Mid-market industrial distributors, VP eCommerce, 100–500 employees", type: "text", required: true },
  { id: "category", label: "What category does this compete in?", placeholder: "e.g. Product content management, MDM/PIM services, data enrichment", type: "text", required: true },
  { id: "geography", label: "Target geography?", placeholder: "e.g. North America, US only", type: "text", required: true },
  { id: "currentSolution", label: "How does the customer solve this today without you?", placeholder: "e.g. Manual data entry, offshore team, incumbent vendor", type: "textarea", required: false },
  { id: "whyNow", label: "Why now? What's shifted or shifting?", placeholder: "e.g. AI is making enrichment cheaper, regulation is forcing change", type: "text", required: false },
  { id: "existingSignals", label: "Any existing customer interest, deals, or pilots?", placeholder: "e.g. 2 prospects have asked, 1 pilot underway", type: "text", required: false },
];

const SYSTEM_PROMPT = `You are a hard-nosed product launch analyst. Use web search to validate product ideas for B2B professional services companies. Score objectively — if an idea is weak, say so.

Use web search to find: market size data, named competitors, pricing benchmarks, timing signals (funding rounds, news, regulation), and ICP validation.

Return ONLY valid JSON. No markdown, no backticks, no preamble. Raw JSON only.

{
  "overallVerdict": "green"|"yellow"|"red",
  "verdictSummary": "2-3 sentence direct assessment. Name competitors, cite numbers.",
  "scores": [
    {
      "dimension": string,
      "score": "green"|"yellow"|"red",
      "finding": "specific finding with named companies or data",
      "signal": "single most important signal — name, price, stat, or event",
      "recommendation": "exactly what to do next"
    }
  ],
  "topStrengths": [string, string, string],
  "topRisks": [string, string, string],
  "competitorsFound": [string, string, string],
  "marketSizeSignal": string,
  "pricingBenchmark": string
}

Score ALL 8 dimensions in order:
1. Problem Clarity — documented real problem with market evidence?
2. Market Size — measurable TAM signal, growing or shrinking?
3. Competitive Landscape — how crowded, named players, what they charge?
4. Timing and Why Now — macro tailwind, trigger event, market shift?
5. ICP Definition — specific and reachable buyer?
6. Monetization Evidence — people paying for this category today, at what price?
7. Differentiation Potential — defensible white space?
8. Offer Viability — can this be scoped, priced, and delivered as a B2B service?

GREEN = strong evidence, clear signal, low concern
YELLOW = partial signal, gaps exist, needs validation
RED = weak signal, major concern, or blocker

Be direct. Use specific data. Don't hedge.`;

const SC = {
  green:  { border: "#16a34a", badge: "#16a34a", label: "GREEN" },
  yellow: { border: "#ca8a04", badge: "#ca8a04", label: "YELLOW" },
  red:    { border: "#dc2626", badge: "#dc2626", label: "RED" },
};

const VC = {
  green:  { bg: "#f0fdf4", border: "#16a34a", text: "#15803d", label: "GO — Strong Idea" },
  yellow: { bg: "#fefce8", border: "#ca8a04", text: "#a16207", label: "PROCEED WITH CAUTION" },
  red:    { bg: "#fef2f2", border: "#dc2626", text: "#b91c1c", label: "STOP — Major Gaps" },
};

const LOADING_MSGS = [
  "Searching the market...",
  "Identifying competitors...",
  "Checking pricing signals...",
  "Evaluating timing indicators...",
  "Scoring your idea...",
];

export default function App() {
  const [phase, setPhase] = useState("intake");
  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState(null);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [error, setError] = useState(null);

  const handleChange = (id, value) => setInputs((p) => ({ ...p, [id]: value }));
  const isReady = () => QUESTIONS.filter((q) => q.required).every((q) => (inputs[q.id] || "").trim());

  const runAnalysis = async () => {
    setPhase("loading");
    setError(null);
    setLoadingIdx(0);
    LOADING_MSGS.forEach((_, i) => setTimeout(() => setLoadingIdx(i), i * 4000));

    const userContext = QUESTIONS
      .filter((q) => inputs[q.id])
      .map((q) => `${q.label}\n${inputs[q.id]}`)
      .join("\n\n");

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContext }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });

      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResults(parsed);
      setPhase("results");
    } catch (err) {
      setError("Analysis failed: " + err.message);
      setPhase("intake");
    }
  };

  const downloadReport = () => {
    if (!results) return;
    const r = results;
    const offerName = inputs.offerName || "Product Idea";
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const vc = VC[r.overallVerdict] || VC.red;
    const sc = (s) => SC[s] || SC.red;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Launch Readiness: ${offerName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#111;max-width:960px;margin:0 auto;padding:48px 40px;font-size:14px;line-height:1.6}
.header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:20px;margin-bottom:32px}
.header h1{font-size:26px;font-weight:700}
.meta{font-size:12px;color:#888;text-align:right}
.verdict{background:${vc.bg};border-left:4px solid ${vc.border};padding:20px 24px;border-radius:4px;margin-bottom:36px}
.verdict-label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${vc.text};margin-bottom:8px}
.sl{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#999;margin:32px 0 16px}
.scores-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:36px}
.sc{background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:16px}
.sc-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:12px}
.badge{font-size:10px;font-weight:700;letter-spacing:.08em;padding:3px 9px;border-radius:20px;color:#fff;white-space:nowrap}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:36px}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:36px}
.box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px}
.box h4{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:8px}
.footer{border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;font-size:11px;color:#bbb;display:flex;justify-content:space-between}
</style></head><body>
<div class="header">
  <div>
    <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#aaa;margin-bottom:6px">Launch Readiness Assessment</div>
    <h1>${offerName}</h1>
  </div>
  <div class="meta"><div>Pivotree GTM</div><div>${date}</div></div>
</div>
<div class="verdict">
  <div class="verdict-label">${vc.label}</div>
  <div style="font-size:15px;line-height:1.7">${r.verdictSummary}</div>
</div>
<div class="sl">Dimension Scores</div>
<div class="scores-grid">
${r.scores.map((s) => {
  const c = sc(s.score);
  return `<div class="sc" style="border-top:3px solid ${c.badge}">
  <div class="sc-top"><strong style="font-size:13px">${s.dimension}</strong><span class="badge" style="background:${c.badge}">${c.label}</span></div>
  <div style="font-size:12px;color:#444;margin-bottom:6px;line-height:1.5">${s.finding}</div>
  ${s.signal ? `<div style="font-size:11px;color:#777;font-style:italic;margin-bottom:8px">${s.signal}</div>` : ""}
  <div style="font-size:11px;border-top:1px solid #e5e7eb;padding-top:8px;color:#555"><strong>Next:</strong> ${s.recommendation}</div>
</div>`;
}).join("")}
</div>
<div class="two-col">
  <div class="box"><h4>Top Strengths</h4><ul style="padding-left:16px">${(r.topStrengths || []).map((s) => `<li style="font-size:12px;color:#444;margin-bottom:5px">${s}</li>`).join("")}</ul></div>
  <div class="box"><h4>Top Risks</h4><ul style="padding-left:16px">${(r.topRisks || []).map((s) => `<li style="font-size:12px;color:#444;margin-bottom:5px">${s}</li>`).join("")}</ul></div>
</div>
<div class="three-col">
  <div class="box"><h4>Market Size</h4><p style="font-size:12px;color:#444;line-height:1.5">${r.marketSizeSignal || ""}</p></div>
  <div class="box"><h4>Pricing Benchmark</h4><p style="font-size:12px;color:#444;line-height:1.5">${r.pricingBenchmark || ""}</p></div>
  <div class="box"><h4>Named Competitors</h4><p style="font-size:12px;color:#444;line-height:1.5">${(r.competitorsFound || []).join(", ")}</p></div>
</div>
<div class="footer"><span>Pivotree GTM · Product Launch Vetting</span><span>${date}</span></div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `launch-readiness-${offerName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 0" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, background: "#111", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 16 }}>↗</span>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>Launch Vetter</div>
              <div style={{ fontSize: 11, color: "#9ca3af", letterSpacing: "0.04em" }}>PIVOTREE GTM</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
        {phase === "intake" && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, color: "#111", marginBottom: 8 }}>Product Launch Vetter</h1>
              <p style={{ fontSize: 14, color: "#6b7280" }}>
                Fill in what you know. First 5 fields are required. Hit run and it goes live across the market — competitors, pricing, timing, market size, all 8 scoring dimensions.
              </p>
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#b91c1c" }}>
                {error}
              </div>
            )}

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "28px 28px" }}>
              {QUESTIONS.map((q, i) => (
                <div key={q.id} style={{ marginBottom: i < QUESTIONS.length - 1 ? 20 : 0 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#111", marginBottom: 6 }}>
                    {q.label}
                    {q.required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
                    {!q.required && <span style={{ color: "#9ca3af", fontSize: 11, marginLeft: 6 }}>optional</span>}
                  </label>
                  {q.type === "textarea" ? (
                    <textarea
                      rows={3}
                      placeholder={q.placeholder}
                      value={inputs[q.id] || ""}
                      onChange={(e) => handleChange(q.id, e.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={q.placeholder}
                      value={inputs[q.id] || ""}
                      onChange={(e) => handleChange(q.id, e.target.value)}
                    />
                  )}
                </div>
              ))}

              <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Runs live web research. Takes ~20-30 seconds.</div>
                <button
                  onClick={runAnalysis}
                  disabled={!isReady()}
                  style={{
                    fontSize: 14, fontWeight: 500, padding: "10px 24px", borderRadius: 8, border: "none",
                    background: isReady() ? "#111" : "#e5e7eb",
                    color: isReady() ? "#fff" : "#9ca3af",
                    cursor: isReady() ? "pointer" : "not-allowed",
                    transition: "background 0.15s",
                  }}
                >
                  Run analysis →
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 24 }}>
            <div style={{ width: 44, height: 44, border: "3px solid #e5e7eb", borderTopColor: "#111", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "#111", marginBottom: 6 }}>{LOADING_MSGS[loadingIdx]}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Running live market research. 15-30 seconds.</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {LOADING_MSGS.map((_, i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i <= loadingIdx ? "#111" : "#e5e7eb", transition: "background 0.3s" }} />
              ))}
            </div>
          </div>
        )}

        {phase === "results" && results && (() => {
          const r = results;
          const vc = VC[r.overallVerdict] || VC.red;
          const sc = (s) => SC[s] || SC.red;

          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>Launch Readiness</div>
                  <h1 style={{ fontSize: 22, fontWeight: 600, color: "#111" }}>{inputs.offerName || "Product Idea"}</h1>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { setPhase("intake"); setResults(null); }}
                    style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "transparent", color: "#374151", cursor: "pointer" }}
                  >
                    New analysis
                  </button>
                  <button
                    onClick={downloadReport}
                    style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111", fontWeight: 500, cursor: "pointer" }}
                  >
                    Download report ↓
                  </button>
                </div>
              </div>

              {/* Verdict */}
              <div style={{ background: vc.bg, borderLeft: `4px solid ${vc.border}`, borderRadius: "0 8px 8px 0", padding: "18px 20px", marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: vc.text, marginBottom: 6 }}>{vc.label}</div>
                <div style={{ fontSize: 14, color: "#111", lineHeight: 1.7 }}>{r.verdictSummary}</div>
              </div>

              {/* Scores */}
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 14 }}>Dimension Scores</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 28 }}>
                {r.scores.map((s, i) => {
                  const c = sc(s.score);
                  return (
                    <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, borderTop: `3px solid ${c.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 9 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111", lineHeight: 1.3 }}>{s.dimension}</div>
                        <span style={{ background: c.badge, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.06em" }}>
                          {c.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, lineHeight: 1.5 }}>{s.finding}</div>
                      {s.signal && <div style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic", marginBottom: 7 }}>{s.signal}</div>}
                      <div style={{ fontSize: 11, borderTop: "1px solid #f3f4f6", paddingTop: 8, color: "#6b7280", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 500, color: "#111" }}>Next: </span>{s.recommendation}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Strengths + Risks */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 28 }}>
                {[["Top Strengths", "#16a34a", r.topStrengths], ["Top Risks", "#dc2626", r.topRisks]].map(([title, color, items]) => (
                  <div key={title} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>{title}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(items || []).map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 7 }} />
                          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{item}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Market Intel */}
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>Market Intelligence</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 11 }}>
                {[
                  ["Market Size", r.marketSizeSignal],
                  ["Pricing Benchmark", r.pricingBenchmark],
                  ["Named Competitors", (r.competitorsFound || []).join(", ")],
                ].map(([label, val]) => (
                  <div key={label} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fff" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
