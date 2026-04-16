import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRole,
  errorResponse,
  ApiErrors,
  isUserTripMember,
  supabase,
} from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

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
      .from('payment_schedule_milestones')
      .select('*')
      .eq('trip_id', tripId)
      .order('milestone_date', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ schedule: data || [] });
  } catch (err) {
    console.error('GET payment-schedule error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
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
    const milestoneDate = body.milestone_date;
    const accumulatedAmount = Number(body.accumulated_amount);

    if (!milestoneDate || Number.isNaN(accumulatedAmount) || accumulatedAmount < 0) {
      return NextResponse.json(
        { error: 'milestone_date and a valid accumulated_amount are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('payment_schedule_milestones')
      .insert({
        trip_id: tripId,
        milestone_date: milestoneDate,
        accumulated_amount: accumulatedAmount,
        description: body.description || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to create milestone' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, milestone: data });
  } catch (err) {
    console.error('POST payment-schedule error:', err);
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
    const milestoneId = body.id || body.milestone_id;

    if (!milestoneId) {
      return NextResponse.json({ error: 'milestone id is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.milestone_date !== undefined) {
      updateData.milestone_date = body.milestone_date;
    }

    if (body.accumulated_amount !== undefined) {
      const accumulatedAmount = Number(body.accumulated_amount);
      if (Number.isNaN(accumulatedAmount) || accumulatedAmount < 0) {
        return NextResponse.json(
          { error: 'accumulated_amount must be a valid non-negative number' },
          { status: 400 }
        );
      }
      updateData.accumulated_amount = accumulatedAmount;
    }

    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No update fields provided' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('payment_schedule_milestones')
      .update(updateData)
      .eq('id', milestoneId)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to update milestone' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, milestone: data });
  } catch (err) {
    console.error('PUT payment-schedule error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
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

    const milestoneId = request.nextUrl.searchParams.get('milestone_id');
    if (!milestoneId) {
      return NextResponse.json({ error: 'milestone_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('payment_schedule_milestones')
      .delete()
      .eq('id', milestoneId)
      .eq('trip_id', tripId);

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to delete milestone' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE payment-schedule error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
