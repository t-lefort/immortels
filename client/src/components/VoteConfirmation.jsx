/**
 * Modal confirmation dialog before submitting a vote.
 * "Voter pour [name] ?" with Confirmer / Annuler buttons.
 */
export default function VoteConfirmation({ targetName, onConfirm, onCancel, actionLabel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full text-center">
        <p className="text-white text-lg mb-6">
          {actionLabel || 'Voter pour'}{' '}
          <span className="font-bold text-yellow-400">{targetName}</span> ?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-lg bg-gray-700 text-gray-300 font-medium text-base
                       active:bg-gray-600 transition-colors min-h-[48px]"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-lg bg-gray-600 text-white font-bold text-base
                       active:bg-gray-700 transition-colors min-h-[48px]"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
