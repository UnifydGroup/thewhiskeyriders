'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/utils';
import { Upload, Check, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Trip } from '@/lib/types/database';

interface PaymentData {
  user_id: string;
  description: string;
  amount: number;
  due_date?: string;
  status: 'pending' | 'paid' | 'overdue' | 'waived';
}

export default function AdminPaymentsPage() {
  const supabase = createClient();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTrips = async () => {
      try {
        const { data: tripsData } = await supabase
          .from('trips')
          .select('*')
          .order('start_date', { ascending: false });

        if (tripsData) {
          setTrips(tripsData);
        }
      } catch (err) {
        console.error('Failed to load trips:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, [supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setData([]);
    setError('');
    setMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        const parsedData = rawData.map((row: any) => ({
          user_id: row.user_id || row.userId || '',
          description: row.description || row.Description || '',
          amount: parseFloat(row.amount || row.Amount || 0),
          due_date: row.due_date || row.dueDate || undefined,
          status: (row.status || row.Status || 'pending').toLowerCase() as
            | 'pending'
            | 'paid'
            | 'overdue'
            | 'waived',
        }));

        setData(parsedData);
        setMessage(`Loaded ${parsedData.length} payment records`);
      } catch (err) {
        setError('Failed to parse Excel file. Make sure it has columns: user_id, description, amount, due_date, status');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleUpload = async () => {
    if (!selectedTripId || data.length === 0) {
      setError('Please select a trip and upload a file');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const paymentsToInsert = data.map((item) => ({
        trip_id: selectedTripId,
        user_id: item.user_id,
        description: item.description,
        amount: item.amount,
        due_date: item.due_date || null,
        status: item.status,
        paid_date: item.status === 'paid' ? new Date().toISOString() : null,
      }));

      const { error: insertError } = await supabase
        .from('payments')
        .insert(paymentsToInsert);

      if (insertError) throw insertError;

      setMessage(`Successfully imported ${paymentsToInsert.length} payments`);
      setFile(null);
      setData([]);
      setSelectedTripId('');

      // Reset file input
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      if (input) input.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload payments');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-cream mb-2">Payment Upload</h1>
        <p className="text-brand-cream/70">Import payment data from Excel spreadsheet</p>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Select Trip */}
          <div>
            <label className="block text-sm font-medium text-brand-cream mb-2">
              Select Trip *
            </label>
            <Select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              disabled={uploading}
            >
              <option value="">Choose a trip...</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.name} ({trip.destination})
                </option>
              ))}
            </Select>
            <p className="text-xs text-brand-cream/60 mt-2">
              All payments will be assigned to this trip
            </p>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-brand-cream mb-2">
              Excel File (.xlsx) *
            </label>
            <div className="border-2 border-dashed border-brand-brown/40 rounded-lg p-8 text-center hover:border-brand-brown/60 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-8 h-8 text-brand-brown" />
                  <div>
                    <p className="font-semibold text-brand-cream">
                      {file ? file.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-brand-cream/60 mt-1">
                      Excel files with columns: user_id, description, amount, due_date, status
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-100 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {message && (
            <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-green-100 text-sm flex items-start gap-3">
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{message}</div>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={handleUpload}
              variant="primary"
              size="md"
              isLoading={uploading}
              disabled={!selectedTripId || data.length === 0}
            >
              Import Payments
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview ({data.length} records)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-brown/20">
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">User ID</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Description</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Amount</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Due Date</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 10).map((item, idx) => (
                    <tr key={idx} className="border-b border-brand-brown/10">
                      <td className="py-3 px-4 text-brand-cream/70 text-xs">{item.user_id}</td>
                      <td className="py-3 px-4 text-brand-cream/70">{item.description}</td>
                      <td className="py-3 px-4 text-brand-cream font-medium">{formatCurrency(item.amount)}</td>
                      <td className="py-3 px-4 text-brand-cream/70 text-xs">
                        {item.due_date || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold capitalize text-brand-brown">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 10 && (
                <p className="text-xs text-brand-cream/60 mt-4">
                  ... and {data.length - 10} more records
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-brand-cream/80">
            <li>Prepare an Excel file with the following columns:</li>
            <ul className="list-disc list-inside ml-4 text-brand-cream/70 space-y-1">
              <li><code className="bg-brand-dark-grey px-2 py-1 rounded">user_id</code> - The user's unique ID</li>
              <li><code className="bg-brand-dark-grey px-2 py-1 rounded">description</code> - Payment description</li>
              <li><code className="bg-brand-dark-grey px-2 py-1 rounded">amount</code> - Payment amount</li>
              <li><code className="bg-brand-dark-grey px-2 py-1 rounded">due_date</code> - Due date (optional)</li>
              <li><code className="bg-brand-dark-grey px-2 py-1 rounded">status</code> - pending, paid, overdue, or waived</li>
            </ul>
            <li>Select the trip this payment batch belongs to</li>
            <li>Upload the Excel file and review the preview</li>
            <li>Click "Import Payments" to save to the database</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
