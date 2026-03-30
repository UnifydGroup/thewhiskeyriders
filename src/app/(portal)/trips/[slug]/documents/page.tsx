'use client';

import { Card, CardContent } from '@/components/ui/Card';

export default function DocumentsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-brand-cream">Travel Documents</h1>
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-brand-cream/70 mb-4">Travel documents coming soon</p>
          <p className="text-sm text-brand-cream/50">
            Visa requirements, travel insurance, and other documents will be shared here
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
