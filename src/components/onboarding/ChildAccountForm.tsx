'use client';
import { useState } from 'react';
import { auth } from '@/lib/firebase/client';

interface ChildAccountFormProps {
  onSuccess: (uid: string) => void;
}

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

    // Client-side validation
    if (!displayName.trim()) {
      setError('Ange ett visningsnamn');
      return;
    }
    if (username.trim().length < 3) {
      setError('Användarnamnet måste vara minst 3 tecken');
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
          username: username.trim().toLowerCase(),
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
        setError('Något gick fel. Försök igen.');
        return;
      }
      const { uid } = await res.json();
      onSuccess(uid); // wishlistId === uid (deterministic)
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="displayName" className="block text-sm mb-1">
          Visningsnamn
        </label>
        <input
          id="displayName"
          type="text"
          autoComplete="off"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="username" className="block text-sm mb-1">
          Användarnamn
        </label>
        <input
          id="username"
          type="text"
          autoComplete="off"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm mb-1">
          Lösenord
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="age" className="block text-sm mb-1">
          Ålder
        </label>
        <input
          id="age"
          type="number"
          min="1"
          max="18"
          required
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded px-3 py-2"
        />
      </div>
      {error && (
        <p role="alert" className="text-[#DC2626] text-sm">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] transition-colors disabled:opacity-50"
      >
        {loading ? 'Skapar…' : 'Skapa konto'}
      </button>
    </form>
  );
}
