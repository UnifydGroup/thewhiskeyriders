'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { DataTable } from '@/components/admin/DataTable';
import Link from 'next/link';
import { Plus, Edit2, Trash2, DollarSign, TrendingUp } from 'lucide-react';

export default function PaymentManagementPage() {
  const params = useParams();
  const tripId = params.id as string;

  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totals, setTotals] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    user_id: '',
    amount: '',
    status: 'pending',
    description: '',
  });

  useEffect(() => {
    fetchPayments();
  }, [tripId]);

  const fetchPayments = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/payments`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch payments');

      const data = await response.json();
      setPayments(data.data.payments);
      setTotals(data.data.totals);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPayment = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      if (!response.ok) throw new Error('Failed to add payment');

      setFormData({ user_id: '', amount: '', status: 'pending', description: '' });
      setShowForm(false);
      fetchPayments();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleUpdatePayment = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/trips/${tripId}/payments/${paymentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      if (!response.ok) throw new Error('Failed to update payment');

      setFormData({ user_id: '', amount: '', status: 'pending', description: '' });
      setEditingId(null);
      setShowForm(false);
      fetchPayments();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Delete this payment?')) return;

    try {
      const response = await fetch(`/api/trips/${tripId}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete payment');

      fetchPayments();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const columns = [
    {
      key: 'user_id',
      label: 'Member ID',
      render: (value: string) => <span className="font-mono text-xs">{value.substring(0, 8)}...</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (value: number) => <span className="font-mono font-bold">${value.toFixed(2)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded text-xs font-medium ${
            value === 'paid'
              ? 'bg-green-900/30 text-green-400'
              : value === 'pending'
              ? 'bg-yellow-900/30 text-yellow-400'
              : 'bg-red-900/30 text-red-400'
          }`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (value: string) => <span className="text-gray-300">{value || 'N/A'}</span>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (value: string, row: any) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setFormData({
                user_id: row.user_id,
                amount: row.amount.toString(),
                status: row.status,
                description: row.description || '',
              });
              setEditingId(value);
              setShowForm(true);
            }}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <Edit2 size={16} className="text-blue-400" />
          </button>
          <button
            onClick={() => handleDeletePayment(value)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <Trash2 size={16} className="text-red-400" />
          </button>
        </div>
      ),
    },
  ];

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Payment Management</h1>
          <p className="text-gray-400">Manage trip payments and member contributions</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} className="mr-2" />
          Add Payment
        </Button>
      </div>

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Paid</p>
                <p className="text-2xl font-bold text-green-400">${totals.paid.toFixed(2)}</p>
              </div>
              <DollarSign size={32} className="text-green-400 opacity-20" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending</p>
                <p className="text-2xl font-bold text-yellow-400">${totals.pending.toFixed(2)}</p>
              </div>
              <TrendingUp size={32} className="text-yellow-400 opacity-20" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Target</p>
                <p className="text-2xl font-bold">${totals.total.toFixed(2)}</p>
              </div>
              <DollarSign size={32} className="text-gray-400 opacity-20" />
            </div>
          </Card>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit Payment' : 'Add New Payment'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Member ID</label>
              <Input
                type="text"
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                placeholder="User UUID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount</label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => (editingId ? handleUpdatePayment(editingId) : handleAddPayment())}
            >
              {editingId ? 'Update' : 'Add'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setFormData({ user_id: '', amount: '', status: 'pending', description: '' });
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Payments Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Payments ({payments.length})</h2>
          {payments.length > 0 ? (
            <DataTable columns={columns} data={payments} rowKey="id" />
          ) : (
            <p className="text-gray-400 text-center py-8">No payments yet</p>
          )}
        </div>
      </Card>
    </div>
  );
}
