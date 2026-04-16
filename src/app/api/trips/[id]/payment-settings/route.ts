import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRole,
  errorResponse,
  ApiErrors,
  isUserTripMember,
  supabase,
} from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

const DEFAULT_PAYMENT_SETTINGS = {
  flights_cost_aud: 0,
  show_payment_options: false,
  monthly_option_title: 'Monthly Option',
  monthly_option_amount_label: null,
  monthly_option_description: null,
  quarterly_option_title: 'Quarterly Option',
  quarterly_option_amount_label: null,
  quarterly_option_description: null,
  show_bank_details: false,
  bank_account_name: null,
  bank_bsb: null,
  bank_account_number: null,
  bank_payid: null,
  bank_notes: null,
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated || !profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (profile.role === 'member') {
      const isMember = await isUserTripMember(profile.id, tripId);
      if (!isMember) {
        return errorResponse(ApiErrors.FORBIDDEN);
      }
    }

    const { data, error } = await supabase
      .from('trip_payment_settings')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      settings: {
        trip_id: tripId,
        ...DEFAULT_PAYMENT_SETTINGS,
        ...(data || {}),
      },
    });
  } catch (err) {
    console.error('GET payment-settings error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, [
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const body = await request.json();

    const payload = {
      trip_id: tripId,
      ...(body.flights_cost_aud !== undefined && { flights_cost_aud: Number(body.flights_cost_aud) || 0 }),
      ...(body.show_payment_options !== undefined && { show_payment_options: body.show_payment_options === true }),
      ...(body.monthly_option_title !== undefined && { monthly_option_title: body.monthly_option_title || 'Monthly Option' }),
      ...(body.monthly_option_amount_label !== undefined && { monthly_option_amount_label: body.monthly_option_amount_label || null }),
      ...(body.monthly_option_description !== undefined && { monthly_option_description: body.monthly_option_description || null }),
      ...(body.quarterly_option_title !== undefined && { quarterly_option_title: body.quarterly_option_title || 'Quarterly Option' }),
      ...(body.quarterly_option_amount_label !== undefined && { quarterly_option_amount_label: body.quarterly_option_amount_label || null }),
      ...(body.quarterly_option_description !== undefined && { quarterly_option_description: body.quarterly_option_description || null }),
      ...(body.show_bank_details !== undefined && { show_bank_details: body.show_bank_details === true }),
      ...(body.bank_account_name !== undefined && { bank_account_name: body.bank_account_name || null }),
      ...(body.bank_bsb !== undefined && { bank_bsb: body.bank_bsb || null }),
      ...(body.bank_account_number !== undefined && { bank_account_number: body.bank_account_number || null }),
      ...(body.bank_payid !== undefined && { bank_payid: body.bank_payid || null }),
      ...(body.bank_notes !== undefined && { bank_notes: body.bank_notes || null }),
    };

    const { data, error } = await supabase
      .from('trip_payment_settings')
      .upsert(payload, { onConflict: 'trip_id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      settings: {
        ...DEFAULT_PAYMENT_SETTINGS,
        ...data,
      },
    });
  } catch (err) {
    console.error('PUT payment-settings error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
