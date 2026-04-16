'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, TextArea, Select } from '@/components/ui/Input';
import { slugify } from '@/lib/utils';
import Link from 'next/link';
export default function NewTripPage() {
  const router = useRouter();
  const supabase = createClient();
  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    country: '',
    country_code: '',
    latitude: '',
    longitude: '',
    countdown_enabled: false,
    countdown_target_at: '',
    start_date: '',
    end_date: '',
    description: '',
    itinerary: '',
    status: 'upcoming' as 'upcoming' | 'active' | 'completed' | 'cancelled',
    max_members: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name } = e.target;
    const value =
      e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
        ? e.target.checked
        : e.target.value;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const slug = slugify(formData.name);
      const { error: insertError } = await supabase
        .from('trips')
        .insert({
          name: formData.name,
          slug,
          destination: formData.destination,
          country: formData.country,
          country_code: formData.country_code.toUpperCase() || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          countdown_enabled: formData.countdown_enabled,
          countdown_target_at: formData.countdown_target_at
            ? new Date(formData.countdown_target_at).toISOString()
            : null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          description: formData.description || null,
          itinerary: formData.itinerary || null,
          status: formData.status,
          max_members: formData.max_members ? parseInt(formData.max_members) : null,
          created_by: user.id,
        });
      if (insertError) throw insertError;
      router.push('/admin/trips');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/admin/trips" className="text-brand-brown hover:text-brand-tan transition-colors mb-4 inline-block">
          ← Back to Trips
        </Link>
        <h1 className="text-3xl font-bold text-brand-cream mb-2">Create New Trip</h1>
        <p className="text-brand-cream/70">Add a new motorcycle adventure</p>
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
                  Trip Name *
                </label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Morocco Desert Run 2024"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Country *
                </label>
                <Input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="e.g., Morocco"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Destination *
                </label>
                <Input
                  type="text"
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  placeholder="e.g., Sahara Desert"
                  required
                  disabled={isLoading}
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
                  placeholder="e.g., 20"
                  disabled={isLoading}
                />
              </div>
              <div className="md:col-span-2 border-t border-brand-brown/20 pt-4 mt-2">
                <p className="text-sm font-semibold text-brand-tan mb-1">Map Coordinates</p>
                <p className="text-xs text-brand-cream/50 mb-4">
                  Used to place a pin on the interactive world map.{' '}
                  <a
                    href="https://www.latlong.net/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-brand-tan"
                  >
                    Find coordinates →
                  </a>
                  {' '}·{' '}
                  Country code:{' '}
                  <a
                    href="https://www.iban.com/country-codes"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-brand-tan"
                  >
                    ISO alpha-3 list →
                  </a>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-brand-cream mb-2">
                      Country Code <span className="text-brand-cream/40 font-normal">(ISO alpha-3)</span>
                    </label>
                    <Input
                      type="text"
                      name="country_code"
                      value={formData.country_code}
                      onChange={handleChange}
                      placeholder="e.g., MAR"
                      maxLength={3}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-cream mb-2">
                      Latitude
                    </label>
                    <Input
                      type="number"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      placeholder="e.g., 31.7917"
                      step="any"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-cream mb-2">
                      Longitude
                    </label>
                    <Input
                      type="number"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleChange}
                      placeholder="e.g., -7.0926"
                      step="any"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Start Date *
                </label>
                <Input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  End Date *
                </label>
                <Input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="md:col-span-2 border-t border-brand-brown/20 pt-4 mt-2">
                <p className="text-sm font-semibold text-brand-tan mb-3">Trip Countdown</p>
                <div className="space-y-4">
                  <label className="inline-flex items-center gap-3 text-sm text-brand-cream">
                    <input
                      type="checkbox"
                      name="countdown_enabled"
                      checked={formData.countdown_enabled}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="h-4 w-4 rounded border-brand-brown/30 bg-brand-dark-grey text-brand-brown focus:ring-brand-brown/40"
                    />
                    Enable countdown on trip page
                  </label>
                  <div className="max-w-sm">
                    <label className="block text-sm font-medium text-brand-cream mb-2">
                      Countdown Target Date & Time
                    </label>
                    <Input
                      type="datetime-local"
                      name="countdown_target_at"
                      value={formData.countdown_target_at}
                      onChange={handleChange}
                      disabled={isLoading || !formData.countdown_enabled}
                    />
                    <p className="text-xs text-brand-cream/50 mt-2">
                      Leave empty to count down to the trip start date.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Status
                </label>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={isLoading}
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
                placeholder="Describe this adventure..."
                rows={4}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-cream mb-2">
                Schedule / Itinerary
              </label>
              <TextArea
                name="itinerary"
                value={formData.itinerary}
                onChange={handleChange}
                placeholder={`Day 1 - Arrival and welcome ride\nDay 2 - Mountain pass loop\nDay 3 - Desert crossing`}
                rows={6}
                disabled={isLoading}
              />
            </div>
            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-brand-brown/20">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
              >
                Create Trip
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
