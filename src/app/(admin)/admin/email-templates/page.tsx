import { redirect } from 'next/navigation';

// Templates are now managed from the Email Campaigns page (Templates tab)
export default function EmailTemplatesRedirect() {
  redirect('/admin/emails');
}
