'use client';
export const dynamic = 'force-dynamic';

import { Card, CardContent } from '@/components/ui/Card';

export default function PaymentsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-brand-cream">Payment Status</h1>
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-brand-cream/70 mb-4">Payment tracking coming soon</p>
          <p className="text-sm text-brand-cream/50">
            View your payment status, amounts due, and transaction history here
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
