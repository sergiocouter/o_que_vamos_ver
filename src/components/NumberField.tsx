import { useState } from 'react'

interface NumberFieldProps {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  'aria-label'?: string
}

// Campo numérico que pode ficar vazio enquanto a pessoa digita.
// Ao sair do campo vazio, volta para o mínimo.
export function NumberField({ value, min = 0, max = Number.MAX_SAFE_INTEGER, onChange, ...rest }: NumberFieldProps) {
  const [editing, setEditing] = useState<string | null>(null)

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 5)
    if (digits === '') {
      setEditing('')
      return
    }
    const clamped = Math.max(min, Math.min(Number(digits), max))
    setEditing(clamped === Number(digits) ? digits : String(clamped))
    onChange(clamped)
  }

  function handleBlur() {
    if (editing === '') onChange(min)
    setEditing(null)
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={editing ?? String(value)}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
    />
  )
}
