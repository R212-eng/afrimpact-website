import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api'
import { Check, Close } from '../components/Icons'
import { Field, useForm } from '../components/Form'
import seed from '@seed'

// Topics offered in the consultation pop-up, per service area (from the Services page)
const TOPICS = {
  investment: seed.services.filter((s) => s.category === 'investment').map((s) => s.title),
  travel: seed.services.filter((s) => s.category === 'travel').map((s) => s.title),
  other: seed.service_categories.find((c) => c.category === 'other')?.bullets.map((b) => b.replace(/\.$/, '')) || [],
}

const UICtx = createContext(null)
export const useUI = () => useContext(UICtx)

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [consult, setConsult] = useState(null) // null = closed, else { interest, source }

  const toast = useCallback((message, type = 'success') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  const openConsultation = useCallback((opts = {}) => setConsult({ interest: 'investment', ...opts }), [])

  return (
    <UICtx.Provider value={{ toast, openConsultation }}>
      {children}
      {consult && <ConsultationModal {...consult} onClose={() => setConsult(null)} toast={toast} />}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.type === 'success' ? <Check size={18} /> : <Close size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </UICtx.Provider>
  )
}

function ConsultationModal({ interest, topic, source, onClose, toast }) {
  const location = useLocation()
  const form = useForm({
    full_name: '', email: '', phone: '', company: '', service_interest: interest,
    topic: topic || '', preferred_date: '', message: '',
  })
  const topics = TOPICS[form.values.service_interest] || []

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const submit = form.handleSubmit(async (values) => {
    const res = await api.consultation({
      ...values, topic: values.topic || null, preferred_date: values.preferred_date || null,
      source_page: source || location.pathname,
    })
    toast(res.message)
    onClose()
  })

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="consult-title" onMouseDown={onClose}>
      <div className="modal__panel" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close"><Close /></button>
        <div className="modal__head">
          <h2 id="consult-title">Request a Consultation</h2>
          {topic && <span className="modal__topic">{topic}</span>}
          <p>Tell us a little about your plans and an Afrimpact advisor will reach out within one working day.</p>
        </div>
        <form className="form" onSubmit={submit} noValidate>
          <div className="form__row">
            <Field form={form} name="full_name" label="Full name" required />
            <Field form={form} name="email" label="Email" type="email" required />
          </div>
          <div className="form__row">
            <Field form={form} name="phone" label="Phone number" type="tel" />
            <Field form={form} name="company" label="Company / organisation" />
          </div>
          <div className="form__row">
            <Field form={form} name="service_interest" label="Service area" as="select"
              onChange={(e) => form.setValues((v) => ({ ...v, service_interest: e.target.value, topic: '' }))}>
              <option value="investment">Investment Consulting</option>
              <option value="travel">Travel Advisory</option>
              <option value="other">Other Services</option>
            </Field>
            <Field form={form} name="topic" label="Topic" as="select">
              <option value="">General enquiry</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </Field>
          </div>
          <Field form={form} name="preferred_date" label="Preferred date for a call" type="date" />
          <Field form={form} name="message" label="How can we help?" as="textarea" rows={4} />
          {form.error && <p className="form__error">{form.error}</p>}
          <button className="btn btn--solid btn--block" disabled={form.submitting}>
            {form.submitting ? 'Sending…' : 'Send Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
