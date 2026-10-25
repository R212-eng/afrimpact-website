import { useState } from 'react'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Minimal form state helper with required/email validation. */
export function useForm(initial) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rules] = useState({})

  const register = (name, { required, type } = {}) => {
    rules[name] = { required, type }
    return {
      name,
      value: values[name] ?? '',
      onChange: (e) => {
        setValues((v) => ({ ...v, [name]: e.target.value }))
        if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }))
      },
    }
  }

  const validate = () => {
    const errs = {}
    Object.entries(rules).forEach(([name, r]) => {
      const v = String(values[name] ?? '').trim()
      if (r.required && !v) errs[name] = 'This field is required'
      else if (r.type === 'email' && v && !EMAIL.test(v)) errs[name] = 'Enter a valid email address'
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (fn) => async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      await fn(values)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setValues(initial)
    setErrors({})
  }

  return { values, errors, error, submitting, register, handleSubmit, reset, setValues }
}

export function Field({ form, name, label, as = 'input', required, type = 'text', placeholder, children, hideLabel, ...rest }) {
  const Tag = as
  const id = `f-${name}`
  const err = form.errors[name]
  return (
    <label className={`field ${err ? 'field--error' : ''}`} htmlFor={id}>
      <span className={hideLabel ? 'sr-only' : 'field__label'}>
        {label} {required && <em aria-hidden="true">*</em>}
      </span>
      <Tag id={id} type={as === 'input' ? type : undefined} placeholder={placeholder ?? (hideLabel ? label : undefined)}
        aria-invalid={!!err} {...form.register(name, { required, type })} {...rest}>
        {children}
      </Tag>
      {err && <span className="field__msg">{err}</span>}
    </label>
  )
}
