import type { Article } from "@nofus/shared";

interface PresentingPhaseProps {
  isExpert: boolean;
  currentArticle?: Article;
}

export default function PresentingPhase({
  isExpert,
  currentArticle,
}: PresentingPhaseProps) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <div className="bg-blue-900/20 border border-blue-500/50 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-white mb-4">
          {isExpert ? "Time to Shine!" : "Defend Your Lie!"}
        </h2>
        <p className="text-gray-300">
          The host is displaying all summaries. When it's your turn, explain why
          yours is the truth!
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
          Your Summary:
        </p>
        <p className="text-xl italic text-white leading-relaxed">
          "{currentArticle?.summary}"
        </p>
      </div>

      {isExpert && (
        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-2">QUICK REFERENCE:</p>
          <p className="text-sm text-gray-300 line-clamp-4">
            {currentArticle?.extract}
          </p>
        </div>
      )}
    </div>
  );
}
