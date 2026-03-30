import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Sign In - Whiskey Riders',
  description: 'Sign in to your Whiskey Riders account',
};

export default function LoginPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-brand-cream mb-6 text-center">
        Sign In
      </h2>
      <LoginForm />
    </div>
  );
}
