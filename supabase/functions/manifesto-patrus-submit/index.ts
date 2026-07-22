import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.1'

const ALLOWED_ORIGINS = new Set([
  'https://www.manifestochanceunicamg.com.br',
  'https://manifestochanceunicamg.com.br',
  'https://lp-patrus.vercel.app',
])

const BRAZILIAN_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
])

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const rateLimitSalt = Deno.env.get('PUBLIC_SUBMIT_RATE_LIMIT_SALT') ?? serviceRoleKey
const brevoApiKey = Deno.env.get('BREVO_API_KEY') ?? ''
const brevoSenderEmail = Deno.env.get('BREVO_SENDER_EMAIL') ?? ''
const brevoSenderName = Deno.env.get('BREVO_SENDER_NAME') ?? 'Manifesto Chance Única MG'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

function corsOrigin(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  if (!origin || ALLOWED_ORIGINS.has(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin || '*'
  return 'https://www.manifestochanceunicamg.com.br'
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const clean = value.trim().slice(0, maxLength)
  return clean || null
}

function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
}

function validBirthDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10)
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function withinRateLimit(req: Request) {
  try {
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ip = req.headers.get('cf-connecting-ip') ?? forwarded ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? 'unknown'
    const ipHash = await sha256(`${rateLimitSalt}:${ip}:${userAgent}`)
    const { data, error } = await supabase.rpc('check_and_record_submit_attempt', { p_ip_hash: ipHash })
    if (error) throw error
    return Boolean(data)
  } catch (error) {
    console.warn('[manifesto-patrus-submit] rate limit indisponível:', error)
    return true
  }
}

async function sendThankYouEmail(email: string, fullName: string) {
  if (!brevoApiKey || !brevoSenderEmail) {
    console.warn('[manifesto-patrus-submit] Brevo não configurado; e-mail não enviado.')
    return
  }

  const safeName = escapeHtml(fullName)
  const htmlContent = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto">
<p>Olá ${safeName}, tudo bem?</p>
<p>Obrigado por assinar nosso manifesto.</p>
<p>Vamos juntos em defesa da Minas Gerais que merecemos e precisamos.</p>
<p>Bolsozema nunca mais!</p>
<p>Manifesto Chance Única MG</p>
</div>`

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: brevoSenderEmail, name: brevoSenderName },
      to: [{ email, name: fullName }],
      subject: 'Obrigado por assinar nosso manifesto',
      htmlContent,
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    console.error('[manifesto-patrus-submit] erro Brevo:', response.status, await response.text())
  }
}

Deno.serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405)
  if (!await withinRateLimit(req)) return reply({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, 429)

  try {
    const body = await req.json()
    const form = body?.form ?? {}
    const elapsedMs = Number(body?.elapsedMs ?? 3000)

    if (form.honeypot) return reply({ ok: true })
    if (Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < 2500) {
      return reply({ error: 'Aguarde alguns segundos antes de enviar o formulário.' }, 400)
    }

    const name = cleanText(form.name, 150)
    const whatsapp = normalizePhone(form.whatsapp)
    const email = cleanText(form.email, 255)?.toLowerCase() ?? null
    const birthDate = cleanText(form.birth_date, 10)
    const state = cleanText(form.state, 2)?.toUpperCase() ?? null
    const city = cleanText(form.city, 100)

    if (!name || name.length < 3) return reply({ error: 'Informe seu nome completo.' }, 400)
    if (!/^\d{10,11}$/.test(whatsapp)) return reply({ error: 'Informe um WhatsApp válido com DDD.' }, 400)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: 'Informe um e-mail válido.' }, 400)
    if (!validBirthDate(birthDate)) return reply({ error: 'Informe uma data de nascimento válida.' }, 400)
    if (!state || !BRAZILIAN_STATES.has(state)) return reply({ error: 'Selecione um estado válido.' }, 400)
    if (!city) return reply({ error: 'Informe seu município.' }, 400)

    const { error } = await supabase.from('manifesto_patrus').insert({
      name,
      whatsapp,
      email,
      birth_date: birthDate,
      state,
      city,
    })

    if (error) {
      console.error('[manifesto-patrus-submit] erro ao gravar assinatura:', error.message)
      return reply({ error: 'Não foi possível registrar sua assinatura agora. Tente novamente em instantes.' }, 400)
    }

    const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime
    const emailTask = sendThankYouEmail(email, name).catch((error) => console.error('[manifesto-patrus-submit] erro ao enviar e-mail:', error))
    if (typeof runtime?.waitUntil === 'function') runtime.waitUntil(emailTask)
    else await emailTask

    return reply({ ok: true })
  } catch (error) {
    console.error('[manifesto-patrus-submit] erro inesperado:', error)
    return reply({ error: 'Não foi possível registrar sua assinatura agora. Tente novamente em instantes.' }, 500)
  }
})
