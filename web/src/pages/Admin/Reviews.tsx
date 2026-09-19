import { ReviewsManager } from '@/components/admin/ReviewsManager';
import { AdminNav } from '@/components/admin/AdminNav';
import { MessageSquare } from 'lucide-react';

export default function AdminReviews() {
  return (
    <div className="px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
            <p className="text-sm text-muted-foreground">Moderate user reviews</p>
          </div>
        </div>
        <AdminNav />
      </div>
      <ReviewsManager />
    </div>
  );
}
