import React from 'react';

interface ExpandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ElementType;
  glowColor?: string;
}

const ExpandButton = ({ 
  onClick, 
  icon: Icon, 
  className,
  glowColor = "bg-cyan-800",
  ...props 
}: ExpandButtonProps) => {
  return (
    <>
      <button
        onClick={onClick}
        className={`group relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-[calc(var(--radius)-0.25rem)] shadow-sm transition-transform hover:scale-105 active:scale-95 ${className}`}
        {...props}
      >
        <div className={`absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 ${glowColor} blur-[8px] animate-blob-spin`} />

        <div className="absolute inset-[1px] rounded-[calc(var(--radius)-0.25rem-1px)] bg-background/90 backdrop-blur-sm transition-colors hover:bg-background/80" />

        {Icon && (
           <Icon className="relative z-10 h-3.5 w-3.5 text-foreground transition-colors group-hover:text-primary" />
        )}
      </button>

      <style jsx>{`
        @keyframes blob-spin {
          0% { transform: translate(-50%, -50%) rotate(0deg) translate(10px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translate(10px) rotate(-360deg); }
        }
        .animate-blob-spin {
          animation: blob-spin 4s linear infinite;
        }
      `}</style>
    </>
  );
};

export default ExpandButton;