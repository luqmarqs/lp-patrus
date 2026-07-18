import { supabase } from './supabase'

export async function submitLead(lead) {
  if (!supabase) throw new Error('A integração de assinaturas não está configurada.')

  const { data, error } = await supabase.functions.invoke('public-submit', {
    body: {
      mode: 'manifesto_signature',
      form: {
        name: lead.name.trim(),
        whatsapp: lead.whatsapp,
        email: lead.email.trim().toLowerCase(),
        birth_date: lead.birthDate,
        state: lead.state,
        city: lead.city,
      },
    },
  })

  if (error || data?.error) throw error ?? new Error(data.error)
}
