import type { Article } from "@nofus/shared";
import ArticleList from "../components/ArticleList";
import RerollButton from "../components/RerollButton";
import SubmissionConfirm from "../components/SubmissionConfirm";
import CustomArticleForm from "../components/CustomArticleForm";
import ResearchProgressHeader from "../components/ResearchProgressHeader";

interface TopicSelectionPhaseProps {
  articleOptions: Article[];
  hasSubmitted: boolean;
  canReroll: boolean;
  progress?: { completed: number; total: number };
  onChooseArticle: (articleId: string) => void;
  onChooseCustomArticle: (article: Article) => void;
  onReroll: () => void;
}

export default function TopicSelectionPhase({
  articleOptions,
  hasSubmitted,
  canReroll,
  progress,
  onChooseArticle,
  onChooseCustomArticle,
  onReroll
}: TopicSelectionPhaseProps) {
  if (hasSubmitted) {
    return (
      <SubmissionConfirm
        message="Article selected!"
        subtext="Loading your article..."
      />
    );
  }

  // The host only sends the current page of options
  const articlesToShow = articleOptions;

  return (
    <>
      <ResearchProgressHeader progress={progress} />
      <h2 className="text-lg font-semibold text-white mb-4">
        Choose {progress ? `Article ${progress.completed + 1}` : "an Article"}
      </h2>

      {articlesToShow.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">Loading articles...</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <ArticleList
              articles={articlesToShow}
              onSelectArticle={onChooseArticle}
            />
          </div>

          <RerollButton onReroll={onReroll} disabled={!canReroll} />
        </>
      )}

      <CustomArticleForm onChoose={onChooseCustomArticle} />
    </>
  );
}
