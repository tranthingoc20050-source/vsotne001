import React, { useState, useEffect } from 'react';
import { Key, Lock, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (key: string, autoDownload: boolean) => void;
  onClose: () => void;
  existingKey: string;
  autoDownload: boolean;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, onClose, existingKey, autoDownload }) => {
  const [key, setKey] = useState(existingKey);
  const [isAutoDownload, setIsAutoDownload] = useState(autoDownload);

  useEffect(() => {
    setKey(existingKey);
    setIsAutoDownload(autoDownload);
  }, [existingKey, autoDownload, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-[#0f172a] border border-slate-800/50 p-8 rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
            
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <Key className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-white font-serif italic">API 配置中心</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-slate-400 text-xs leading-relaxed">
                  请输入您的 <span className="text-indigo-300 font-bold">Nano Banana API</span> 密钥。
                  该密钥仅保存在您的本地浏览器缓存中，不会上传到任何第三方服务器。
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">Secret API Key</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none block pl-12 p-4 transition-all placeholder:text-slate-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">自动下载生成图</p>
                  <p className="text-[10px] text-slate-500">生成成功后自动保存到本地</p>
                </div>
                <button 
                  onClick={() => setIsAutoDownload(!isAutoDownload)}
                  className={`w-12 h-6 rounded-full transition-all relative ${isAutoDownload ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isAutoDownload ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-800/50 border border-slate-800 rounded-xl hover:bg-slate-800 hover:text-white transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => onSave(key, isAutoDownload)}
                  className="flex-1 py-3.5 text-xs font-bold uppercase tracking-widest text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-900/20 transition-all"
                >
                  保存配置
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
