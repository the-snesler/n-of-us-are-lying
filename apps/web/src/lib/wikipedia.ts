import type { Article } from "@nofus/shared";

interface WikipediaApiResponse {
  type: string;
  title: string;
  extract: string;
  content_urls: {
    desktop: {
      page: string;
    };
  };
  pageid: number;
}

const WIKIPEDIA_API_BASE = "https://en.wikipedia.org/api/rest_v1";
const MIN_EXTRACT_LENGTH = 200;
const MAX_RETRIES = 3;

/**
 * Checks if an article meets quality criteria
 */
function isQualityArticle(response: WikipediaApiResponse): boolean {
  // Exclude disambiguation pages
  if (
    response.title.toLowerCase().includes("disambiguation") ||
    response.extract.toLowerCase().includes("may refer to")
  ) {
    return false;
  }

  // Exclude stubs (articles with very short extracts)
  if (response.extract.length < MIN_EXTRACT_LENGTH) {
    return false;
  }

  return true;
}

/**
 * Fetches a single random Wikipedia article with retry logic
 */
async function fetchRandomArticle(
  retryCount = 0
): Promise<WikipediaApiResponse> {
  try {
    const response = await fetch(`${WIKIPEDIA_API_BASE}/page/random/summary`);

    if (!response.ok) {
      throw new Error(`Wikipedia API returned ${response.status}`);
    }

    const data: WikipediaApiResponse = await response.json();
    return data;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.warn(
        `Failed to fetch article, retrying (${retryCount + 1}/${MAX_RETRIES})...`,
        error
      );
      // Add a small delay before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
      return fetchRandomArticle(retryCount + 1);
    }
    throw error;
  }
}

/**
 * Fetches a single quality random article
 * Keeps fetching until we get one that passes quality checks
 */
async function fetchQualityArticle(): Promise<Article> {
  let attempts = 0;
  const maxAttempts = 20; // Prevent infinite loops

  while (attempts < maxAttempts) {
    const article = await fetchRandomArticle();

    if (isQualityArticle(article)) {
      return {
        id: article.pageid.toString(),
        title: article.title,
        url: article.content_urls.desktop.page,
        extract: article.extract,
        summary: "", // Will be filled by player during writing phase
      };
    }

    attempts++;
  }

  throw new Error("Failed to fetch quality article after maximum attempts");
}

/**
 * Fetches multiple quality articles for a player
 */
export async function fetchArticlesForPlayer(count: number): Promise<Article[]> {
  const promises = Array.from({ length: count }, () => fetchQualityArticle());
  
  const results = await Promise.allSettled(promises);
  
  const articles = results
    .filter((result): result is PromiseFulfilledResult<Article> => result.status === 'fulfilled')
    .map(result => result.value);

  if (articles.length === 0) {
    throw new Error("Failed to fetch any articles");
  }

  return articles;
}

/**
 * Parses user input (a Wikipedia URL or a plain article title) into a
 * language code and page title.
 */
function parseArticleInput(input: string): { lang: string; title: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const hostMatch = url.hostname.match(/^([a-z-]+)\.(?:m\.)?wikipedia\.org$/i);
    if (hostMatch) {
      const lang = hostMatch[1].toLowerCase() === "www" ? "en" : hostMatch[1].toLowerCase();
      // /wiki/Title or /w/index.php?title=Title
      const pathMatch = url.pathname.match(/^\/wiki\/(.+)$/);
      const rawTitle = pathMatch?.[1] ?? url.searchParams.get("title");
      if (!rawTitle) return null;
      return { lang, title: decodeURIComponent(rawTitle).replace(/_/g, " ") };
    }
    if (trimmed.includes("://")) return null; // A URL, but not Wikipedia
  } catch {
    // Not a URL, treat as a title
  }

  return { lang: "en", title: trimmed };
}

/**
 * Looks up a specific Wikipedia article from a URL or title entered by a player.
 * Throws an Error with a user-facing message if the article can't be used.
 */
export async function fetchArticleFromInput(input: string): Promise<Article> {
  const parsed = parseArticleInput(input);
  if (!parsed) {
    throw new Error("Enter a Wikipedia link or article title");
  }

  const apiBase =
    parsed.lang === "en"
      ? WIKIPEDIA_API_BASE
      : `https://${parsed.lang}.wikipedia.org/api/rest_v1`;
  const encodedTitle = encodeURIComponent(parsed.title.replace(/ /g, "_"));

  let response: Response;
  try {
    response = await fetch(`${apiBase}/page/summary/${encodedTitle}`);
  } catch {
    throw new Error("Couldn't reach Wikipedia, try again");
  }

  if (response.status === 404) {
    throw new Error(`No Wikipedia article found for "${parsed.title}"`);
  }
  if (!response.ok) {
    throw new Error("Couldn't load that article, try again");
  }

  const data: WikipediaApiResponse = await response.json();
  if (data.type === "disambiguation") {
    throw new Error(`"${data.title}" is a disambiguation page, pick a more specific article`);
  }
  if (data.type !== "standard" || !data.pageid) {
    throw new Error("That page isn't a regular Wikipedia article");
  }

  return {
    id: parsed.lang === "en" ? data.pageid.toString() : `${parsed.lang}:${data.pageid}`,
    title: data.title,
    url: data.content_urls.desktop.page,
    extract: data.extract,
    summary: "",
  };
}
