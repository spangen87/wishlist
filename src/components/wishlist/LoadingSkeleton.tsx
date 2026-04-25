import { NightShell } from '@/components/galaxy';

export function LoadingSkeleton() {
  return (
    <NightShell twinkleCount={20}>
      <div className="px-5 pt-6 pb-10 mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-7">
          <div
            className="rounded-full anim-twinkle"
            style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.06)' }}
          />
          <div className="flex flex-col gap-1.5">
            <div className="rounded-md anim-twinkle" style={{ width: 72, height: 10, background: 'rgba(255,255,255,0.08)' }} />
            <div className="rounded-md anim-twinkle" style={{ width: 140, height: 18, background: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
        <ul className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="night-card anim-twinkle"
              style={{ height: 76, animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </ul>
      </div>
    </NightShell>
  );
}
