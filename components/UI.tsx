import React from 'react';
import { cn } from '@/src/lib/utils';

export function Card({ children, className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div 
      className={cn("glass rounded-2xl p-6 overflow-hidden", className)} 
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'accent' | 'success' | 'warning' | 'error', className?: string }) {
  const variants = {
    default: 'bg-white/10 text-white',
    accent: 'bg-accent/20 text-accent border border-accent/30',
    success: 'bg-green-500/20 text-green-400 border border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/30',
  };

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", variants[variant], className)}>
      {children}
    </span>
  );
}
