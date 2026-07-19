import { useId, useMemo, useRef, useState } from 'react'
import { brazilianStates } from '../constants/brazilianStates'
import { useMunicipalities } from '../hooks/useMunicipalities'
import { submitLead } from '../services/leadSubmission'

const initialValues = { name: '', whatsapp: '', email: '', birthDate: '', state: 'MG', city: '' }
const errorsByField = {
  name: 'Informe seu nome completo.',
  whatsapp: 'Informe um WhatsApp válido com DDD.',
  email: 'Informe um e-mail válido.',
  birthDate: 'Informe sua data de nascimento.',
  state: 'Selecione o estado.',
  city: 'Selecione um município de Minas Gerais.',
}

function formatWhatsapp(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatBirthDate(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function birthDateToIso(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day)) return null
  return iso
}

export default function LeadForm({ onOpenPrivacy }) {
  const [values, setValues] = useState(initialValues)
  const { municipalities, status } = useMunicipalities(values.state)
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const fieldRefs = useRef({})
  const uid = useId()
  const isValidCity = useMemo(
    () => municipalities.some((municipality) => municipality.name === values.city),
    [municipalities, values.city],
  )

  function validate(field) {
    const value = values[field]
    if (field === 'name') return value.trim().split(/\s+/).length >= 2
    if (field === 'whatsapp') return /^[0-9]{10,11}$/.test(value.replace(/\D/g, ''))
    if (field === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    if (field === 'birthDate') {
      const isoDate = birthDateToIso(value)
      return Boolean(isoDate) && isoDate <= new Date().toISOString().slice(0, 10)
    }
    if (field === 'state') return brazilianStates.some((state) => state.value === value)
    if (field === 'city') return status === 'ready' && isValidCity
    return true
  }

  function fieldError(field) {
    return touched[field] && !validate(field) ? errorsByField[field] : ''
  }

  function updateField(event) {
    const { name, value } = event.target
    setSuccess(false)
    setSubmitError('')
    setValues((current) => {
      const nextValue = name === 'whatsapp' ? formatWhatsapp(value) : name === 'birthDate' ? formatBirthDate(value) : value
      return name === 'state' ? { ...current, state: nextValue, city: '' } : { ...current, [name]: nextValue }
    })
  }

  function handleBlur(event) {
    setTouched((current) => ({ ...current, [event.target.name]: true }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const allTouched = Object.keys(initialValues).reduce((result, key) => ({ ...result, [key]: true }), {})
    setTouched(allTouched)
    const invalidField = Object.keys(initialValues).find((field) => !validate(field))
    if (invalidField) {
      fieldRefs.current[invalidField]?.focus()
      return
    }

    setSubmitting(true)
    try {
      await submitLead({
        ...values,
        whatsapp: values.whatsapp.replace(/\D/g, ''),
        birthDate: birthDateToIso(values.birthDate),
      })
      setSuccess(true)
    } catch {
      setSubmitError('Não foi possível registrar sua assinatura agora. Tente novamente em instantes.')
    } finally {
      setSubmitting(false)
    }
  }

  const register = (field) => ({
    ref: (element) => { fieldRefs.current[field] = element },
    name: field,
    value: values[field],
    onChange: updateField,
    onBlur: handleBlur,
    'aria-invalid': Boolean(fieldError(field)),
    'aria-describedby': fieldError(field) ? `${uid}-${field}-error` : undefined,
  })

  return (
    <form className="lead-form" onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label className="sr-only" htmlFor="name">Nome completo</label>
        <input id="name" type="text" autoComplete="name" placeholder="Nome completo *" {...register('name')} />
        <p id={`${uid}-name-error`} className="field-error" role="alert">{fieldError('name')}</p>
      </div>
      <div className="form-field">
        <label className="sr-only" htmlFor="whatsapp">WhatsApp com DDD</label>
        <input id="whatsapp" type="tel" autoComplete="tel" inputMode="tel" placeholder="WhatsApp com DDD *" {...register('whatsapp')} />
        <p id={`${uid}-whatsapp-error`} className="field-error" role="alert">{fieldError('whatsapp')}</p>
      </div>
      <div className="form-field">
        <label className="sr-only" htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" inputMode="email" placeholder="E-mail *" {...register('email')} />
        <p id={`${uid}-email-error`} className="field-error" role="alert">{fieldError('email')}</p>
      </div>
      <div className="form-field">
        <label htmlFor="birthDate">Data de nascimento *</label>
        <input id="birthDate" type="text" inputMode="numeric" autoComplete="bday" maxLength="10" placeholder="dd/mm/aaaa" {...register('birthDate')} />
        <p id={`${uid}-birthDate-error`} className="field-error" role="alert">{fieldError('birthDate')}</p>
      </div>
      <div className="form-field">
        <label className="sr-only" htmlFor="state">Estado</label>
        <div className="select-wrap">
          <select id="state" {...register('state')}>
            {brazilianStates.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}
          </select>
        </div>
        <p id={`${uid}-state-error`} className="field-error" role="alert">{fieldError('state')}</p>
      </div>
      <div className="form-field">
        <label className="sr-only" htmlFor="city">Município</label>
        <input id="city" list="mg-municipalities" type="text" autoComplete="address-level2" placeholder={status === 'loading' ? 'Carregando municípios...' : 'Município *'} disabled={status === 'loading'} {...register('city')} />
        <datalist id="mg-municipalities">{municipalities.map((municipality) => <option key={municipality.id} value={municipality.name} />)}</datalist>
        {status === 'error' && <p className="load-error" role="alert">Não foi possível carregar os municípios deste estado. Tente selecionar novamente.</p>}
        <p id={`${uid}-city-error`} className="field-error" role="alert">{fieldError('city')}</p>
      </div>
      <button className="form-submit" type="submit" disabled={submitting || status === 'loading'}>
        {submitting ? 'Enviando...' : 'Assinar o manifesto'}
      </button>
      <p className="form-privacy-notice">
        Ao assinar, você concorda com o tratamento dos seus dados conforme a nossa{' '}
        <button type="button" onClick={onOpenPrivacy}>Política de Privacidade</button>.
      </p>
      {success && (
        <p className="form-success" role="status">
          {values.name.trim()},<br /><br />
          Obrigado por assinar nosso manifesto.<br /><br />
          Vamos juntos em defesa da Minas Gerais que merecemos e precisamos.<br /><br />
          Bolsozema nunca mais!
        </p>
      )}
      {submitError && <p className="form-submit-error" role="alert">{submitError}</p>}
    </form>
  )
}
