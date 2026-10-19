interface RerollButtonProps {
  onReroll: () => void;
  disabled: boolean;
}

export default function RerollButton({ onReroll, disabled }: RerollButtonProps) {
  return (
    <button
      onClick={onReroll}
      disabled={disabled}
      className="w-full bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {disabled ? "Loading more articles..." : "Reroll (Show 3 Different Articles)"}
    </button>
  );
}
