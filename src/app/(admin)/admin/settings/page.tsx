'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { Settings, Mail, Bell, Shield, Eye, Lock, Save, Upload } from 'lucide-react';

type BackgroundMediaType = 'image' | 'video';

const DEFAULT_LOGO_URL = '/3.png';
const DEFAULT_BACKGROUND_URL = '/swirl-bg.svg';
const DEFAULT_BACKGROUND_MEDIA_TYPE: BackgroundMediaType = 'image';
const MAX_BACKGROUND_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_BACKGROUND_VIDEO_SIZE_BYTES = 80 * 1024 * 1024;
const SITE_SETTINGS_MISSING_TABLE_TEXT = "Could not find the table 'public.site_settings'";
const SUPPORTED_BACKGROUND_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'];
const SUPPORTED_BACKGROUND_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);
const SUPPORTED_BACKGROUND_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'ogg', 'm4v'];
const SUPPORTED_BACKGROUND_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/x-m4v',
]);
const SITE_SETTINGS_SELECT =
  'id, logo_url, background_image_url, background_media_type, background_video_url, background_position_x, background_position_y, background_zoom, background_opacity';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseBoundedInt = (value: string, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return clamp(parsed, min, max);
};

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

const isSupabaseErrorLike = (value: unknown): value is SupabaseErrorLike =>
  typeof value === 'object'
  && value !== null
  && ('message' in value || 'details' in value || 'hint' in value || 'code' in value);

const extractErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (isSupabaseErrorLike(err)) {
    const parts = [err.message, err.details, err.hint]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ');
    if (parts) return parts;
    if (err.code) return `Supabase error (${err.code})`;
  }
  return 'Unknown error';
};

const toFriendlyErrorMessage = (err: unknown, action: 'load' | 'save' | 'upload') => {
  const rawMessage = extractErrorMessage(err);
  if (rawMessage.includes(SITE_SETTINGS_MISSING_TABLE_TEXT)) {
    return 'Site settings are not initialized yet. Run migration `migrations/create_site_settings_and_landing_background_controls.sql` (and then media migration), then try again.';
  }
  if (rawMessage.includes('background_media_type') || rawMessage.includes('background_video_url')) {
    return 'Landing background media columns are missing. Run migration `migrations/add_media_support_for_photos_and_landing_background.sql` and try again.';
  }

  if (action === 'load') return `Failed to load settings. ${rawMessage}`;
  if (action === 'save') return `Failed to save settings. ${rawMessage}`;
  return `Failed to upload media. ${rawMessage}`;
};

const extractExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || '';

