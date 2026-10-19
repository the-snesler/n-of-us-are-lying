interface AnswerTextProps {
  text?: string;
}

/** A quoted answer, or a placeholder for players who didn't submit one */
export default function AnswerText({ text }: AnswerTextProps) {
  if (!text) {
    return <span className="not-italic text-gray-500">[no response]</span>;
  }
  return <>"{text}"</>;
}
