'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { Settings, Mail, Bell, Shield, Eye, Lock, Save, Upload } from 'lucide-react';

const DEFAULT_LOGO_URL = '/3.png';
const DEFAULT_BACKGROUND_URL = '/swirl-bg.svg';
const MAX_BACKGROUND_SIZE_BYTES = 10 * 1024 * 1024;

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
  background_image_url: string;
}

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
  background_image_url: DEFAULT_BACKGROUND_URL,
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
        .select('id, logo_url, background_image_url')
        .maybeSingle();

      if (error) {
        throw error;
      }

      const loaded: PortalSettings = {
        ...DEFAULT_SETTINGS,
        logo_url: data?.logo_url || DEFAULT_LOGO_URL,
        background_image_url: data?.background_image_url || DEFAULT_BACKGROUND_URL,
      };

      setSiteSettingsId(data?.id ?? null);
      setSettings(loaded);
      setOriginal(loaded);
    } catch (err) {
      console.error('Error:', err);
      setErrorMessage('Failed to load settings from database.');
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

      const payload = {
        logo_url: settings.logo_url || DEFAULT_LOGO_URL,
        background_image_url: settings.background_image_url || DEFAULT_BACKGROUND_URL,
        updated_by: userResult.user?.id || 'system',
      };

      let persisted:
        | { id: string; logo_url: string; background_image_url: string }
        | null
        = null;

      if (siteSettingsId) {
        const { data, error } = await supabase
          .from('site_settings')
          .update(payload)
          .eq('id', siteSettingsId)
          .select('id, logo_url, background_image_url')
          .single();

        if (error) {
          throw error;
        }
        persisted = data;
      } else {
        const { data, error } = await supabase
          .from('site_settings')
          .insert(payload)
          .select('id, logo_url, background_image_url')
          .single();

        if (error) {
          throw error;
        }
        persisted = data;
      }

      const nextSettings: PortalSettings = {
        ...settings,
        logo_url: persisted?.logo_url || payload.logo_url,
        background_image_url: persisted?.background_image_url || payload.background_image_url,
      };

      setSiteSettingsId(persisted?.id || siteSettingsId);
      setSettings(nextSettings);
      setOriginal(nextSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save settings.');
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
      if (!file.type.startsWith('image/')) {
        throw new Error('Please choose an image file.');
      }

      if (file.size > MAX_BACKGROUND_SIZE_BYTES) {
        throw new Error('Background image must be 10MB or smaller.');
      }

      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExtension = /^[a-z0-9]+$/.test(fileExtension) ? fileExtension : 'jpg';
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
        throw new Error('Failed to generate public URL for uploaded image.');
      }

      handleChange('background_image_url', data.publicUrl);
      setUploadMessage('Background uploaded. Click "Save Settings" to publish it on the landing page.');
    } catch (err) {
      console.error('Background upload error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to upload background image.');
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
                Upload a new image or paste a URL. This is used on the public landing page hero.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Upload Background Image</label>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded bg-brand-brown text-brand-black font-semibold cursor-pointer hover:bg-brand-brown/90 transition-colors">
                <Upload size={16} />
                {isUploadingBackground ? 'Uploading...' : 'Choose Image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBackgroundUpload}
                  disabled={isUploadingBackground}
                />
              </label>
              <p className="text-xs text-gray-500">Allowed: image files up to 10MB.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Background Image URL</label>
              <Input
                type="url"
                value={settings.background_image_url}
                onChange={(e) => handleChange('background_image_url', e.target.value)}
                placeholder="https://example.com/background.jpg"
              />
            </div>

            {uploadMessage && <p className="text-sm text-brand-tan">{uploadMessage}</p>}

            <div>
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="h-48 w-full rounded border border-gray-700 overflow-hidden bg-black/40">
                <img
                  src={settings.background_image_url || DEFAULT_BACKGROUND_URL}
                  alt="Landing background preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_BACKGROUND_URL;
                  }}
                />
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
