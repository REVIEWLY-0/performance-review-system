'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, invalidateUserCache, requestPasswordReset, User } from '@/lib/auth';
import { ratingScaleApi, RatingScale, RatingScaleLabel, ALL_DEFAULT_LABELS, DEFAULT_SCALE } from '@/lib/rating-scale';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferences,
} from '@/lib/notifications';
import { usersApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import BackButton from '@/components/BackButton';
import Avatar from '@/components/Avatar';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    cycleStarted: true,
    reviewAssigned: true,
    reminders: true,
    scoreAvailable: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ratingScaleInput, setRatingScaleInput] = useState<RatingScale>(DEFAULT_SCALE);
  const [savingRatingScale, setSavingRatingScale] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [currentUser, prefs, scale] = await Promise.all([
        getCurrentUser(),
        getNotificationPreferences(),
        ratingScaleApi.get(),
      ]);
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);
      setNameInput(currentUser.name);
      setPreferences(prefs);
      setRatingScaleInput(scale);
    } catch (err: any) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    if (trimmed.length > 100) {
      toast.error('Name must be 100 characters or fewer');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateProfile(trimmed);
      // Bust the user cache so DashboardNav picks up the new name
      invalidateUserCache();
      setUser((prev) => prev ? { ...prev, name: updated.name } : prev);
      setNameInput(updated.name);
      toast.success('Profile updated');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const updated = await usersApi.uploadAvatar(file);
      invalidateUserCache();
      // Append a cache-busting param so the browser fetches the new image even if
      // the Supabase CDN URL is identical (same path, upsert replaces the file).
      const bustedUrl = updated.avatarUrl ? `${updated.avatarUrl}?t=${Date.now()}` : updated.avatarUrl;
      setUser((prev) => {
        const next = prev ? { ...prev, avatarUrl: bustedUrl } : prev;
        if (next) window.dispatchEvent(new CustomEvent('user-updated', { detail: next }));
        return next;
      });
      toast.success('Avatar updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await usersApi.deleteAvatar();
      invalidateUserCache();
      setUser((prev) => {
        const next = prev ? { ...prev, avatarUrl: null } : prev;
        if (next) window.dispatchEvent(new CustomEvent('user-updated', { detail: next }));
        return next;
      });
      toast.success('Avatar removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePasswordReset = async () => {
    setSendingReset(true);
    try {
      const result = await requestPasswordReset();
      toast.success(result.message || 'Password reset email sent — check your inbox');
    } catch (err: any) {
      console.error('Password reset error:', err);
      toast.error(err.message || 'Failed to send password reset email');
    } finally {
      setSendingReset(false);
    }
  };

  const handleMaxRatingChange = (val: number) => {
    const clamped = Math.min(10, Math.max(1, val));
    const newLabels: RatingScaleLabel[] = Array.from({ length: clamped }, (_, i) => {
      const v = i + 1;
      const existing = ratingScaleInput.labels.find((l) => l.value === v);
      if (existing) return existing;
      const def = ALL_DEFAULT_LABELS.find((l) => l.value === v);
      return def ?? { value: v, title: '', description: '' };
    });
    setRatingScaleInput({ maxRating: clamped, labels: newLabels });
  };

  const handleLabelChange = (value: number, field: 'title' | 'description', text: string) => {
    setRatingScaleInput((prev) => ({
      ...prev,
      labels: prev.labels.map((l) => (l.value === value ? { ...l, [field]: text } : l)),
    }));
  };

  const handleSaveRatingScale = async () => {
    setSavingRatingScale(true);
    try {
      const updated = await ratingScaleApi.update(ratingScaleInput);
      setRatingScaleInput(updated);
      toast.success('Rating scale saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save rating scale');
    } finally {
      setSavingRatingScale(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNotificationPreferences(preferences);
      toast.success('Notification preferences saved');
    } catch (err: any) {
      console.error('Error saving preferences:', err);
      toast.error(err.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 animate-pulse">
          <div className="h-4 bg-surface-container-high rounded w-32 mb-4" />
          <div className="h-7 bg-surface-container-high rounded w-24 mb-1" />
          <div className="h-4 bg-surface-container-high rounded w-72" />
        </div>
        <div className="bg-surface-container-lowest shadow rounded-lg p-6 mb-6 animate-pulse">
          <div className="h-5 bg-surface-container-high rounded w-44 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-surface-container-high rounded w-16" />
                <div className="h-4 bg-surface-container-high rounded w-40" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface-container-lowest shadow rounded-lg p-6 animate-pulse">
          <div className="h-5 bg-surface-container-high rounded w-40 mb-2" />
          <div className="h-4 bg-surface-container-high rounded w-64 mb-6" />
          <div className="space-y-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-4 bg-surface-container-high rounded w-32" />
                  <div className="h-3 bg-surface-container-high rounded w-52" />
                </div>
                <div className="h-6 w-11 bg-surface-container-high rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const profileDirty = nameInput.trim() !== user.name;

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <BackButton label="Back" />
        <h1 className="text-2xl font-bold text-on-surface">Settings</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Manage your account settings and notification preferences
        </p>
      </div>

      {/* Account Information */}
      <div className="bg-surface-container-lowest shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-on-surface mb-4">Account Information</h2>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 pb-4 border-b border-outline-variant">
            <Avatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-on-surface">Profile photo</p>
              <p className="text-xs text-on-surface-variant">JPG, PNG or WebP — max 2 MB</p>
              <div className="flex items-center gap-2 mt-1">
                <label className={`cursor-pointer px-3 py-1.5 text-sm font-medium rounded-lg border border-outline text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors ${uploadingAvatar ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                </label>
                {user.avatarUrl && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name — editable */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              minLength={2}
              maxLength={100}
              className="block w-full rounded-md border border-outline px-3 py-2 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Email — read-only */}
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">
              Email
              <span className="ml-1 text-xs text-on-surface-variant">(read-only)</span>
            </label>
            <p className="text-sm text-on-surface py-2">{user.email}</p>
          </div>

          {/* Role — read-only */}
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">
              Role
              <span className="ml-1 text-xs text-on-surface-variant">(managed by admin)</span>
            </label>
            <p className="text-sm text-on-surface py-2">{user.role}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile || !profileDirty}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dim focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-outline disabled:cursor-not-allowed"
          >
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Rating Scale — admin only */}
      {user.role === 'ADMIN' && (
        <div className="bg-surface-container-lowest shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-on-surface mb-1">Rating Scale</h2>
          <p className="text-sm text-on-surface-variant mb-5">
            Configure the rating scale used in all reviews. Employees see the label definitions when submitting answers.
          </p>

          {/* Max rating input */}
          <div className="mb-5">
            <label htmlFor="maxRating" className="block text-sm font-medium text-on-surface-variant mb-1">
              Maximum rating value
              <span className="ml-1 text-xs text-on-surface-variant">(1 – 10)</span>
            </label>
            <input
              id="maxRating"
              type="number"
              min={1}
              max={10}
              value={ratingScaleInput.maxRating}
              onChange={(e) => handleMaxRatingChange(parseInt(e.target.value, 10) || 1)}
              className="w-24 rounded-md border border-outline px-3 py-2 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Per-value label editor */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-on-surface-variant uppercase tracking-wide pb-1 border-b">
              <div className="col-span-1">#</div>
              <div className="col-span-3">Title</div>
              <div className="col-span-8">Description</div>
            </div>
            {ratingScaleInput.labels.map((label) => (
              <div key={label.value} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-1">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                    {label.value}
                  </span>
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={label.title}
                    onChange={(e) => handleLabelChange(label.value, 'title', e.target.value)}
                    maxLength={40}
                    placeholder="Title"
                    className="block w-full rounded-md border border-outline px-2 py-1.5 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-8">
                  <input
                    type="text"
                    value={label.description}
                    onChange={(e) => handleLabelChange(label.value, 'description', e.target.value)}
                    maxLength={100}
                    placeholder="Short description visible to employees"
                    className="block w-full rounded-md border border-outline px-2 py-1.5 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={handleSaveRatingScale}
              disabled={savingRatingScale}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dim focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-outline disabled:cursor-not-allowed"
            >
              {savingRatingScale ? 'Saving...' : 'Save Rating Scale'}
            </button>
          </div>
        </div>
      )}

      {/* Security */}
      <div className="bg-surface-container-lowest shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-on-surface mb-1">Security</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          Manage your password and account security
        </p>

        <div className="flex items-center justify-between py-3 border-t border-outline-variant">
          <div>
            <h3 className="text-sm font-medium text-on-surface">Password</h3>
            <p className="text-sm text-on-surface-variant">
              We'll send a reset link to <span className="font-medium">{user.email}</span>
            </p>
          </div>
          <button
            onClick={handlePasswordReset}
            disabled={sendingReset}
            className="inline-flex items-center px-4 py-2 border border-outline text-sm font-medium rounded-md text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingReset ? 'Sending...' : 'Send Reset Email'}
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-surface-container-lowest shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-on-surface mb-4">
          Email Notifications
        </h2>
        <p className="text-sm text-on-surface-variant mb-6">
          Choose which email notifications you want to receive
        </p>

        <div className="space-y-4">
          {/* Cycle Started */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-on-surface">
                Cycle Started
              </h3>
              <p className="text-sm text-on-surface-variant">
                Get notified when a new review cycle begins
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('cycleStarted')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                preferences.cycleStarted ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.cycleStarted ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Review Assigned */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-on-surface">
                Review Assigned
              </h3>
              <p className="text-sm text-on-surface-variant">
                Get notified when you're assigned a review
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('reviewAssigned')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                preferences.reviewAssigned ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.reviewAssigned ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Reminders */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-on-surface">
                Review Reminders
              </h3>
              <p className="text-sm text-on-surface-variant">
                Get reminded about pending reviews 3 days before deadline
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('reminders')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                preferences.reminders ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.reminders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Score Available */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-on-surface">
                Score Available
              </h3>
              <p className="text-sm text-on-surface-variant">
                Get notified when your performance score is ready
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('scoreAvailable')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                preferences.scoreAvailable ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.scoreAvailable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dim focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-outline"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
