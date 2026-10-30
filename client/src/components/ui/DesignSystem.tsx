import React from 'react';

/**
 * The four primitives still shared across the app.
 *
 * This module used to be a 1,050-line design system — Card, Drawer, Modal,
 * Toggle, FormField, Search, GraphNode and a dozen more — written against the
 * dark theme that the product no longer uses. Nineteen of its twenty-five
 * exports had no importer, and the file was the last place the retired palette
 * survived. It has been reduced to the pieces that are actually called.
 *
 * New UI should use the Plate & Paper classes in `index.css` (`.panel`,
 * `.abtn`, `.khead`, `.kmetric`, `.st`, …) rather than growing this file back.
 * What remains here is here because three pages already depend on it and
 * rewriting those call sites would be churn without benefit.
 */

/* ── Spinner ───────────────────────────────────────────────────────────── */

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg';
}

const SPINNER_SIZE: Record<NonNullable<SpinnerProps['size']>, number> = {
  sm: 14,
  md: 18,
  lg: 26,
};

export const Spinner = ({ size = 'md', className = '', ...props }: SpinnerProps) => {
  const px = SPINNER_SIZE[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.22" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
};

/* ── Loading ───────────────────────────────────────────────────────────── */

export interface LoadingProps {
  message?: string;
  /** `spinner` for short waits, `skeleton` for a first paint. */
  type?: 'spinner' | 'skeleton';
  className?: string;
}

export const Loading = ({ message = 'Loading…', type = 'spinner', className = '' }: LoadingProps) => (
  <div
    className={`flex flex-col items-center justify-center gap-3 text-ink-3 ${className}`}
    role="status"
    aria-live="polite"
  >
    {type === 'spinner' ? (
      <Spinner size="lg" />
    ) : (
      /* Skeleton bars rather than a spinner: a first paint should show the
         shape of what is coming, not a rotating circle. */
      <div className="flex w-[220px] flex-col gap-2">
        {[100, 76, 54].map((w) => (
          <span
            key={w}
            className="h-2 animate-pulse-dot rounded-full bg-rule"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    )}
    <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{message}</span>
  </div>
);

/* ── ErrorState ────────────────────────────────────────────────────────── */

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState = ({ title, description, onRetry, className = '' }: ErrorStateProps) => (
  <div className={`flex flex-col items-start gap-3 ${className}`} role="alert">
    <span className="st st--risk">
      <i />
      {title}
    </span>
    {description && (
      <p className="max-w-[52ch] text-[13px] leading-[1.65] text-ink-2">{description}</p>
    )}
    {onRetry && (
      <button type="button" onClick={onRetry} className="abtn abtn--ghost mt-1">
        Try again
      </button>
    )}
  </div>
);

/* ── Typography ────────────────────────────────────────────────────────── */

type Variant = 'headline' | 'title' | 'body' | 'body-sm' | 'label-caps' | 'mono';

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: Variant;
  as?: keyof React.JSX.IntrinsicElements;
}

const VARIANT_CLASS: Record<Variant, string> = {
  headline: 'text-[18px] font-semibold tracking-[-0.025em] text-ink',
  title: 'text-[15px] font-semibold tracking-[-0.02em] text-ink',
  body: 'text-[13.5px] leading-[1.65] text-ink-2',
  'body-sm': 'text-[12.5px] leading-[1.6] text-ink-2',
  'label-caps': 'font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3',
  mono: 'font-mono text-[11px] text-ink-2',
};

export const Typography = ({
  variant = 'body',
  as: Tag = 'p',
  className = '',
  children,
  ...props
}: TypographyProps) => {
  const Component = Tag as React.ElementType;
  return (
    <Component className={`${VARIANT_CLASS[variant]} ${className}`} {...props}>
      {children}
    </Component>
  );
};

/* ── Panel ─────────────────────────────────────────────────────────────── */

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'base' | 'plate';
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ variant = 'base', className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`${variant === 'plate' ? 'panel panel--plate' : 'panel'} ${className}`}
      {...props}
    >
      {children}
    </div>
  ),
);
Panel.displayName = 'Panel';

/* ── Button ────────────────────────────────────────────────────────────── */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const BUTTON_VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'border-[1.5px] border-forest bg-forest text-[#f0f6f2] hover:border-[#0c2a23] hover:bg-[#0c2a23]',
  secondary: 'border-[1.5px] border-ink bg-transparent text-ink hover:bg-ink hover:text-paper',
  ghost: 'border border-rule-strong bg-paper-2 text-ink-2 hover:border-ink hover:text-ink',
  danger: 'border-[1.5px] border-sig bg-sig text-[#fff4f2] hover:bg-[#c53a24]',
};

const BUTTON_SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2.5 py-1.5 text-[11px]',
  md: 'px-4 py-2.5 text-[12.5px]',
  lg: 'px-5 py-3 text-[13.5px]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', isLoading = false, className = '', children, disabled, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-[3px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
      {...props}
    >
      {isLoading && <Spinner size="sm" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
