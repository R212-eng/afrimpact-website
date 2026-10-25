import { useState } from 'react'
import { api } from '../api'
import { Field, useForm } from '../components/Form'
import { Check, Clock, Mail, Phone, Pin } from '../components/Icons'
import { CONTACT, ConsultationCTA, SocialLinks } from '../components/Layout'
import { useUI } from '../context/UIContext'
import { useDocumentTitle } from '../lib/utils'

export default function Contact() {
  useDocumentTitle('Contact Us')
  const { toast } = useUI()
  const [sent, setSent] = useState(null)
  const form = useForm({ first_name: '', last_name: '', email: '', phone: '', message: '' })
  const submit = form.handleSubmit(async (v) => {
    const r = await api.contact(v)
    toast(r.message)
    setSent(r.message)
    form.reset()
  })

  return (
    <div className="contact">
      <section className="contact__grid">
        <div className="contact__info">
          <h1>Contact Us</h1>
          <h3>Phone</h3>
          <a href={`tel:${CONTACT.phone}`} className="contact__link"><Phone size={16} /> {CONTACT.phone}</a>
          <h3>Email</h3>
          <a href={`mailto:${CONTACT.email}`} className="contact__link"><Mail size={16} /> {CONTACT.email}</a>
          <h3>Office</h3>
          <p className="contact__link"><Pin size={16} /> {CONTACT.address}</p>
          <p className="contact__link"><Clock size={16} /> {CONTACT.hours}</p>
          <div className="contact__social">
            <strong>social</strong>
            <SocialLinks size={34} />
          </div>
        </div>

        <div className="contact__form-wrap">
          {sent ? (
            <div className="form-success form-success--light">
              <Check size={28} />
              <p>{sent}</p>
              <button className="btn btn--solid" onClick={() => setSent(null)}>Send another message</button>
            </div>
          ) : (
            <form className="form form--contact" onSubmit={submit} noValidate>
              <div className="form__row">
                <Field form={form} name="first_name" label="First Name" required hideLabel />
                <Field form={form} name="last_name" label="Last Name" required hideLabel />
              </div>
              <Field form={form} name="email" label="Email" type="email" required hideLabel />
              <Field form={form} name="phone" label="Phone Number" type="tel" hideLabel />
              <Field form={form} name="message" label="Message" as="textarea" rows={5} required hideLabel />
              {form.error && <p className="form__error">{form.error}</p>}
              <button className="btn btn--solid btn--block btn--lg" disabled={form.submitting}>
                {form.submitting ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </section>
      <ConsultationCTA />
    </div>
  )
}
