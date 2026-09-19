import { DealCard } from './DealCard';
import { SaveDealButton } from './SaveDealButton';
import type { TourDeal } from '@/types';

interface DealGridProps {
  deals: TourDeal[];
}

export function DealGrid({ deals }: DealGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {deals.map((deal) => (
        <DealCard
          key={deal.id}
          deal={deal}
          action={
            <SaveDealButton
              deal={deal}
              className="rounded-full bg-white/90 shadow-md backdrop-blur-sm hover:bg-white"
            />
          }
        />
      ))}
    </div>
  );
}
