import { useState } from "react";
import type { Article } from "@nofus/shared";
import SubmissionConfirm from "../components/SubmissionConfirm";

interface GuessingPhaseProps {
  articleTitle?: string;
  currentArticle?: Article; // Only provided to the expert
  isExpert: boolean;
  hasSubmitted: boolean;
  onSubmitLie: (text: string) => void;
}

export default function GuessingPhase({
  articleTitle,
  currentArticle,
  isExpert,
  hasSubmitted,
  onSubmitLie,
}: GuessingPhaseProps) {
  const [lie, setLie] = useState("");
  const MAX_CHARS = 50;

  if (isExpert) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            You are the EXPERT!
          </h2>
          <p className="text-blue-200 text-sm">
            Refresh your memory on the topic. The others are writing lies!
          </p>
        </div>

        <h3 className="text-lg font-bold text-white text-center">
          {currentArticle?.title}
        </h3>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 max-h-64 overflow-y-auto">
          <p className="text-gray-300 text-sm leading-relaxed">
            {currentArticle?.extract}
          </p>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1 font-medium uppercase">
            Your Summary:
          </p>
          <p className="text-white italic">"{currentArticle?.summary}"</p>
        </div>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <SubmissionConfirm
        message="Lie submitted!"
        subtext="Wait for the presentations..."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-1">
          The Topic is:
        </h2>
        <h3 className="text-2xl font-bold text-white leading-tight">
          {articleTitle}
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="lie" className="text-sm font-medium text-gray-400">
          Write a believable summary (max {MAX_CHARS} characters):
        </label>
        <textarea
          id="lie"
          value={lie}
          onChange={(e) => setLie(e.target.value.slice(0, MAX_CHARS))}
          className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none h-24"
          placeholder="Make them believe you..."
        />
        <div className="flex justify-end">
          <span
            className={`text-xs ${lie.length === MAX_CHARS ? "text-red-400" : "text-gray-500"}`}
          >
            {lie.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      <button
        onClick={() => onSubmitLie(lie)}
        disabled={!lie.trim()}
        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-lg shadow-red-900/20"
      >
        Submit Lie
      </button>
    </div>
  );
}
