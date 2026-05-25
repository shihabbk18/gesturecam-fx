import { Download, Sparkles } from "lucide-react";
import { ConfidenceMeter } from "./ConfidenceMeter.jsx";
import { reportUrl } from "../lib/api.js";

export function ResultPanel({ result }) {
  if (!result) {
    return (
      <section className="emptyState">
        <Sparkles size={32} />
        <h2>Run a scan to see the verdict</h2>
        <p>Results include confidence, probability breakdown, metrics, and highlighted text signals.</p>
      </section>
    );
  }

  return (
    <section className="resultPanel">
      <div className="resultTop">
        <div>
          <span className="eyebrow">{result.kind} analysis</span>
          <h2>{result.label}</h2>
        </div>
        <a className="iconButton" href={reportUrl(result.id)} title="Download PDF report">
          <Download size={18} />
        </a>
      </div>

      <ConfidenceMeter value={result.confidence} />

      <div className="breakdown">
        <Probability label="AI" value={result.breakdown.ai} />
        <Probability label="Human" value={result.breakdown.human} />
        <Probability label="GPT-style" value={result.breakdown.gpt_style} />
        <Probability label="Claude-style" value={result.breakdown.claude_style} />
      </div>

      <div className="details">
        <h3>Explanation</h3>
        {result.explanation.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>

      {result.highlights?.length > 0 && (
        <div className="details">
          <h3>Highlighted Signals</h3>
          {result.highlights.map((item) => (
            <blockquote key={item.text}>
              {item.text}
              <span>{item.reason}</span>
            </blockquote>
          ))}
        </div>
      )}
    </section>
  );
}

function Probability({ label, value }) {
  return (
    <div className="probability">
      <span>{label}</span>
      <strong>{value}%</strong>
    </div>
  );
}
