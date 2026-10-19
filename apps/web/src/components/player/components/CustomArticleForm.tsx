import { useState } from "react";
import type { Article } from "@nofus/shared";
import { fetchArticleFromInput } from "../../../lib/wikipedia";

interface CustomArticleFormProps {
  onChoose: (article: Article) => void;
}

export default function CustomArticleForm({ onChoose }: CustomArticleFormProps) {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await fetchArticleFromInput(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't find that article");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-t border-gray-700 pt-4 mt-4">
      <h3 className="text-white font-semibold mb-1">Or use your own article</h3>
      <p className="text-gray-400 text-sm mb-3">
        Paste a Wikipedia link or type an article title.
      </p>
      <form onSubmit={handleLookup} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          placeholder="en.wikipedia.org/wiki/..."
          className="flex-1 min-w-0 bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:border-blue-500 outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white font-medium py-2 px-4 rounded"
        >
          {isLoading ? "..." : "Find"}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

      {preview && (
        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 mt-3">
          <h3 className="text-white font-semibold mb-2">{preview.title}</h3>
          <p className="text-gray-300 text-sm mb-3 line-clamp-3">
            {preview.extract}
          </p>
          <button
            onClick={() => onChoose(preview)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Choose This Article
          </button>
        </div>
      )}
    </div>
  );
}
