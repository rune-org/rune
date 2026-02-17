import Image from "next/image";

type SmithButtonProps = {
  onClick: () => void;
  isSending: boolean;
  justFinished: boolean;
};

export function SmithButton({ onClick, isSending, justFinished }: SmithButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-13 w-13 items-center justify-center overflow-hidden rounded-full p-px shadow-lg transition-all hover:shadow-primary/25 hover:scale-105 active:scale-95 ${justFinished ? 'animate-pulse' : ''}`}
      title="Ask Smith"
    >
      <div className={`absolute inset-0 bg-linear-to-tr from-indigo-500 via-purple-500 to-pink-500 blur-[2px] transition-opacity duration-500 ${justFinished ? 'opacity-100 animate-pulse' : 'opacity-0 group-hover:opacity-100'}`} />
      {isSending && (
        <div className="absolute inset-0 bg-linear-to-tr from-indigo-500 via-purple-500 to-pink-500 opacity-60 blur-[2px] animate-spin-slow" style={{ animationDuration: '3s' }} />
      )}
      <div className={`relative flex h-full w-full items-center justify-center rounded-full border border-border/60 backdrop-blur-md transition-colors ${justFinished ? 'bg-primary/20 border-primary/40' : 'bg-background/20 group-hover:bg-background/80'}`}>
        <Image
          src="/icons/smith_logo_compact_white.svg"
          alt="Smith"
          width={30}
          height={30}
          priority
        />
      </div>
    </button>
  );
}
