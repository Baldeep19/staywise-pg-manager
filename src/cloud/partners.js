/**
 * Expenses and partner (co-owner) data: loading plus the save helpers used by the Expenses page.
 */
import {supabase} from './client.js';
import {session} from './session.js';

/** Load expenses and partners for the active property and expose save helpers on window. */
export async function loadPartnerData() {
  const {data: expenseRows} = await supabase
    .from('property_expenses')
    .select('*')
    .eq('property_id', session.property.id)
    .order('expense_date', {ascending: false});
  window.pgExpenses = expenseRows || [];
  const {data: memberRows} = await supabase.from('property_members').select('*').eq('property_id', session.property.id);
  window.pgPropertyMembers = memberRows || [];
  window.refreshPropertyPeople = async () => {
    const {data} = await supabase.rpc('property_people', {p_property_id: session.property.id});
    window.pgPropertyPeople = data || [];
  };
  await window.refreshPropertyPeople();
  /** Columns for an expense from the form values. Notes are only touched when the form actually sent them. */
  const expenseColumns = (d) => ({
    expense_date: d.date || new Date().toISOString().slice(0, 10),
    category: d.category || 'Other',
    description: d.description,
    amount: Number(d.amount),
    paid_to: d.paidTo || null,
    paid_by_user_id: d.paidByUserId || null,
    ...('notes' in d ? {notes: d.notes || null} : {})
  });
  window.savePropertyExpense = async (d) => {
    const {data, error} = await supabase
      .from('property_expenses')
      .insert({property_id: session.property.id, notes: null, ...expenseColumns(d)})
      .select()
      .single();
    if (error) throw error;
    window.pgExpenses = [data, ...(window.pgExpenses || [])];
    return data;
  };
  // Edit an existing expense (any owner or partner of the building may do this).
  window.updatePropertyExpense = async (id, d) => {
    const {data, error} = await supabase
      .from('property_expenses')
      .update(expenseColumns(d))
      .eq('id', id)
      .eq('property_id', session.property.id)
      .select()
      .single();
    if (error) throw error;
    window.pgExpenses = (window.pgExpenses || []).map((x) => (x.id === id ? data : x));
    return data;
  };
  // Delete an expense. Profit and settlement are recalculated from what is left.
  window.deletePropertyExpense = async (id) => {
    const {error} = await supabase
      .from('property_expenses')
      .delete()
      .eq('id', id)
      .eq('property_id', session.property.id);
    if (error) throw error;
    window.pgExpenses = (window.pgExpenses || []).filter((x) => x.id !== id);
  };
  // Choose which partner holds the collected rent (null = the building owner). Used for profit settlement.
  window.setRentCollector = async (userId) => {
    const {data, error} = await supabase
      .from('properties')
      .update({rent_collector_user_id: userId || null})
      .eq('id', session.property.id)
      .select()
      .single();
    if (error) throw error;
    session.property = {...session.property, ...data};
    window.pgProperties = (window.pgProperties || []).map((x) => (x.id === data.id ? {...x, ...data} : x));
    return data;
  };
  // Change a partner's ownership share.
  window.updatePropertyMember = async (userId, ownershipPercent) => {
    const percent = Number(ownershipPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100)
      throw new Error('Ownership must be between 0 and 100');
    const {data, error} = await supabase
      .from('property_members')
      .update({ownership_percent: percent})
      .eq('property_id', session.property.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    window.pgPropertyMembers = (window.pgPropertyMembers || []).map((x) => (x.user_id === userId ? data : x));
    return data;
  };
  // Remove a partner's access to this building. Their past expenses stay on record.
  window.deletePropertyMember = async (userId) => {
    const {error} = await supabase
      .from('property_members')
      .delete()
      .eq('property_id', session.property.id)
      .eq('user_id', userId);
    if (error) throw error;
    window.pgPropertyMembers = (window.pgPropertyMembers || []).filter((x) => x.user_id !== userId);
    await window.refreshPropertyPeople();
  };
  window.savePropertyMember = async (d) => {
    const lookup = await supabase.rpc('lookup_partner_by_email', {p_email: d.email});
    if (lookup.error || !lookup.data?.length) throw new Error('No registered account found for this email');
    const profile = lookup.data[0];
    const {data, error} = await supabase
      .from('property_members')
      .upsert(
        {
          property_id: session.property.id,
          user_id: profile.user_id,
          display_name: profile.display_name,
          email: profile.email,
          role: 'partner',
          ownership_percent: Number(d.ownershipPercent || 0),
          can_manage_residents: true,
          can_manage_payments: true,
          can_manage_electricity: true,
          can_manage_expenses: true,
          can_view_reports: true
        },
        {onConflict: 'property_id,user_id'}
      )
      .select()
      .single();
    if (error) throw error;
    window.pgPropertyMembers = [...(window.pgPropertyMembers || []).filter((x) => x.user_id !== profile.user_id), data];
    await window.refreshPropertyPeople();
    return data;
  };
}
