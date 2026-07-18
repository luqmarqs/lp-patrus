import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.1'

const ALLOWED_ORIGINS = new Set([
  'https://izalourenca.com.br',
  'https://www.izalourenca.com.br',
])

function getCorsOrigin(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  if (!origin) return '*'
  return ALLOWED_ORIGINS.has(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)
    ? origin
    : origin
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const rateLimitSalt = Deno.env.get('PUBLIC_SUBMIT_RATE_LIMIT_SALT') ?? serviceRoleKey
const leadTokenSecret = Deno.env.get('PUBLIC_LEAD_TOKEN_SECRET') ?? serviceRoleKey
const RPC_TIMEOUT_MS = 8000
const QUEUE_RETRY_DELAY_MS = 5000

const brevoApiKey              = Deno.env.get('BREVO_API_KEY') ?? ''
const brevoManifestoListId     = Number(
  Deno.env.get('BREVO_MANIFESTO_LIST_ID')
  ?? Deno.env.get('BREVO_LIST_ID')
  ?? '0',
)
const brevoMobilizadoresListId = Number(
  Deno.env.get('BREVO_MOBILIZADORES_LIST_ID')
  ?? Deno.env.get('BREVO_MOBILIZERS_LIST_ID')
  ?? '0',
)
const brevoSenderEmail         = Deno.env.get('BREVO_SENDER_EMAIL') ?? ''
const brevoSenderName          = Deno.env.get('BREVO_SENDER_NAME') ?? 'Iza Lourença'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

function runBackground(label: string, task: () => Promise<void>) {
  const promise = Promise.resolve()
    .then(task)
    .catch((error) => console.error(`[background] ${label}:`, error))

  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime
  if (typeof runtime?.waitUntil === 'function') {
    runtime.waitUntil(promise)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | { timedOut: true }> {
  let timer: number | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<{ timedOut: true }>((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

type RpcResult = { data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }

const INTEREST_THEMES = new Set([
  'lgbtqiapn+', 'educacao', 'cultura', 'juventude',
  'meio_ambiente', 'negritude', 'feminismo', 'direito_a_cidade',
  'projetos_sociais', 'todos', 'outros',
])

const HELP_TYPES = new Set([
  'grupo_mobilizadores', 'materiais_campanha', 'redes_sociais',
  'atividades_presenciais', 'agendas', 'grupo_whatsapp', 'conhecer_psol',
])

const TRACK_EVENTS = new Set([
  'obrigado_whatsapp_direct_click',
  'obrigado_whatsapp_group_click',
  'obrigado_share_whatsapp_click',
  'obrigado_copy_message_click',
  'obrigado_mobiliza_submit',
])

const MOBILIZADOR_EVENTS = new Set([
  'mob_dash_copy_link',
  'mob_dash_share_whatsapp',
  'mob_dash_join_group',
  'mob_dash_missao_click',
  'mob_dash_kit_click',
  'mob_dash_agenda_click',
])

const BRAZILIAN_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function base64UrlEncode(input: string | ArrayBuffer) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return atob(padded)
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(leadTokenSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))
}

async function createLeadToken(leadId: string) {
  const payload = base64UrlEncode(JSON.stringify({ lead_id: leadId, exp: Date.now() + 6 * 60 * 60 * 1000 }))
  return `${payload}.${await hmac(payload)}`
}

async function createSubmissionToken(submissionId: string) {
  const payload = base64UrlEncode(JSON.stringify({ submission_id: submissionId, exp: Date.now() + 6 * 60 * 60 * 1000 }))
  return `${payload}.${await hmac(payload)}`
}

async function verifyLeadToken(leadId: string | null, token: unknown) {
  if (!leadId || typeof token !== 'string') return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature || await hmac(payload) !== signature) return false

  try {
    const body = JSON.parse(base64UrlDecode(payload))
    return body?.lead_id === leadId && Number(body?.exp) >= Date.now()
  } catch {
    return false
  }
}

async function verifySubmissionToken(submissionId: string | null, token: unknown) {
  if (!submissionId || typeof token !== 'string') return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature || await hmac(payload) !== signature) return false

  try {
    const body = JSON.parse(base64UrlDecode(payload))
    return body?.submission_id === submissionId && Number(body?.exp) >= Date.now()
  } catch {
    return false
  }
}


function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const clean = value.trim().slice(0, maxLength)
  return clean || null
}

function normalizePhoneBR(value = '') {
  return value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
}

function isValidPhoneBR(value = '') {
  return /^\d{10,11}$/.test(normalizePhoneBR(value))
}

function normalizeCep(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 8) : null
}

function isValidCep(value: unknown) {
  const cep = normalizeCep(value)
  return !cep || /^\d{8}$/.test(cep)
}

function isValidEmail(value: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function isValidDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed <= new Date()
}

function cleanUtmData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^utm_|^(ref|lid|landing_page|captured_at)$/.test(key)) continue
    const val = cleanText(raw, 500)
    if (val) result[key] = val
  }
  return result
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-zA-Z0-9_:-]{1,60}$/.test(key)) continue
    if (typeof raw === 'string') result[key] = raw.slice(0, 500)
    else if (typeof raw === 'number' || typeof raw === 'boolean') result[key] = raw
    else if (Array.isArray(raw)) result[key] = raw.filter((item) => typeof item === 'string').slice(0, 20)
  }
  return result
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function checkRateLimit(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = req.headers.get('cf-connecting-ip') ?? forwarded ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'
  const ipHash = await sha256(`${rateLimitSalt}:${ip}:${userAgent}`)

  const { data, error } = await supabase.rpc('check_and_record_submit_attempt', {
    p_ip_hash: ipHash,
  })
  if (error) throw error
  return Boolean(data)
}

