'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { ArrowLeft, SaveIcon, Trash2, Users } from 'lucide-react';

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function TripEditorPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    cover_image_url: '',
    status: 'upcoming',
    max_members: '',
  });

  useEffect(() => {
    if (tripId) {
      fetchTrip();
    }
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      if (!tripId) {
        throw new Error('Trip ID is missing');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch trip');
      }

      const data = await response.json();
      const tripData = data.data;

      setTrip(tripData);
      setFormData({
        name: tripData.name,
        destination: tripData.destination,
        country: tripData.country,
        start_date: tripData.start_date.split('T')[0],
        end_date: tripData.end_date.split('T')[0],
        description: tripData.description || '',
        itinerary: tripData.itinerary || '',
        cover_image_url: tripData.cover_image_url || '',
        country_code: tripData.country_code || '',
        latitude: tripData.latitude != null ? String(tripData.latitude) : '',
        longitude: tripData.longitude != null ? String(tripData.longitude) : '',
        countdown_enabled: tripData.countdown_enabled === true,
        countdown_target_at: toDateTimeLocalValue(tripData.countdown_target_at),
        status: tripData.status,
        max_members: tripData.max_members ? String(tripData.max_members) : '',
      });
    } catch (err: any) {
      setError(err.message || 'Error fetching trip');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<any>) => {
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

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...formData,
          country_code: formData.country_code.toUpperCase() || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          countdown_enabled: formData.countdown_enabled,
          countdown_target_at: formData.countdown_target_at
            ? new Date(formData.countdown_target_at).toISOString()
            : null,
          max_members: formData.max_members ? parseInt(formData.max_members) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update trip');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error saving trip');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this trip? This will delete all related records.')) {
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete trip');
      }

      router.push('/admin/trips');
    } catch (err: any) {
      setError(err.message || 'Error deleting trip');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-400">Trip not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/trips">
          <button className="p-2 hover:bg-gray-800 rounded">
            <ArrowLeft size={20} />
          </button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Trip</h1>
          <p className="text-gray-400">{trip.name}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/members/trips">
          <Button variant="secondary" className="inline-flex items-center gap-2">
            <Users size={16} />
            Manage Members
          </Button>
        </Link>
        <Link href={`/admin/trips/${tripId}/documents`}>
          <Button variant="secondary">Manage Documents</Button>
        </Link>
        <Link href={`/admin/trips/${tripId}/payments`}>
          <Button variant="secondary">Manage Payments</Button>
        </Link>
        <Link href={`/admin/trips/${tripId}/budget`}>
          <Button variant="secondary">Manage Budget</Button>
        </Link>
        <Link href={`/admin/trips/${tripId}/awards`}>
          <Button variant="secondary">Manage Awards</Button>
        </Link>
        <Link href={`/admin/trips/${tripId}/galleries`}>
          <Button variant="secondary">Manage Galleries</Button>
        </Link>
      </div>

      {/* Messages */}
      {error && (
        <Card className="border border-red-500 bg-red-900/20">
          <p className="text-red-400">{error}</p>
        </Card>
      )}
      {success && (
        <Card className="border border-green-500 bg-green-900/20">
          <p className="text-green-400">Trip updated successfully!</p>
        </Card>
      )}

      {/* Main Form */}
      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Trip Name</label>
            <Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Morocco 2027"
            />
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium mb-2">Destination</label>
            <Input
              type="text"
              name="destination"
              value={formData.destination}
              onChange={handleChange}
              placeholder="e.g., Marrakech"
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium mb-2">Country</label>
            <Input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder="e.g., Morocco"
            />
          </div>

          {/* Max Members */}
          <div>
            <label className="block text-sm font-medium mb-2">Max Members (empty = unlimited)</label>
            <Input
              type="number"
              name="max_members"
              value={formData.max_members}
              onChange={handleChange}
              placeholder="30"
            />
          </div>

          {/* Map Coordinates */}
          <div className="md:col-span-2 border-t border-gray-700 pt-4 mt-2">
            <p className="text-sm font-semibold text-brand-tan mb-1">Map Coordinates</p>
            <p className="text-xs text-gray-400 mb-4">
              Used to place a pin on the interactive world map.{' '}
              <a href="https://www.latlong.net/" target="_blank" rel="noreferrer" className="underline">
                Find coordinates →
              </a>
              {' '}·{' '}
              Country code:{' '}
              <a href="https://www.iban.com/country-codes" target="_blank" rel="noreferrer" className="underline">
                ISO alpha-3 list →
              </a>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Country Code <span className="text-gray-400 font-normal">(ISO alpha-3)</span>
                </label>
                <Input
                  type="text"
                  name="country_code"
                  value={formData.country_code}
                  onChange={handleChange}
                  placeholder="e.g., MAR"
                  maxLength={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Latitude</label>
                <Input
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  placeholder="e.g., 31.7917"
                  step="any"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Longitude</label>
                <Input
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  placeholder="e.g., -7.0926"
                  step="any"
                />
              </div>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <Input
              type="date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium mb-2">End Date</label>
            <Input
              type="date"
              name="end_date"
              value={formData.end_date}
              onChange={handleChange}
            />
          </div>

          {/* Countdown */}
          <div className="md:col-span-2 border-t border-gray-700 pt-4 mt-2">
            <p className="text-sm font-semibold text-brand-tan mb-3">Trip Countdown</p>
            <div className="space-y-4">
              <label className="inline-flex items-center gap-3 text-sm text-gray-200">
                <input
                  type="checkbox"
                  name="countdown_enabled"
                  checked={formData.countdown_enabled}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-brand-brown focus:ring-brand-brown/40"
                />
                Enable countdown on trip page
              </label>
              <div className="max-w-sm">
                <label className="block text-sm font-medium mb-2">
                  Countdown Target Date & Time
                </label>
                <Input
                  type="datetime-local"
                  name="countdown_target_at"
                  value={formData.countdown_target_at}
                  onChange={handleChange}
                  disabled={!formData.countdown_enabled}
                />
                <p className="text-xs text-gray-400 mt-2">
                  Leave empty to count down to the trip start date.
                </p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Cover Image URL */}
          <div>
            <label className="block text-sm font-medium mb-2">Cover Image URL</label>
            <Input
              type="url"
              name="cover_image_url"
              value={formData.cover_image_url}
              onChange={handleChange}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <TextArea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Trip overview and context..."
            rows={6}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Schedule / Itinerary</label>
          <TextArea
            name="itinerary"
            value={formData.itinerary}
            onChange={handleChange}
            placeholder={`Day 1 - Arrive in Marrakech\nDay 2 - Atlas Mountains\nDay 3 - Desert camp`}
            rows={8}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-6 border-t border-gray-700">
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            <SaveIcon size={18} className="mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>

          <Button variant="secondary" onClick={() => router.push('/admin/trips')}>
            Cancel
          </Button>

          <Button
            variant="secondary"
            className="ml-auto border-red-500/30 hover:border-red-500"
            onClick={handleDelete}
          >
            <Trash2 size={18} className="mr-2 text-red-400" />
            Delete Trip
          </Button>
        </div>
      </Card>

      {/* Trip Stats */}
      <Card>
        <h2 className="text-lg font-bold mb-4">Trip Stats</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Created</p>
            <p className="font-medium">{new Date(trip.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Last Updated</p>
            <p className="font-medium">{new Date(trip.updated_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Trip ID</p>
            <p className="font-mono text-xs">{trip.id.substring(0, 8)}...</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
