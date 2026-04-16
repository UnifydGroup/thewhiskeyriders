import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: any;
}

interface FormComponentProps {
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
}

export function FormComponent({
  fields,
  onSubmit,
  isLoading = false,
  submitLabel = 'Submit',
  title,
}: FormComponentProps) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    fields.forEach((field) => {
      initial[field.name] = field.defaultValue ?? '';
    });
    return initial;
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<any>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      await onSubmit(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      {title && <h2 className="text-xl font-bold mb-6">{title}</h2>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-500 rounded-lg">
            <AlertCircle size={20} className="text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-500 rounded-lg">
            <CheckCircle size={20} className="text-green-400" />
            <p className="text-green-400">Submitted successfully</p>
          </div>
        )}

        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium mb-2">{field.label}</label>

            {field.type === 'textarea' ? (
              <Textarea
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.required}
                rows={4}
              />
            ) : field.type === 'select' ? (
              <select
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                required={field.required}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              >
                <option value="">-- Select {field.label} --</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <input
                type="checkbox"
                name={field.name}
                checked={formData[field.name]}
                onChange={handleChange}
                className="w-4 h-4 cursor-pointer"
              />
            ) : (
              <Input
                type={field.type}
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}
          </div>
        ))}

        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? 'Submitting...' : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
