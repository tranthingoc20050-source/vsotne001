import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, User, ImagePlus, Save, AlertCircle, Download, Upload, Sparkles, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Character } from '../types';
import { fileToBase64 } from '../services/api';

interface CharacterLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (character: Character) => void;
}

export const CharacterLibraryModal: React.FC<CharacterLibraryModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [characters, setCharacters] = useState<Character[]>(() => {
    try {
      const saved = localStorage.getItem('grsai_character_library');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load character library", e);
      return [];
    }
  });
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newImage, setNewImage] = useState<string>('');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('grsai_character_library', JSON.stringify(characters));
      setStorageError(null);
    } catch (e: any) {
      console.error("Failed to save character library", e);
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
        setStorageError("本地存储空间已满，新添加的角色可能无法保存。建议删除旧角色或使用较小的图片。");
      } else {
        setStorageError("保存角色库时出错。");
      }
    }
  }, [characters]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await fileToBase64(e.target.files[0]);
        setNewImage(base64);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddCharacter = () => {
    if (!newName || !newCode || !newImage) {
      alert("请填写完整信息：名称、代码和图片");
      return;
    }
    const newChar: Character = {
      id: crypto.randomUUID(),
      name: newName,
      code: newCode,
      image: newImage
    };
    setCharacters(prev => [...prev, newChar]);
    setIsAdding(false);
    setNewName('');
    setNewCode('');
    setNewImage('');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个角色吗？')) {
      setCharacters(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleExport = () => {
    if (characters.length === 0) return;
    const dataStr = JSON.stringify(characters, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `character_master_library_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          const validChars: Character[] = json
            .filter((c: any) => c.name && c.code && c.image)
            .map((c: any) => ({
              id: crypto.randomUUID(),
              name: c.name,
              code: c.code,
              image: c.image
            }));
          if (validChars.length > 0) {
            setCharacters(prev => [...prev, ...validChars]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredCharacters = characters.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-[#0f172a] border border-slate-800/50 rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden relative"
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-[#0f172a]/80 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                  <User className="text-indigo-400 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white font-serif italic">角色参考库</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mt-1">Character Reference Library</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input 
                    type="text" 
                    placeholder="搜索角色..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-full pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input type="file" accept=".json" ref={importInputRef} className="hidden" onChange={handleImportFile} />
                  <button onClick={() => importInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-700" title="导入 JSON"><Upload size={18} /></button>
                  <button onClick={handleExport} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-700" title="导出 JSON"><Download size={18} /></button>
                  <div className="w-px h-6 bg-slate-800 mx-1" />
                  <button onClick={onClose} className="p-2.5 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-400 transition-all"><X size={20} /></button>
                </div>
              </div>
            </div>

            {storageError && (
              <div className="bg-red-500/10 border-b border-red-500/20 p-4 flex items-center gap-3 text-red-400 text-xs font-medium">
                <AlertCircle size={16} />
                <span>{storageError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {/* Add Card */}
                <motion.button 
                  layout
                  onClick={() => setIsAdding(true)}
                  className="aspect-[3/4] border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-600 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus size={24} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest">新增角色</span>
                </motion.button>

                <AnimatePresence mode="popLayout">
                  {filteredCharacters.map((char) => (
                    <motion.div 
                      key={char.id} 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => onSelect(char)}
                      className="group relative bg-slate-900/40 rounded-2xl border border-slate-800/50 overflow-hidden cursor-pointer hover:border-indigo-500/30 transition-all flex flex-col aspect-[3/4] shadow-lg"
                    >
                       <div className="flex-1 relative overflow-hidden">
                          <img src={char.image} alt={char.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]">
                            <Sparkles className="text-white w-8 h-8" />
                          </div>
                       </div>
                       <div className="p-4 bg-slate-900/80 backdrop-blur-md">
                          <div className="font-bold text-white text-xs truncate">{char.name}</div>
                          <div className="text-[9px] text-slate-500 font-mono truncate mt-2 bg-black/40 px-2 py-1 rounded border border-white/5">
                            {char.code}
                          </div>
                       </div>
                       <button 
                         onClick={(e) => handleDelete(char.id, e)}
                         className="absolute top-3 right-3 p-2 bg-red-500/10 text-red-400 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/30 backdrop-blur-md border border-red-500/20"
                       >
                         <Trash2 size={14} />
                       </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-800/50 bg-[#0f172a]/80 backdrop-blur-md text-[10px] text-slate-500 flex justify-between items-center font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>点击卡片即可将角色添加到参考图</span>
                </div>
                <span>Total: {characters.length} Characters</span>
            </div>

            {/* Add Form Overlay */}
            <AnimatePresence>
              {isAdding && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-[#0f172a]/95 backdrop-blur-xl"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="w-full max-w-lg space-y-8"
                  >
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-bold text-white font-serif italic">创建新角色</h3>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Define your character identity</p>
                    </div>

                    <div className="flex flex-col items-center gap-8">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-40 h-40 border-2 border-dashed border-slate-800 rounded-3xl hover:border-indigo-500 hover:bg-indigo-500/5 cursor-pointer flex flex-col items-center justify-center transition-all relative overflow-hidden group shadow-2xl"
                      >
                         {newImage ? (
                           <img src={newImage} alt="Preview" className="w-full h-full object-cover" />
                         ) : (
                           <>
                             <ImagePlus className="text-slate-600 group-hover:text-indigo-400 w-8 h-8 mb-2 transition-colors" />
                             <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 group-hover:text-indigo-400 transition-colors">上传头像</span>
                           </>
                         )}
                         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                      </div>
                      
                      <div className="w-full space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">角色名称</label>
                          <input 
                            type="text" 
                            placeholder="例如: 赛博少女" 
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none p-4 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">角色代码 (Trigger Code)</label>
                          <input 
                            type="text" 
                            placeholder="例如: @shjieai3.kzsip" 
                            value={newCode}
                            onChange={e => setNewCode(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none p-4 font-mono transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button onClick={() => setIsAdding(false)} className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">取消</button>
                      <button onClick={handleAddCharacter} className="flex-[2] py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-indigo-900/20 hover:from-indigo-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2">
                        <Save size={16} /> 保存到库
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
