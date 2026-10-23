import { Card, CardContent } from '@/components/ui/card';
import { getTierColor, getTierProgress, formatCurrency } from '@/lib/utils';
import type { ProfileStats } from '@/types';

interface StatsCardsProps {
  stats: ProfileStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const tierInfo = getTierProgress(stats.pearls);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Tours */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">{stats.totalTours}</p>
            <p className="text-muted-foreground">Total Tours</p>
          </div>
        </CardContent>
      </Card>

      {/* Pearls */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">🐚 {stats.pearls}</p>
            <p className="text-muted-foreground">Pearls</p>
            {tierInfo.next && (
              <div className="mt-2">
                <div className="glass-chip w-full rounded-full h-2">
                  <div
                    className="glass-primary h-2 rounded-full"
                    style={{ width: `${tierInfo.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tierInfo.needed} more to {tierInfo.next}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className={`inline-block rounded-full px-3 py-1 text-2xl font-bold ${getTierColor(stats.status)}`}>
              {stats.status.charAt(0).toUpperCase() + stats.status.slice(1)}
            </p>
            <p className="text-muted-foreground">Status</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tierInfo.current} Tier
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
