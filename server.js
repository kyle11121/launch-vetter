import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "client/dist")));

// Proxy — keeps API key server-side
app.post("/api/analyze", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download — generates .docx with sources
app.post("/api/download", async (req, res) => {
  try {
    const {
      Document, Packer, Paragraph, TextRun, HeadingLevel,
      BorderStyle, ExternalHyperlink, UnderlineType
    } = await import("docx");

    const {
      offerName, date, verdictSummary, overallVerdict,
      scores, topStrengths, topRisks, competitorsFound,
      marketSizeSignal, pricingBenchmark, sources
    } = req.body;

    const VERDICT_LABEL = {
      green: "GO — Strong Idea",
      yellow: "PROCEED WITH CAUTION",
      red: "STOP — Major Gaps"
    };
    const SCORE_COLOR = {
      green: "16a34a",
      yellow: "ca8a04",
      red: "dc2626"
    };

    const sectionLabel = (text) => new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, color: "888888", font: "Calibri" })],
      spacing: { before: 320, after: 80 },
    });

    const bodyPara = (text) => new Paragraph({
      children: [new TextRun({ text: text || "—", size: 22, font: "Calibri" })],
      spacing: { after: 100 },
    });

    const scoreSection = (s) => {
      const color = SCORE_COLOR[s.score] || "dc2626";
      const label = (s.score || "").toUpperCase();
      return [
        new Paragraph({
          children: [
            new TextRun({ text: s.dimension, bold: true, size: 24, font: "Calibri" }),
            new TextRun({ text: "  " }),
            new TextRun({ text: `[${label}]`, bold: true, size: 20, color, font: "Calibri" }),
          ],
          spacing: { before: 260, after: 80 },
        }),
        bodyPara(s.finding),
        ...(s.signal ? [new Paragraph({
          children: [new TextRun({ text: s.signal, italics: true, size: 20, color: "888888", font: "Calibri" })],
          spacing: { after: 80 },
        })] : []),
        new Paragraph({
          children: [
            new TextRun({ text: "Next: ", bold: true, size: 20, font: "Calibri" }),
            new TextRun({ text: s.recommendation || "", size: 20, font: "Calibri" }),
          ],
          spacing: { after: 100 },
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: "e5e7eb" } },
        }),
      ];
    };

    const sourceItems = (sources || []).map((src, i) => {
      const linkRun = new ExternalHyperlink({
        link: src.url,
        children: [
          new TextRun({
            text: src.title || src.url,
            style: "Hyperlink",
            size: 20,
            font: "Calibri",
            color: "2563eb",
            underline: { type: UnderlineType.SINGLE },
          }),
        ],
      });
      return new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 20, font: "Calibri" }),
          linkRun,
          new TextRun({ text: src.supports ? `  —  ${src.supports}` : "", size: 18, color: "888888", font: "Calibri" }),
        ],
        spacing: { after: 100 },
        indent: { left: 360 },
      });
    });

    const verdictColor = SCORE_COLOR[overallVerdict] || "dc2626";

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        children: [
          // Header
          new Paragraph({
            children: [new TextRun({ text: "LAUNCH READINESS ASSESSMENT", size: 18, color: "aaaaaa", bold: true, font: "Calibri" })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: offerName || "Product Idea", bold: true, size: 48, font: "Calibri" })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Pivotree GTM  ·  ", size: 18, color: "999999", font: "Calibri" }),
              new TextRun({ text: date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), size: 18, color: "999999", font: "Calibri" }),
            ],
            spacing: { after: 400 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "111111" } },
          }),

          // Verdict
          sectionLabel("Overall Verdict"),
          new Paragraph({
            children: [new TextRun({ text: VERDICT_LABEL[overallVerdict] || (overallVerdict || "").toUpperCase(), bold: true, size: 28, color: verdictColor, font: "Calibri" })],
            spacing: { after: 120 },
          }),
          bodyPara(verdictSummary),

          // Scores
          sectionLabel("Dimension Scores"),
          ...(scores || []).flatMap(scoreSection),

          // Strengths
          sectionLabel("Top Strengths"),
          ...(topStrengths || []).map(s => new Paragraph({
            children: [new TextRun({ text: `•  ${s}`, size: 22, font: "Calibri" })],
            spacing: { after: 80 },
            indent: { left: 360 },
          })),

          // Risks
          sectionLabel("Top Risks"),
          ...(topRisks || []).map(r => new Paragraph({
            children: [new TextRun({ text: `•  ${r}`, size: 22, font: "Calibri" })],
            spacing: { after: 80 },
            indent: { left: 360 },
          })),

          // Market Intel
          sectionLabel("Market Intelligence"),
          new Paragraph({ children: [new TextRun({ text: "Market Size", bold: true, size: 22, font: "Calibri" })], spacing: { before: 160, after: 60 } }),
          bodyPara(marketSizeSignal),
          new Paragraph({ children: [new TextRun({ text: "Pricing Benchmark", bold: true, size: 22, font: "Calibri" })], spacing: { before: 160, after: 60 } }),
          bodyPara(pricingBenchmark),
          new Paragraph({ children: [new TextRun({ text: "Named Competitors", bold: true, size: 22, font: "Calibri" })], spacing: { before: 160, after: 60 } }),
          bodyPara((competitorsFound || []).join(", ")),

          // Sources
          ...(sources && sources.length > 0 ? [
            sectionLabel("Sources"),
            new Paragraph({
              children: [new TextRun({ text: "All findings sourced from live web research conducted during this analysis.", size: 18, color: "888888", italics: true, font: "Calibri" })],
              spacing: { after: 120 },
            }),
            ...sourceItems,
          ] : []),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const slug = (offerName || "report").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const filename = `launch-readiness-${slug}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`Launch Vetter running on port ${PORT}`);
});
