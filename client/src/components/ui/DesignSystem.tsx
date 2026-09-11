import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ==========================================
// 1. TYPOGRAPHY
// ==========================================

interface TypographyProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: 'display' | 'headline' | 'body' | 'body-sm' | 'code' | 'label-caps';
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'code';
}

export const Typography = ({
  variant = 'body',
  as: Component = 'p',
  className = '',
  children,
  ...props
}: TypographyProps) => {
  const getStyleClass = () => {
    switch (variant) {
      case 'display':
        return 'font-heading font-semibold text-[32px] leading-[1.2] tracking-[-0.02em] text-[#e4e1e5]';
      case 'headline':
        return 'font-heading font-semibold text-[20px] leading-[1.4] tracking-[-0.01em] text-[#e4e1e5]';
      case 'body':
        return 'font-body font-normal text-[14px] leading-[1.5] text-[#c8c5ca]';
      case 'body-sm':
        return 'font-body font-normal text-[13px] leading-[1.5] text-[#919095]';
      case 'code':
        return 'font-mono text-[13px] leading-[1.6] text-[#e4e1e5] bg-[#0e0e11] px-1 py-0.5 rounded-[4px] border border-[#27272a]';
      case 'label-caps':
        return 'font-mono font-medium text-[11px] leading-[1] uppercase tracking-[0.05em] text-[#c8c6c8]';
      default:
        return '';
    }
  };

  const ComponentToRender = Component as any;

  return (
    <ComponentToRender className={`${getStyleClass()} ${className}`} {...props}>
      {children}
    </ComponentToRender>
  );
};

// ==========================================
// 1.5 SPINNER
// ==========================================

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner = ({ size = 'md', className = '', ...props }: SpinnerProps) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'sm': return 'w-3.5 h-3.5';
      case 'md': return 'w-5 h-5';
      case 'lg': return 'w-8 h-8';
      default: return 'w-5 h-5';
    }
  };

  return (
    <svg
      className={`animate-spin text-accent ${getSizeStyles()} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

// ==========================================
// 2. BUTTONS
// ==========================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent-glow';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'secondary',
  size = 'md',
  icon,
  isLoading = false,
  disabled,
  className = '',
  children,
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-heading font-medium tracking-tight rounded-md transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base select-none';
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-accent hover:bg-accent-hover text-white border border-transparent shadow-sm';
      case 'secondary':
        return 'bg-transparent hover:bg-surface-elevated text-text-primary border border-border-subtle';
      case 'ghost':
        return 'bg-transparent hover:bg-surface-elevated/60 text-text-secondary hover:text-text-primary border border-transparent';
      case 'danger':
        return 'bg-status-error/15 hover:bg-status-error/25 text-status-error border border-status-error/40';
      case 'accent-glow':
        return 'bg-accent hover:bg-accent-hover text-white border border-transparent shadow-[0_0_20px_rgba(176,38,255,0.35)]';
      default:
        return 'bg-transparent hover:bg-surface-elevated text-text-primary border border-border-subtle';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'h-8 px-3 text-[12px] gap-1.5';
      case 'md':
        return 'h-9 px-4 text-[13px] gap-2';
      case 'lg':
        return 'h-11 px-5 text-[14px] gap-2.5';
      default:
        return 'h-9 px-4 text-[13px] gap-2';
    }
  };

  const isButtonDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      disabled={isButtonDisabled}
      aria-busy={isLoading ? true : undefined}
      className={`${baseStyles} ${getVariantStyles()} ${getSizeStyles()} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size={size === 'lg' ? 'md' : 'sm'} className="text-current" />
          {children && <span>{children}</span>}
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
});
Button.displayName = 'Button';

