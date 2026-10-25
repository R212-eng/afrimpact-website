import { useEffect, useState } from 'react'
import { api } from '../api'
import { useUI } from '../context/UIContext'
import { formatDate } from '../lib/utils'

export function EmailSettings({ ctx }) {
  const { toast } = useUI()
  const [st, setSt] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = () => api.adminEmail(ctx.token).then(setSt)
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!st) return <div className="adm-loading"><span className="spinner" /></div>
  const test = async () => {
    setBusy(true)
    try {
      toast((await api.adminEmailTest(ctx.token)).message)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
      load()
    }
  }
  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div>
          <h1>Email forwarding</h1>
          <p className="adm-muted">Every form is saved to the database (except Contact, which is email-only) and forwarded to the inbox below.</p>
        </div>
        <div className="adm-actions">
          <span className={`adm-pill ${st.configured ? 'adm-pill--approved' : 'adm-pill--pending'}`}>{st.configured ? `SMTP connected · ${st.smtp_host}:${st.smtp_port}` : 'SMTP not configured'}</span>
          <button className="adm-btn adm-btn--primary" onClick={test} disabled={busy}>{busy ? 'Sending…' : 'Send test email'}</button>
        </div>
      </div>

      {!st.configured && (
        <div className="adm-card adm-callout">
          <h2>Turn on email</h2>
          <p>Add these to <code>backend/.env</code> and restart the API. Each form can go to its own inbox with <code>NOTIFY_&lt;FORM&gt;</code>; empty ones use <code>NOTIFY_EMAILS</code>.</p>
          <pre>{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=you@yourdomain.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=Afrimpact Website <no-reply@afrimpact.com>
NOTIFY_EMAILS=info@afrimpact.com
NOTIFY_ITINERARIES=travel@afrimpact.com
NOTIFY_INTERESTS=invest@afrimpact.com`}</pre>
        </div>
      )}

      <section className="adm-card">
        <h2>Where each form goes</h2>
        <div className="adm-table-wrap adm-table-wrap--flat">
          <table className="adm-table">
            <thead><tr><th>Form</th><th>Stored in database</th><th>Forwarded to</th></tr></thead>
            <tbody>
              {st.routes.map((r) => (
                <tr key={r.kind}>
                  <td>{r.label}</td>
                  <td>{r.kind === 'contact' ? 'No — email only' : 'Yes'}</td>
                  <td>{r.recipients.length ? r.recipients.join(', ') : '—'} {r.custom && <span className="adm-pill adm-pill--approved">custom</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="adm-muted">Visitor confirmation emails: {st.send_confirmation ? 'on' : 'off'} (SEND_CONFIRMATION).</p>
      </section>

      {st.newsletter_sends?.length > 0 && (
        <section className="adm-card">
          <h2>Newsletter mailings</h2>
          <div className="adm-table-wrap adm-table-wrap--flat">
            <table className="adm-table">
              <thead><tr><th>When</th><th>Subject</th><th>Subscribers</th><th>Delivered</th><th>Status</th></tr></thead>
              <tbody>{st.newsletter_sends.map((n) => (
                <tr key={n.id}><td>{formatDate(n.created_at)}</td><td>{n.subject}</td><td>{n.recipients}</td><td>{n.delivered}</td>
                  <td><span className={`adm-pill adm-pill--${n.status}`}>{n.status}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="adm-card">
        <h2>Recent email activity</h2>
        {st.logs.length === 0 ? <p className="adm-muted">No emails yet.</p> : (
          <div className="adm-table-wrap adm-table-wrap--flat">
            <table className="adm-table">
              <thead><tr><th>When</th><th>Form</th><th>Type</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
              <tbody>{st.logs.map((l) => (
                <tr key={`${l.id}-${l.purpose}`} title={l.error || ''}>
                  <td>{formatDate(l.created_at)}</td><td>{l.kind}</td><td>{l.purpose}</td><td>{l.recipient}</td><td>{l.subject}</td>
                  <td><span className={`adm-pill adm-pill--${l.status}`}>{l.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
