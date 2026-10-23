import { useQuery } from '@tanstack/react-query';
import { AnimatedTestimonials, type Testimonial } from '@/components/ui/testimonial';
import { api } from '@/lib/api';
import { TestimonialsSkeleton } from '@/components/skeletons/TestimonialsSkeleton';
import type { Review } from '@/types';

function reviewToTestimonial(review: Review): Testimonial {
  const user = review.user;
  const fullName = user?.full_name || 'Anonymous Traveler';
  const initial = fullName.charAt(0).toUpperCase();

  // A transparent portrait keeps the frosted panel visible instead of dropping
  // an opaque white placeholder into the middle of the glass card.
  const fallbackPortrait = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="220" fill="rgba(100,116,139,0.5)">${initial.replace(/[<>&"']/g, '')}</text></svg>`,
  )}`;

  return {
    quote: review.body,
    name: fullName,
    designation: review.booking_id ? 'Verified Traveler' : 'Traveler',
    src: user?.avatar_url || fallbackPortrait,
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

  if (isLoading) {
    return <TestimonialsSkeleton />;
  }

  if (testimonials.length === 0) {
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