async function shouldAcceptSubmit(req: Request) {
  try {
    return await checkRateLimit(req)
  } catch (error) {
    console.warn('[public-submit] rate limit indisponivel; envio liberado:', error)
    return true
  }
}

function assertAntiSpam(form: Record<string, unknown>, startedAt: number) {
  if (form.honeypot) return '__honeypot__'
  const elapsed = startedAt ? Date.now() - startedAt : 3000
  if (elapsed >= 0 && elapsed < 2500) {
    return 'Aguarde alguns segundos antes de enviar o formulário.'
  }
  return null
}

function buildManifestoPayload(form: Record<string, unknown>) {
  const name = cleanText(form.name, 150)
  const phone = normalizePhoneBR(String(form.phone ?? ''))
  const email = cleanText(form.email, 255)
  const birthDate = cleanText(form.birth_date, 10)
  const city = cleanText(form.city, 100)
  const uf = cleanText(form.uf, 2)?.toUpperCase() ?? null
  const interestTheme = cleanText(form.interest_theme, 50)

  if (!name) return { error: 'Informe seu nome.' }
  if (!isValidPhoneBR(phone)) return { error: 'Telefone inválido.' }
  if (!isValidEmail(email)) return { error: 'E-mail inválido.' }
  if (!isValidDate(birthDate)) return { error: 'Data de nascimento inválida.' }
  if (!city) return { error: 'Informe o município.' }
  if (!uf || !/^[A-Z]{2}$/.test(uf)) return { error: 'Estado inválido.' }
  if (!interestTheme || !INTEREST_THEMES.has(interestTheme)) return { error: 'Tema de interesse inválido.' }
  if (!form.consent_lgpd && !form.lgpd_accepted) return { error: 'É necessário aceitar os termos de privacidade.' }

  return {
    payload: {
      name,
      phone,
      email,
      birth_date: birthDate,
      city,
      uf,
      interest_theme: interestTheme,
      lgpd_accepted: Boolean(form.consent_lgpd ?? form.lgpd_accepted),
      source: cleanText(form.source, 80) ?? 'manifesto_page',
      utm_data: cleanUtmData(form.utm_data),
    },
  }
}

function buildManifestoSignaturePayload(form: Record<string, unknown>) {
  const name = cleanText(form.name, 150)
  const whatsapp = normalizePhoneBR(String(form.whatsapp ?? ''))
  const email = cleanText(form.email, 255)?.toLowerCase() ?? null
  const birthDate = cleanText(form.birth_date, 10)
  const state = cleanText(form.state, 2)?.toUpperCase() ?? null
  const city = cleanText(form.city, 100)

  if (!name || name.length < 3) return { error: 'Informe seu nome completo.' }
  if (!isValidPhoneBR(whatsapp)) return { error: 'Informe um WhatsApp válido com DDD.' }
  if (!isValidEmail(email)) return { error: 'Informe um e-mail válido.' }
  if (!isValidDate(birthDate)) return { error: 'Informe uma data de nascimento válida.' }
  if (!state || !BRAZILIAN_STATES.has(state)) return { error: 'Selecione um estado válido.' }
  if (!city) return { error: 'Informe seu município.' }

  return { payload: { name, whatsapp, email, birth_date: birthDate, state, city } }
}

function buildMobilizaPayload(form: Record<string, unknown>) {
  const leadId = cleanText(form.lead_id, 36)
  const leadToken = typeof form.lead_token === 'string' ? form.lead_token : null
  const submissionId = cleanText(form.submission_id, 36)
  const submissionToken = typeof form.submission_token === 'string' ? form.submission_token : null
  const name = cleanText(form.name, 150)
  const phone = normalizePhoneBR(String(form.phone ?? ''))
  const email = cleanText(form.email, 255)
  const city = cleanText(form.city, 100)
  const uf = cleanText(form.uf, 2)?.toUpperCase() ?? null
  const cep = normalizeCep(form.cep)
  const helpTypes = Array.isArray(form.help_types)
    ? form.help_types.map((item) => cleanText(item, 80)).filter((item): item is string => Boolean(item))
    : []

  if (submissionId) {
    if (!UUID_RE.test(submissionId)) return { error: 'Envio pendente invalido.' }
    if (!isValidCep(cep)) return { error: 'CEP inválido.' }
    if (helpTypes.length === 0 || helpTypes.some((item) => !HELP_TYPES.has(item))) {
      return { error: 'Escolha pelo menos uma forma válida de ajudar.' }
    }
    return {
      payload: {
        submission_id: submissionId,
        submission_token: submissionToken,
        cep,
        help_types: helpTypes,
        lgpd_accepted: true,
        source: cleanText(form.source, 80) ?? 'obrigado_page',
        utm_data: cleanUtmData(form.utm_data),
      },
    }
  }

  if (!leadId && !submissionId && !name) return { error: 'Informe seu nome.' }
  if (!leadId && !isValidPhoneBR(phone)) return { error: 'Telefone inválido.' }
  if (!leadId && !isValidEmail(email)) return { error: 'E-mail inválido.' }
  if (!leadId && !city) return { error: 'Informe o município.' }
  if (!leadId && (!uf || !/^[A-Z]{2}$/.test(uf))) return { error: 'Estado inválido.' }
  if (!isValidCep(cep)) return { error: 'CEP inválido.' }
  if (helpTypes.length === 0 || helpTypes.some((item) => !HELP_TYPES.has(item))) {
    return { error: 'Escolha pelo menos uma forma válida de ajudar.' }
  }
  if (leadId) {
    if (!UUID_RE.test(leadId)) return { error: 'Lead inválido.' }
    return {
      payload: {
        lead_id: leadId,
        lead_token: leadToken,
        cep,
        help_types: helpTypes,
        lgpd_accepted: true,
        source: cleanText(form.source, 80) ?? 'obrigado_page',
        utm_data: cleanUtmData(form.utm_data),
      },
    }
  }
  if (!form.consent_lgpd && !form.lgpd_accepted) return { error: 'É necessário aceitar os termos de privacidade.' }

  return {
    payload: {
      name,
      phone,
      email,
      city,
      uf,
      cep,
      help_types: helpTypes,
      lgpd_accepted: Boolean(form.consent_lgpd ?? form.lgpd_accepted),
      source: cleanText(form.source, 80) ?? 'mobiliza_page',
      utm_data: cleanUtmData(form.utm_data),
    },
  }
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '23505' || /duplicate key|unique constraint/i.test(error?.message ?? '')
}

