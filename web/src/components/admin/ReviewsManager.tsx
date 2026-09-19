import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, MessageSquare, Star, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { useAdminReviews } from '@/hooks/useAdmin';
import { useNavigate } from 'react-router-dom';

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-3.5 w-3.5',
            star <= value
              ? 'fill-amber-400 text-amber-400'
              : 'fill-none text-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}

export function ReviewsManager() {
  const [page, setPage] = useState(1);
  const { reviews, total, totalPages, isLoading, updateStatus, isUpdating } = useAdminReviews(page);
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            Reviews ({total})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Rating</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Review</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr key={review.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="min-w-0 flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {review.user?.avatar_url ? (
                              <img
                                src={review.user.avatar_url}
                                alt={review.user.full_name || ''}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {review.user?.full_name || 'Anonymous'}
                            </p>
                            {review.booking_id && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                <ShieldCheck className="h-2.5 w-2.5" />
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => review.deal?.slug && navigate(`/deals/${review.deal.slug}`)}
                          className="text-sm font-medium text-primary hover:underline truncate max-w-[150px] block"
                        >
                          {review.deal?.title || 'Unknown deal'}
                        </button>
                      </td>
                      <td className="py-3 px-3 hidden sm:table-cell">
                        <StarDisplay value={review.rating} />
                      </td>
                      <td className="py-3 px-3 hidden md:table-cell">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{review.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{review.body}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground hidden md:table-cell">
                        {formatDate(review.created_at)}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          className={cn(
                            'text-xs',
                            review.is_approved
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700',
                          )}
                        >
                          {review.is_approved ? 'Approved' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant={review.is_approved ? 'outline' : 'default'}
                            size="sm"
                            className="h-8 text-xs"
                            disabled={isUpdating}
                            onClick={() =>
                              updateStatus({ id: review.id, is_approved: !review.is_approved })
                            }
                          >
                            {review.is_approved ? 'Reject' : 'Approve'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
