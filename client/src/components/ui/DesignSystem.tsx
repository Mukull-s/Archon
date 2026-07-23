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
// 2. BUTTONS
// ==========================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  ...props
}: ButtonProps) => {
  const baseStyles = 'inline-flex items-center justify-center font-heading font-medium tracking-tight rounded-[6px] transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-[#3b82f6] hover:bg-[#2563eb] text-white border border-transparent';
      case 'secondary':
        return 'bg-transparent hover:bg-[#27272a] text-[#fafafa] border border-[#27272a]';
      case 'ghost':
        return 'bg-transparent hover:bg-[#1f1f22]/50 text-[#c8c5ca] border border-transparent';
      case 'danger':
        return 'bg-[#93000a]/20 hover:bg-[#93000a]/40 text-[#ffb4ab] border border-[#93000a]';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-[12px] gap-1.5';
      case 'md':
        return 'px-4 py-2 text-[13px] gap-2';
      case 'lg':
        return 'px-5 py-2.5 text-[14px] gap-2.5';
    }
  };

  return (
    <button
      className={`${baseStyles} ${getVariantStyles()} ${getSizeStyles()} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

// ==========================================
// 3. PANELS
// ==========================================

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'base' | 'lowest' | 'high';
  bordered?: boolean;
}

export const Panel = ({
  variant = 'base',
  bordered = true,
  className = '',
  children,
  ...props
}: PanelProps) => {
  const getBgClass = () => {
    switch (variant) {
      case 'lowest':
        return 'bg-[#0e0e11]';
      case 'base':
        return 'bg-[#131316]';
      case 'high':
        return 'bg-[#1f1f22]';
    }
  };

  const borderClass = bordered ? 'border border-[#27272a] rounded-[8px]' : '';

  return (
    <div className={`${getBgClass()} ${borderClass} ${className}`} {...props}>
      {children}
    </div>
  );
};

// ==========================================
// 4. CARDS
// ==========================================

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  accent?: 'blue' | 'purple' | 'red' | 'green' | 'none';
}

export const Card = ({
  hoverable = true,
  accent = 'none',
  className = '',
  children,
  ...props
}: CardProps) => {
  const getAccentClass = () => {
    switch (accent) {
      case 'blue':
        return 'border-t-2 border-t-[#3b82f6]';
      case 'purple':
        return 'border-t-2 border-t-[#a855f7]';
      case 'red':
        return 'border-t-2 border-t-[#ffb4ab]';
      case 'green':
        return 'border-t-2 border-t-[#10b981]';
      default:
        return '';
    }
  };

  const hoverClass = hoverable ? 'hover:bg-[#2a2a2d] transition-all duration-150 cursor-pointer' : '';

  return (
    <div
      className={`bg-[#1f1f22] border border-[#27272a] rounded-[8px] p-4 ${getAccentClass()} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// ==========================================
// 5. BADGES
// ==========================================

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
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
        return 'bg-[#3b82f6]/10 text-[#adc6ff] border border-[#3b82f6]/20';
      case 'success':
        return 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20';
      case 'warning':
        return 'bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20';
      case 'danger':
        return 'bg-[#93000a]/10 text-[#ffb4ab] border border-[#93000a]/20';
      case 'neutral':
        return 'bg-[#27272a]/40 text-[#c8c5ca] border border-[#27272a]/80';
    }
  };

  const getDotColor = () => {
    switch (variant) {
      case 'info': return 'bg-[#3b82f6]';
      case 'success': return 'bg-[#10b981]';
      case 'warning': return 'bg-[#eab308]';
      case 'danger': return 'bg-[#ffb4ab]';
      case 'neutral': return 'bg-[#c8c5ca]';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-medium rounded-[4px] uppercase tracking-wide ${getStyleClass()} ${className}`}
      {...props}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${getDotColor()}`} />}
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