function rpcErrorMessage(error: unknown) {
  if (!error) return null
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '')
  return String(error)
}

async function enqueuePublicSubmit(mode: 'manifesto' | 'mobiliza', payload: Record<string, unknown>, reason: string | null) {
  const { data, error } = await supabase
    .from('public_submit_queue')
    .insert({
      mode,
      payload,
      status: 'pending',
      attempts: 0,
      last_error: reason,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw error ?? new Error('Nao foi possivel gravar o envio pendente.')
  }

  const submissionToken = await createSubmissionToken(data.id)
  runBackground(`process queued ${mode}`, async () => {
    await sleep(QUEUE_RETRY_DELAY_MS)
    await processQueueItem(data.id)
  })

  return {
    queued: true,
    status: 'queued',
    submission_id: data.id,
    submission_token: submissionToken,
  }
}

async function markQueueFailed(id: string, attempts: number, message: string) {
  await supabase
    .from('public_submit_queue')
    .update({
      status: 'failed',
      attempts,
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

async function markQueueProcessed(id: string, attempts: number, result: Record<string, unknown>) {
  await supabase
    .from('public_submit_queue')
    .update({
      status: 'processed',
      attempts,
      last_error: null,
      result,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

async function processQueuedMobilizaIfReady(id: string) {
  const { data: item, error: findError } = await supabase
    .from('public_submit_queue')
    .select('id,mobiliza_payload,result,status,attempts')
    .eq('id', id)
    .maybeSingle()

  if (findError) throw findError
  const leadId = item?.result?.manifesto?.lead_id
  if (!item || item.status !== 'processed' || !leadId || !item.mobiliza_payload || item.result?.mobiliza) {
    return false
  }

  const { data, error } = await supabase.rpc('upsert_mobiliza_lead', {
    payload: {
      ...(item.mobiliza_payload as Record<string, unknown>),
      lead_id: leadId,
    },
  })
  if (error) {
    await markQueueFailed(id, Number(item.attempts ?? 0) + 1, error.message)
    return false
  }

  await markQueueProcessed(id, Number(item.attempts ?? 0), {
    ...((item.result ?? {}) as Record<string, unknown>),
    mobiliza: data ?? null,
  })
  return true
}

async function processQueueItem(id: string) {
  const { data: item, error: findError } = await supabase
    .from('public_submit_queue')
    .select('id,mode,payload,mobiliza_payload,result,status,attempts')
    .eq('id', id)
    .maybeSingle()

  if (findError) throw findError
  if (!item) return null
  if (item.status === 'processed') {
    await processQueuedMobilizaIfReady(id)
    return null
  }
  if (item.status === 'processing') return null

  const attempts = Number(item.attempts ?? 0) + 1
  await supabase
    .from('public_submit_queue')
    .update({ status: 'processing', attempts, updated_at: new Date().toISOString() })
    .eq('id', id)

  try {
    if (item.mode === 'manifesto') {
      const { data, error } = await supabase.rpc('upsert_manifesto_lead', { payload: item.payload })
      if (error) throw error

      const result: Record<string, unknown> = { manifesto: data ?? null }
      const leadId = data?.lead_id

      if (leadId && item.mobiliza_payload) {
        const mobilizaPayload = {
          ...(item.mobiliza_payload as Record<string, unknown>),
          lead_id: leadId,
        }
        const { data: mobilizaData, error: mobilizaError } = await supabase.rpc('upsert_mobiliza_lead', {
          payload: mobilizaPayload,
        })
        if (mobilizaError) throw mobilizaError
        result.mobiliza = mobilizaData ?? null
      }

      await markQueueProcessed(id, attempts, result)
      return result
    }

    if (item.mode === 'mobiliza') {
      const { data, error } = await supabase.rpc('upsert_mobiliza_lead', { payload: item.payload })
      if (error) throw error
      const result = { mobiliza: data ?? null }
      await markQueueProcessed(id, attempts, result)
      return result
    }
  } catch (error) {
    const message = rpcErrorMessage(error) || 'Erro ao processar envio pendente.'
    console.warn('[public-submit] queue process failed:', message)
    await markQueueFailed(id, attempts, message)
    return null
  }

  return null
}

async function attachMobilizaToQueuedSubmission(payload: Record<string, unknown>) {
  const submissionId = String(payload.submission_id || '')
  const mobilizaPayload = {
    cep: payload.cep ?? null,
    help_types: payload.help_types ?? [],
    lgpd_accepted: true,
    source: payload.source ?? 'obrigado_page',
    utm_data: payload.utm_data ?? {},
  }

  const { data: item, error: findError } = await supabase
    .from('public_submit_queue')
    .select('id,status,result')
    .eq('id', submissionId)
    .maybeSingle()

  if (findError) throw findError
  if (!item) throw new Error('Envio pendente nao encontrado.')

  const processedLeadId = item.result?.manifesto?.lead_id
  if (item.status === 'processed' && processedLeadId) {
    const { data, error } = await supabase.rpc('upsert_mobiliza_lead', {
      payload: { ...mobilizaPayload, lead_id: processedLeadId },
    })
    if (error) throw error
    return { queued: false, linked_to_submission: true, lead_id: processedLeadId, ...data }
  }

  const { error: updateError } = await supabase
    .from('public_submit_queue')
    .update({
      mobiliza_payload: mobilizaPayload,
      status: item.status === 'processing' ? 'processing' : 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)

  if (updateError) throw updateError

  runBackground('process queued manifesto with mobiliza payload', async () => {
    await sleep(QUEUE_RETRY_DELAY_MS)
    if (!await processQueuedMobilizaIfReady(submissionId)) {
      await processQueueItem(submissionId)
    }
  })

  return {
    queued: true,
    status: 'queued',
    linked_to_submission: true,
    submission_id: submissionId,
  }
}

function buildTrackEventPayload(form: Record<string, unknown>) {
  const leadId = cleanText(form.lead_id, 36)
  const leadToken = typeof form.lead_token === 'string' ? form.lead_token : null
  const eventName = cleanText(form.event_name, 80)
  const eventLabel = cleanText(form.event_label, 160)
  const page = cleanText(form.page, 80) ?? 'obrigado'

  if (leadId && !UUID_RE.test(leadId)) return { error: 'Lead inválido.' }
  if (!eventName || !TRACK_EVENTS.has(eventName)) return { error: 'Evento inválido.' }

  return {
    payload: {
      lead_id: leadId || null,
      lead_token: leadToken,
      event_name: eventName,
      event_label: eventLabel,
      page,
      metadata: cleanMetadata(form.metadata),
    },
  }
}

// ── Brevo helpers ──────────────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function splitName(fullName: string) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

type BrevoAttributes = Record<string, string | number | boolean>

type BrevoIdentifier = {
  email?: string | null
  phone?: string | null
}

const BREVO_ACTION_TAGS: Record<string, string[]> = {
  manifesto_signed: ['assinou_manifesto'],
  mobiliza_registered: ['cadastrou_mobilizador'],
  obrigado_whatsapp_group_click: ['clicou_grupo_whatsapp', 'entrou_grupo_tema'],
  obrigado_share_whatsapp_click: ['compartilhou_whatsapp'],
  obrigado_copy_message_click: ['copiou_mensagem'],
  mob_dash_copy_link: ['gerou_link_mobilizador'],
  mob_dash_share_whatsapp: ['compartilhou_whatsapp'],
  mob_dash_join_group: ['clicou_grupo_whatsapp', 'clicou_grupo_mobilizadores'],
}

const BREVO_ONCE_PER_LEAD_EVENTS = new Set([
  'obrigado_whatsapp_group_click',
  'obrigado_share_whatsapp_click',
  'obrigado_copy_message_click',
  'mob_dash_copy_link',
  'mob_dash_share_whatsapp',
  'mob_dash_join_group',
])

function toBrevoSms(phone: unknown) {
  const clean = normalizePhoneBR(String(phone ?? ''))
  return clean ? `+55${clean}` : null
}

function brevoIdentifiers(identifier: BrevoIdentifier) {
  const email = typeof identifier.email === 'string' && isValidEmail(identifier.email) ? identifier.email : null
  const phone = toBrevoSms(identifier.phone ?? '')
  const identifiers: Record<string, string> = {}
  if (email) identifiers.email_id = email
  else if (phone) identifiers.phone_id = phone
  return identifiers
}

async function checkLeadOrigins(email: string): Promise<{ hasManifesto: boolean; hasMobiliza: boolean }> {
  try {
    const { data } = await supabase
      .from('leads')
      .select('manifesto_signed_at, mobiliza_registered_at')
      .eq('email', email)
      .maybeSingle()
    return {
      hasManifesto: Boolean(data?.manifesto_signed_at),
      hasMobiliza:  Boolean(data?.mobiliza_registered_at),
    }
  } catch {
    return { hasManifesto: false, hasMobiliza: false }
  }
}

async function syncBrevoContact(p: { email?: string | null; phone?: string | null; listId?: number; attributes: BrevoAttributes }) {
  if (!brevoApiKey)  { console.warn('[Brevo] BREVO_API_KEY ausente — sync ignorado.'); return }
  if (!p.listId)     { console.warn('[Brevo] list ID ausente — sync ignorado.'); return }

  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: p.email, updateEnabled: true, listIds: [p.listId], attributes: p.attributes }),
  })

  if (res.ok || res.status === 204) {
    console.log(`[Brevo] Contato sincronizado: ${p.email} → lista ${p.listId}`)
  } else {
    const text = await res.text().catch(() => '')
    console.error(`[Brevo] Erro ao sincronizar contato: HTTP ${res.status}`, text)
  }
}

async function upsertBrevoContact(p: { email?: string | null; phone?: string | null; listId?: number; attributes: BrevoAttributes }) {
  if (!brevoApiKey) { console.warn('[Brevo] BREVO_API_KEY ausente - sync ignorado.'); return }

  const email = typeof p.email === 'string' && isValidEmail(p.email) ? p.email : null
  const sms = toBrevoSms(p.phone ?? p.attributes.SMS)
  if (!email && !sms) { console.warn('[Brevo] contato sem email/SMS - sync ignorado.'); return }

  const attributes = { ...p.attributes }
  if (sms) attributes.SMS = sms

  const body: Record<string, unknown> = {
    updateEnabled: true,
    attributes,
  }
  if (email) body.email = email
  if (p.listId) body.listIds = [p.listId]

  async function postContact(payload: Record<string, unknown>, label: string) {
    try {
      const res = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      })
      const text = res.ok || res.status === 204 ? '' : await res.text().catch(() => '')
      return { ok: res.ok || res.status === 204, status: res.status, text, label }
    } catch (error) {
      return { ok: false, status: 0, text: error instanceof Error ? error.message : String(error), label }
    }
  }

  const fullSync = await postContact(body, 'com atributos')
  if (fullSync.ok) {
    console.log(`[Brevo] Contato sincronizado: ${email ?? sms}${p.listId ? ` -> lista ${p.listId}` : ''}`)
    return
  }

  console.error(`[Brevo] Erro ao sincronizar contato (${fullSync.label}): HTTP ${fullSync.status}`, fullSync.text)

  // Nao deixa erro de atributo customizado/SMS duplicado impedir a inclusao em lista.
  // Se houver email, garantimos o contato com payload minimo e a lista; os atributos
  // podem ser corrigidos depois no Brevo sem quebrar o cadastro da campanha.
  if (email) {
    const minimalBody: Record<string, unknown> = { email, updateEnabled: true }
    if (p.listId) minimalBody.listIds = [p.listId]
    const minimalSync = await postContact(minimalBody, 'minimo')
    if (minimalSync.ok) {
      console.log(`[Brevo] Contato garantido com payload minimo: ${email}${p.listId ? ` -> lista ${p.listId}` : ''}`)
    } else {
      console.error(`[Brevo] Erro ao garantir contato minimo: HTTP ${minimalSync.status}`, minimalSync.text)
    }
  }
}

async function addBrevoContactToList(email: string | null, listId?: number) {
  if (!brevoApiKey || !listId || !email || !isValidEmail(email)) return

  try {
    const res = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/add`, {
      method: 'POST',
      headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: [email] }),
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok || res.status === 204) {
      console.log(`[Brevo] Contato adicionado explicitamente a lista ${listId}: ${email}`)
    } else {
      const text = await res.text().catch(() => '')
      console.error(`[Brevo] Erro ao adicionar contato a lista ${listId}: HTTP ${res.status}`, text)
    }
  } catch (error) {
    console.error(`[Brevo] Erro de rede ao adicionar contato a lista ${listId}:`, error)
  }
}

async function trackBrevoAction(p: {
  identifier: BrevoIdentifier
  action: string
  contactProperties?: BrevoAttributes
  eventProperties?: Record<string, unknown>
}) {
  if (!brevoApiKey) { console.warn('[Brevo] BREVO_API_KEY ausente - evento ignorado.'); return }
  const identifiers = brevoIdentifiers(p.identifier)
  if (!Object.keys(identifiers).length) { console.warn('[Brevo] evento sem identificador - ignorado.'); return }

  const res = await fetch('https://api.brevo.com/v3/events', {
    method: 'POST',
    headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: p.action,
      identifiers,
      contact_properties: p.contactProperties ?? {},
      event_properties: p.eventProperties ?? {},
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (res.ok || res.status === 204) {
    console.log(`[Brevo] Evento sincronizado: ${p.action}`)
  } else {
    const text = await res.text().catch(() => '')
    console.error(`[Brevo] Erro ao sincronizar evento ${p.action}: HTTP ${res.status}`, text)
  }
}

function calculateScore(lead: Record<string, unknown>, events: Array<Record<string, unknown>>) {
  const names = new Set(events.map((event) => String(event.event_name || '')))
  let score = 0
  if (lead.manifesto_signed_at) score += 1
  if (lead.phone) score += 2
  if (lead.mobiliza_registered_at) score += 10
  const utm = (lead.utm_data && typeof lead.utm_data === 'object') ? lead.utm_data as Record<string, unknown> : {}
  if (utm.ref || utm.lid) score += 3
  if (names.has('obrigado_whatsapp_group_click') || names.has('mob_dash_join_group')) score += 4
  if (names.has('obrigado_share_whatsapp_click') || names.has('mob_dash_share_whatsapp')) score += 4
  if (names.has('obrigado_copy_message_click')) score += 2
  if (names.has('mob_dash_copy_link')) score += 3
  return score
}

async function buildBrevoContactState(leadId: string, latestAction: string) {
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id,name,email,phone,city,cep,uf,interest_theme,help_types,sources,utm_data,mobilizer_lid,manifesto_signed_at,mobiliza_registered_at,lgpd_accepted')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError || !lead) {
    if (leadError) console.error('[Brevo] erro ao buscar lead:', leadError)
    return null
  }

  const { data: events } = await supabase
    .from('lead_events')
    .select('event_name')
    .eq('lead_id', leadId)

  const utm = (lead.utm_data && typeof lead.utm_data === 'object') ? lead.utm_data as Record<string, string> : {}
  const sources = Array.isArray(lead.sources) ? lead.sources.filter((item) => typeof item === 'string') : []
  const helpTypes = Array.isArray(lead.help_types) ? lead.help_types.filter((item) => typeof item === 'string') : []
  const { firstName, lastName } = splitName(lead.name ?? '')
  const attrs: BrevoAttributes = {
    ASSINOU_MANIFESTO: Boolean(lead.manifesto_signed_at),
    MOBILIZADOR: Boolean(lead.mobiliza_registered_at),
    SCORE: calculateScore(lead, events ?? []),
    ULTIMA_ACAO: latestAction,
    ENTROU_POR_MOBILIZADOR: Boolean(utm.ref || utm.lid),
    LGPD_ACEITO: Boolean(lead.lgpd_accepted),
  }

  if (firstName) attrs.NOME = firstName
  if (lastName) attrs.SOBRENOME = lastName
  if (lead.phone) attrs.SMS = toBrevoSms(lead.phone) ?? ''
  if (lead.city) attrs.CIDADE = lead.city
  if (lead.cep) attrs.CEP = String(lead.cep)
  if (lead.uf) attrs.UF = lead.uf
  if (lead.interest_theme) attrs.INTERESSE_PRINCIPAL = lead.interest_theme
  if (helpTypes.length) {
    attrs.HELP_TYPES = helpTypes.join(',')
    const helpSet = new Set(helpTypes)
    attrs.AJUDA_GRUPO = helpSet.has('grupo_mobilizadores')
    attrs.AJUDA_MATERIAL = helpSet.has('materiais_campanha')
    attrs.AJUDA_REDES = helpSet.has('redes_sociais')
    attrs.AJUDA_PRESENCIAL = helpSet.has('atividades_presenciais')
    attrs.AJUDA_AGENDA = helpSet.has('agendas')
    attrs.AJUDA_NOVO_GRUPO = helpSet.has('grupo_whatsapp')
    attrs.AJUDA_CONHECER_PSOL = helpSet.has('conhecer_psol')
  }
  if (sources.length) attrs.ORIGEM = sources[0]
  if (utm.utm_source) attrs.UTM_SOURCE = utm.utm_source
  if (utm.utm_medium) attrs.UTM_MEDIUM = utm.utm_medium
  if (utm.utm_campaign) attrs.UTM_CAMPAIGN = utm.utm_campaign
  if (utm.ref) attrs.MOBILIZER_REF = utm.ref
  if (utm.lid || lead.mobilizer_lid) attrs.MOBILIZER_LID = utm.lid || lead.mobilizer_lid

  return {
    lead,
    identifier: { email: lead.email, phone: lead.phone },
    attributes: attrs,
  }
}

async function syncLeadToBrevo(leadId: string | null | undefined, latestAction: string, options: { listId?: number; eventProperties?: Record<string, unknown>; skipActionTags?: boolean } = {}) {
  if (!leadId) return
  const state = await buildBrevoContactState(leadId, latestAction)
  if (!state) return

  await upsertBrevoContact({
    email: state.lead.email,
    phone: state.lead.phone,
    listId: options.listId,
    attributes: state.attributes,
  })
  await addBrevoContactToList(state.lead.email, options.listId)

  if (!options.skipActionTags) {
    const actions = BREVO_ACTION_TAGS[latestAction] ?? []
    for (const action of actions) {
      await trackBrevoAction({
        identifier: state.identifier,
        action,
        contactProperties: state.attributes,
        eventProperties: { lead_id: leadId, source_action: latestAction, ...(options.eventProperties ?? {}) },
      })
    }
  }
}

async function shouldSyncBrevoEvent(leadId: string | null | undefined, eventName: string, insertedEventId?: string | null) {
  if (!leadId) return false
  if (!BREVO_ACTION_TAGS[eventName]) return false
  if (!BREVO_ONCE_PER_LEAD_EVENTS.has(eventName)) return true

  const query = supabase
    .from('lead_events')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('event_name', eventName)

  if (insertedEventId) query.neq('id', insertedEventId)

  const { count, error } = await query
  if (error) {
    console.error('[Brevo] erro ao verificar evento duplicado:', error)
    return false
  }
  return (count ?? 0) === 0
}

async function getAuthenticatedEmail(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  if (error) {
    console.warn('[public-submit] token autenticado invalido:', error.message)
    return null
  }
  return data.user?.email ?? null
}

async function ownsMobilizadorLead(leadId: string, email: string | null) {
  if (!email) return false
  const { data, error } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .ilike('email', email)
    .not('mobiliza_registered_at', 'is', null)
    .maybeSingle()

  if (error) {
    console.warn('[public-submit] erro ao validar mobilizador:', error.message)
    return false
  }
  return Boolean(data?.id)
}

async function sendThankYouEmail(p: { email: string; fullName: string }) {
  if (!brevoApiKey)      { console.warn('[Brevo] BREVO_API_KEY ausente — email não enviado.'); return }
  if (!brevoSenderEmail) { console.warn('[Brevo] BREVO_SENDER_EMAIL ausente — email não enviado.'); return }

  const safeName = escapeHtml(p.fullName.trim() || 'apoiadora')

  const htmlContent = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto">
<p>Olá ${safeName}, tudo bem?</p>
<p>Vi que você assinou o manifesto em defesa da chapa Patrus, para o governo, e Áurea e Marília para o Senado. Muito bom saber que podemos contar com você!</p>
<p>Precisamos de ousadia para derrotar mais uma vez a extrema direita e seu projeto de destruição.</p>
<p>Se quiser conhecer mais o nosso movimento, acesse <a href="https://izalourenca.com.br" style="color:#006f91">izalourenca.com.br</a>. Acreditamos muito na força coletiva, e quanto mais gente, maior a nossa capacidade de disputar a Minas Gerais dos nossos sonhos.</p>
<p>Vamos juntos, com coragem.</p>
<p>Um abraço,<br>Iza Lourença</p>
<p style="margin-bottom:8px">@izalourenca</p>
<p style="margin:0">
  <a href="https://www.instagram.com/izalourenca/" style="display:inline-block;margin-right:10px"><img src="https://cdn.simpleicons.org/instagram/111111" alt="Instagram" width="24" height="24" style="display:block;border:0"></a>
  <a href="https://www.facebook.com/izalourenca" style="display:inline-block;margin-right:10px"><img src="https://cdn.simpleicons.org/facebook/111111" alt="Facebook" width="24" height="24" style="display:block;border:0"></a>
  <a href="https://www.tiktok.com/@izalourenca" style="display:inline-block"><img src="https://cdn.simpleicons.org/tiktok/111111" alt="TikTok" width="24" height="24" style="display:block;border:0"></a>
</p>
</div>`

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: brevoSenderEmail, name: brevoSenderName },
      to: [{ email: p.email, name: p.fullName || undefined }],
      subject: 'Obrigada por assinar o manifesto',
      htmlContent,
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (res.ok) {
    console.log(`[Brevo] Email enviado: ${p.email}`)
  } else {
    const text = await res.text().catch(() => '')
    console.error(`[Brevo] Erro ao enviar email: HTTP ${res.status}`, text)
  }
}

// ── Servidor ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': getCorsOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405)

  try {
    const limited = await shouldAcceptSubmit(req)
    if (!limited) return reply({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, 429)

    const body = await req.json()
    const mode = body?.mode
    const form = body?.form ?? {}
    const startedAt = Number(body?.startedAt ?? 0)

    const spamError = assertAntiSpam(form, startedAt)
    if (spamError === '__honeypot__') return reply({ ok: true })
    if (spamError) return reply({ error: spamError }, 400)

    if (mode === 'manifesto_signature') {
      const built = buildManifestoSignaturePayload(form)
      if ('error' in built) return reply({ error: built.error }, 400)

      const { error } = await supabase
        .from('manifesto_patrus')
        .insert(built.payload)

      if (error) {
        console.warn('[public-submit] manifesto signature error:', error.message)
        return reply({ error: 'Não foi possível registrar sua assinatura agora. Tente novamente em instantes.' }, 400)
      }

      runBackground('brevo manifesto signature thank-you email', () =>
        sendThankYouEmail({ email: built.payload.email, fullName: built.payload.name })
      )

      return reply({ ok: true })
    }

    if (mode === 'manifesto') {
      const built = buildManifestoPayload(form)
      if ('error' in built) return reply({ error: built.error }, 400)
      const rpcResult = await withTimeout(
        supabase.rpc('upsert_manifesto_lead', { payload: built.payload }) as Promise<RpcResult>,
        RPC_TIMEOUT_MS,
      )
      if ('timedOut' in rpcResult) {
        console.warn('[public-submit] manifesto rpc timeout; envio salvo na fila')
        const queued = await enqueuePublicSubmit('manifesto', built.payload, 'rpc_timeout')
        return reply({ ok: true, data: queued })
      }

      const { data, error } = rpcResult
      if (error) {
        if (isUniqueViolation(error)) {
          console.warn('[public-submit] manifesto duplicado tratado como sucesso:', error.message)
          return reply({ ok: true, data: { duplicate: true, merged: true } })
        }
        console.warn('[public-submit] manifesto rpc error:', error.message)
        try {
          const queued = await enqueuePublicSubmit('manifesto', built.payload, error.message ?? null)
          return reply({ ok: true, data: queued })
        } catch (queueError) {
          console.warn('[public-submit] manifesto queue error:', rpcErrorMessage(queueError))
          return reply({ error: error.message }, 400)
        }
      }
      const leadId = data?.lead_id as string | null | undefined
      if (leadId) data!.lead_token = await createLeadToken(leadId)

      const { email, name } = built.payload
      if (leadId) {
        runBackground('brevo manifesto sync', () =>
          syncLeadToBrevo(leadId, 'manifesto_signed', {
            listId: brevoManifestoListId,
            skipActionTags: Boolean(data?.merged),
          })
        )
      }
      if (email && isValidEmail(email) && !data?.merged) {
        runBackground('brevo thank-you email', () =>
          sendThankYouEmail({ email, fullName: name ?? '' })
        )
      }

      return reply({ ok: true, data })
    }

    if (mode === 'mobiliza') {
      const built = buildMobilizaPayload(form)
      if ('error' in built) return reply({ error: built.error }, 400)
      if (built.payload.submission_id) {
        if (!await verifySubmissionToken(built.payload.submission_id, built.payload.submission_token)) {
          return reply({ error: 'Sessao de confirmacao expirada. Preencha o formulario completo para continuar.' }, 400)
        }
        delete (built.payload as Record<string, unknown>).submission_token
        try {
          const data = await attachMobilizaToQueuedSubmission(built.payload)
          return reply({ ok: true, data })
        } catch (error) {
          const message = rpcErrorMessage(error) || 'Nao foi possivel vincular o envio pendente.'
          console.warn('[public-submit] queue attach error:', message)
          return reply({ error: message }, 400)
        }
      }
      if (built.payload.lead_id && !await verifyLeadToken(built.payload.lead_id, built.payload.lead_token)) {
        return reply({ error: 'Sessao de confirmacao expirada. Preencha o formulario completo para continuar.' }, 400)
      }
      delete (built.payload as Record<string, unknown>).lead_token
      const rpcResult = await withTimeout(
        supabase.rpc('upsert_mobiliza_lead', { payload: built.payload }) as Promise<RpcResult>,
        RPC_TIMEOUT_MS,
      )
      if ('timedOut' in rpcResult) {
        console.warn('[public-submit] mobiliza rpc timeout; envio salvo na fila')
        const queued = await enqueuePublicSubmit('mobiliza', built.payload, 'rpc_timeout')
        return reply({ ok: true, data: queued })
      }

      const { data, error } = rpcResult
      if (error) {
        if (isUniqueViolation(error)) {
          console.warn('[public-submit] mobiliza duplicado tratado como sucesso:', error.message)
          return reply({ ok: true, data: { duplicate: true, merged: true } })
        }
        console.warn('[public-submit] mobiliza rpc error:', error.message)
        try {
          const queued = await enqueuePublicSubmit('mobiliza', built.payload, error.message ?? null)
          return reply({ ok: true, data: queued })
        } catch (queueError) {
          console.warn('[public-submit] mobiliza queue error:', rpcErrorMessage(queueError))
          return reply({ error: error.message }, 400)
        }
      }

      runBackground('brevo mobiliza sync', () =>
        syncLeadToBrevo(data?.lead_id as string | null, 'mobiliza_registered', {
          listId: brevoMobilizadoresListId,
          skipActionTags: Boolean(data?.merged),
        })
      )

      return reply({ ok: true, data })
    }

    if (mode === 'mobilizador_event') {
      const leadId = cleanText(form.lead_id, 36)
      const eventName = cleanText(form.event_name, 80)
      const eventLabel = cleanText(form.event_label, 160)
      const page = cleanText(form.page, 80) ?? 'mobilizador_dashboard'

      if (!leadId || !UUID_RE.test(leadId)) return reply({ error: 'Lead invalido.' }, 400)
      if (!eventName || !MOBILIZADOR_EVENTS.has(eventName)) return reply({ error: 'Evento invalido.' }, 400)

      const email = await getAuthenticatedEmail(req)
      if (!await ownsMobilizadorLead(leadId, email)) return reply({ error: 'Nao autorizado.' }, 403)

      const payload = {
        lead_id: leadId,
        event_name: eventName,
        event_label: eventLabel,
        page,
        metadata: cleanMetadata(form.metadata),
      }

      const { data, error } = await supabase
        .from('lead_events')
        .insert(payload)
        .select('id')
        .single()
      if (error) return reply({ error: error.message }, 400)

      if (await shouldSyncBrevoEvent(leadId, eventName, data?.id)) {
        runBackground('brevo mobilizador event sync', () =>
          syncLeadToBrevo(leadId, eventName, {
            eventProperties: {
              event_label: eventLabel ?? '',
              page,
              ...payload.metadata,
            },
          })
        )
      }

      return reply({ ok: true, data })
    }

    if (mode === 'track_event') {
      const built = buildTrackEventPayload(form)
      if ('error' in built) return reply({ error: built.error }, 400)
      const trustedLeadId = built.payload.lead_id && await verifyLeadToken(built.payload.lead_id, built.payload.lead_token)
      delete (built.payload as Record<string, unknown>).lead_token
      if (built.payload.lead_id && !trustedLeadId) {
        built.payload.metadata = { ...built.payload.metadata, ignored_public_lead_id: true }
        built.payload.lead_id = null
      }
      const { data, error } = await supabase
        .from('lead_events')
        .insert(built.payload)
        .select('id')
        .single()
      if (error) return reply({ error: error.message }, 400)
      if (await shouldSyncBrevoEvent(built.payload.lead_id, built.payload.event_name, data?.id)) {
        runBackground('brevo public event sync', () =>
          syncLeadToBrevo(built.payload.lead_id, built.payload.event_name, {
            eventProperties: {
              event_label: built.payload.event_label ?? '',
              page: built.payload.page,
              ...built.payload.metadata,
            },
          })
        )
      }
      return reply({ ok: true, data })
    }

    return reply({ error: 'Tipo de formulário inválido.' }, 400)
  } catch (error) {
    console.error(error)
    return reply({ error: 'Não foi possível enviar agora. Tente novamente em instantes.' }, 500)
  }
})
