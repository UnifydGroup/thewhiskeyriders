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
    start_date: '',
    end_date: '',
    description: '',
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
    const { name, value } = e.target;
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
          start_date: formData.start_date,
          end_date: formData.end_date,
          description: formData.description || null,
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
