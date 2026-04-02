import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ imageUrl, onClose }) => {
  return (
    <AnimatePresence>
      {imageUrl && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-10"
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/95 backdrop-blur-2xl" 
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-w-full max-h-full flex flex-col items-center gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative group">
              <img 
                src={imageUrl} 
                alt="Full size" 
                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5"
              />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
            </div>

            <div className="flex items-center gap-3">
              <a 
                href={imageUrl} 
                target="_blank" 
                rel="noreferrer"
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-xl border border-white/10 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
              >
                <ExternalLink size={16} />
                <span>查看原图</span>
              </a>
              <button 
                onClick={onClose}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-xl shadow-indigo-900/20 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
              >
                <X size={16} />
                <span>关闭预览</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
