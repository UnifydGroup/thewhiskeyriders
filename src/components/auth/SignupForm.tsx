'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { APPAREL_SIZES } from '@/lib/profile-options';

type SignupFormData = {
  first_name: string;
  middle_name: string;
  surname: string;
  nickname: string;
  email: string;
  password: string;
  confirm_password: string;
  phone_country_code: string;
  phone: string;
  emergency_contact: string;
  emergency_contact_number: string;
  date_of_birth: string;
  address_line1: string;
  address_line2: string;
  address_city: string;
  address_state: string;
  address_postcode: string;
  address_country: string;
  passport_number: string;
  passport_expiry: string;
  shirt_size: string;
  shorts_size: string;
  bio: string;
};

const initialFormState: SignupFormData = {
  first_name: '',
  middle_name: '',
  surname: '',
  nickname: '',
  email: '',
  password: '',
  confirm_password: '',
  phone_country_code: '',
  phone: '',
  emergency_contact: '',
  emergency_contact_number: '',
  date_of_birth: '',
  address_line1: '',
  address_line2: '',
  address_city: '',
  address_state: '',
  address_postcode: '',
  address_country: '',
  passport_number: '',
  passport_expiry: '',
  shirt_size: '',
  shorts_size: '',
  bio: '',
};

export function SignupForm() {
  const [form, setForm] = useState<SignupFormData>(initialFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.first_name.trim() || !form.surname.trim()) {
      setError('First name and surname are required.');
      return;
    }

    if (!form.email.trim()) {
      setError('Email is required.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: form.first_name,
          middle_name: form.middle_name,
          surname: form.surname,
          nickname: form.nickname,
          email: form.email,
          password: form.password,
          phone_country_code: form.phone_country_code,
          phone: form.phone,
          emergency_contact: form.emergency_contact,
          emergency_contact_number: form.emergency_contact_number,
          date_of_birth: form.date_of_birth,
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          address_city: form.address_city,
          address_state: form.address_state,
          address_postcode: form.address_postcode,
          address_country: form.address_country,
          passport_number: form.passport_number,
          passport_expiry: form.passport_expiry,
          shirt_size: form.shirt_size,
          shorts_size: form.shorts_size,
          bio: form.bio,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error || 'Failed to submit signup request');
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit signup request');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle className="w-12 h-12 text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-brand-cream">Request Submitted</h3>
        <p className="text-brand-cream/70 text-sm">
          Your signup details have been sent to the admin team. You can sign in after your account is approved.
        </p>
        <Link
          href="/login?signup=requested"
          className="inline-flex items-center gap-2 text-brand-brown hover:text-brand-brown/80 text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-brand-brown uppercase tracking-wider mb-3">Personal Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="First name *"
            value={form.first_name}
            onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
            required
            disabled={isLoading}
          />
          <Input
            placeholder="Middle name"
            value={form.middle_name}
            onChange={(e) => setForm((prev) => ({ ...prev, middle_name: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            placeholder="Surname *"
            value={form.surname}
            onChange={(e) => setForm((prev) => ({ ...prev, surname: e.target.value }))}
            required
            disabled={isLoading}
          />
          <Input
            placeholder="Nickname"
            value={form.nickname}
            onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
            disabled={isLoading}
          />
          <div>
            <label className="block text-xs text-brand-cream/60 mb-1">Date of Birth</label>
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm((prev) => ({ ...prev, date_of_birth: e.target.value }))}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-brand-brown uppercase tracking-wider mb-3">Account</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="email"
            placeholder="Email address *"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
            disabled={isLoading}
          />
          <Input
            type="password"
            placeholder="Password (min 8 chars) *"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required
            disabled={isLoading}
          />
          <Input
            type="password"
            placeholder="Confirm password *"
            value={form.confirm_password}
            onChange={(e) => setForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-brand-brown uppercase tracking-wider mb-3">Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="Phone country code"
            value={form.phone_country_code}
            onChange={(e) => setForm((prev) => ({ ...prev, phone_country_code: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            placeholder="Emergency contact"
            value={form.emergency_contact}
            onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            placeholder="Emergency contact number"
            value={form.emergency_contact_number}
            onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_number: e.target.value }))}
            disabled={isLoading}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-brand-brown uppercase tracking-wider mb-3">Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="Address line 1"
            value={form.address_line1}
            onChange={(e) => setForm((prev) => ({ ...prev, address_line1: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            placeholder="Address line 2"
            value={form.address_line2}
            onChange={(e) => setForm((prev) => ({ ...prev, address_line2: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            placeholder="City"
            value={form.address_city}
            onChange={(e) => setForm((prev) => ({ ...prev, address_city: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            placeholder="State / Region"
            value={form.address_state}
            onChange={(e) => setForm((prev) => ({ ...prev, address_state: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            placeholder="Postcode"
            value={form.address_postcode}
            onChange={(e) => setForm((prev) => ({ ...prev, address_postcode: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            placeholder="Country"
            value={form.address_country}
            onChange={(e) => setForm((prev) => ({ ...prev, address_country: e.target.value }))}
            disabled={isLoading}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-brand-brown uppercase tracking-wider mb-3">Travel Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-brand-cream/60 mb-1">Passport Number</label>
            <Input
              placeholder="Passport number"
              value={form.passport_number}
              onChange={(e) => setForm((prev) => ({ ...prev, passport_number: e.target.value }))}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-xs text-brand-cream/60 mb-1">Passport Expiry</label>
            <Input
              type="date"
              value={form.passport_expiry}
              onChange={(e) => setForm((prev) => ({ ...prev, passport_expiry: e.target.value }))}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-brand-brown uppercase tracking-wider mb-3">Clothing Sizes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-brand-cream/60 mb-1">Shirt Size</label>
            <select
              value={form.shirt_size}
              onChange={(e) => setForm((prev) => ({ ...prev, shirt_size: e.target.value }))}
              className="w-full px-3 py-2 bg-brand-black/50 border border-brand-brown/30 rounded text-brand-cream text-sm focus:outline-none focus:border-brand-brown"
              disabled={isLoading}
            >
              <option value="">Select shirt size</option>
              {APPAREL_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-brand-cream/60 mb-1">Shorts Size</label>
            <select
              value={form.shorts_size}
              onChange={(e) => setForm((prev) => ({ ...prev, shorts_size: e.target.value }))}
              className="w-full px-3 py-2 bg-brand-black/50 border border-brand-brown/30 rounded text-brand-cream text-sm focus:outline-none focus:border-brand-brown"
              disabled={isLoading}
            >
              <option value="">Select shorts size</option>
              {APPAREL_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <Textarea
          placeholder="Short bio"
          value={form.bio}
          onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
          disabled={isLoading}
          rows={3}
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-100 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <Button type="submit" variant="primary" size="md" className="w-full" isLoading={isLoading}>
          Submit Signup Request
        </Button>
        <Link
          href="/login"
          className="block text-center text-sm text-brand-cream/70 hover:text-brand-cream transition-colors"
        >
          Already have an account? Sign in
        </Link>
      </div>
    </form>
  );
}
