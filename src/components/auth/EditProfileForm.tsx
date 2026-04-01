'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types/database';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Notification } from '@/components/ui/Notification';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { AlertCircle, Upload, Trash2 } from 'lucide-react';
import { APPAREL_SIZES } from '@/lib/profile-options';

interface EditProfileFormProps {
  profile: Profile;
  onSave?: (profile: Profile) => void;
}

const PHONE_COUNTRY_CODES = [
  { label: 'AU (+61)', value: '+61' },
  { label: 'NZ (+64)', value: '+64' },
  { label: 'UK (+44)', value: '+44' },
  { label: 'US/CA (+1)', value: '+1' },
  { label: 'MA (+212)', value: '+212' },
  { label: 'ZA (+27)', value: '+27' },
];

function splitFullName(fullName: string | null) {
  if (!fullName) {
    return { first_name: '', middle_name: '', surname: '' };
  }

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], middle_name: '', surname: '' };
  }

  if (parts.length === 2) {
    return { first_name: parts[0], middle_name: '', surname: parts[1] };
  }

  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(' '),
    surname: parts[parts.length - 1],
  };
}

function buildFullName(firstName: string, middleName: string, surname: string) {
  return [firstName, middleName, surname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

export default function EditProfileForm({ profile, onSave }: EditProfileFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const parsedName = splitFullName(profile.full_name);

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: profile.first_name || parsedName.first_name || '',
    middle_name: profile.middle_name || parsedName.middle_name || '',
    surname: profile.surname || parsedName.surname || '',
    nickname: profile.nickname || '',
    date_of_birth: profile.date_of_birth || '',
    phone_country_code: profile.phone_country_code || '+61',
    phone: profile.phone || '',
    address_line1: profile.address_line1 || profile.address || '',
    address_line2: profile.address_line2 || '',
    address_city: profile.address_city || '',
    address_state: profile.address_state || '',
    address_postcode: profile.address_postcode || '',
    address_country: profile.address_country || '',
    passport_number: profile.passport_number || '',
    passport_expiry: profile.passport_expiry || '',
    shirt_size: profile.shirt_size || '',
    shorts_size: profile.shorts_size || '',
    emergency_contact: profile.emergency_contact || '',
    emergency_contact_number: profile.emergency_contact_number || '',
    avatar_url: profile.avatar_url || '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Profile image must be an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile image must be 5MB or smaller.');
      return;
    }

    setError(null);

    // Read file and show crop modal
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageToCrop(result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    setUploadingImage(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('You must be logged in to upload a profile image.');
      }

      const extension = 'jpg';
      const path = `avatars/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, croppedImageBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('photos').getPublicUrl(path);

      setFormData((prev) => ({ ...prev, avatar_url: publicUrl }));
      setCropModalOpen(false);
      setImageToCrop(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload profile image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveAvatar = () => {
    setFormData((prev) => ({ ...prev, avatar_url: '' }));
    setCropModalOpen(false);
    setImageToCrop(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      if (!profile.id) {
        throw new Error('Profile ID is missing');
      }

      const response = await fetch(`/api/members/${profile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...formData,
          full_name: buildFullName(formData.first_name, formData.middle_name, formData.surname),
        }),
      });

      let errorData: any;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          errorData = await response.json();
        } else {
          // If response is not JSON, it's likely an HTML error page
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      } catch (parseError) {
        throw new Error(
          `Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        );
      }

      if (!response.ok) {
        throw new Error(errorData?.error || errorData?.message || 'Failed to update profile');
      }

      const result = errorData;
      const updatedProfile = result?.data ?? result;
      setSuccess(true);

      if (onSave) {
        onSave(updatedProfile);
      }

      setTimeout(() => {
        router.push('/profile');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Notification
            type="error"
            title="Error"
            message={error}
            onClose={() => setError(null)}
            icon={<AlertCircle className="w-5 h-5" />}
          />
        )}

        {success && (
          <Notification
            type="success"
            title="Success"
            message="Profile updated successfully!"
            onClose={() => setSuccess(false)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-cream">Profile Image</h3>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <Avatar
                src={formData.avatar_url || null}
                alt={buildFullName(formData.first_name, formData.middle_name, formData.surname) || 'User'}
                size="xl"
              />
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-dark border border-brand-gold/30 text-brand-cream cursor-pointer hover:border-brand-gold/60 transition-colors">
                  {uploadingImage ? <Spinner size="sm" /> : <Upload className="w-4 h-4" />}
                  <span>{uploadingImage ? 'Uploading...' : 'Upload New Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingImage || loading}
                  />
                </label>
                {formData.avatar_url && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-dark border border-red-500/40 text-red-300 hover:border-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-brand-cream mb-4">Name Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  First Name *
                </label>
                <Input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="First name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Middle Name
                </label>
                <Input
                  type="text"
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={handleChange}
                  placeholder="Middle name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Surname *
                </label>
                <Input
                  type="text"
                  name="surname"
                  value={formData.surname}
                  onChange={handleChange}
                  placeholder="Surname"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Nickname
                </label>
                <Input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="What we should call you"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Date of Birth
                </label>
                <Input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-brand-cream mb-4">Contact Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Phone Country Prefix
                </label>
                <select
                  name="phone_country_code"
                  value={formData.phone_country_code}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-brand-dark border border-brand-gold/20 rounded-lg text-brand-cream focus:outline-none focus:border-brand-gold/50"
                >
                  {PHONE_COUNTRY_CODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Phone Number
                </label>
                <Input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Emergency Contact
                </label>
                <Input
                  type="text"
                  name="emergency_contact"
                  value={formData.emergency_contact}
                  onChange={handleChange}
                  placeholder="Emergency contact name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Emergency Contact Number
                </label>
                <Input
                  type="tel"
                  name="emergency_contact_number"
                  value={formData.emergency_contact_number}
                  onChange={handleChange}
                  placeholder="Emergency contact number"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-brand-cream mb-4">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Address Line 1
                </label>
                <Input
                  type="text"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  placeholder="Street address"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Address Line 2
                </label>
                <Input
                  type="text"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  placeholder="Unit, suite, apartment"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  City/Suburb
                </label>
                <Input
                  type="text"
                  name="address_city"
                  value={formData.address_city}
                  onChange={handleChange}
                  placeholder="City/Suburb"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  State/Province
                </label>
                <Input
                  type="text"
                  name="address_state"
                  value={formData.address_state}
                  onChange={handleChange}
                  placeholder="State/Province"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Postcode
                </label>
                <Input
                  type="text"
                  name="address_postcode"
                  value={formData.address_postcode}
                  onChange={handleChange}
                  placeholder="Postcode"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Country
                </label>
                <Input
                  type="text"
                  name="address_country"
                  value={formData.address_country}
                  onChange={handleChange}
                  placeholder="Country"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-brand-cream mb-4">Travel Documentation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Passport Number
                </label>
                <Input
                  type="text"
                  name="passport_number"
                  value={formData.passport_number}
                  onChange={handleChange}
                  placeholder="Passport number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Passport Expiry
                </label>
                <Input
                  type="date"
                  name="passport_expiry"
                  value={formData.passport_expiry}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-brand-cream mb-4">Travel Gear</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Shirt Size
                </label>
                <select
                  name="shirt_size"
                  value={formData.shirt_size}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-brand-dark border border-brand-gold/20 rounded-lg text-brand-cream focus:outline-none focus:border-brand-gold/50"
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
                <label className="block text-sm font-medium text-brand-cream/80 mb-2">
                  Shorts Size
                </label>
                <select
                  name="shorts_size"
                  value={formData.shorts_size}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-brand-dark border border-brand-gold/20 rounded-lg text-brand-cream focus:outline-none focus:border-brand-gold/50"
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

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={loading || uploadingImage}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading || uploadingImage}>
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>

        {/* Crop Image Modal */}
      </div>
    );
}
