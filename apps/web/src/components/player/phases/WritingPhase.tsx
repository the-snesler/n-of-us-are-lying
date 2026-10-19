import { useState } from "react";
import type { Article } from "@nofus/shared";
import SubmissionConfirm from "../components/SubmissionConfirm";
import ResearchProgressHeader from "../components/ResearchProgressHeader";
import { getDraft, setDraft } from "../../../lib/session";

interface WritingPhaseProps {
  roomCode: string;
  currentArticle?: Article;
  hasSubmitted: boolean;
  progress?: { completed: number; total: number };
  onSubmitSummary: (summary: string) => void;
}

export default function WritingPhase({
  roomCode,
  currentArticle,
  hasSubmitted,
  progress,
  onSubmitSummary,
}: WritingPhaseProps) {
  // Drafts survive leaving the page to read the article
  const [summary, setSummaryState] = useState(() =>
    currentArticle ? getDraft(roomCode, currentArticle.id) : "",
  );
  const MAX_CHARS = 50;

  const setSummary = (text: string) => {
    setSummaryState(text);
    if (currentArticle) setDraft(roomCode, currentArticle.id, text);
  };

  if (hasSubmitted) {
    return (
      <SubmissionConfirm
        message="All summaries submitted!"
        subtext="Waiting for other players..."
      />
    );
  }

  if (!currentArticle) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Loading article...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ResearchProgressHeader progress={progress} />
      <h2 className="text-xl font-bold text-white text-center">
        {currentArticle.title}
      </h2>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 max-h-48 overflow-y-auto">
        <p className="text-gray-300 text-sm leading-relaxed">
          {currentArticle.extract}
        </p>
      </div>

      <a
        href={currentArticle.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 text-xs text-right block -mt-2"
      >
        View full article on Wikipedia ↗
      </a>

      <div className="flex flex-col gap-2">
        <label htmlFor="summary" className="text-sm font-medium text-gray-400">
          Write a short summary (max {MAX_CHARS} characters):
        </label>
        <textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value.slice(0, MAX_CHARS))}
          className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none h-24"
          placeholder="What is this about?"
        />
        <div className="flex justify-end">
          <span
            className={`text-xs ${summary.length === MAX_CHARS ? "text-red-400" : "text-gray-500"}`}
          >
            {summary.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      <button
        onClick={() => {
          onSubmitSummary(summary.trim());
          setDraft(roomCode, currentArticle.id, "");
        }}
        disabled={!summary.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
      >
        Submit Summary
      </button>
    </div>
  );
}
