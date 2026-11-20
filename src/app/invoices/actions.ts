'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  isSupabaseConfigured,
  requireAuthenticatedUser,
  getActiveStudio,
  assertStudioRole,
} from '@/lib/supabase/auth'
import type { InvoiceStatus } from '@/lib/supabase/database.types'

export interface InvoiceActionState {
  error?: string
  success?: boolean
}

const BILLING_ROLES = ['owner' as const, 'admin' as const]
const VALID_INVOICE_STATUSES: InvoiceStatus[] = ['unpaid', 'paid', 'refunded', 'cancelled']

export async function createInvoiceAction(
  _prevState: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured. Supply credentials in .env.local.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) {
      return { error: 'No active studio found.' }
    }

    await assertStudioRole(activeStudio.studio.id, BILLING_ROLES)

    const artistId = (formData.get('artist_id') as string)?.trim()
    const bookingId = (formData.get('booking_id') as string)?.trim() || null
    const amountInrStr = formData.get('amount') as string
    const dueDateStr = (formData.get('due_date') as string)?.trim() || null
    const status = (formData.get('status') as InvoiceStatus) || 'unpaid'

    if (!artistId) {
      return { error: 'Please select an artist for the invoice.' }
    }

    const amount = parseFloat(amountInrStr)
    if (isNaN(amount) || amount <= 0) {
      return { error: 'Please enter a valid invoice amount in INR.' }
    }

    if (!VALID_INVOICE_STATUSES.includes(status)) {
      return { error: 'Invalid invoice status provided.' }
    }

    const studioId = activeStudio.studio.id
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('invoices').insert({
      studio_id: studioId,
      artist_id: artistId,
      booking_id: bookingId,
      booking_studio_id: bookingId ? studioId : null,
      amount,
      status,
      due_date: dueDateStr ? new Date(dueDateStr).toISOString() : null,
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/invoices')
    revalidatePath('/analytics')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to create invoice.' }
  }
}

export async function updateInvoiceStatusAction(
  invoiceId: string,
  newStatus: InvoiceStatus
): Promise<InvoiceActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) return { error: 'No active studio found.' }

    await assertStudioRole(activeStudio.studio.id, BILLING_ROLES)

    if (!VALID_INVOICE_STATUSES.includes(newStatus)) {
      return { error: 'Invalid invoice status.' }
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('invoices')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('studio_id', activeStudio.studio.id)

    if (error) return { error: error.message }

    revalidatePath('/invoices')
    revalidatePath('/analytics')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to update invoice status.' }
  }
}

export async function deleteInvoiceAction(invoiceId: string): Promise<InvoiceActionState> {
  if (!isSupabaseConfigured()) {
    return { error: 'Database is not configured.' }
  }

  try {
    await requireAuthenticatedUser()
    const activeStudio = await getActiveStudio()
    if (!activeStudio) return { error: 'No active studio found.' }

    await assertStudioRole(activeStudio.studio.id, BILLING_ROLES)

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('studio_id', activeStudio.studio.id)

    if (error) return { error: error.message }

    revalidatePath('/invoices')
    revalidatePath('/analytics')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to delete invoice.' }
  }
}
