interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg px-4">
      <div className="bg-white rounded-card border border-border shadow-card p-6 text-center max-w-app w-full">
        <p className="text-error font-semibold">{message}</p>
      </div>
    </div>
  );
}
