import { useEffect } from 'react';

interface ImageModalProps {
  src: string | null;
  onClose: () => void;
}

export function ImageModal({ src, onClose }: ImageModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  if (!src) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        <img 
          src={src} 
          alt="Preview" 
          className="max-w-full max-h-[90vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <button 
          className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