const isHeicOrHeif = (fileNameOrUrl: string, mimeType?: string) => {
  const lower = fileNameOrUrl.toLowerCase();
  return (
    lower.endsWith('.heic')
    || lower.endsWith('.heif')
    || /\.(heic|heif)(\?|#|$)/i.test(lower)
    || (mimeType ? /heic|heif/i.test(mimeType) : false)
  );
};

interface PortalSettings {
  portal_name: string;
  portal_description: string;
  contact_email: string;
  support_email: string;
  email_from_name: string;
  email_from_address: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  notify_on_trip_created: boolean;
  notify_on_payment_received: boolean;
  notify_on_member_joined: boolean;
  notify_on_document_shared: boolean;
  notify_on_award_created: boolean;
  password_expiry_days: number;
  password_min_length: number;
  require_2fa_for_admins: boolean;
  session_timeout_minutes: number;
  max_login_attempts: number;
  enable_payments: boolean;
  enable_voting: boolean;
  enable_documents: boolean;
  enable_gallery: boolean;
  enable_member_profiles: boolean;
  logo_url: string;
  background_media_type: BackgroundMediaType;
  background_image_url: string;
  background_video_url: string;
  background_position_x: number;
  background_position_y: number;
  background_zoom: number;
  background_opacity: number;
}

type SiteSettingsRow = {
  id: string;
  logo_url: string;
  background_media_type: BackgroundMediaType;
  background_image_url: string;
  background_video_url: string | null;
  background_position_x: number;
  background_position_y: number;
  background_zoom: number;
  background_opacity: number;
};

const DEFAULT_SETTINGS: PortalSettings = {
  // General
  portal_name: 'Whiskey Riders Portal',
  portal_description: 'Manage your whiskey riding trips and community',
  contact_email: 'contact@whiskeyriders.com',
  support_email: 'support@whiskeyriders.com',

  // Email Settings
  email_from_name: 'Whiskey Riders',
  email_from_address: 'noreply@whiskeyriders.com',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_password: '',

  // Notification Preferences
  notify_on_trip_created: true,
  notify_on_payment_received: true,
  notify_on_member_joined: true,
  notify_on_document_shared: true,
  notify_on_award_created: true,

  // Security
  password_expiry_days: 90,
  password_min_length: 8,
  require_2fa_for_admins: true,
  session_timeout_minutes: 30,
  max_login_attempts: 5,

  // Feature Flags
  enable_payments: true,
  enable_voting: true,
  enable_documents: true,
  enable_gallery: true,
  enable_member_profiles: true,

  // Site branding used by landing page
  logo_url: DEFAULT_LOGO_URL,
  background_media_type: DEFAULT_BACKGROUND_MEDIA_TYPE,
  background_image_url: DEFAULT_BACKGROUND_URL,
  background_video_url: '',
  background_position_x: 50,
  background_position_y: 50,
  background_zoom: 100,
  background_opacity: 40,
};

export default function SettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [siteSettingsId, setSiteSettingsId] = useState<string | null>(null);

  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [original, setOriginal] = useState<PortalSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select(SITE_SETTINGS_SELECT)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const loaded: PortalSettings = {
        ...DEFAULT_SETTINGS,
        logo_url: data?.logo_url || DEFAULT_LOGO_URL,
        background_media_type: data?.background_media_type === 'video' ? 'video' : 'image',
        background_image_url: data?.background_image_url || DEFAULT_BACKGROUND_URL,
        background_video_url: data?.background_video_url || '',
        background_position_x: clamp(data?.background_position_x ?? 50, 0, 100),
        background_position_y: clamp(data?.background_position_y ?? 50, 0, 100),
        background_zoom: clamp(data?.background_zoom ?? 100, 25, 300),
        background_opacity: clamp(data?.background_opacity ?? 40, 0, 100),
      };

      setSiteSettingsId(data?.id ?? null);
      setSettings(loaded);
      setOriginal(loaded);
    } catch (err) {
      console.error('Error:', err);
      setErrorMessage(toFriendlyErrorMessage(err, 'load'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = <K extends keyof PortalSettings>(key: K, value: PortalSettings[K]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSuccess(false);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) {
        throw userError;
      }
      if (!userResult.user?.id) {
        throw new Error('You must be logged in to save settings.');
      }

      if (settings.background_media_type === 'video' && !settings.background_video_url.trim()) {
        throw new Error('Background video URL is required when media type is video.');
      }

      const payload = {
        logo_url: settings.logo_url || DEFAULT_LOGO_URL,
        background_media_type: settings.background_media_type || DEFAULT_BACKGROUND_MEDIA_TYPE,
        background_image_url: settings.background_image_url || DEFAULT_BACKGROUND_URL,
        background_video_url: settings.background_video_url || null,
        background_position_x: clamp(settings.background_position_x, 0, 100),
        background_position_y: clamp(settings.background_position_y, 0, 100),
        background_zoom: clamp(settings.background_zoom, 25, 300),
        background_opacity: clamp(settings.background_opacity, 0, 100),
        updated_by: userResult.user.id,
      };

      const updateById = async (id: string) =>
        supabase
          .from('site_settings')
          .update(payload)
          .eq('id', id)
          .select(SITE_SETTINGS_SELECT)
          .maybeSingle();

      let persisted: SiteSettingsRow | null = null;
      let persistedId = siteSettingsId;

      if (siteSettingsId) {
        const { data, error } = await updateById(siteSettingsId);

        if (error) {
          throw error;
        }

        if (!data) {
          const { data: latest, error: latestError } = await supabase
            .from('site_settings')
            .select('id')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestError) {
            throw latestError;
          }

          if (latest?.id && latest.id !== siteSettingsId) {
            const retry = await updateById(latest.id);
            if (retry.error) {
              throw retry.error;
            }
            persisted = retry.data;
            persistedId = latest.id;
          }
        } else {
          persisted = data;
        }
      } else {
        const { data, error } = await supabase
          .from('site_settings')
          .insert(payload)
          .select(SITE_SETTINGS_SELECT)
          .maybeSingle();

        if (error) {
          throw error;
        }
        persisted = data;
        persistedId = data?.id ?? null;
      }

      if (!persisted) {
        throw new Error(
          'No site settings row was updated. Ensure your profile has the admin or super_admin role.'
        );
      }

      const nextSettings: PortalSettings = {
        ...settings,
        logo_url: persisted?.logo_url || payload.logo_url,
        background_media_type: persisted?.background_media_type || payload.background_media_type,
        background_image_url: persisted?.background_image_url || payload.background_image_url,
        background_video_url: persisted?.background_video_url || payload.background_video_url || '',
        background_position_x: persisted?.background_position_x ?? payload.background_position_x,
        background_position_y: persisted?.background_position_y ?? payload.background_position_y,
        background_zoom: persisted?.background_zoom ?? payload.background_zoom,
        background_opacity: persisted?.background_opacity ?? payload.background_opacity,
      };

      setSiteSettingsId(persistedId ?? persisted.id);
      setSettings(nextSettings);
      setOriginal(nextSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error:', err);
      setErrorMessage(toFriendlyErrorMessage(err, 'save'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadMessage(null);
    setErrorMessage(null);
    setIsUploadingBackground(true);

    try {
      const fileName = file.name.toLowerCase();
      const fileExtension = extractExtension(fileName);
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        throw new Error('Please choose an image or video file.');
      }

      if (isImage && isHeicOrHeif(fileName, file.type)) {
        throw new Error(
          'HEIC/HEIF images are not previewable in most browsers. Convert to JPG, PNG, WEBP, GIF, AVIF, or SVG and upload again.'
        );
      }

      if (isImage) {
        const mimeLooksSupported = file.type ? SUPPORTED_BACKGROUND_MIME_TYPES.has(file.type) : false;
        const extensionLooksSupported = SUPPORTED_BACKGROUND_EXTENSIONS.includes(fileExtension);
        if (!mimeLooksSupported && !extensionLooksSupported) {
          throw new Error('Unsupported image format. Use JPG, PNG, WEBP, GIF, AVIF, or SVG.');
        }
      }

      if (isVideo) {
        const mimeLooksSupported = file.type ? SUPPORTED_BACKGROUND_VIDEO_MIME_TYPES.has(file.type) : false;
        const extensionLooksSupported = SUPPORTED_BACKGROUND_VIDEO_EXTENSIONS.includes(fileExtension);
        if (!mimeLooksSupported && !extensionLooksSupported) {
          throw new Error('Unsupported video format. Use MP4, WEBM, MOV, OGG, or M4V.');
        }
      }

      if (isImage && file.size > MAX_BACKGROUND_IMAGE_SIZE_BYTES) {
        throw new Error('Background image must be 10MB or smaller.');
      }

      if (isVideo && file.size > MAX_BACKGROUND_VIDEO_SIZE_BYTES) {
        throw new Error('Background video must be 80MB or smaller.');
      }

      const safeExtension = /^[a-z0-9]+$/.test(fileExtension)
        ? fileExtension
        : isVideo
          ? 'mp4'
          : 'jpg';
      const path = `site/backgrounds/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExtension}`;

      const { error: uploadError } = await supabase.storage.from('photos').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('photos').getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error('Failed to generate public URL for uploaded media.');
      }

      if (isVideo) {
        handleChange('background_media_type', 'video');
        handleChange('background_video_url', data.publicUrl);
      } else {
        handleChange('background_media_type', 'image');
        handleChange('background_image_url', data.publicUrl);
      }
      setUploadMessage('Background media uploaded. Click "Save Settings" to publish it on the landing page.');
    } catch (err) {
      console.error('Background upload error:', err);
      setErrorMessage(toFriendlyErrorMessage(err, 'upload'));
    } finally {
      setIsUploadingBackground(false);
      event.target.value = '';
    }
  };

  const handleReset = () => {
    setSettings(original);
    setSuccess(false);
    setErrorMessage(null);
    setUploadMessage(null);
  };

  const isChanged = JSON.stringify(settings) !== JSON.stringify(original);
  const previewBackgroundImageUrl = settings.background_image_url || DEFAULT_BACKGROUND_URL;
  const previewBackgroundVideoUrl = settings.background_video_url;
  const hasUnsupportedPreviewFormat =
    settings.background_media_type === 'image' && isHeicOrHeif(previewBackgroundImageUrl);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings size={32} className="text-blue-400" />
        <div>
          <h1 className="text-3xl font-bold">Settings & Configuration</h1>
          <p className="text-gray-400">Manage portal settings and system configuration</p>
        </div>
      </div>

      {success && (
        <Card className="border border-green-500 bg-green-900/20 p-4">
          <p className="text-green-400">✓ Settings saved successfully!</p>
        </Card>
      )}
      {errorMessage && (
        <Card className="border border-red-500 bg-red-900/20 p-4">
          <p className="text-red-400">{errorMessage}</p>
        </Card>
      )}

      {/* Tabs */}
      <Card className="border-b border-gray-700">
        <div className="flex gap-1 p-4 border-b border-gray-700">
          {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'email', label: 'Email', icon: Mail },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'features', label: 'Features', icon: Eye },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-900/30 text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* General Settings */}
      {activeTab === 'general' && (
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Portal Name</label>
              <Input
                type="text"
                value={settings.portal_name}
                onChange={(e) => handleChange('portal_name', e.target.value)}
                placeholder="Portal name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Portal Description</label>
              <Input
                type="text"
                value={settings.portal_description}
                onChange={(e) => handleChange('portal_description', e.target.value)}
                placeholder="Portal description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Contact Email</label>
              <Input
                type="email"
                value={settings.contact_email}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                placeholder="contact@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Support Email</label>
              <Input
                type="email"
                value={settings.support_email}
                onChange={(e) => handleChange('support_email', e.target.value)}
                placeholder="support@example.com"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Email Settings */}
      {activeTab === 'email' && (
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">From Name</label>
                <Input
                  type="text"
                  value={settings.email_from_name}
                  onChange={(e) => handleChange('email_from_name', e.target.value)}
                  placeholder="Email from name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">From Address</label>
                <Input
                  type="email"
                  value={settings.email_from_address}
                  onChange={(e) => handleChange('email_from_address', e.target.value)}
                  placeholder="noreply@example.com"
                />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="font-bold mb-4">SMTP Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">SMTP Host</label>
                  <Input
                    type="text"
                    value={settings.smtp_host}
                    onChange={(e) => handleChange('smtp_host', e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">SMTP Port</label>
                  <Input
                    type="number"
                    value={settings.smtp_port}
                    onChange={(e) => handleChange('smtp_port', e.target.value)}
                    placeholder="587"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">SMTP Username</label>
                  <Input
                    type="text"
                    value={settings.smtp_user}
                    onChange={(e) => handleChange('smtp_user', e.target.value)}
                    placeholder="username"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">SMTP Password</label>
                  <Input
                    type="password"
                    value={settings.smtp_password}
                    onChange={(e) => handleChange('smtp_password', e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <Card className="p-6 space-y-4">
          <div className="space-y-3">
            {[
              { key: 'notify_on_trip_created', label: 'Trip Created', description: 'Notify when a new trip is created' },
              { key: 'notify_on_payment_received', label: 'Payment Received', description: 'Notify when a payment is received' },
              { key: 'notify_on_member_joined', label: 'Member Joined', description: 'Notify when a member joins' },
              { key: 'notify_on_document_shared', label: 'Document Shared', description: 'Notify when documents are shared' },
              { key: 'notify_on_award_created', label: 'Award Created', description: 'Notify when an award is created' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[item.key as keyof typeof settings] as boolean}
                  onChange={(e) => handleChange(item.key, e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Password Expiry Days</label>
                <Input
                  type="number"
                  value={settings.password_expiry_days}
                  onChange={(e) => handleChange('password_expiry_days', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Minimum Password Length</label>
                <Input
                  type="number"
                  value={settings.password_min_length}
                  onChange={(e) => handleChange('password_min_length', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Session Timeout (minutes)</label>
                <Input
                  type="number"
                  value={settings.session_timeout_minutes}
                  onChange={(e) => handleChange('session_timeout_minutes', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Max Login Attempts</label>
                <Input
                  type="number"
                  value={settings.max_login_attempts}
                  onChange={(e) => handleChange('max_login_attempts', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <label className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.require_2fa_for_admins}
                  onChange={(e) => handleChange('require_2fa_for_admins', e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Lock size={16} />
                    Require 2FA for Admins
                  </p>
                  <p className="text-gray-400 text-sm">Force two-factor authentication for admin accounts</p>
                </div>
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* Feature Flags */}
      {activeTab === 'features' && (
        <Card className="p-6 space-y-6">
          <div className="space-y-3">
            {[
              { key: 'enable_payments', label: 'Payments', description: 'Enable payment tracking and management' },
              { key: 'enable_voting', label: 'Voting System', description: 'Enable award voting' },
              { key: 'enable_documents', label: 'Documents', description: 'Enable document uploads and sharing' },
              { key: 'enable_gallery', label: 'Gallery', description: 'Enable photo gallery for trips' },
              { key: 'enable_member_profiles', label: 'Member Profiles', description: 'Allow members to view each other profiles' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[item.key as keyof typeof settings] as boolean}
                  onChange={(e) => handleChange(item.key, e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="border-t border-gray-700 pt-6 space-y-4">
            <div>
              <h3 className="font-bold text-lg">Landing Background</h3>
              <p className="text-gray-400 text-sm">
                Upload a new image/video or paste a URL. This is used on the public landing page hero.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Background Media Type</label>
              <select
                value={settings.background_media_type}
                onChange={(e) => handleChange('background_media_type', e.target.value as BackgroundMediaType)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-brand-cream focus:outline-none focus:border-brand-brown"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Upload Background Media</label>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded bg-brand-brown text-brand-black font-semibold cursor-pointer hover:bg-brand-brown/90 transition-colors">
                <Upload size={16} />
                {isUploadingBackground ? 'Uploading...' : 'Choose File'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,video/mp4,video/webm,video/quicktime,video/ogg,video/x-m4v,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg,.mp4,.webm,.mov,.ogg,.m4v"
                  className="hidden"
                  onChange={handleBackgroundUpload}
                  disabled={isUploadingBackground}
                />
              </label>
              <p className="text-xs text-gray-500">Allowed: images up to 10MB and videos up to 80MB.</p>
            </div>

            {settings.background_media_type === 'image' ? (
              <div>
                <label className="block text-sm font-medium mb-2">Background Image URL</label>
                <Input
                  type="url"
                  value={settings.background_image_url}
                  onChange={(e) => handleChange('background_image_url', e.target.value)}
                  placeholder="https://example.com/background.jpg"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">Background Video URL</label>
                <Input
                  type="url"
                  value={settings.background_video_url}
                  onChange={(e) => handleChange('background_video_url', e.target.value)}
                  placeholder="https://example.com/background.mp4"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Horizontal Position ({settings.background_position_x}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.background_position_x}
                  onChange={(e) =>
                    handleChange('background_position_x', parseBoundedInt(e.target.value, 50, 0, 100))
                  }
                  className="w-full accent-brand-brown"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Vertical Position ({settings.background_position_y}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.background_position_y}
                  onChange={(e) =>
                    handleChange('background_position_y', parseBoundedInt(e.target.value, 50, 0, 100))
                  }
                  className="w-full accent-brand-brown"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Zoom ({settings.background_zoom}%)
                </label>
                <input
                  type="range"
                  min={25}
                  max={300}
                  value={settings.background_zoom}
                  onChange={(e) =>
                    handleChange('background_zoom', parseBoundedInt(e.target.value, 100, 25, 300))
                  }
                  className="w-full accent-brand-brown"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Transparency ({settings.background_opacity}% visible)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.background_opacity}
                  onChange={(e) =>
                    handleChange('background_opacity', parseBoundedInt(e.target.value, 40, 0, 100))
                  }
                  className="w-full accent-brand-brown"
                />
              </div>
            </div>

            {uploadMessage && <p className="text-sm text-brand-tan">{uploadMessage}</p>}
            {hasUnsupportedPreviewFormat && (
              <p className="text-sm text-amber-300">
                This image URL looks like HEIC/HEIF, which most browsers cannot preview. Use JPG, PNG, WEBP, GIF, AVIF, or SVG.
              </p>
            )}

            <div>
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="relative h-52 w-full rounded border border-gray-700 overflow-hidden bg-black">
                {settings.background_media_type === 'video' ? (
                  previewBackgroundVideoUrl ? (
                    <video
                      src={previewBackgroundVideoUrl}
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{
                        objectPosition: `${settings.background_position_x}% ${settings.background_position_y}%`,
                        transform: `scale(${clamp(settings.background_zoom, 25, 300) / 100})`,
                        opacity: clamp(settings.background_opacity, 0, 100) / 100,
                      }}
                      muted
                      autoPlay
                      loop
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-brand-cream/70">
                      Add a video URL or upload a video to preview
                    </div>
                  )
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url('${previewBackgroundImageUrl}')`,
                      backgroundSize: `${settings.background_zoom}%`,
                      backgroundPosition: `${settings.background_position_x}% ${settings.background_position_y}%`,
                      backgroundRepeat: 'no-repeat',
                      opacity: clamp(settings.background_opacity, 0, 100) / 100,
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-black/35" />
                <div className="absolute bottom-3 left-3 text-xs text-brand-cream/80">
                  Live style preview
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isChanged || isSaving || isUploadingBackground}
        >
          <Save size={18} className="mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={!isChanged || isUploadingBackground}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
