type LoadingBlockProps = {
  label?: string;
};

export function LoadingBlock({ label = "読み込み中..." }: LoadingBlockProps) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center">
      <p className="text-sm font-semibold text-stone-600">{label}</p>
    </div>
  );
}