// ==========================================
// 3. PANELS
// ==========================================

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'base' | 'lowest' | 'high' | 'subtle';
  bordered?: boolean;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(({
  variant = 'base',
  bordered = true,
  className = '',
  children,
  ...props
}, ref) => {
  const getBgClass = () => {
    switch (variant) {
      case 'lowest':
        return 'bg-surface-base';
      case 'base':
        return 'bg-surface-subtle';
      case 'high':
        return 'bg-surface-elevated';
      case 'subtle':
        return 'bg-surface-subtle';
      default:
        return 'bg-surface-subtle';
    }
  };

  const borderClass = bordered ? 'border border-border-subtle rounded-lg' : '';

  return (
    <div ref={ref} className={`${getBgClass()} ${borderClass} ${className}`} {...props}>
      {children}
    </div>
  );
});
Panel.displayName = 'Panel';

// ==========================================
// 4. CARDS
// ==========================================

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive';
  hoverable?: boolean;
  accent?: 'blue' | 'purple' | 'red' | 'green' | 'none';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  variant = 'default',
  hoverable = true,
  accent = 'none',
  className = '',
  children,
  ...props
}, ref) => {
  const getAccentClass = () => {
    switch (accent) {
      case 'blue':
        return 'border-t-2 border-t-accent';
      case 'purple':
        return 'border-t-2 border-t-[#a855f7]';
      case 'red':
        return 'border-t-2 border-t-status-error';
      case 'green':
        return 'border-t-2 border-t-status-success';
      default:
        return '';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return 'bg-surface-elevated shadow-card';
      case 'interactive':
        return 'bg-surface-elevated hover:bg-surface-elevated/80 border-border-default hover:border-border-strong cursor-pointer';
      case 'default':
      default:
        return 'bg-surface-elevated';
    }
  };

  const isInteractive = hoverable || variant === 'interactive';
  const hoverClass = isInteractive ? 'hover:bg-surface-elevated/90 transition-all duration-150 cursor-pointer' : '';

  return (
    <div
      ref={ref}
      className={`${getVariantStyles()} border border-border-subtle rounded-lg p-4 ${getAccentClass()} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';

// ==========================================
// 5. BADGES
// ==========================================

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'blue' | 'green' | 'purple' | 'red';
  showDot?: boolean;
}

export const Badge = ({
  variant = 'neutral',
  showDot = false,
  className = '',
  children,
  ...props
}: BadgeProps) => {
  const getStyleClass = () => {
    switch (variant) {
      case 'info':
      case 'blue':
        return 'bg-status-info/10 text-[#adc6ff] border border-status-info/20';
      case 'success':
      case 'green':
        return 'bg-status-success/10 text-status-success border border-status-success/20';
      case 'warning':
        return 'bg-status-warning/10 text-status-warning border border-status-warning/20';
      case 'danger':
      case 'red':
        return 'bg-status-error/10 text-[#ffb4ab] border border-status-error/20';
      case 'purple':
        return 'bg-[#a855f7]/10 text-[#ddb7ff] border border-[#a855f7]/20';
      case 'neutral':
      default:
        return 'bg-surface-elevated text-text-secondary border border-border-subtle';
    }
  };

  const getDotColor = () => {
    switch (variant) {
      case 'info':
      case 'blue': return 'bg-status-info';
      case 'success':
      case 'green': return 'bg-status-success';
      case 'warning': return 'bg-status-warning';
      case 'danger':
      case 'red': return 'bg-status-error';
      case 'purple': return 'bg-[#a855f7]';
      case 'neutral':
      default: return 'bg-text-secondary';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-medium rounded-sm uppercase tracking-wide ${getStyleClass()} ${className}`}
      {...props}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${getDotColor()}`} aria-hidden="true" />}
      {children}
    </span>
  );
};

// ==========================================
// 6. DRAWERS
// ==========================================

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Drawer = ({ isOpen, onClose, title, children }: DrawerProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-45 bg-[#0e0e11]"
          />
          {/* Content */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[460px] bg-[#131316] border-l border-[#27272a] shadow-xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a]">
              <Typography variant="headline" as="h3">{title}</Typography>
              <button
                onClick={onClose}
                className="text-[#919095] hover:text-[#e4e1e5] p-1.5 rounded-[4px] hover:bg-[#27272a] cursor-pointer"
              >
                {/* Close Icon SVG */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ==========================================
// 7. GRAPH NODES (SVG elements representation)
// ==========================================

interface GraphNodeProps {
  label: string;
  type: 'route' | 'controller' | 'service' | 'config' | 'other';
  x: number;
  y: number;
  isActive?: boolean;
  isHovered?: boolean;
  status?: 'optimal' | 'refactor' | 'critical';
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const GraphNode = ({
  label,
  type,
  x,
  y,
  isActive = false,
  isHovered = false,
  status = 'optimal',
  onClick,
  onMouseEnter,
  onMouseLeave
}: GraphNodeProps) => {
  const getStatusBorderColor = () => {
    switch (status) {
      case 'critical': return '#ffb4ab';
      case 'refactor': return '#eab308';
      case 'optimal': default: return '#3b82f6';
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'route': return 'R';
      case 'controller': return 'C';
      case 'service': return 'S';
      case 'config': return '⚙';
      default: return 'F';
    }
  };

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="cursor-pointer select-none"
    >
      {/* Node Glow */}
      {(isHovered || isActive) && (
        <circle
          r={28}
          fill="none"
          stroke={getStatusBorderColor()}
          strokeOpacity={0.15}
          strokeWidth={6}
        />
      )}
      {/* Node Outer Circle */}
      <circle
        r={22}
        fill="#131316"
        stroke={isActive ? getStatusBorderColor() : isHovered ? '#fafafa' : '#27272a'}
        strokeWidth={isActive ? 3 : 2}
      />
      {/* Small Type Icon */}
      <circle
        r={8}
        cx={14}
        cy={-14}
        fill={getStatusBorderColor()}
      />
      <text
        fontSize={10}
        fontFamily="JetBrains Mono"
        fontWeight="bold"
        fill="#131316"
        textAnchor="middle"
        dominantBaseline="central"
        x={14}
        y={-14}
      >
        {getTypeIcon()}
      </text>
      {/* Text Label */}
      <text
        y={36}
        fontSize={11}
        fontFamily="Inter"
        fill={isActive || isHovered ? '#fafafa' : '#c8c5ca'}
        textAnchor="middle"
        fontWeight={isActive ? 'semibold' : 'normal'}
      >
        {label}
      </text>
    </g>
  );
};

// ==========================================
// 8. SEARCH INPUT
// ==========================================

interface SearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export const Search = ({ onSearch, className = '', ...props }: SearchProps) => {
  const [value, setValue] = React.useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    if (onSearch) onSearch(val);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Search SVG Icon */}
      <span className="absolute left-3 text-[#919095]">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className="w-full bg-[#0e0e11] border border-[#27272a] rounded-[6px] pl-9 pr-12 py-1.5 text-[13px] font-body text-[#fafafa] placeholder-[#919095] focus:outline-none focus:border-[#3b82f6] transition-all duration-150"
        {...props}
      />
      {/* Shortcut indicator */}
      <span className="absolute right-3 flex items-center gap-0.5 px-1 py-0.5 bg-[#1f1f22] border border-[#27272a] rounded-[4px] text-[9px] font-mono text-[#919095] select-none">
        <span>⌘</span>
        <span>K</span>
      </span>
    </div>
  );
};

// ==========================================
// 9. LOADING STATES
// ==========================================

interface LoadingProps {
  message?: string;
  type?: 'spinner' | 'skeleton' | 'step-list';
  steps?: string[];
  currentStep?: number;
}

export const Loading = ({
  message = 'Loading analysis...',
  type = 'spinner',
  steps = [],
  currentStep = 0
}: LoadingProps) => {
  if (type === 'skeleton') {
    return (
      <div className="space-y-4 animate-pulse w-full">
        <div className="h-6 bg-[#27272a] rounded-[4px] w-1/3" />
        <div className="h-32 bg-[#1f1f22] border border-[#27272a] rounded-[8px]" />
        <div className="space-y-2">
          <div className="h-4 bg-[#27272a] rounded-[4px] w-full" />
          <div className="h-4 bg-[#27272a] rounded-[4px] w-5/6" />
        </div>
      </div>
    );
  }

  if (type === 'step-list' && steps.length > 0) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-[#131316] border border-[#27272a] rounded-[8px] max-w-[420px] w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#3b82f6]/20 border-t-[#3b82f6] rounded-full animate-spin" />
          <Typography variant="headline" as="h4">{message}</Typography>
        </div>
        <div className="flex flex-col gap-2 mt-2">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isActive = idx === currentStep;
            return (
              <div key={idx} className="flex items-center gap-2.5 text-[13px] font-body">
                {isCompleted ? (
                  <span className="text-[#10b981] font-mono">✓</span>
                ) : isActive ? (
                  <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-ping" />
                ) : (
                  <span className="w-1.5 h-1.5 bg-[#47464a] rounded-full" />
                )}
                <span className={isCompleted ? 'text-[#919095]' : isActive ? 'text-[#fafafa] font-medium' : 'text-[#47464a]'}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 w-full">
      <div className="w-8 h-8 border-2 border-[#3b82f6]/20 border-t-[#3b82f6] rounded-full animate-spin" />
      <Typography variant="body-sm">{message}</Typography>
    </div>
  );
};

// ==========================================
// 10. EMPTY STATES
// ==========================================

interface EmptyProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const Empty = ({
  title = 'No Data Selected',
  description = 'Select a node or module in the panel to inspect dependency parameters.',
  action,
  icon
}: EmptyProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-[#131316] border border-dashed border-[#27272a] rounded-[8px] gap-4 w-full">
      {icon ? (
        <span className="text-[#919095]">{icon}</span>
      ) : (
        <span className="text-[#919095]">
          {/* Default Folder Open SVG */}
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-18.75 0a2.25 2.25 0 00-2.25 2.25v3.562c0 .614.49 1.117 1.1 1.074l1.277-.09a2.25 2.25 0 001.996-2.25V13.5m0 0V9.75m0 0l3.87-1.162a2.25 2.25 0 011.096.04l3.19 1.162m0 0h4.5m-4.5 0L12.09 6.2a2.25 2.25 0 00-1.096-.04l-3.87 1.162M21.75 12.75a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25m19.5 0v3.562c0 .614-.49 1.117-1.1 1.074l-1.277-.09a2.25 2.25 0 00-1.996-2.25V13.5M3.75 13.5v.008c0 .167.11.318.27.368L12 16.5m0 0l8.25-2.632c.16-.05.27-.201.27-.368v-.008" />
          </svg>
        </span>
      )}
      <div className="space-y-1.5 max-w-[280px]">
        <Typography variant="headline" as="h4">{title}</Typography>
        <Typography variant="body-sm">{description}</Typography>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

// ==========================================
// 11. ERROR STATES
// ==========================================

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
}

export const ErrorState = ({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  icon
}: ErrorStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-[#131316] border border-dashed border-[#93000a]/30 rounded-[8px] gap-4 w-full">
      {icon ? (
        <span className="text-[#ffb4ab]">{icon}</span>
      ) : (
        <span className="text-[#ffb4ab]">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </span>
      )}
      <div className="space-y-1.5 max-w-[320px]">
        <Typography variant="headline" as="h4">{title}</Typography>
        <Typography variant="body-sm">{description}</Typography>
      </div>
      {onRetry && (
        <div className="mt-2">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 12. INPUTS
// ==========================================

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  hasError = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  id,
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) => {
  const baseInputStyles = 'w-full bg-surface-base border rounded-md text-[13px] font-body text-text-primary placeholder:text-text-muted transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base';
  
  const borderAndRingStyles = hasError
    ? 'border-status-error/80 focus-visible:ring-status-error/80 focus-visible:border-status-error'
    : 'border-border-subtle hover:border-border-default focus-visible:ring-accent focus-visible:border-accent';

  const paddingStyles = leftIcon && rightIcon
    ? 'pl-9 pr-9 py-2'
    : leftIcon
    ? 'pl-9 pr-3 py-2'
    : rightIcon
    ? 'pl-3 pr-9 py-2'
    : 'px-3 py-2';

  return (
    <div className="relative flex items-center w-full">
      {leftIcon && (
        <span className="absolute left-3 text-text-muted pointer-events-none flex items-center justify-center" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        disabled={disabled}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={ariaDescribedBy}
        className={`${baseInputStyles} ${borderAndRingStyles} ${paddingStyles} ${className}`}
        {...props}
      />
      {rightIcon && (
        <span className="absolute right-3 text-text-muted pointer-events-none flex items-center justify-center" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </div>
  );
});
Input.displayName = 'Input';

// ==========================================
// 13. FORM FIELD
// ==========================================

export interface FormFieldProps {
  id?: string;
  label?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField = ({
  id,
  label,
  required = false,
  helperText,
  error,
  children,
  className = '',
}: FormFieldProps) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[12px] font-medium text-text-secondary select-none"
        >
          {label}
          {required && <span className="text-status-error ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      {/* Render children and pass id + aria-describedby if it is a single valid React element */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            id: inputId,
            'aria-describedby': describedBy,
            hasError: Boolean(error),
          })
        : children}

      {error ? (
        <span id={errorId} role="alert" className="text-[11px] text-status-error font-medium">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className="text-[11px] text-text-muted">
          {helperText}
        </span>
      ) : null}
    </div>
  );
};

// ==========================================
// 14. MODAL
// ==========================================

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  className = '',
}: ModalProps) => {
  const titleId = React.useId();
  const descId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<HTMLElement | null>(null);

  // Focus trap, initial focus, and focus restoration for WCAG 2.2 AA compliance
  React.useEffect(() => {
    if (!isOpen) return;

    // Store active element to restore focus on modal unmount
    previousActiveElement.current = document.activeElement as HTMLElement | null;

    // Move focus into modal dialog
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const firstFocusable = dialogRef.current.querySelector<HTMLElement>(focusableSelector);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape dismissal
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      // Tab key focus trap containment
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'sm': return 'max-w-[380px]';
      case 'md': return 'max-w-[460px]';
      case 'lg': return 'max-w-[560px]';
      case 'xl': return 'max-w-[680px]';
      default: return 'max-w-[460px]';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          className="fixed inset-0 z-modal flex items-center justify-center p-4"
        >
          {/* Backdrop with click-to-close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Dialog Container */}
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className={`relative z-10 w-full ${getMaxWidthClass()} bg-surface-elevated border border-border-subtle rounded-lg shadow-modal p-6 text-text-primary focus:outline-none ${className}`}
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  {title && (
                    <h3 id={titleId} className="text-[17px] font-heading font-semibold tracking-tight text-text-primary m-0">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p id={descId} className="text-[12px] text-text-secondary mt-1 mb-0">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Content */}
            <div className="text-[13px] font-body text-text-secondary">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ==========================================
// 15. TOGGLE
// ==========================================

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  id?: string;
  className?: string;
}

export const Toggle = ({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  id,
  className = '',
}: ToggleProps) => {
  const generatedId = React.useId();
  const toggleId = id || generatedId;

  return (
    <div className={`inline-flex items-center justify-between gap-4 ${className}`}>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <label
              htmlFor={toggleId}
              className={`text-[13px] font-medium select-none ${
                disabled ? 'text-text-muted cursor-not-allowed' : 'text-text-primary cursor-pointer'
              }`}
            >
              {label}
            </label>
          )}
          {description && (
            <span className="text-[11px] text-text-muted select-none">
              {description}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        id={toggleId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-pill border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-accent' : 'bg-surface-subtle border-border-subtle'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0 bg-text-secondary'
          }`}
        />
      </button>
    </div>
  );
};
