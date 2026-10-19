interface RoundProgressProps {
  current: number;
  total: number;
  size?: 'sm' | 'lg';
}

export default function RoundProgress({ current, total, size = 'sm' }: RoundProgressProps) {
  const sizeClasses = {
    sm: 'text-xs',
    lg: 'text-lg',
  };
  const isFinal = current === total;

  return (
    <span
      className={`${sizeClasses[size]} font-semibold uppercase tracking-wider ${isFinal ? "text-yellow-400" : "text-gray-400"}`}
    >
      {isFinal
        ? "Final round!"
        : `Round ${current} of ${total} · ${total - current} left`}
    </span>
  );
}
