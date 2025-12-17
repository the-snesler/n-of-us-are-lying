export default function RevealPhase() {
  return (
    <div className="flex flex-col gap-6 text-center">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-white mb-2">The Results!</h2>
        <p className="text-gray-400">
          Look at the big screen to see who was telling the truth and who got
          fooled!
        </p>
      </div>

      <div className="flex justify-center">
        <div className="animate-bounce bg-blue-600 p-4 rounded-full shadow-lg">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
