import { useQuery } from '@tanstack/react-query';
import { AnimatedTestimonials, type Testimonial } from '@/components/ui/testimonial';
import { api } from '@/lib/api';
import type { Review } from '@/types';

function reviewToTestimonial(review: Review): Testimonial {
  const user = review.user;
  const fullName = user?.full_name || 'Anonymous Traveler';
  const initial = fullName.charAt(0).toUpperCase();

  return {
    quote: review.body,
    name: fullName,
    designation: review.booking_id ? 'Verified Traveler' : 'Traveler',
    src:
      user?.avatar_url ||
      `https://placehold.co/500x500/e2e8f0/64748b?text=${initial}`,
    rating: review.rating,
  };
}

/**
 * Fetches the latest approved reviews and renders them as animated
 * testimonials. Returns null when there are no reviews to show.
 */
export function AnimatedReviews() {
  const { data, isLoading } = useQuery({
    queryKey: ['featured-reviews'],
    queryFn: () => api.getFeaturedReviews(10),
  });

  const testimonials = (data?.reviews || []).map(reviewToTestimonial);

  if (isLoading || testimonials.length === 0) {
    return null;
  }

  return (
    <section className="py-16">
      <div className="site-container">
        <div className="text-center mb-4">
          <h2 className="text-3xl font-bold text-primary mb-4">What Our Travelers Say</h2>
          <p className="text-muted-foreground">Real experiences from real adventurers</p>
        </div>
        <AnimatedTestimonials testimonials={testimonials} />
      </div>
    </section>
  );
}
