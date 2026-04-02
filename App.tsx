import React, { useState, useEffect, useRef } from 'react';
import { Settings, Image as ImageIcon, Trash2, Maximize2, Loader2, Plus, X, RefreshCw, Eraser, BookUser, Download, Sparkles, ChevronRight, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GenerationTask, TaskStatus, MODELS, ASPECT_RATIOS, IMAGE_SIZES, Character, PromptTemplate } from './types';
import { createGenerationTask, fetchTaskResult, fileToBase64, resizeImage } from './services/api';
import { ApiKeyModal } from './components/ApiKeyModal';
import { Lightbox } from './components/Lightbox';
import { CharacterLibraryModal } from './components/CharacterLibraryModal';

const App: React.FC = () => {
  // --- State ---
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('grsai_api_key') || '');
  const [autoDownload, setAutoDownload] = useState<boolean>(() => localStorage.getItem('grsai_auto_download') === 'true');
  const [isKeyModalOpen, setKeyModalOpen] = useState(false);
  const [isLibraryOpen, setLibraryOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  
  // Form State
  const [model, setModel] = useState(() => localStorage.getItem('grsai_form_model') || 'nano-banana-pro'); 
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('grsai_form_aspectRatio') || '16:9');
  const [imageSize, setImageSize] = useState(() => localStorage.getItem('grsai_form_imageSize') || '1K');
  const [prompt, setPrompt] = useState(() => localStorage.getItem('grsai_form_prompt') || '');
  const [prompt2, setPrompt2] = useState(() => localStorage.getItem('grsai_form_prompt2') || '');
  const [refImages, setRefImages] = useState<string[]>(() => {
    const saved = localStorage.getItem('grsai_form_refImages');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tasksRef = useRef<GenerationTask[]>([]);
  
  // Replacement State
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // Tasks State
  const [tasks, setTasks] = useState<GenerationTask[]>(() => {
    const saved = localStorage.getItem('grsai_tasks');
    const initialTasks = saved ? JSON.parse(saved) : [];
    tasksRef.current = initialTasks;
    return initialTasks;
  });

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Prompt Templates State
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(() => {
    const saved = localStorage.getItem('prompt_templates');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: '写实摄影', content: 'Photorealistic, 8k, highly detailed, cinematic lighting, masterpiece' },
      { id: '2', name: '二次元', content: 'Anime style, vibrant colors, clean lines, high quality' }
    ];
  });
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');

  // --- Helpers ---
  useEffect(() => {
    localStorage.setItem('prompt_templates', JSON.stringify(promptTemplates));
  }, [promptTemplates]);

  useEffect(() => {
    // Save tasks to localStorage, limit to recent 30 to avoid quota issues
    // Base64 images in refImages can take up significant space
    // We strip refImages for tasks older than 5 to save space
    const saveTasks = async () => {
      try {
        const tasksToSave = tasks.slice(0, 30).map((t, i) => {
          if (i > 5) {
            return { ...t, refImages: [] }; // Strip refImages for older tasks
          }
          return t;
        });
        localStorage.setItem('grsai_tasks', JSON.stringify(tasksToSave));
      } catch (e) {
        console.warn("LocalStorage quota exceeded, could not save all tasks");
      }
    };
    
    const timeoutId = setTimeout(saveTasks, 1000); // Debounce save
    return () => clearTimeout(timeoutId);
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('grsai_form_prompt', prompt);
    localStorage.setItem('grsai_form_prompt2', prompt2);
    localStorage.setItem('grsai_form_model', model);
    localStorage.setItem('grsai_form_aspectRatio', aspectRatio);
    localStorage.setItem('grsai_form_imageSize', imageSize);
    try {
      localStorage.setItem('grsai_form_refImages', JSON.stringify(refImages));
    } catch (e) {
      console.warn("LocalStorage quota exceeded, could not save reference images");
    }
  }, [prompt, prompt2, model, aspectRatio, imageSize, refImages]);

  const handleAddTemplate = () => {
    if (!newTemplateName || !newTemplateContent) return;
    const template: PromptTemplate = {
      id: crypto.randomUUID(),
      name: newTemplateName,
      content: newTemplateContent
    };
    setPromptTemplates(prev => [...prev, template]);
    setNewTemplateName('');
    setNewTemplateContent('');
    setIsAddingTemplate(false);
  };

  const deleteTemplate = (id: string) => {
    setPromptTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleSaveKey = (key: string, autoDownloadVal: boolean) => {
    setApiKey(key);
    setAutoDownload(autoDownloadVal);
    localStorage.setItem('grsai_api_key', key);
    localStorage.setItem('grsai_auto_download', String(autoDownloadVal));
    setKeyModalOpen(false);
  };

  const getNextDownloadFilename = () => {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                    (now.getMonth() + 1).toString().padStart(2, '0') + 
                    now.getDate().toString().padStart(2, '0');
    
    const lastDate = localStorage.getItem('grsai_last_download_date');
    let counter = parseInt(localStorage.getItem('grsai_download_counter') || '0');

    if (lastDate !== dateStr) {
      counter = 1;
    } else {
      counter += 1;
    }

    localStorage.setItem('grsai_last_download_date', dateStr);
    localStorage.setItem('grsai_download_counter', counter.toString());

    return `${dateStr}${counter.toString().padStart(3, '0')}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages: string[] = [];
      const files = Array.from(e.target.files);
      const remainingSlots = 10 - refImages.length;
      const filesToProcess = files.slice(0, remainingSlots);

      for (const file of filesToProcess) {
        try {
          const base64 = await fileToBase64(file as File);
          const resized = await resizeImage(base64);
          newImages.push(resized);
        } catch (err) {
          console.error("Error reading file", err);
        }
      }
      setRefImages(prev => [...prev, ...newImages]);
    }
    e.target.value = '';
  };

  const handleSelectCharacter = (character: Character) => {
    if (refImages.length >= 10) {
      alert("参考图数量已达上限 (10张)，请先删除一些图片。");
      return;
    }
    setRefImages(prev => [...prev, character.image]);
    const refIndex = refImages.length + 1;
    const triggerText = `参考图${refIndex}是${character.code}，`;
    setPrompt(prev => triggerText + prev);
    setLibraryOpen(false);
  };

  const handleReplaceClick = (index: number) => {
    setReplacingIndex(index);
    replaceFileRef.current?.click();
  };

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && replacingIndex !== null) {
      try {
        const base64 = await fileToBase64(e.target.files[0]);
        const resized = await resizeImage(base64);
        setRefImages(prev => {
          const newArr = [...prev];
          newArr[replacingIndex] = resized;
          return newArr;
        });
      } catch (err) {
        console.error("Error replacing file", err);
      }
    }
    if (replaceFileRef.current) replaceFileRef.current.value = '';
    setReplacingIndex(null);
  };

  const removeRefImage = (index: number) => {
    setRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleDownloadImage = async (url: string, customFilename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      
      if (customFilename) {
        a.download = `${customFilename}.png`;
      } else {
        const safePrompt = prompt.slice(0, 20).replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
        a.download = `nano_${safePrompt}_${Date.now()}.png`;
      }

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed", error);
      window.open(url, '_blank');
    }
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('提示词已复制到剪贴板');
  };

  const handleRegenerate = async (task: GenerationTask) => {
    if (!apiKey) {
      setKeyModalOpen(true);
      return;
    }
    setIsSubmitting(true);
    console.log("Regenerating task...", { taskId: task.id, model: task.model });
    const tempId = crypto.randomUUID();

    const newTask: GenerationTask = {
      id: tempId,
      status: TaskStatus.PENDING,
      prompt: task.prompt,
      model: task.model,
      aspectRatio: task.aspectRatio,
      imageSize: task.imageSize,
      refImages: task.refImages,
      createdAt: Date.now(),
      progress: 0,
    };

    setTasks(prev => [newTask, ...prev]);

    try {
      const apiId = await createGenerationTask(apiKey, {
        model: task.model,
        prompt: task.prompt,
        aspectRatio: task.aspectRatio,
        imageSize: task.imageSize,
        refImages: task.refImages,
      });
      console.log("Regeneration task created, API ID:", apiId);
      setTasks(prev => prev.map(t => 
        t.id === tempId ? { ...t, apiTaskId: apiId, status: TaskStatus.RUNNING } : t
      ));
    } catch (error: any) {
      console.error("Failed to regenerate task:", error);
      setTasks(prev => prev.map(t => 
        t.id === tempId ? { ...t, status: TaskStatus.FAILED, error: error.message } : t
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: '清空历史',
      message: '确定要清空所有生成历史吗？此操作不可撤销。',
      onConfirm: () => {
        setTasks([]);
        localStorage.removeItem('grsai_tasks');
        setConfirmModal(null);
      }
    });
  };

  const handleResetAll = () => {
    setConfirmModal({
      isOpen: true,
      title: '重置全部',
      message: '确定要重置所有内容吗？（包括提示词、参考图和生成历史）',
      onConfirm: () => {
        setPrompt('');
        setPrompt2('');
        setRefImages([]);
        setTasks([]);
        localStorage.removeItem('grsai_tasks');
        localStorage.removeItem('grsai_form_prompt');
        localStorage.removeItem('grsai_form_prompt2');
        localStorage.removeItem('grsai_form_refImages');
        setConfirmModal(null);
      }
    });
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setKeyModalOpen(true);
      return;
    }
    const combinedPrompt = `${prompt}\n${prompt2}`.trim();
    if (!combinedPrompt) {
      alert("请输入提示词描述 (Prompt)");
      return;
    }

    setIsSubmitting(true);
    console.log("Starting generation task...", { model, aspectRatio, imageSize, refCount: refImages.length });
    const tempId = crypto.randomUUID();

    const newTask: GenerationTask = {
      id: tempId,
      status: TaskStatus.PENDING,
      prompt: combinedPrompt,
      model: model,
      aspectRatio,
      imageSize,
      refImages: [...refImages],
      createdAt: Date.now(),
      progress: 0,
    };

    setTasks(prev => [newTask, ...prev]);

    try {
      const apiId = await createGenerationTask(apiKey, {
        model,
        prompt: combinedPrompt,
        aspectRatio,
        imageSize,
        refImages,
      });
      console.log("Task created successfully, API ID:", apiId);
      setTasks(prev => prev.map(t => 
        t.id === tempId ? { ...t, apiTaskId: apiId, status: TaskStatus.RUNNING } : t
      ));
    } catch (error: any) {
      console.error("Failed to create task:", error);
      setTasks(prev => prev.map(t => 
        t.id === tempId ? { ...t, status: TaskStatus.FAILED, error: error.message } : t
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const intervalId = setInterval(async () => {
      const now = Date.now();
      const runningTasks = tasksRef.current.filter(t => t.status === TaskStatus.RUNNING && t.apiTaskId);
      
      if (runningTasks.length === 0) return;

      for (const task of runningTasks) {
        try {
          // Stuck task detection: if running for more than 15 minutes
          if (now - task.createdAt > 15 * 60 * 1000) {
            setTasks(prev => prev.map(t => 
              t.id === task.id ? { ...t, status: TaskStatus.FAILED, error: '任务超时 (超过15分钟未响应)' } : t
            ));
            continue;
          }

          if (!apiKey || !task.apiTaskId) continue;
          const result = await fetchTaskResult(apiKey, task.apiTaskId);
          
          if (result.status === 'succeeded') {
            const resultUrl = result.results[0]?.url;
            if (resultUrl && autoDownload) {
              handleDownloadImage(resultUrl, getNextDownloadFilename());
            }
            setTasks(prev => prev.map(t => 
              t.id === task.id ? {
                ...t,
                status: TaskStatus.SUCCEEDED,
                progress: 100,
                resultUrl: resultUrl
              } : t
            ));
          } else if (result.status === 'failed') {
             setTasks(prev => prev.map(t => 
              t.id === task.id ? {
                ...t,
                status: TaskStatus.FAILED,
                error: result.failure_reason || result.error || '生成失败'
              } : t
            ));
          } else {
             setTasks(prev => prev.map(t => 
              t.id === task.id ? {
                ...t,
                progress: result.progress || t.progress
              } : t
            ));
          }
        } catch (error: any) {
          console.error(`Error polling task ${task.id}`, error);
          // If the error message indicates the task is not found or unauthorized, mark as failed
          const errorMsg = error.message || '';
          if (errorMsg.includes('not found') || errorMsg.includes('401') || errorMsg.includes('403')) {
            setTasks(prev => prev.map(t => 
              t.id === task.id ? { ...t, status: TaskStatus.FAILED, error: `查询失败: ${errorMsg}` } : t
            ));
          }
        }
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [apiKey, autoDownload]); // Added autoDownload to dependencies to ensure it's fresh

  return (
    <div className="flex h-screen bg-[#020617] font-sans selection:bg-indigo-500/30 text-slate-200">
      
      {/* Left Sidebar - Controls */}
      <div className="w-[420px] flex-shrink-0 bg-[#0f172a]/50 backdrop-blur-xl border-r border-slate-800/50 flex flex-col h-full overflow-hidden shadow-2xl z-30">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-800/50 flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif italic">
              角色生图大师
            </h1>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mt-2">Professional Character AI Studio</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          
          {/* Section: Model Config */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-indigo-500 rounded-full" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">核心配置</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1">生成模型</label>
                <div className="relative group">
                  <select 
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-800 text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none block p-4 appearance-none transition-all hover:bg-slate-800/50 cursor-pointer"
                  >
                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none group-hover:text-slate-400 transition-colors rotate-90" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1">画质设定</label>
                    <select 
                      value={imageSize}
                      onChange={(e) => setImageSize(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-800 text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none block p-4 appearance-none transition-all hover:bg-slate-800/50 cursor-pointer"
                    >
                      {IMAGE_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1">构图比例</label>
                    <select 
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-800 text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none block p-4 appearance-none transition-all hover:bg-slate-800/50 cursor-pointer"
                    >
                      {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                 </div>
              </div>
            </div>
          </section>

          {/* Section: Reference */}
          <section className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-purple-500 rounded-full" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">视觉参考</h2>
              </div>
              <span className="text-[10px] font-mono text-slate-600 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{refImages.length}/10</span>
            </div>
            
            <input type="file" ref={replaceFileRef} className="hidden" accept="image/*" onChange={handleReplaceFileChange} />

            <div className="grid grid-cols-4 gap-3">
              <AnimatePresence mode="popLayout">
                {refImages.map((img, idx) => (
                  <motion.div 
                    key={idx}
                    layout
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner"
                  >
                    <img src={img} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-indigo-900/80 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
                      <button onClick={() => handleReplaceClick(idx)} className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"><RefreshCw size={14} /></button>
                      <button onClick={() => removeRefImage(idx)} className="p-2 text-white hover:bg-red-500/40 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                    <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] text-white/80 font-mono border border-white/10">#{idx + 1}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {refImages.length < 10 && (
                <>
                  <label className="aspect-square border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group">
                    <Plus className="text-slate-600 group-hover:text-indigo-400 w-5 h-5 mb-1 transition-colors" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-600 group-hover:text-indigo-400 transition-colors">上传</span>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                  </label>
                  
                  <button 
                    onClick={() => setLibraryOpen(true)}
                    className="aspect-square border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition-all group"
                  >
                    <BookUser className="text-slate-600 group-hover:text-purple-400 w-5 h-5 mb-1 transition-colors" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-600 group-hover:text-purple-400 transition-colors">角色库</span>
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Section: Prompts */}
          <section className="space-y-6 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-emerald-500 rounded-full" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">创意描述</h2>
            </div>

            <div className="space-y-6 flex-1 flex flex-col">
              <div className="space-y-3 flex flex-col">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">主体描述 (Prompt 1)</label>
                  <button onClick={() => setPrompt('')} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors flex items-center gap-1"><Eraser size={10} />清空</button>
                </div>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="描述角色的外貌、动作、神态..."
                  className="w-full min-h-[120px] bg-slate-900/50 border border-slate-800 text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none block p-4 resize-none transition-all placeholder:text-slate-700"
                />
              </div>

              <div className="space-y-3 flex flex-col">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">环境与风格 (Prompt 2)</label>
                  <button onClick={() => setPrompt2('')} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors flex items-center gap-1"><Eraser size={10} />清空</button>
                </div>
                <textarea 
                  value={prompt2}
                  onChange={(e) => setPrompt2(e.target.value)}
                  placeholder="描述背景、光影、艺术风格..."
                  className="w-full min-h-[120px] bg-slate-900/50 border border-slate-800 text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none block p-4 resize-none transition-all placeholder:text-slate-700"
                />

                {/* Prompt Templates UI */}
                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">快捷设定 (Templates)</label>
                    <button 
                      onClick={() => setIsAddingTemplate(!isAddingTemplate)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <Plus size={10} /> {isAddingTemplate ? '取消' : '新增模版'}
                    </button>
                  </div>

                  {isAddingTemplate && (
                    <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <input 
                        type="text" 
                        placeholder="模版名称"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-lg p-2 outline-none focus:border-indigo-500"
                      />
                      <textarea 
                        placeholder="模版内容..."
                        value={newTemplateContent}
                        onChange={(e) => setNewTemplateContent(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-lg p-2 outline-none focus:border-indigo-500 min-h-[60px]"
                      />
                      <button 
                        onClick={handleAddTemplate}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-colors"
                      >
                        保存模版
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {promptTemplates.map(t => (
                      <div key={t.id} className="group relative">
                        <button 
                          onClick={() => setPrompt2(t.content)}
                          className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-slate-400 hover:text-white text-[10px] rounded-full transition-all flex items-center gap-2"
                        >
                          {t.name}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Generate Button Footer */}
        <div className="p-8 border-t border-slate-800/50 bg-[#0f172a]/80 backdrop-blur-xl">
          <button 
            onClick={handleGenerate}
            disabled={isSubmitting}
            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-xl shadow-indigo-900/20 transform transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" /> 
                <span className="tracking-widest uppercase text-sm">正在构建角色...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span className="tracking-widest uppercase text-sm">立即开启创作</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Content - Gallery */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#020617]">
        
        {/* Top Bar */}
        <div className="h-20 border-b border-slate-800/50 flex items-center justify-between px-10 bg-[#020617]/40 backdrop-blur-md z-20 absolute top-0 left-0 right-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">System Online</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {tasks.length > 0 && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleClearHistory}
                  className="text-[11px] px-4 py-2 rounded-full border border-red-900/30 hover:border-red-500/50 bg-red-950/20 text-red-400 hover:text-red-300 font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  清空历史
                </button>
                <button 
                  onClick={handleResetAll}
                  className="text-[11px] px-4 py-2 rounded-full border border-slate-800 hover:border-slate-600 bg-slate-900/50 text-slate-400 hover:text-white font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <RefreshCw size={12} />
                  重置全部
                </button>
              </div>
            )}
            <button onClick={() => window.open('https://grsai.dakka.com.cn/docs', '_blank')} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">使用指南</button>
            <button 
              onClick={() => setKeyModalOpen(true)}
              className="text-[11px] px-4 py-2 rounded-full border border-slate-800 hover:border-indigo-500/50 bg-slate-900/50 text-slate-400 hover:text-white font-bold uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <Settings size={12} />
              {apiKey ? 'API Active' : 'Configure API'}
            </button>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-10 pt-28 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {tasks.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col items-center justify-center text-slate-700 space-y-6"
              >
                <div className="w-32 h-32 rounded-full bg-slate-900/50 border border-slate-800 flex items-center justify-center shadow-inner">
                  <ImageIcon size={48} className="opacity-10" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-xl font-serif italic text-slate-500">等待您的灵感降临</p>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-600">Generated Masterpieces will be displayed here</p>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
                {tasks.map((task) => (
                  <motion.div 
                    key={task.id} 
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative bg-slate-900/40 rounded-2xl border border-slate-800/50 overflow-hidden shadow-2xl transition-all hover:border-indigo-500/30 flex flex-col aspect-[4/5]"
                  >
                    {/* Status Overlay / Image */}
                    <div className="flex-1 relative w-full h-full bg-slate-950 overflow-hidden">
                      {task.status === TaskStatus.SUCCEEDED && task.resultUrl ? (
                        <>
                          <img src={task.resultUrl} alt={task.prompt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center p-6 gap-3 backdrop-blur-[2px]">
                            <button onClick={() => setSelectedImage(task.resultUrl!)} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white backdrop-blur-xl border border-white/10 transition-all transform hover:-translate-y-1"><Maximize2 size={20} /></button>
                            <button onClick={() => handleDownloadImage(task.resultUrl!)} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white backdrop-blur-xl border border-white/10 transition-all transform hover:-translate-y-1"><Download size={20} /></button>
                            <button onClick={() => handleDeleteTask(task.id)} className="p-3 bg-red-500/10 hover:bg-red-500/30 rounded-xl text-red-400 backdrop-blur-xl border border-red-500/20 transition-all transform hover:-translate-y-1"><Trash2 size={20} /></button>
                          </div>
                        </>
                      ) : task.status === TaskStatus.FAILED ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-8 text-center bg-red-500/5">
                          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4"><X size={24} /></div>
                          <span className="text-xs font-bold uppercase tracking-widest mb-2">生成失败</span>
                          <span className="text-[10px] text-red-400/60 leading-relaxed line-clamp-4 mb-6">{task.error}</span>
                          
                          <div className="flex flex-col w-full gap-2">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleCopyPrompt(task.prompt)}
                                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                              >
                                <Copy size={12} />
                                复制
                              </button>
                              <button 
                                onClick={() => handleRegenerate(task)}
                                className="flex-1 py-2 px-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                              >
                                <RefreshCw size={12} />
                                重试
                              </button>
                            </div>
                            <button 
                              onClick={() => handleDeleteTask(task.id)} 
                              className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors border border-slate-800 rounded-lg"
                            >
                              移除记录
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-500/5">
                          <div className="relative">
                            <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
                            <div className="absolute inset-0 blur-xl bg-indigo-500/20 animate-pulse" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-400 animate-pulse">正在构思中...</span>
                          <div className="w-32 h-1 bg-slate-800 mt-6 rounded-full overflow-hidden border border-white/5">
                             <motion.div 
                               className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                               initial={{ width: 0 }}
                               animate={{ width: `${task.progress}%` }}
                               transition={{ duration: 0.5 }}
                             />
                          </div>
                          <span className="text-[9px] font-mono text-slate-600 mt-2">{task.progress}%</span>
                        </div>
                      )}
                    </div>

                    {/* Info Footer */}
                    <div className="p-5 bg-slate-900/80 border-t border-slate-800/50 backdrop-blur-md">
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-medium mb-3" title={task.prompt}>{task.prompt}</p>
                      
                      {task.status === TaskStatus.SUCCEEDED && (
                        <div className="flex gap-2 mb-4">
                          <button 
                            onClick={() => handleCopyPrompt(task.prompt)}
                            className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                          >
                            <Copy size={12} />
                            复制提示词
                          </button>
                          <button 
                            onClick={() => handleRegenerate(task)}
                            className="flex-1 py-2 px-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                          >
                            <RefreshCw size={12} />
                            重新生成
                          </button>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-4 border-t border-white/5">
                         <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                           <span className="text-[9px] uppercase text-slate-500 font-bold tracking-widest">{task.model.replace('nano-banana-', '')}</span>
                         </div>
                         <span className="text-[9px] font-mono text-slate-600">{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <ApiKeyModal isOpen={isKeyModalOpen} onClose={() => setKeyModalOpen(false)} onSave={handleSaveKey} existingKey={apiKey} autoDownload={autoDownload} />
      <CharacterLibraryModal isOpen={isLibraryOpen} onClose={() => setLibraryOpen(false)} onSelect={handleSelectCharacter} />
      <Lightbox imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal?.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                    <Trash2 size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white">{confirmModal.title}</h3>
                </div>
                <p className="text-slate-400 leading-relaxed mb-8">
                  {confirmModal.message}
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                  >
                    取消
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all"
                  >
                    确认
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default App;
