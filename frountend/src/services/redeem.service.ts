import { supabase } from '@/lib/supabase';

export interface RedeemRequest {
  id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  user_phone?: string;
  coins_redeemed: number;
  amount_inr: number;
  redeem_type: 'recharge' | 'upi';
  target_account: string;
  status: 'pending' | 'completed' | 'rejected';
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateRedeemPayload {
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  coins: number;
  amountInr: number;
  type: 'recharge' | 'upi';
  targetAccount: string;
}

export const redeemService = {
  /**
   * Fetch all redemption requests submitted by a specific user.
   */
  async fetchUserRedeems(userId: string): Promise<RedeemRequest[]> {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from('redeem_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[RedeemService] Error fetching user redeems:', error.message);
        return [];
      }
      return (data || []) as RedeemRequest[];
    } catch (e) {
      console.error('[RedeemService] Unexpected error fetching user redeems:', e);
      return [];
    }
  },

  /**
   * Compute total coins deducted from user balance.
   * Only 'pending' and 'completed' requests deduct coins.
   * 'rejected' requests are automatically refunded.
   */
  async getUserDeductedCoins(userId: string): Promise<number> {
    if (!userId) return 0;
    try {
      const { data, error } = await supabase
        .from('redeem_requests')
        .select('coins_redeemed, status')
        .eq('user_id', userId)
        .in('status', ['pending', 'completed']);

      if (error || !data) return 0;
      return data.reduce((sum, item) => sum + (Number(item.coins_redeemed) || 0), 0);
    } catch {
      return 0;
    }
  },

  /**
   * Submit a new redemption request (Mobile Recharge or UPI).
   */
  async submitRedeemRequest(payload: CreateRedeemPayload): Promise<{ success: boolean; data?: RedeemRequest; error?: string }> {
    try {
      if (payload.coins < 500) {
        return { success: false, error: 'Minimum 500 coins required to redeem.' };
      }

      const row = {
        user_id: payload.userId,
        user_email: payload.userEmail || null,
        user_name: payload.userName || null,
        user_phone: payload.userPhone || null,
        coins_redeemed: payload.coins,
        amount_inr: payload.amountInr,
        redeem_type: payload.type,
        target_account: payload.targetAccount.trim(),
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('redeem_requests')
        .insert(row)
        .select()
        .single();

      if (error) throw error;

      // Notify Superadmin / Admins of the new payout request
      try {
        await supabase.from('notifications').insert({
          user_id: payload.userId,
          title: `💰 New Coin Redemption: ₹${payload.amountInr}`,
          message: `${payload.userName || 'A reporter'} requested payout of ₹${payload.amountInr} (${payload.coins} coins) via ${payload.type === 'recharge' ? 'Mobile Recharge' : 'UPI'}.`,
          type: 'payout_request',
          status: 'unread',
        });
      } catch (notifErr) {
        console.warn('[RedeemService] Could not insert notification:', notifErr);
      }

      return { success: true, data: data as RedeemRequest };
    } catch (e: any) {
      console.error('[RedeemService] Failed to submit redeem request:', e);
      return { success: false, error: e?.message || 'Failed to submit redemption request' };
    }
  },

  /**
   * Superadmin / Admin: Fetch all redeem requests across the system.
   */
  async fetchAllRedeemRequests(): Promise<RedeemRequest[]> {
    try {
      const { data, error } = await supabase
        .from('redeem_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as RedeemRequest[];
    } catch (e) {
      console.error('[RedeemService] Error fetching all redeems:', e);
      return [];
    }
  },

  /**
   * Superadmin / Admin: Approve (completed) or Reject a redemption request.
   */
  async updateRedeemStatus(
    requestId: string,
    status: 'completed' | 'rejected',
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('redeem_requests')
        .update({
          status,
          admin_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      // If completed or rejected, fetch request details to notify reporter
      try {
        const { data: reqData } = await supabase
          .from('redeem_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (reqData?.user_id) {
          const isDone = status === 'completed';
          const title = isDone ? '🎉 Payout Processed!' : '❌ Redemption Request Update';
          const msg = isDone
            ? `Your ₹${reqData.amount_inr} redemption (${reqData.redeem_type.toUpperCase()}: ${reqData.target_account}) has been processed successfully.`
            : `Your redemption request for ₹${reqData.amount_inr} was rejected.${notes ? ' Reason: ' + notes : ' Please contact support.'}`;

          await supabase.from('notifications').insert({
            user_id: reqData.user_id,
            title,
            message: msg,
            type: 'payout_status',
            status: 'unread',
          });
        }
      } catch (notifErr) {
        console.warn('[RedeemService] Payout status notification failed:', notifErr);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to update redemption status' };
    }
  },
};
