'use client';
export const dynamic = 'force-dynamic';

import { Card, CardContent } from '@/components/ui/Card';

export default function VotesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-brand-cream">Awards Voting</h1>
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-brand-cream/70 mb-4">Awards voting coming soon</p>
          <p className="text-sm text-brand-cream/50">
            Vote for your fellow riders for special trip awards and achievements
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
