import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      theme="dark"
      toastOptions={{
        classNames: {
          toast: 'bg-gray-900 border border-gray-700 text-white shadow-lg',
          description: 'text-gray-400 text-sm',
          closeButton: 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white',
          actionButton: 'bg-blue-600 hover:bg-blue-700 text-white',
        },
        duration: 3000,
      }}
    />
  );
}

export { toast } from 'sonner';
export type { ExternalToast } from 'sonner';
