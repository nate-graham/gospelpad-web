import { redirect } from 'next/navigation';

// Profile and settings are one page now.
export default function ProfilePage() {
  redirect('/settings');
}
