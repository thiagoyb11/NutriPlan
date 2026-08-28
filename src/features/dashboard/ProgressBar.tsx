import { format, type MacroDefinition } from "../../constants";

export default function ProgressBar({
  macro,
  amount,
  goal,
}: {
  macro: MacroDefinition;
  amount: number;
  goal: number;
}) {
  const percent = goal > 0 ? (amount / goal) * 100 : 0;
  const state = percent < 50 ? "low" : percent < 80 ? "medium" : "good";
  return (
    <div className="macro-progress">
      <div className="macro-progress-label">
        <span>{macro.label}</span>
        <span>
          {goal > 0
            ? `${format(amount)} / ${format(goal)} ${macro.unit} · ${Math.round(percent)}%`
            : `${format(amount)} ${macro.unit} · sin objetivo`}
        </span>
      </div>
      <div
        className="macro-progress-track"
        role="progressbar"
        aria-label={`${macro.label}: ${Math.round(percent)}% del objetivo`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(Math.round(percent), 100)}
      >
        <div
          className={`macro-progress-fill ${state}`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
