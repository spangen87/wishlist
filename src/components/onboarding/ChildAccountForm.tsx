'use client';
import { useState } from 'react';
import { auth } from '@/lib/firebase/client';

interface ChildAccountFormProps {
  onSuccess: (uid: string) => void;
}

const FIELD_ACCENTS = ['#FF7AB8', '#7DE3FF', '#FFD36E', '#85F2CA'] as const;
const FIELD_LABELS = ['Visningsnamn', 'Användarnamn', 'Lösenord', 'Ålder'] as const;

export function ChildAccountForm({ onSuccess }: ChildAccountFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Ange ett visningsnamn');
      return;
    }
    const usernameLower = username.trim().toLowerCase();
    if (usernameLower.length < 3) {
      setError('Användarnamnet måste vara minst 3 tecken');
      return;
    }
    // Must match USERNAME_PATTERN in /api/auth/register-child
    if (!/^[a-z0-9._-]{3,30}$/.test(usernameLower)) {
      setError('Användarnamnet får bara innehålla bokstäver (a–z), siffror, punkt, bindestreck och understreck');
      return;
    }
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken');
      return;
    }
    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 18) {
      setError('Ange en ålder mellan 1 och 18');
      return;
    }

    setLoading(true);
    try {
      if (!auth.currentUser) {
        setError('Sessionen har gått ut. Logga ut och logga in igen, sedan försök skapa barnkontot.');
        setLoading(false);
        return;
      }
      let viewerIdToken: string;
      try {
        viewerIdToken = await auth.currentUser.getIdToken(true);
      } catch {
        setError('Sessionen har gått ut. Logga ut och logga in igen, sedan försök skapa barnkontot.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/auth/register-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameLower,
          password,
          displayName: displayName.trim(),
          age: ageNum,
          viewerIdToken,
        }),
      });
      if (res.status === 409) {
        setError('Användarnamnet är redan taget');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Något gick fel. Försök igen.');
        return;
      }
      const { uid } = await res.json();
      onSuccess(uid);
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    {
      id: 'displayName',
      type: 'text',
      autoComplete: 'off',
      value: displayName,
      onChange: setDisplayName,
    },
    {
      id: 'username',
      type: 'text',
      autoComplete: 'off',
      value: username,
      onChange: setUsername,
    },
    {
      id: 'password',
      type: 'password',
      autoComplete: 'new-password',
      value: password,
      onChange: setPassword,
    },
    {
      id: 'age',
      type: 'number',
      autoComplete: 'off',
      value: age,
      onChange: setAge,
      min: 1,
      max: 18,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {fields.map((f, i) => (
        <div key={f.id}>
          <label
            htmlFor={f.id}
            className="block mb-1.5 text-[10px] font-bold tracking-caps"
            style={{ color: FIELD_ACCENTS[i] }}
          >
            {FIELD_LABELS[i]}
          </label>
          <input
            id={f.id}
            type={f.type}
            autoComplete={f.autoComplete}
            min={f.min}
            max={f.max}
            required
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="light-input"
            style={{ boxShadow: `inset 0 0 0 1px ${FIELD_ACCENTS[i]}33` }}
          />
        </div>
      ))}

      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="light-cta mt-1">
        {loading ? 'Skapar…' : 'Skapa konto →'}
      </button>
    </form>
  );
}
