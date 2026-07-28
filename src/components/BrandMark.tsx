export function BrandMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2" width="11" height="2" rx="1" />
      <rect x="2" y="7" width="3" height="2" rx="1" opacity="0.45" />
      <rect x="6" y="7" width="3" height="2" rx="1" opacity="0.45" />
      <rect x="10" y="12" width="3" height="2" rx="1" />
    </svg>
  );
}
