function ArrowUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path d="M5 1.5 L5 8.5 M2 4.5 L5 1.5 L8 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path d="M5 8.5 L5 1.5 M2 5.5 L5 8.5 L8 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

export function ChangeIndicator({
  change,
  isNew,
  compact = false,
}: {
  change: number | null;
  isNew: boolean;
  compact?: boolean;
}) {
  if (isNew) {
    return <span className={compact ? "change-mini new" : "badge badge-new"}>naujas</span>;
  }
  if (change == null) {
    return <span className={compact ? "change-mini flat" : "muted-dash"}>—</span>;
  }
  if (change > 0) {
    return (
      <span className={compact ? "change-mini up" : "badge badge-up"}>
        <ArrowUp />
        {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className={compact ? "change-mini down" : "badge badge-down"}>
        <ArrowDown />
        {Math.abs(change)}
      </span>
    );
  }
  // Same place as previous stage — don't show "0" (looks like 0 points).
  return <span className={compact ? "change-mini flat" : "muted-dash"}>=</span>;
}
