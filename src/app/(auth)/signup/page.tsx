import { SignupForm } from '@/components/auth/SignupForm';

export const metadata = {
  title: 'Member Signup - Whiskey Riders',
  description: 'Request a new Whiskey Riders member account',
};

export default function SignupPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-brand-cream mb-2 text-center">Member Signup</h2>
      <p className="text-brand-cream/70 text-sm text-center mb-6">
        Submit your details for admin approval before portal access is granted.
      </p>
      <SignupForm />
    </div>
  );
}
