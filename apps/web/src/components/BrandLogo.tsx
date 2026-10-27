interface BrandLogoProps {
  size?: 'small' | 'medium';
  symbolOnly?: boolean;
  compact?: boolean;
  wordmarkClassName?: string;
}

const symbolSizes = {
  small: 'h-5 w-5 rounded',
  medium: 'h-8 w-8 rounded-md',
};

export default function BrandLogo({
  size = 'medium',
  symbolOnly = false,
  compact = false,
  wordmarkClassName = 'text-base font-semibold tracking-tight text-text-primary',
}: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`flex flex-shrink-0 items-center justify-center overflow-hidden bg-white ${symbolSizes[size]}`}>
        <img
          src="/brand/qravikon-mark.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
        />
      </span>
      {!symbolOnly && (
        <span className={`${wordmarkClassName}${compact ? ' hidden sm:inline' : ''}`}>
          Qravikon
        </span>
      )}
    </span>
  );
}
