import { Card, Spinner } from "@heroui/react";

type LoadingBlockProps = {
  label?: string;
};

export function LoadingBlock({ label = "読み込み中..." }: LoadingBlockProps) {
  return (
    <Card className="border border-dashed border-line bg-white/75">
      <Card.Content className="items-center gap-3 py-8">
        <Spinner color="accent" size="sm" />
        <p className="text-sm font-semibold text-stone-600">{label}</p>
      </Card.Content>
    </Card>
  );
}
