interface ResearchProgressHeaderProps {
  progress?: { completed: number; total: number };
}

export default function ResearchProgressHeader({ progress }: ResearchProgressHeaderProps) {
  if (!progress) return null;

  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-sm text-gray-400 whitespace-nowrap">
        {progress.completed}/{progress.total} summaries
      </span>
      <div className="flex gap-1 flex-1">
        {Array.from({ length: progress.total }, (_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full ${
              i < progress.completed
                ? "bg-green-500"
                : i === progress.completed
                  ? "bg-yellow-400"
                  : "bg-gray-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
