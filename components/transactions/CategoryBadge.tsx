import { Badge } from '@/components/ui/badge';

interface CategoryBadgeProps {
  name?: string | null;
  color?: string | null;
}

export function CategoryBadge({ name, color }: CategoryBadgeProps) {
  if (!name) {
    return <Badge className="bg-gray-100 text-gray-600">Sem categoria</Badge>;
  }

  return (
    <Badge className="text-white" style={{ backgroundColor: color ?? '#6b7280' }}>
      {name}
    </Badge>
  );
}
