import { useRef, useState } from 'react';
import { MeetingLayout } from '@vcs/shared';
import { authApi, usersApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Avatar, Button, Input, Modal, Select, Toggle } from '@/components/ui';

function Section({ title, description, children }) {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Screen 12: account and meeting preferences. */
export default function Settings() {
  const { user, setUser, signOut } = useAuth();
  const toast = useToast();
  const avatarInput = useRef(null);

  const [profile, setProfile] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  const settings = user?.settings ?? {};

  /** Settings toggles save immediately; there is no separate save button. */
  const patchSettings = async (patch) => {
    const previous = user;
    setUser({ ...user, settings: { ...settings, ...patch } });
    try {
      const updated = await usersApi.updateSettings(patch);
      setUser(updated);
    } catch (error) {
      setUser(previous);
      toast.error(error.message);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      setUser(await usersApi.updateProfile(profile));
      toast.success('Profile updated');
      setEditing(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUser(await usersApi.uploadAvatar(file));
      toast.success('Photo updated');
    } catch (error) {
      toast.error(error.message);
    } finally {
      event.target.value = '';
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    try {
      await authApi.changePassword(passwords);
      toast.success('Password changed. Please sign in again.');
      setPasswordOpen(false);
      await signOut();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-extrabold text-slate-900">Settings</h1>

      <Section title="Account">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            className="rounded-full ring-offset-2 hover:ring-2 hover:ring-brand-300"
            aria-label="Change profile photo"
          >
            <Avatar user={user} size="lg" />
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={uploadAvatar}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-slate-900">{user?.name}</p>
            <p className="truncate text-sm text-slate-500">{user?.email}</p>
          </div>

          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        </div>
      </Section>

      <Section title="Meeting" description="Defaults applied every time you join a meeting.">
        <div className="divide-y divide-slate-100">
          <Toggle
            label="Auto Join Audio"
            checked={settings.autoJoinAudio ?? true}
            onChange={(value) => patchSettings({ autoJoinAudio: value })}
          />
          <Toggle
            label="Auto Join Video"
            checked={settings.autoJoinVideo ?? true}
            onChange={(value) => patchSettings({ autoJoinVideo: value })}
          />
          <Toggle
            label="Show Meeting Notifications"
            checked={settings.showMeetingNotifications ?? true}
            onChange={(value) => patchSettings({ showMeetingNotifications: value })}
          />
          <Toggle
            label="Mirror My Video"
            description="Only affects how you see yourself."
            checked={settings.mirrorSelfView ?? true}
            onChange={(value) => patchSettings({ mirrorSelfView: value })}
          />

          <div className="flex items-center justify-between gap-4 py-4">
            <span className="text-sm font-medium text-slate-800">Default Meeting Layout</span>
            <Select
              name="defaultMeetingLayout"
              className="w-48"
              value={settings.defaultMeetingLayout ?? MeetingLayout.Gallery}
              onChange={(event) => patchSettings({ defaultMeetingLayout: event.target.value })}
            >
              <option value={MeetingLayout.Gallery}>Gallery View</option>
              <option value={MeetingLayout.Speaker}>Speaker View</option>
              <option value={MeetingLayout.Sidebar}>Sidebar View</option>
            </Select>
          </div>
        </div>
      </Section>

      <Section title="Security">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Changing your password signs you out of every device.
          </p>
          <Button variant="outline" onClick={() => setPasswordOpen(true)}>
            Change password
          </Button>
        </div>
      </Section>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit Profile"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button form="profile-form" type="submit" loading={savingProfile}>
              Save
            </Button>
          </>
        }
      >
        <form id="profile-form" className="space-y-4" onSubmit={saveProfile}>
          <Input
            label="Full name"
            name="name"
            value={profile.name}
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
            required
          />
          <Input
            label="Phone number"
            name="phone"
            value={profile.phone}
            onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
            hint="Used as an alternative way to sign in."
          />
        </form>
      </Modal>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Change password"
        footer={
          <>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>
              Cancel
            </Button>
            <Button form="password-form" type="submit">
              Change password
            </Button>
          </>
        }
      >
        <form id="password-form" className="space-y-4" onSubmit={changePassword}>
          <Input
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={passwords.currentPassword}
            onChange={(event) =>
              setPasswords({ ...passwords, currentPassword: event.target.value })
            }
            required
          />
          <Input
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={passwords.newPassword}
            onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
            hint="At least 8 characters, with a letter and a number."
            required
          />
        </form>
      </Modal>
    </div>
  );
}
