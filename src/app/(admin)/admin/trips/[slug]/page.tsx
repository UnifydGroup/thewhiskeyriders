'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import type { Trip } from '@/lib/types/database';

export default function EditTripPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const slug = params.slug as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    country: '',
    start_date: '',
    end_date: '',
    description: '',
    status: 'upcoming' as Trip['status'],
    max_members: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTrip = async () => {
      try {
        const { data } = await supabase
          .from('trips')
          .select('*')
          .eq('slug', slug)
          .single();

        if (!data) {
          router.push('/admin/trips');
          return;
        }

        setTrip(data);
        setFormData({
          name: data.name,
          destination: data.destination,
          country: data.country,
          start_date: data.start_date,
          end_date: data.end_date,
          description: data.description || '',
          status: data.status,
          max_members: data.max_members?.toString() || '',
        });
      } catch (err) {
        console.error('Failed to load trip:', err);
        router.push('/admin/trips');
      } finally {
        setIsLoading(false);
      }
    };

    loadTrip();
  }, [slug, supabase, router]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    setIsSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('trips')
        .update({
          name: formData.name,
          destination: formData.destination,
          country: formData.country,
          start_date: formData.start_date,
          end_date: formData.end_date,
          description: formData.description || null,
          status: formData.status,
          max_members: formData.max_members ? parseInt(formData.max_members) : null,
        })
        .eq('id', trip.id);

      if (updateError) throw updateError;

      router.push('/admin/trips');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trip');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-brand-cream">Trip not found</h1>
        <Link href="/admin/trips">
          <Button variant="primary">Back to Trips</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/admin/trips" className="text-brand-brown hover:text-brand-tan transition-colors mb-4 inline-block">
          ← Back to Trips
        </Link>
        <h1 className="text-3xl font-bold text-brand-cream mb-2">Edit Trip</h1>
        <p className="text-brand-cream/70">{formData.name}</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Trip Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-100 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Trip Name
                </label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Country
                </label>
                <Input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Destination
                </label>
                <Input
                  type="text"
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Max Members
                </label>
                <Input
                  type="number"
                  name="max_members"
                  value={formData.max_members}
                  onChange={handleChange}
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Start Date
                </label>
                <Input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  End Date
                </label>
                <Input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Status
                </label>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={isSaving}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-cream mb-2">
                Description
              </label>
              <TextArea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                disabled={isSaving}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-brand-brown/20">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSaving}
              >
                Save Changes
              </Button>
              <Link href="/admin/trips">
                <Button type="button" variant="ghost" size="md">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
