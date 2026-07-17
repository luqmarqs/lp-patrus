import { supabase } from './supabase'

export async function submitLead(lead) {
  if (!supabase) throw new Error('A integração de assinaturas não está configurada.')

  const { error } = await supabase.from('manifesto_signatures').insert({
    name: lead.name.trim(),
    whatsapp: lead.whatsapp,
    email: lead.email.trim().toLowerCase(),
    birth_date: lead.birthDate,
    state: lead.state,
    city: lead.city,
  })

  if (error) throw error
}
