import express from "express";
import cors from "cors";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Serve built React app
app.use(express.static(path.join(__dirname, "client/dist")));

// Proxy route — keeps API key server-side
app.post("/api/analyze", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "interleaved-thinking-2025-05-14"
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download endpoint — generates .docx from results JSON
app.post("/api/download", async (req, res) => {
  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType } = await import("docx");

    const { offerName, date, verdictSummary, overallVerdict, scores, topStrengths, topRisks, competitorsFound, marketSizeSignal, pricingBenchmark } = req.body;

    const VERDICT_LABEL = { green: "GO — Strong Idea", yellow: "PROCEED WITH CAUTION", red: "STOP — Major Gaps" };
    const SCORE_LABEL = { green: "GREEN", yellow: "YELLOW", red: "RED" };

    const heading = (text, level = HeadingLevel.HEADING_2) => new Paragraph({
      text, heading: level,
      spacing: { before: 300, after: 100 },
    });

    const body = (text, bold = false) => new Paragraph({
      children: [new TextRun({ text, bold, size: 22, font: "Calibri" })],
      spacing: { after: 80 },
    });

    const label = (text) => new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, color: "888888", font: "Calibri" })],
      spacing: { before: 200, after: 60 },
    });

    const scoreSection = (s) => [
      new Paragraph({
        children: [
          new TextRun({ text: s.dimension, bold: true, size: 24, font: "Calibri" }),
          new TextRun({ text: `  ${SCORE_LABEL[s.score] || s.score.toUpperCase()}`, bold: true, size: 20, color: s.score === "green" ? "16a34a" : s.score === "yellow" ? "ca8a04" : "dc2626", font: "Calibri" }),
        ],
        spacing: { before: 240, after: 60 },
      }),
      body(s.finding),
      ...(s.signal ? [new Paragraph({ children: [new TextRun({ text: s.signal, italics: true, size: 20, color: "888888", font: "Calibri" })], spacing: { after: 60 } })] : []),
      new Paragraph({
        children: [new TextRun({ text: "Next: ", bold: true, size: 20, font: "Calibri" }), new TextRun({ text: s.recommendation, size: 20, font: "Calibri" })],
        spacing: { after: 80 },
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" } },
        indent: { left: 0 },
      }),
    ];

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: "Calibri", size: 22 } },
        },
      },
      sections: [{
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        children: [
          // Title block
          new Paragraph({
            children: [new TextRun({ text: "LAUNCH READINESS ASSESSMENT", size: 18, color: "999999", bold: true, font: "Calibri" })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: offerName || "Product Idea", bold: true, size: 44, font: "Calibri" })],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Pivotree GTM  ·  ", size: 18, color: "999999", font: "Calibri" }),
              new TextRun({ text: date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), size: 18, color: "999999", font: "Calibri" }),
            ],
            spacing: { after: 360 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "111111" } },
          }),

          // Verdict
          label("Overall Verdict"),
          new Paragraph({
            children: [new TextRun({ text: VERDICT_LABEL[overallVerdict] || overallVerdict?.toUpperCase() || "—", bold: true, size: 26, color: overallVerdict === "green" ? "16a34a" : overallVerdict === "yellow" ? "ca8a04" : "dc2626", font: "Calibri" })],
            spacing: { after: 100 },
          }),
          body(verdictSummary),

          // Scores
          label("Dimension Scores"),
          ...(scores || []).flatMap(scoreSection),

          // Strengths
          label("Top Strengths"),
          ...(topStrengths || []).map(s => new Paragraph({
            children: [new TextRun({ text: `• ${s}`, size: 22, font: "Calibri" })],
            spacing: { after: 80 },
            indent: { left: 360 },
          })),

          // Risks
          label("Top Risks"),
          ...(topRisks || []).map(r => new Paragraph({
            children: [new TextRun({ text: `• ${r}`, size: 22, font: "Calibri" })],
            spacing: { after: 80 },
            indent: { left: 360 },
          })),

          // Market Intel
          label("Market Intelligence"),
          new Paragraph({ children: [new TextRun({ text: "Market Size", bold: true, size: 22, font: "Calibri" })], spacing: { before: 160, after: 40 } }),
          body(marketSizeSignal || "—"),
          new Paragraph({ children: [new TextRun({ text: "Pricing Benchmark", bold: true, size: 22, font: "Calibri" })], spacing: { before: 160, after: 40 } }),
          body(pricingBenchmark || "—"),
          new Paragraph({ children: [new TextRun({ text: "Named Competitors", bold: true, size: 22, font: "Calibri" })], spacing: { before: 160, after: 40 } }),
          body((competitorsFound || []).join(", ") || "—"),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `launch-readiness-${(offerName || "report").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback to React app for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`Launch Vetter running on port ${PORT}`);
});
