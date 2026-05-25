export function ConfidenceMeter({ value = 0, label = "Confidence" }) {
  return (
    <div className="meter" aria-label={`${label}: ${value}%`}>
      <div className="meterHeader">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="meterTrack">
        <div className="meterFill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
