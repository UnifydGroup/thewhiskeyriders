'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import {
  Edit2, Trash2, Archive, X, Save, AlertCircle, CheckCircle,
  Users, Search, Shield, UserCheck, Bike, Plus, Camera
} from 'lucide-react';
import { getMemberDisplayName } from '@/lib/member-display';
import { APPAREL_SIZES } from '@/lib/profile-options';

export default function MemberManagementPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<any[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [memberTrips, setMemberTrips] = useState<Map<string, any[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingMember, setEditingMember] = useState<any>(null);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [newMember, setNewMember] = useState<any>({
    first_name: '',
    middle_name: '',
    surname: '',
    nickname: '',
    email: '',
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
    role: 'member',
    status: 'active',
  });
  const [message, setMessage] = useState<any>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [editingMemberTripIds, setEditingMemberTripIds] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);

  // Avatar / photo upload state (scoped to the edit modal)
  const [avatarCropModalOpen, setAvatarCropModalOpen] = useState(false);
  const [avatarImageToCrop, setAvatarImageToCrop] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    active: 0,
    inactive: 0,
  });

  const formatRoleOrStatus = (value: unknown, fallback: string) => {
    if (typeof value !== 'string' || value.trim() === '') {
      return fallback;
    }

    const normalized = value.replace(/_/g, ' ').trim();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const normalizeNullableText = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const stringValue = String(value).trim();
    return stringValue === '' ? null : stringValue;
  };

  const normalizeDateValue = (value: unknown): string | null => {
    const normalized = normalizeNullableText(value);
    return normalized || null;
  };

  const extractMissingProfilesColumn = (errorMessage: string | undefined): string | null => {
    if (!errorMessage) return null;
    const match = errorMessage.match(/Could not find the '([^']+)' column of 'profiles' in the schema cache/i);
    return match?.[1] ?? null;
  };

  const buildCreateMemberPayload = (member: any): Record<string, unknown> => {
    const firstName = normalizeNullableText(member.first_name);
    const middleName = normalizeNullableText(member.middle_name);
    const surname = normalizeNullableText(member.surname);
    const nickname = normalizeNullableText(member.nickname);
    const email = normalizeNullableText(member.email);
    const phoneCountryCode = normalizeNullableText(member.phone_country_code);
    const phone = normalizeNullableText(member.phone);
    const emergencyContact = normalizeNullableText(member.emergency_contact);
    const emergencyContactNumber = normalizeNullableText(member.emergency_contact_number);
    const dateOfBirth = normalizeDateValue(member.date_of_birth);
    const addressLine1 = normalizeNullableText(member.address_line1);
    const addressLine2 = normalizeNullableText(member.address_line2);
    const addressCity = normalizeNullableText(member.address_city);
    const addressState = normalizeNullableText(member.address_state);
    const addressPostcode = normalizeNullableText(member.address_postcode);
    const addressCountry = normalizeNullableText(member.address_country);
    const passportNumber = normalizeNullableText(member.passport_number);
    const passportExpiry = normalizeDateValue(member.passport_expiry);
    const shirtSize = normalizeNullableText(member.shirt_size);
    const shortsSize = normalizeNullableText(member.shorts_size);
    const role = normalizeNullableText(member.role) || 'member';
    const status = normalizeNullableText(member.status) || 'active';

    const fullName =
      [firstName, middleName, surname].filter(Boolean).join(' ').trim() ||
      normalizeNullableText(member.full_name);

    const address =
      [
        addressLine1,
        addressLine2,
        [addressCity, addressState].filter(Boolean).join(', '),
        [addressPostcode, addressCountry].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ')
        .trim() || normalizeNullableText(member.address);

    return {
      email,
      full_name: fullName || null,
      first_name: firstName,
      middle_name: middleName,
      surname,
      nickname,
      phone_country_code: phoneCountryCode,
      phone,
      emergency_contact: emergencyContact,
      emergency_contact_number: emergencyContactNumber,
      date_of_birth: dateOfBirth,
      address,
      address_line1: addressLine1,
      address_line2: addressLine2,
      address_city: addressCity,
      address_state: addressState,
      address_postcode: addressPostcode,
      address_country: addressCountry,
      passport_number: passportNumber,
      passport_expiry: passportExpiry,
      shirt_size: shirtSize,
      shorts_size: shortsSize,
      role,
      status,
    };
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [members, searchQuery, roleFilter]);

  const loadData = async () => {
    try {
      // Load members
      const { data: membersData } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (membersData) {
        setMembers(membersData);

        // Calculate stats
        setStats({
          total: membersData.length,
          admins: membersData.filter((m: any) => m.role === 'admin' || m.role === 'super_admin').length,
          active: membersData.filter((m: any) => m.status === 'active').length,
          inactive: membersData.filter((m: any) => m.status !== 'active').length,
        });
      }

      // Load trips
      const { data: tripsData } = await supabase
        .from('trips')
        .select('id, name, slug, start_date, end_date')
        .order('start_date', { ascending: false });
      if (tripsData) {
        setTrips(tripsData);
      }

      // Load member trips
      const { data: memberTripsData } = await supabase
        .from('trip_members')
        .select('user_id, trip_id, trips(id, name, slug)');

      if (memberTripsData) {
        const tripsMap = new Map<string, any[]>();
        for (const mt of memberTripsData) {
          const userId = mt.user_id;
          if (!tripsMap.has(userId)) {
            tripsMap.set(userId, []);
          }
          if (mt.trips) {
            tripsMap.get(userId)!.push(mt.trips);
          }
        }
        setMemberTrips(tripsMap);
      }
    } catch (err) {
      console.error('Load error:', err);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = () => {
    let filtered = members;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m: any) =>
          (m.user_id?.toLowerCase() || '').includes(query) ||
          (m.full_name?.toLowerCase() || '').includes(query) ||
          (m.email?.toLowerCase() || '').includes(query) ||
          (m.phone?.toLowerCase() || '').includes(query)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter((m: any) => m.role === roleFilter);
    }

    setFilteredMembers(filtered);
  };

  const handleCreateMember = async () => {
    try {
      // Validate required fields
      if (!normalizeNullableText(newMember.email)) {
        setMessage({ type: 'error', text: 'Email is required' });
        return;
      }

      if (!normalizeNullableText(newMember.surname)) {
        setMessage({ type: 'error', text: 'Surname is required' });
        return;
      }

      setIsSavingMember(true);

      // Get session token for API call
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' });
        return;
      }

      const response = await fetch('/api/members/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(newMember),
      });

      const result = await response.json();

      if (!response.ok) {
        // API errors are returned in result.error (not result.message)
        setMessage({ type: 'error', text: result.error || result.message || 'Failed to create member' });
        return;
      }

      // Add the new member to the list
      if (result.data?.profile) {
        setMembers((prev) => [...prev, result.data.profile]);
      }

      // Reset form
      setIsCreatingMember(false);
      setNewMember({
        first_name: '',
        middle_name: '',
        surname: '',
        nickname: '',
        email: '',
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
        role: 'member',
        status: 'active',
      });

      setMessage({
        type: result.data?.warning ? 'error' : 'success',
        text: result.data?.message || 'Member created successfully'
      });

      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create member'
      });
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleArchiveMember = async (memberId: string) => {
    if (!confirm('Archive this member? They can be restored later.')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'archived' })
        .eq('id', memberId);

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      setMembers(members.filter((m) => m.id !== memberId));
      setMessage({ type: 'success', text: 'Member archived' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Archive failed' });
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Delete this member permanently? This cannot be undone.')) return;

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', memberId);

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      setMembers(members.filter((m) => m.id !== memberId));
      setMessage({ type: 'success', text: 'Member deleted' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  const handleBulkRoleChange = async (newRole: 'super_admin' | 'admin' | 'trip_admin' | 'member') => {
    if (selectedMembers.length === 0) {
      alert('Please select members first');
      return;
    }

    if (!confirm(`Change role to "${newRole}" for ${selectedMembers.length} selected members?`)) {
      return;
    }

    try {
      for (const memberId of selectedMembers) {
        await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', memberId);
      }

      setSelectedMembers([]);
      loadData();
      setMessage({ type: 'success', text: `Updated ${selectedMembers.length} members` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Bulk update failed' });
    }
  };

  const handleMemberSelect = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(filteredMembers.map((m: any) => m.id));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleToggleEditingMemberTrip = (tripId: string) => {
    setEditingMemberTripIds((previous) =>
      previous.includes(tripId)
        ? previous.filter((id) => id !== tripId)
        : [...previous, tripId]
    );
  };

  const handleBulkImport = async () => {
    setBulkImporting(true);
    const membersData = [
      {
        full_name: 'Andreas Emmanuel Gloor',
        email: 'andreas@gloor.com.au',
        phone: '0409651993',
        date_of_birth: '1981-08-24',
        address: '24 Sydenham Lane, Surrey Hills VIC 3127',
        passport_number: 'PA6257096',
        shirt_size: 'Large',
        shorts_size: 'Large/ 34',
      },
      {
        full_name: 'Andrew Lewis',
        email: 'andrew@ozlocal.com.au',
        phone: '0414734216',
        date_of_birth: '2025-05-21',
        address: '41 gundawarra st lilli pillu',
        passport_number: '',
        shirt_size: 'XL',
        shorts_size: 'XL/ 36',
      },
      {
        full_name: 'Christian Stefan Doyle',
        email: 'Stefan@sontimer.com',
        phone: '0408485654',
        date_of_birth: '1975-07-15',
        address: '8/10 Beloka Close Jindabyne, nsw 2627',
        passport_number: '',
        shirt_size: 'XL',
        shorts_size: 'Large/ 34',
      },
      {
        full_name: 'Robert Wentworth Norman',
        email: 'robwnorman123@gmail.com',
        phone: '0422074283',
        date_of_birth: '1978-09-17',
        address: '2/11a Lamrock Ave Bondi beach 2026',
        passport_number: '',
        shirt_size: 'Medium',
        shorts_size: 'Medium/ 32',
      },
      {
        full_name: 'Matthew James Hampton',
        email: 'matt@rhythmjapan.com',
        phone: '0412007733',
        date_of_birth: '1977-08-28',
        address: '5659 Kosciusko Rd, East Jindabyne NSW 2627',
        passport_number: '',
        shirt_size: 'Large',
        shorts_size: 'Large/ 34',
      },
      {
        full_name: 'Kristian Hugh Spencer',
        email: 'kristian.spencer@atomic.com',
        phone: '0409603358',
        date_of_birth: '1972-10-23',
        address: '40 Toronto Ave Cromer 2099',
        passport_number: '',
        shirt_size: 'Large',
        shorts_size: 'Medium/ 32',
      },
      {
        full_name: 'Travis Tierney',
        email: 'travis@tmtbuilding.com.au',
        phone: '0418 253379',
        date_of_birth: '1972-05-12',
        address: '1/14 Palmerston Ave Bronte',
        passport_number: '',
        shirt_size: 'XL',
        shorts_size: 'Large/ 34',
      },
      {
        full_name: 'Daniel Mark Morgan',
        email: 'danielmarkmorgan@gmail.com',
        phone: '+61403857746',
        date_of_birth: '1974-09-02',
        address: '8 Amaroo Place Cooroibah QLD 4565',
        passport_number: '',
        shirt_size: 'XL',
        shorts_size: 'Large/ 34',
      },
      {
        full_name: 'Thomas Kowalczuk',
        email: 'tomkchook@hotmail.com',
        phone: '0416164481',
        date_of_birth: '2025-07-28',
        address: '20 Banora Tce. Bilambil Heights NSW 2926',
        passport_number: '',
        shirt_size: 'XL',
        shorts_size: 'Small/ 30',
      },
      {
        full_name: 'Simon Lewis Dakin',
        email: 'simon@attract.com.ai',
        phone: '0402905060',
        date_of_birth: '1977-05-16',
        address: '7 Buckinbah Place Lilli Pilli NSW 2229',
        passport_number: '',
        shirt_size: 'XL',
        shorts_size: 'Large/ 34',
      },
      {
        full_name: 'James Michael Cattermole',
        email: 'Jamescattermole@hotmail.com',
        phone: '0404863676',
        date_of_birth: '1981-12-17',
        address: '11 kunama drive east jindabyne nsw 2627',
        passport_number: '',
        shirt_size: 'XL',
        shorts_size: 'XL/ 36',
      },
      {
        full_name: 'Andrew Knight',
        email: 'Andy@brothernature.net.au',
        phone: '0404046323',
        date_of_birth: '2025-07-31',
        address: '1 wolbah place',
        passport_number: '',
        shirt_size: '2XL',
        shorts_size: '2XL/ 38',
      },
      {
        full_name: 'Jonathon Brauer',
        email: 'Jonobrauer@gmail.com',
        phone: '0409924861',
        date_of_birth: '1981-09-26',
        address: '5661a Kosciuszko Rd, east Jindabyne',
        passport_number: '',
        shirt_size: 'Medium',
        shorts_size: 'Medium/ 32',
      },
      {
        full_name: 'Campbell Stafford Harris',
        email: 'Campbell.harris@morgans.com.au',
        phone: '0416596674',
        date_of_birth: '1980-03-21',
        address: '320 Moore park road Paddington 2021',
        passport_number: '',
        shirt_size: 'Medium',
        shorts_size: 'Medium/ 32',
      },
      {
        full_name: 'Hamish Richard Gordon',
        email: 'hamish.gordon@gmail.com',
        phone: '0410257702',
        date_of_birth: '1978-11-07',
        address: '23 Truman Ave Bonnet Bay NSW 2226',
        passport_number: '',
        shirt_size: 'XL',
        shorts_size: 'Large/ 34',
      },
      {
        full_name: 'Will David Clifford',
        email: 'will_clifford@hotmail.com',
        phone: '6049027077',
        date_of_birth: '1985-04-18',
        address: '7287 spruce grove lane, Whistler, BC, Canada, V8E0E8',
        passport_number: '',
        shirt_size: 'Large',
        shorts_size: 'Large/ 34',
      },
      {
        full_name: 'Reid Ballingall',
        email: 'reid@example.com',
        phone: '0400000000',
        date_of_birth: '1980-01-01',
        address: 'Sydney, NSW',
        passport_number: '',
        shirt_size: 'Large',
        shorts_size: 'Large/ 34',
      },
      {
        full_name: 'Simon Gallagher',
        email: 'simon.gallagher@example.com',
        phone: '0400000001',
        date_of_birth: '1980-01-02',
        address: 'Sydney, NSW',
        passport_number: '',
        shirt_size: 'Medium',
        shorts_size: 'Medium/ 32',
      },
    ];

    try {
      const response = await fetch('/api/members/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: membersData }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error });
        return;
      }

      setMessage({
        type: 'success',
        text: `Imported ${data.successCount} members successfully`,
      });

      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Import failed' });
    } finally {
      setBulkImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  // ── Avatar upload handlers (scoped to the edit modal) ─────────────────────

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarUploadError('Profile image must be an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarUploadError('Profile image must be 5MB or smaller.');
      return;
    }
    setAvatarUploadError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarImageToCrop(ev.target?.result as string);
      setAvatarCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // Upload cropped blob to storage and update editingMember.avatar_url in state.
  // The URL will be included in the profile save when the user clicks "Save Changes".
  const handleAvatarCropComplete = async (croppedBlob: Blob) => {
    if (!editingMember) return;
    setUploadingAvatar(true);
    setAvatarUploadError(null);
    try {
      const memberId = editingMember.id as string;
      const path = `avatars/${memberId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, croppedBlob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw new Error(uploadError.message);
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path);
      setEditingMember((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      setAvatarCropModalOpen(false);
      setAvatarImageToCrop(null);
    } catch (err) {
      setAvatarUploadError(err instanceof Error ? err.message : 'Failed to upload profile image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleClearAvatar = () => {
    setEditingMember((prev: any) => ({ ...prev, avatar_url: '' }));
  };

  // ── Unified save: profile fields + trips ───────────────────────────────────

  const handleSaveEditingMember = async () => {
    if (!editingMember?.id) { setEditError('Missing member ID'); return; }
    setEditError(null);
    setIsSavingMember(true);
    try {
      const memberId = editingMember.id as string;
      const { data: { session } } = await supabase.auth.getSession();

      // 1. Save all profile fields via API
      const profilePayload = {
        first_name:               editingMember.first_name       || null,
        middle_name:              editingMember.middle_name      || null,
        surname:                  editingMember.surname          || null,
        nickname:                 editingMember.nickname         || null,
        email:                    editingMember.email,
        phone_country_code:       editingMember.phone_country_code || null,
        phone:                    editingMember.phone            || null,
        date_of_birth:            editingMember.date_of_birth    || null,
        emergency_contact:        editingMember.emergency_contact || null,
        emergency_contact_number: editingMember.emergency_contact_number || null,
        role:                     editingMember.role             || 'member',
        status:                   editingMember.status           || 'active',
        address_line1:            editingMember.address_line1    || null,
        address_line2:            editingMember.address_line2    || null,
        address_city:             editingMember.address_city     || null,
        address_state:            editingMember.address_state    || null,
        address_postcode:         editingMember.address_postcode || null,
        address_country:          editingMember.address_country  || null,
        passport_number:          editingMember.passport_number  || null,
        passport_expiry:          editingMember.passport_expiry  || null,
        shirt_size:               editingMember.shirt_size       || null,
        shorts_size:              editingMember.shorts_size      || null,
        avatar_url:               editingMember.avatar_url       || null,
      };
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(profilePayload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any).error || 'Failed to save profile');
      }

      // 2. Save trip assignments
      const { data: existing, error: fetchError } = await supabase
        .from('trip_members').select('trip_id').eq('user_id', memberId);
      if (fetchError) throw new Error(fetchError.message);

      const existingIds = new Set((existing || []).map((r) => r.trip_id as string));
      const nextIds = new Set(editingMemberTripIds);

      const toAdd = editingMemberTripIds
        .filter((id) => !existingIds.has(id))
        .map((id) => ({ user_id: memberId, trip_id: id, trip_role: 'member' as const }));
      const toRemove = [...existingIds].filter((id) => !nextIds.has(id));

      if (toAdd.length > 0) {
        const { error } = await supabase.from('trip_members').insert(toAdd);
        if (error) throw new Error(error.message);
      }
      if (toRemove.length > 0) {
        const { error } = await supabase.from('trip_members').delete()
          .eq('user_id', memberId).in('trip_id', toRemove);
        if (error) throw new Error(error.message);
      }

      // 3. Update local state
      const updatedMember = { ...editingMember };
      setMembers((prev) => prev.map((m) => m.id === memberId ? updatedMember : m));
      setFilteredMembers((prev) => prev.map((m) => m.id === memberId ? updatedMember : m));
      setMemberTrips((prev) => {
        const next = new Map(prev);
        next.set(memberId, trips.filter((t) => nextIds.has(t.id)));
        return next;
      });

      setEditingMember(null);
      setEditingMemberTripIds([]);
      setMessage({ type: 'success', text: 'Member updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save member');
    } finally {
      setIsSavingMember(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-cream mb-2">Members Management</h1>
          <p className="text-brand-cream/70">Manage all members, roles, details, and trip assignments</p>
        </div>
        <Button
          onClick={() => setIsCreatingMember(true)}
          className="bg-brand-brown hover:bg-brand-brown/80 text-brand-black font-semibold flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </Button>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-3 rounded border flex gap-2 ${
            message.type === 'success'
              ? 'bg-green-900/20 border-green-600/50'
              : 'bg-red-900/20 border-red-600/50'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-brand-dark-grey">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm">Total Members</p>
                <p className="text-2xl font-bold text-brand-cream">{stats.total}</p>
              </div>
              <Users size={32} className="text-blue-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-dark-grey">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm">Admins</p>
                <p className="text-2xl font-bold text-brand-cream">{stats.admins}</p>
              </div>
              <Shield size={32} className="text-red-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-dark-grey">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm">Active</p>
                <p className="text-2xl font-bold text-brand-cream">{stats.active}</p>
              </div>
              <UserCheck size={32} className="text-green-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-dark-grey">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm">Archived/Inactive</p>
                <p className="text-2xl font-bold text-brand-cream">{stats.inactive}</p>
              </div>
              <AlertCircle size={32} className="text-yellow-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Import Button */}
      {members.length === 0 && (
        <Card className="bg-brand-brown/10 border-brand-brown/30">
          <CardContent className="pt-6">
            <Button
              onClick={handleBulkImport}
              disabled={bulkImporting}
              className="w-full bg-brand-brown hover:bg-brand-brown/80 text-brand-black font-semibold"
            >
              {bulkImporting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Importing...
                </>
              ) : (
                'Bulk Import 18 Members from Morocco 2027'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search & Filters */}
      <Card className="bg-brand-dark-grey">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-cream/50" />
              <Input
                type="text"
                placeholder="Search by User ID, name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-brand-black/50 border-brand-brown/20 text-brand-cream placeholder-brand-cream/30"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-brand-black/50 border border-brand-brown/20 rounded text-brand-cream text-sm"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedMembers.length > 0 && (
        <Card className="bg-brand-brown/10 border border-brand-brown/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-brand-cream">
                <strong>{selectedMembers.length}</strong> member(s) selected
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleBulkRoleChange('member')}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Make Members
                </Button>
                <Button
                  onClick={() => handleBulkRoleChange('admin')}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Make Admins
                </Button>
                <Button
                  onClick={() => setSelectedMembers([])}
                  size="sm"
                  className="bg-brand-black/50 hover:bg-brand-black/70 text-brand-cream"
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => {
            const memberTripsData = memberTrips.get(member.id) || [];
            return (
              <Card key={member.id} className="h-full bg-brand-dark-grey/50 hover:bg-brand-dark-grey/70 transition-colors">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Header & Checkbox */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => handleMemberSelect(member.id)}
                          className="w-4 h-4 mt-1"
                        />
                        <div className="relative w-12 h-12 shrink-0">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={getMemberDisplayName(member)}
                              className="w-12 h-12 rounded-full object-cover border border-brand-brown/40"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-brand-brown/20 border border-brand-brown/40 flex items-center justify-center">
                              <span className="text-sm font-bold text-brand-cream/60">
                                {(member.first_name?.[0] || member.full_name?.[0] || member.email?.[0] || '?').toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-brand-cream text-lg">{getMemberDisplayName(member)}</h3>
                          <p className="text-brand-cream/50 text-sm">{member.email}</p>
                          <p className="text-brand-cream/40 text-xs mt-1">
                            User ID: {member.user_id || 'Pending'}
                          </p>

                          {/* Info badges */}
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {member.phone && (
                              <span className="text-xs bg-brand-black/50 px-2 py-1 rounded text-brand-cream/70">
                                {member.phone}
                              </span>
                            )}
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                member.role === 'super_admin' || member.role === 'admin'
                                  ? 'bg-red-900/30 text-red-400'
                                  : 'bg-blue-900/30 text-blue-400'
                              }`}
                            >
                              {formatRoleOrStatus(member.role, 'Member')}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                member.status === 'active'
                                  ? 'bg-green-900/30 text-green-400'
                                  : 'bg-yellow-900/30 text-yellow-400'
                              }`}
                            >
                              {formatRoleOrStatus(member.status, 'Unknown')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditError(null);
                            setEditingMember(member);
                            const assignedTripIds = (memberTrips.get(member.id) || []).map((trip) => trip.id);
                            setEditingMemberTripIds(assignedTripIds);
                          }}
                          className="p-2 hover:bg-brand-brown/20 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-brand-brown" />
                        </button>
                        <button
                          onClick={() => handleArchiveMember(member.id)}
                          className="p-2 hover:bg-yellow-900/20 rounded transition-colors"
                          title="Archive"
                        >
                          <Archive className="w-4 h-4 text-yellow-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-2 hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm pl-7">
                      {member.shirt_size && (
                        <div>
                          <p className="text-brand-cream/50 text-xs">Shirt Size</p>
                          <p className="text-brand-cream">{member.shirt_size}</p>
                        </div>
                      )}
                      {member.shorts_size && (
                        <div>
                          <p className="text-brand-cream/50 text-xs">Shorts Size</p>
                          <p className="text-brand-cream">{member.shorts_size}</p>
                        </div>
                      )}
                      {member.date_of_birth && (
                        <div>
                          <p className="text-brand-cream/50 text-xs">DOB</p>
                          <p className="text-brand-cream">{new Date(member.date_of_birth).toLocaleDateString()}</p>
                        </div>
                      )}
                      {memberTripsData.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-brand-cream/50 text-xs">Trips</p>
                          <div className="flex gap-1 flex-wrap">
                            {memberTripsData.map((trip) => (
                              <span key={trip.id} className="text-xs bg-brand-brown/20 text-brand-cream px-2 py-1 rounded flex items-center gap-1">
                                <Bike className="w-3 h-3" />
                                {trip.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {memberTripsData.length === 0 && (
                        <div className="col-span-2">
                          <p className="text-brand-cream/50 text-xs">Trips</p>
                          <p className="text-brand-cream/50 italic">No trips assigned</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="bg-brand-dark-grey lg:col-span-2">
            <CardContent className="pt-6">
              <p className="text-brand-cream/50 text-center py-8">
                {members.length === 0 ? 'No members yet' : 'No members match your search'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Member Modal — full profile + photo + trips */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl my-6 bg-brand-dark-grey">
            {/* Header */}
            <CardHeader className="flex items-center justify-between gap-4 border-b border-brand-brown/20 sticky top-0 bg-brand-dark-grey z-10">
              <CardTitle className="text-brand-cream">Edit Member</CardTitle>
              <button
                onClick={() => {
                  if (isSavingMember || uploadingAvatar) return;
                  setEditError(null);
                  setAvatarUploadError(null);
                  setEditingMember(null);
                  setEditingMemberTripIds([]);
                }}
                className="text-brand-cream/60 hover:text-brand-cream"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Error */}
              {(editError || avatarUploadError) && (
                <div className="p-3 rounded border bg-red-900/20 border-red-600/50">
                  <p className="text-sm text-red-400">{editError || avatarUploadError}</p>
                </div>
              )}

              {/* ── Profile Photo ─────────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold text-brand-cream/50 uppercase tracking-wider mb-3">Profile Photo</h3>
                <div className="flex items-center gap-5">
                  {/* Avatar preview */}
                  <div className="relative w-20 h-20 shrink-0">
                    {editingMember.avatar_url ? (
                      <img
                        src={editingMember.avatar_url}
                        alt={getMemberDisplayName(editingMember)}
                        className="w-20 h-20 rounded-full object-cover border-2 border-brand-brown/40"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-brand-brown/20 border-2 border-brand-brown/40 flex items-center justify-center">
                        <span className="text-2xl font-bold text-brand-cream/50">
                          {(editingMember.first_name?.[0] || editingMember.full_name?.[0] || editingMember.email?.[0] || '?').toUpperCase()}
                        </span>
                      </div>
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                        <Spinner />
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <label className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${uploadingAvatar ? 'opacity-50 pointer-events-none' : 'bg-brand-brown hover:bg-brand-brown/80'} text-brand-black`}>
                      <Camera className="w-3.5 h-3.5" />
                      {uploadingAvatar ? 'Uploading…' : 'Change Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileSelect}
                        disabled={uploadingAvatar}
                      />
                    </label>
                    {editingMember.avatar_url && (
                      <button
                        onClick={handleClearAvatar}
                        disabled={uploadingAvatar}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors text-left disabled:opacity-50"
                      >
                        Remove photo
                      </button>
                    )}
                    <p className="text-brand-cream/40 text-xs">JPEG, PNG or WebP · max 5 MB</p>
                  </div>
                </div>
              </div>

              {/* ── Personal Information ──────────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold text-brand-cream/50 uppercase tracking-wider mb-3">Personal Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">First Name</label>
                    <Input value={editingMember.first_name || ''} onChange={(e) => setEditingMember({ ...editingMember, first_name: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Middle Name</label>
                    <Input value={editingMember.middle_name || ''} onChange={(e) => setEditingMember({ ...editingMember, middle_name: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Surname</label>
                    <Input value={editingMember.surname || ''} onChange={(e) => setEditingMember({ ...editingMember, surname: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Nickname</label>
                    <Input value={editingMember.nickname || ''} onChange={(e) => setEditingMember({ ...editingMember, nickname: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Date of Birth</label>
                    <Input type="date" value={editingMember.date_of_birth || ''} onChange={(e) => setEditingMember({ ...editingMember, date_of_birth: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Role</label>
                    <select value={editingMember.role || 'member'} onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })} className="w-full px-3 py-2 bg-brand-black/50 border border-brand-brown/20 rounded text-brand-cream text-sm">
                      <option value="member">Member</option>
                      <option value="trip_admin">Trip Admin</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Status</label>
                    <select value={editingMember.status || 'active'} onChange={(e) => setEditingMember({ ...editingMember, status: e.target.value })} className="w-full px-3 py-2 bg-brand-black/50 border border-brand-brown/20 rounded text-brand-cream text-sm">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Contact ──────────────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold text-brand-cream/50 uppercase tracking-wider mb-3">Contact</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Email</label>
                    <Input value={editingMember.email || ''} onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Phone Country Code</label>
                    <Input value={editingMember.phone_country_code || ''} placeholder="+61" onChange={(e) => setEditingMember({ ...editingMember, phone_country_code: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Phone</label>
                    <Input value={editingMember.phone || ''} onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Emergency Contact</label>
                    <Input value={editingMember.emergency_contact || ''} onChange={(e) => setEditingMember({ ...editingMember, emergency_contact: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Emergency Contact Number</label>
                    <Input value={editingMember.emergency_contact_number || ''} onChange={(e) => setEditingMember({ ...editingMember, emergency_contact_number: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                </div>
              </div>

              {/* ── Address ──────────────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold text-brand-cream/50 uppercase tracking-wider mb-3">Address</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Street Address</label>
                    <Input value={editingMember.address_line1 || editingMember.address || ''} onChange={(e) => setEditingMember({ ...editingMember, address_line1: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Address Line 2</label>
                    <Input value={editingMember.address_line2 || ''} onChange={(e) => setEditingMember({ ...editingMember, address_line2: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">City</label>
                    <Input value={editingMember.address_city || ''} onChange={(e) => setEditingMember({ ...editingMember, address_city: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">State</label>
                    <Input value={editingMember.address_state || ''} onChange={(e) => setEditingMember({ ...editingMember, address_state: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Postcode</label>
                    <Input value={editingMember.address_postcode || ''} onChange={(e) => setEditingMember({ ...editingMember, address_postcode: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Country</label>
                    <Input value={editingMember.address_country || ''} onChange={(e) => setEditingMember({ ...editingMember, address_country: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                </div>
              </div>

              {/* ── Passport & Apparel ───────────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold text-brand-cream/50 uppercase tracking-wider mb-3">Passport & Apparel</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Passport Number</label>
                    <Input value={editingMember.passport_number || ''} onChange={(e) => setEditingMember({ ...editingMember, passport_number: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Passport Expiry</label>
                    <Input type="date" value={editingMember.passport_expiry || ''} onChange={(e) => setEditingMember({ ...editingMember, passport_expiry: e.target.value })} className="bg-brand-black/50 border-brand-brown/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Shirt Size</label>
                    <select value={editingMember.shirt_size || ''} onChange={(e) => setEditingMember({ ...editingMember, shirt_size: e.target.value })} className="w-full px-3 py-2 bg-brand-black/50 border border-brand-brown/20 rounded text-brand-cream text-sm">
                      <option value="">Select</option>
                      {APPAREL_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-brand-cream/70 text-xs font-medium mb-1">Shorts Size</label>
                    <select value={editingMember.shorts_size || ''} onChange={(e) => setEditingMember({ ...editingMember, shorts_size: e.target.value })} className="w-full px-3 py-2 bg-brand-black/50 border border-brand-brown/20 rounded text-brand-cream text-sm">
                      <option value="">Select</option>
                      {APPAREL_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Trip Assignment ──────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold text-brand-cream/50 uppercase tracking-wider mb-3">Trip Membership</h3>
                <div className="rounded border border-brand-brown/20 bg-brand-black/30 p-3">
                  {trips.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {trips.map((trip) => (
                        <label
                          key={trip.id}
                          className="flex items-center gap-3 rounded border border-brand-brown/20 bg-brand-black/20 px-3 py-2 text-sm text-brand-cream hover:border-brand-brown/40 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={editingMemberTripIds.includes(trip.id)}
                            onChange={() => handleToggleEditingMemberTrip(trip.id)}
                            disabled={isSavingMember}
                            className="h-4 w-4"
                          />
                          <span>{trip.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-brand-cream/60">No trips available.</p>
                  )}
                </div>
                <p className="text-xs text-brand-cream/50 mt-1.5">
                  {editingMemberTripIds.length} trip{editingMemberTripIds.length !== 1 ? 's' : ''} selected.
                </p>
              </div>

              {/* ── Actions ──────────────────────────────────────────── */}
              <div className="flex gap-3 pt-2 border-t border-brand-brown/20">
                <Button
                  onClick={() => void handleSaveEditingMember()}
                  isLoading={isSavingMember || uploadingAvatar}
                  disabled={isSavingMember || uploadingAvatar}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSavingMember ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button
                  onClick={() => {
                    if (isSavingMember || uploadingAvatar) return;
                    setEditError(null);
                    setAvatarUploadError(null);
                    setEditingMember(null);
                    setEditingMemberTripIds([]);
                  }}
                  disabled={isSavingMember || uploadingAvatar}
                  className="px-6 bg-brand-black/50 hover:bg-brand-black/70 text-brand-cream"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
