
import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { useStore } from '../store';
import { uploadToImgBB, prepareVeoPayload } from '../services/apiService';
import { ImageEditorModal } from './ImageEditorModal';
import { PROMPT_TEMPLATES } from '../promptTemplates';

declare global {
  interface Window {
    executeNodeById?: (id: string) => void;
  }
}

const NodeWrapper: React.FC<{ 
  title: string; 
  children: React.ReactNode; 
  color?: string; 
  id?: string; 
  status?: string;
  selected?: boolean;
  startTime?: number;
  duration?: number;
  remark?: string;
}> = ({ title, children, color = "blue", id, status, selected, startTime, duration, remark }) => {
  const { deleteNode, duplicateNode, updateNodeData } = useStore();
  const isLoading = status === 'loading';
  const [elapsed, setElapsed] = useState(0);

  // Local state for remark to prevent cursor jump bug
  const [localRemark, setLocalRemark] = useState(remark || '');
  
  // Sync local state when external remark changes (e.g. on project load)
  useEffect(() => {
    if (remark !== localRemark) {
      setLocalRemark(remark || '');
    }
  }, [remark]);

  useEffect(() => {
    let interval: any;
    if (isLoading && startTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isLoading, startTime]);

  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-950/40 border-blue-500/30 text-blue-400 shadow-blue-500/10',
    indigo: 'bg-indigo-950/40 border-indigo-500/30 text-indigo-400 shadow-indigo-500/10',
    purple: 'bg-violet-950/40 border-violet-500/30 text-violet-400 shadow-violet-500/10',
    green: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10',
    yellow: 'bg-amber-950/40 border-amber-500/30 text-amber-400 shadow-amber-500/10',
    white: 'bg-gray-800/40 border-gray-600/30 text-gray-300 shadow-white/5'
  };

  const style = colorStyles[color] || colorStyles.blue;
  let borderColor = selected ? 'border-red-500 ring-2 ring-red-500/20' : style.split(' ')[1];
  let shadowClass = selected ? 'shadow-[0_0_25px_rgba(239,68,68,0.4)]' : style.split(' ')[3];

  return (
    <div className={`backdrop-blur-md border-2 ${style.split(' ')[0]} ${borderColor} ${shadowClass} rounded-2xl overflow-hidden shadow-2xl min-w-[240px] max-w-[300px] transition-all group/node relative`}>
      {isLoading && (
        <div className="absolute inset-0 bg-blue-500/20 z-10 pointer-events-none flex flex-col items-center justify-center backdrop-blur-[2px]">
          <div className="bg-blue-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full shadow-lg uppercase tracking-widest border border-white/20 flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            <span>Running {elapsed}s</span>
          </div>
        </div>
      )}
      <div className={`px-4 py-2.5 bg-black/50 border-b border-gray-700/50 flex justify-between items-center`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-blue-400 animate-ping' : (selected ? 'bg-red-500' : 'bg-current')} shadow-lg`}></div>
          <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[140px] opacity-80">{title}</span>
        </div>
        <div className="flex gap-1.5 opacity-0 group-hover/node:opacity-100 transition-opacity">
          <button onClick={() => id && duplicateNode(id)} className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-all" title="复制节点">📋</button>
          <button onClick={() => id && deleteNode(id)} className="text-gray-400 hover:text-red-400 p-1 hover:bg-red-500/10 rounded-lg transition-all" title="删除节点">✕</button>
        </div>
      </div>
      <div className="p-4 bg-gradient-to-b from-transparent to-black/30">
        {children}
      </div>
      <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex flex-col gap-1.5">
        <input 
          type="text"
          className="nodrag nowheel nopan bg-transparent text-[10px] text-gray-500 outline-none border-none placeholder:text-gray-700 italic w-full"
          placeholder="添加备注..."
          value={localRemark}
          onChange={(e) => {
            setLocalRemark(e.target.value);
            if (id) updateNodeData(id, { remark: e.target.value });
          }}
          onKeyDown={(e) => e.stopPropagation()}
        />
        {(duration !== undefined) && (
          <div className="text-[8px] text-gray-600 font-mono uppercase tracking-tighter self-end">
            Last run: {duration}s
          </div>
        )}
      </div>
    </div>
  );
};

const ImageActions: React.FC<{ 
  url: string; 
  onZoom: (url: string) => void;
  nodeId: string;
}> = ({ url, onZoom, nodeId }) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const [showLinkOverlay, setShowLinkOverlay] = useState(false);
  
  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(nodeId, { refreshKey: Date.now() });
  };

  const toggleLinkOverlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowLinkOverlay(!showLinkOverlay);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `NodeLAB_Export_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <button onClick={handleRefresh} className="p-1.5 bg-black/80 rounded-lg hover:bg-blue-600 text-white text-[10px] backdrop-blur-sm border border-white/10" title="刷新预览">🔄</button>
        <button onClick={toggleLinkOverlay} className={`p-1.5 rounded-lg hover:bg-emerald-600 text-white text-[10px] backdrop-blur-sm border border-white/10 ${showLinkOverlay ? 'bg-emerald-600' : 'bg-black/80'}`} title="显示/隐藏原图链接">🔗</button>
        <button onClick={handleDownload} className="p-1.5 bg-black/80 rounded-lg hover:bg-indigo-600 text-white text-[10px] backdrop-blur-sm border border-white/10" title="下载原图">📥</button>
        <button onClick={(e) => { e.stopPropagation(); onZoom(url); }} className="p-1.5 bg-black/80 rounded-lg hover:bg-gray-700 text-white text-[10px] backdrop-blur-sm border border-white/10" title="全屏查看原图">🔍</button>
      </div>
      {showLinkOverlay && (
        <div className="absolute inset-x-0 bottom-0 bg-black/90 p-2 z-30 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 bg-gray-900 border border-white/10 rounded px-2 py-1">
             <input readOnly value={url} className="bg-transparent text-[9px] text-emerald-400 flex-1 outline-none font-mono truncate" />
             <button onClick={() => { navigator.clipboard.writeText(url); alert("链接已复制"); }} className="text-[9px] text-white bg-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-600 transition-colors">复制</button>
          </div>
        </div>
      )}
    </>
  );
};

const DarkSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, className, ...props }) => (
  <div className="relative group/select">
    <select 
      {...props}
      className={`w-full bg-[#080808] text-xs text-gray-200 p-2.5 rounded-xl outline-none border border-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/5 transition-all appearance-none cursor-pointer ${className}`}
    >
      {children}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 group-hover/select:opacity-100 transition-opacity">
      <span className="text-[8px]">▼</span>
    </div>
  </div>
);

const ToggleSwitch: React.FC<{ 
  label: string; 
  checked: boolean; 
  onChange: (val: boolean) => void;
  color?: 'blue' | 'purple' | 'emerald';
}> = ({ label, checked, onChange, color = 'blue' }) => {
  const bgClasses = {
    blue: checked ? 'bg-blue-600' : 'bg-gray-700',
    purple: checked ? 'bg-purple-600' : 'bg-gray-700',
    emerald: checked ? 'bg-emerald-600' : 'bg-gray-700',
  };
  return (
    <div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all">
      <span className="text-[10px] text-gray-400 font-bold">{label}</span>
      <button 
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-all relative shadow-lg ${bgClasses[color]}`}
      >
        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-md ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
};

export const InputTextNode = ({ id, data, selected }: any) => {
  const updateNodeData = useStore(s => s.updateNodeData);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const template = PROMPT_TEMPLATES.find(t => t.id === selectedId);
    if (template) {
      updateNodeData(id, { content: template.content });
    }
  };

  return (
    <NodeWrapper title="文字输入" id={id} color="blue" status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest pl-1">快速模板</label>
          <DarkSelect value="" onChange={handleTemplateChange} className="!p-2 text-[10px]">
            <option value="" disabled className="bg-[#1a1a1a]">选择预设模板...</option>
            {PROMPT_TEMPLATES.map(t => (
              <option key={t.id} value={t.id} className="bg-[#1a1a1a]">{t.title}</option>
            ))}
          </DarkSelect>
        </div>
        
        <textarea
          className="nodrag nowheel nopan w-full bg-black/60 text-xs text-gray-300 p-3 rounded-xl outline-none border border-white/10 focus:border-blue-500/50 resize-none font-sans transition-all leading-relaxed shadow-inner mt-1"
          rows={4}
          value={data.content || ''}
          onChange={(e) => updateNodeData(id, { content: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="输入描述文字..."
        />
      </div>
      <Handle type="source" position={Position.Right} id="text" className="!bg-blue-500" />
    </NodeWrapper>
  );
};

export const InputImageNode = ({ id, data, selected }: any) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const settings = useStore(s => s.settings);
  const setZoomUrl = useStore((s: any) => s.setZoomUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      updateNodeData(id, { status: 'loading', statusMsg: 'Uploading...' });
      const { url, mediumUrl } = await uploadToImgBB(file, settings.imgbbKey);
      updateNodeData(id, { url, mediumUrl, status: 'success', statusMsg: 'Done' });
    } catch (err: any) {
      updateNodeData(id, { status: 'error', statusMsg: err.message });
    }
  };

  return (
    <NodeWrapper title="图像资源" id={id} color="green" status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="group relative w-full h-36 bg-black/60 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all overflow-hidden" onClick={() => fileInputRef.current?.click()}>
        {data.url ? (
          <>
            <img src={data.mediumUrl || data.url} className="w-full h-full object-contain" alt="Preview" />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
               <button onClick={(e) => { e.stopPropagation(); setZoomUrl(data.url); }} className="p-1.5 bg-black/80 rounded border border-white/10 text-[10px]">🔍</button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
             <span className="text-gray-500 text-3xl opacity-50">🖼️</span>
             <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">上传素材</span>
          </div>
        )}
      </div>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
      <Handle type="source" position={Position.Right} id="image" className="!bg-emerald-500" />
    </NodeWrapper>
  );
};

export const ExpertStoryboardNode = ({ id, data, selected }: any) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const handleCopy = () => {
    if (data.content) {
      navigator.clipboard.writeText(data.content);
      alert("分析结果已复制到剪贴板");
    }
  };
  return (
    <NodeWrapper title="分镜导演" color="purple" id={id} status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="flex flex-col gap-2.5">
        <ToggleSwitch 
          label="空间一致性 (Consistency)" 
          checked={!!data.storyboardConsistency} 
          onChange={(val) => updateNodeData(id, { storyboardConsistency: val })} 
        />
        <ToggleSwitch 
          label="读取图像备注 (Read Remarks)" 
          checked={!!data.readImageRemarks} 
          onChange={(val) => updateNodeData(id, { readImageRemarks: val })}
          color="purple"
        />
        <div className="flex justify-between items-center bg-black/40 p-2 rounded-xl border border-white/5">
          <span className="text-[10px] text-gray-400 font-bold">输出语言</span>
          <button 
            onClick={() => updateNodeData(id, { outputLang: data.outputLang === 'en' ? 'zh' : 'en' })}
            className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all ${data.outputLang === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            {data.outputLang === 'en' ? 'English' : '中文'}
          </button>
        </div>
        <div className="flex justify-between items-center mt-1 px-1">
          <div className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] opacity-60">AI 专家分析</div>
          <button onClick={handleCopy} className="text-gray-500 hover:text-blue-400 transition-colors" title="复制结果">
            <span className="text-[11px]">📋</span>
          </button>
        </div>
        <div className="nodrag nowheel nopan bg-black/60 p-3 rounded-xl text-[11px] text-gray-400 h-28 overflow-y-auto border border-white/5 italic leading-relaxed scrollbar-thin shadow-inner relative group">
          {data.content || (data.status === 'loading' ? '正在分析...' : '等待运行...')}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="text" style={{ top: '35%' }} className="!bg-blue-500" />
      <Handle type="target" position={Position.Left} id="image" style={{ top: '65%' }} className="!bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="text" className="!bg-blue-500" />
    </NodeWrapper>
  );
};

const ExpertNodeBase: React.FC<{ id: string; data: any; title: string; color?: string; selected?: boolean }> = ({ id, data, title, color = "purple", selected }) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const handleCopy = () => {
    if (data.content) {
      navigator.clipboard.writeText(data.content);
      alert("分析结果已复制到剪贴板");
    }
  };
  return (
    <NodeWrapper title={title} color={color} id={id} status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="flex flex-col gap-2.5 mb-2.5">
        <ToggleSwitch 
          label="读取图像备注 (Read Remarks)" 
          checked={!!data.readImageRemarks} 
          onChange={(val) => updateNodeData(id, { readImageRemarks: val })}
          color="purple"
        />
        <div className="flex justify-between items-center bg-black/40 p-2 rounded-xl border border-white/5">
          <span className="text-[10px] text-gray-400 font-bold">输出语言</span>
          <button 
            onClick={() => updateNodeData(id, { outputLang: data.outputLang === 'en' ? 'zh' : 'en' })}
            className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all ${data.outputLang === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            {data.outputLang === 'en' ? 'English' : '中文'}
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center mb-2 px-1">
        <div className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] opacity-60">AI 专家分析</div>
        <button onClick={handleCopy} className="text-gray-500 hover:text-blue-400 transition-colors" title="复制结果">
          <span className="text-[11px]">📋</span>
        </button>
      </div>
      <div className="nodrag nowheel nopan bg-black/60 p-3 rounded-xl text-[11px] text-gray-400 h-28 overflow-y-auto border border-white/5 italic leading-relaxed scrollbar-thin shadow-inner relative group">
        {data.content || (data.status === 'loading' ? '正在分析...' : '等待运行...')}
      </div>
      <Handle type="target" position={Position.Left} id="text" style={{ top: '35%' }} className="!bg-blue-500" />
      <Handle type="target" position={Position.Left} id="image" style={{ top: '65%' }} className="!bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="text" className="!bg-blue-500" />
    </NodeWrapper>
  );
};

export const ExpertOptimizerNode = (props: any) => <ExpertNodeBase {...props} title="提示词优化" />;
export const ExpertActionNode = (props: any) => <ExpertNodeBase {...props} title="动作导演" />;
export const ExpertCharacterNode = (props: any) => <ExpertNodeBase {...props} title="角色设计" />;
export const ExpertEnvironmentNode = (props: any) => <ExpertNodeBase {...props} title="环境设计" />;

export const AIExpertNode = ({ id, data, selected }: any) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const handleCopy = () => {
    if (data.content) {
      navigator.clipboard.writeText(data.content);
      alert("总结内容已复制");
    }
  };
  return (
    <NodeWrapper title="AI 专家" color="purple" id={id} status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="flex flex-col gap-2.5 mb-3">
        <DarkSelect value={data.expertType || ''} onChange={(e) => updateNodeData(id, { expertType: e.target.value })}>
          <option value="" className="bg-[#1a1a1a]">选择专家类型...</option>
          <option value="optimizer" className="bg-[#1a1a1a]">提示词优化</option>
          <option value="storyboard" className="bg-[#1a1a1a]">分镜导演</option>
          <option value="action" className="bg-[#1a1a1a]">动作导演</option>
          <option value="character" className="bg-[#1a1a1a]">角色设计</option>
          <option value="environment" className="bg-[#1a1a1a]">环境设计</option>
        </DarkSelect>
        <ToggleSwitch 
          label="读取图像备注 (Read Remarks)" 
          checked={!!data.readImageRemarks} 
          onChange={(val) => updateNodeData(id, { readImageRemarks: val })}
          color="purple"
        />
        <div className="flex justify-between items-center bg-black/40 p-2 rounded-xl border border-white/5">
          <span className="text-[10px] text-gray-400 font-bold">输出语言</span>
          <button 
            onClick={() => updateNodeData(id, { outputLang: data.outputLang === 'en' ? 'zh' : 'en' })}
            className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all ${data.outputLang === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            {data.outputLang === 'en' ? 'English' : '中文'}
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center mb-1 px-1">
        <div className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] opacity-60">AI 专家总结</div>
        <button onClick={handleCopy} className="text-gray-500 hover:text-blue-400 transition-colors" title="复制结果">
          <span className="text-[11px]">📋</span>
        </button>
      </div>
      <div className="nodrag nowheel nopan bg-black/60 p-2 rounded-xl text-[10px] text-gray-500 h-20 overflow-y-auto border border-white/5 italic leading-relaxed shadow-inner">
        {data.content || '等待生成...'}
      </div>
      <Handle type="target" position={Position.Left} id="text" style={{ top: '35%' }} className="!bg-blue-500" />
      <Handle type="target" position={Position.Left} id="image" style={{ top: '65%' }} className="!bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="text" className="!bg-blue-500" />
    </NodeWrapper>
  );
};

export const ImageProcessingNode = ({ id, data, selected }: any) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const setZoomUrl = useStore(s => s.setZoomUrl);
  const updateNodeData = useStore(s => s.updateNodeData);
  const addNode = useStore(s => s.addNode);
  const onConnect = useStore(s => s.onConnect);

  const getInputImages = useCallback(() => {
    const state = useStore.getState();
    const incomingEdges = state.edges.filter(e => e.target === id && e.targetHandle === 'image');
    return incomingEdges
      .sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0))
      .map(edge => state.nodes.find(n => n.id === edge.source)?.data?.url)
      .filter(Boolean) as string[];
  }, [id]);

  const handleEditorSave = useCallback((result: { url: string, mediumUrl: string }) => {
    const state = useStore.getState();
    const currentNode = state.nodes.find(n => n.id === id);
    
    updateNodeData(id, { 
      url: result.url, 
      mediumUrl: result.mediumUrl, 
      status: 'success',
      statusMsg: 'Processed'
    });

    if (currentNode) {
      const resultId = crypto.randomUUID();
      addNode({
        id: resultId,
        type: 'outputResult',
        position: { x: currentNode.position.x + 400, y: currentNode.position.y },
        data: { 
          type: 'image', 
          url: result.url, 
          mediumUrl: result.mediumUrl, 
          label: '处理结果', 
          status: 'idle' 
        }
      });
      
      setTimeout(() => {
        onConnect({ 
          source: id, 
          target: resultId, 
          sourceHandle: 'image', 
          targetHandle: 'image',
          id: `e-${id}-${resultId}-image`
        } as any);
      }, 150);
    }
  }, [id, updateNodeData, addNode, onConnect]);

  return (
    <NodeWrapper title="图片处理" color="indigo" id={id} status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="flex flex-col gap-4">
        <button onClick={() => setIsEditorOpen(true)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"><span>🎞️</span> 进入处理编辑器</button>
        <div className="group relative bg-black/60 h-36 rounded-xl flex flex-col items-center justify-center overflow-hidden border border-white/5 shadow-inner">
          {data.url ? (
            <>
              <img src={data.mediumUrl || data.url} className="w-full h-full object-cover" alt="Processed" />
              <ImageActions url={data.url} onZoom={setZoomUrl} nodeId={id} />
            </>
          ) : (
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-30 text-center px-4">连接素材并打开编辑器</div>
          )}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="image" className="!bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="image" className="!bg-emerald-500" />
      {isEditorOpen && <ImageEditorModal isOpen={isEditorOpen} onClose={() => setIsEditorOpen(false)} inputImageUrls={getInputImages()} onSave={handleEditorSave} />}
    </NodeWrapper>
  );
};

export const ImageSplitNode = ({ id, data, selected }: any) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const setZoomUrl = useStore(s => s.setZoomUrl);

  return (
    <NodeWrapper title="宫格拆分" color="indigo" id={id} status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-gray-500 font-black uppercase">网格类型</label>
          <DarkSelect value={data.gridType || '2x2'} onChange={(e) => updateNodeData(id, { gridType: e.target.value })}>
            <option value="2x2">4 宫格 (2x2)</option>
            <option value="3x3">9 宫格 (3x3)</option>
          </DarkSelect>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-gray-500 font-black uppercase">边缘裁剪 (Trim PX)</label>
          <input 
            type="number"
            className="nodrag nowheel nopan bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-emerald-400 font-black outline-none focus:border-emerald-500/50"
            value={data.gridTrim ?? 10}
            onChange={(e) => updateNodeData(id, { gridTrim: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-gray-500 font-black uppercase">指定导出索引 (0=全选)</label>
          <input 
            type="text"
            className="nodrag nowheel nopan bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-blue-400 font-black outline-none focus:border-blue-500/50"
            placeholder="例如: 1, 2, 5"
            value={data.gridSelect || ''}
            onChange={(e) => updateNodeData(id, { gridSelect: e.target.value })}
          />
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="image" className="!bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="image" className="!bg-emerald-500" />
    </NodeWrapper>
  );
};

export const PromptMergeNode = ({ id, data, selected }: any) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const edges = useStore(s => s.edges);
  const nodes = useStore(s => s.nodes);

  const connectedAnchor = useMemo(() => edges.find(e => e.target === id && e.targetHandle === 'anchor'), [edges, id]);
  const connectedSequences = useMemo(() => 
    edges
      .filter(e => e.target === id && e.targetHandle === 'sequence')
      .sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0)), 
  [edges, id]);

  const sequenceTexts = useMemo(() => {
    return connectedSequences.map(e => {
      const source = nodes.find(n => n.id === e.source);
      return source?.data?.content || source?.data?.label || "";
    }).filter(Boolean);
  }, [connectedSequences, nodes]);

  const targetCount = data.gridType === '3x3' ? 9 : 4;
  const currentCount = sequenceTexts.length > 0 ? sequenceTexts.length : (data.sequenceContent || '').split('\n').filter(l => l.trim().length > 0).length;
  const isOk = currentCount >= targetCount;

  return (
    <NodeWrapper title="提示词合并" color="indigo" id={id} status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-gray-500 font-black uppercase">网格布局</label>
          <DarkSelect value={data.gridType || '3x3'} onChange={(e) => updateNodeData(id, { gridType: e.target.value })}>
            <option value="2x2">4 宫格 (2x2)</option>
            <option value="3x3">9 宫格 (3x3)</option>
          </DarkSelect>
        </div>

        <div className="flex flex-col gap-1 relative">
          <label className="text-[9px] text-gray-500 font-black uppercase">角色锚点 (CHARACTER ANCHOR)</label>
          {connectedAnchor ? (
             <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-2.5 text-[10px] text-blue-300 italic">
                🔗 已从外部节点获取角色描述
             </div>
          ) : (
            <textarea
              className="nodrag nowheel nopan w-full bg-black/60 text-[11px] text-blue-300 p-2.5 rounded-xl outline-none border border-white/10 focus:border-blue-500/50 resize-none"
              rows={2}
              value={data.characterAnchor || ''}
              onChange={(e) => updateNodeData(id, { characterAnchor: e.target.value })}
              placeholder="描述核心角色特征..."
            />
          )}
          <Handle type="target" position={Position.Left} id="anchor" style={{ top: '35px' }} className="!bg-blue-400" />
        </div>

        <div className="flex flex-col gap-1 relative">
          <div className="flex justify-between items-center">
            <label className="text-[9px] text-gray-500 font-black uppercase">序列内容 (SEQUENCE)</label>
            <span className={`text-[9px] font-black ${isOk ? 'text-emerald-500' : 'text-amber-500 animate-pulse'}`}>
              {currentCount} / {targetCount}
            </span>
          </div>

          {connectedSequences.length > 0 ? (
            <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-2 text-[10px] text-indigo-300 max-h-32 overflow-y-auto scrollbar-thin">
               {sequenceTexts.map((txt, idx) => (
                 <div key={idx} className="border-b border-white/5 py-1 truncate">
                    <span className="opacity-50 mr-1">#{idx+1}</span> {txt}
                 </div>
               ))}
               <div className="mt-1 text-[8px] opacity-40 font-mono uppercase">Connected Mode</div>
            </div>
          ) : (
            <textarea
              className="nodrag nowheel nopan w-full bg-black/60 text-[11px] text-gray-400 p-2.5 rounded-xl outline-none border border-white/10 focus:border-blue-500/50 resize-none h-32 scrollbar-thin"
              value={data.sequenceContent || ''}
              onChange={(e) => updateNodeData(id, { sequenceContent: e.target.value })}
              placeholder={`每行输入一个分镜描述...\n(或连接多个文本节点)`}
            />
          )}
          
          <Handle type="target" position={Position.Left} id="sequence" style={{ top: '65px' }} className="!bg-indigo-600" />
          
          {!isOk && currentCount > 0 && (
             <p className="text-[8px] text-amber-600 italic">注意：不足部分将自动重复最后一个分镜。</p>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="text" className="!bg-blue-500" />
    </NodeWrapper>
  );
};

export const ImageGenNode = ({ id, data, selected }: any) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const settings = useStore(s => s.settings);
  const setZoomUrl = useStore((s: any) => s.setZoomUrl);
  const [showDebug, setShowDebug] = useState(false);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    updateNodeData(id, { model });
  };

  const isComfly = data.model?.startsWith('comfly:');

  const debugPayload = useMemo(() => {
    const state = useStore.getState();
    const incomingEdges = state.edges.filter(e => e.target === id);
    const textInputs = incomingEdges.filter(e => !e.targetHandle || e.targetHandle === 'text')
      .map(e => state.nodes.find(n => n.id === e.source)?.data?.content)
      .filter(Boolean);
    const imageUrls = incomingEdges.filter(e => e.targetHandle === 'image')
      .sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0))
      .map(e => state.nodes.find(n => n.id === e.source)?.data?.url)
      .filter(Boolean) as string[];

    if (isComfly) {
      const actualModel = data.model.split(':')[1];
      return {
        model: actualModel,
        prompt: textInputs.join('\n\n') || "Debug Prompt",
        aspect_ratio: data.aspectRatio || settings.aspectRatio,
        image_size: data.imageSize || "1K",
        image: imageUrls.length > 0 ? imageUrls : undefined,
        response_format: "url"
      };
    }
    return { info: "Native/GRSAI Payload varies by endpoint." };
  }, [data, id, settings.aspectRatio, isComfly]);

  return (
    <NodeWrapper title="图像渲染引擎" color="green" id={id} status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="space-y-2 mb-3">
        <DarkSelect value={data.model || 'gemini-native'} onChange={handleModelChange}>
          <optgroup label="Native / GRSAI" className="bg-[#1a1a1a]">
            <option value="gemini-native" className="bg-[#1a1a1a]">Gemini Native</option>
            <option value="nano-banana-pro" className="bg-[#1a1a1a]">Nano Pro (GRSAI)</option>
            <option value="nano-banana-pro-vt" className="bg-[#1a1a1a]">Nano Pro VT (GRSAI)</option>
            <option value="nano-banana-pro-cl" className="bg-[#1a1a1a]">Nano Pro CL (GRSAI)</option>
            <option value="nano-banana-fast" className="bg-[#1a1a1a]">Nano Fast (GRSAI)</option>
          </optgroup>
          <optgroup label="Comfly API" className="bg-[#1a1a1a]">
            <option value="comfly:nano-banana" className="bg-[#1a1a1a]">Nano Banana (Comfly)</option>
            <option value="comfly:nano-banana-2" className="bg-[#1a1a1a]">Nano Banana 2 (Comfly)</option>
            <option value="comfly:nano-banana-hd" className="bg-[#1a1a1a]">Nano Banana HD (Comfly)</option>
            <option value="comfly:nano-banana-2-4k" className="bg-[#1a1a1a]">Nano Banana 2 4K (Comfly)</option>
          </optgroup>
        </DarkSelect>
        
        {isComfly && (
          <ToggleSwitch 
            label="异步任务 (Async)" 
            checked={data.comflyAsync ?? true} 
            onChange={(val) => updateNodeData(id, { comflyAsync: val })} 
            color="emerald"
          />
        )}

        <div className="flex gap-2">
          <DarkSelect className="flex-1 !p-2 text-[10px]" value={data.aspectRatio || ''} onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}>
            <option value="" className="bg-[#1a1a1a]">比例: 默认</option>
            <option value="1:1" className="bg-[#1a1a1a]">1:1</option>
            <option value="16:9" className="bg-[#1a1a1a]">16:9</option>
            <option value="9:16" className="bg-[#1a1a1a]">9:16</option>
            <option value="4:3" className="bg-[#1a1a1a]">4:3</option>
            <option value="3:4" className="bg-[#1a1a1a]">3:4</option>
            <option value="3:2" className="bg-[#1a1a1a]">3:2</option>
            <option value="2:3" className="bg-[#1a1a1a]">2:3</option>
          </DarkSelect>
          <DarkSelect 
            className="flex-1 !p-2 text-[10px] !text-emerald-400 font-black" 
            value={data.imageSize || '1K'} 
            onChange={(e) => updateNodeData(id, { imageSize: e.target.value })}
          >
            <option value="1K" className="bg-[#1a1a1a]">1K</option>
            <option value="2K" className="bg-[#1a1a1a]">2K</option>
            <option value="4K" className="bg-[#1a1a1a]">4K</option>
          </DarkSelect>
        </div>
      </div>
      <div className="group relative bg-black/60 h-36 rounded-xl flex flex-col items-center justify-center overflow-hidden border border-white/5 shadow-inner">
        {data.url ? (
          <>
            <img key={data.refreshKey} src={data.mediumUrl || data.url} className="w-full h-full object-cover" alt="Gen" />
            <ImageActions url={data.url} onZoom={setZoomUrl} nodeId={id} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-20">
            <span className="text-emerald-400 font-black text-xs font-mono">{data.statusMsg || 'IDLE'}</span>
          </div>
        )}
      </div>

      <div className="mt-3">
         <button 
           onClick={() => setShowDebug(!showDebug)} 
           className="w-full text-[9px] font-black text-gray-600 hover:text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2 py-1 bg-black/20 rounded border border-white/5 transition-all active:scale-95"
         >
           {showDebug ? '隐藏 Debug Payload' : '显示 Debug Payload'}
         </button>
         {showDebug && (
           <div className="mt-2 p-2 bg-black/80 rounded-lg border border-red-900/30 font-mono text-[8px] text-red-400/80 overflow-x-auto max-h-40 scrollbar-thin">
              <pre>{JSON.stringify(debugPayload, null, 2)}</pre>
           </div>
         )}
      </div>

      <Handle type="target" position={Position.Left} id="text" style={{ top: '35%' }} className="!bg-blue-500" />
      <Handle type="target" position={Position.Left} id="image" style={{ top: '65%' }} className="!bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="image" className="!bg-emerald-500" />
    </NodeWrapper>
  );
};

export const VideoGenNode = ({ id, data, selected }: any) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const settings = useStore(s => s.settings);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (!data.model?.startsWith('comfly:') && (data.resolution === '1080p' || data.resolution === '4k')) {
      if (data.durationSeconds !== '8') {
        updateNodeData(id, { durationSeconds: '8' });
      }
    }
  }, [data.resolution, data.model, id, updateNodeData]);

  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const res = e.target.value;
    const newData: any = { resolution: res };
    if (!data.model?.startsWith('comfly:') && (res === '1080p' || res === '4k')) {
      newData.durationSeconds = '8';
    }
    updateNodeData(id, newData);
  };

  const debugPayload = useMemo(() => {
    const state = useStore.getState();
    const incomingEdges = state.edges.filter(e => e.target === id);
    const textInputs = incomingEdges.filter(e => !e.targetHandle || e.targetHandle === 'text')
      .map(e => state.nodes.find(n => n.id === e.source)?.data?.content)
      .filter(Boolean);
    const imageUrls = incomingEdges.filter(e => e.targetHandle === 'image')
      .sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0))
      .map(e => state.nodes.find(n => n.id === e.source)?.data?.url)
      .filter(Boolean) as string[];

    const isComfly = data.model?.startsWith('comfly:');
    if (isComfly) {
      const actualModel = data.model.split(':')[1];
      return {
        prompt: textInputs.join('\n\n') || "Debug Prompt",
        model: actualModel,
        aspect_ratio: data.aspectRatio || settings.aspectRatio,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        ...(data.resolution === '1080p' && actualModel === 'veo3.1-fast' ? { enable_upsample: true } : {})
      };
    }

    return prepareVeoPayload({
      model: data.model || 'veo3.1-fast',
      prompt: textInputs.join('\n\n') || "Debug Prompt",
      urls: imageUrls,
      aspectRatio: data.aspectRatio || settings.aspectRatio,
      resolution: data.resolution,
      durationSeconds: data.durationSeconds
    });
  }, [data, id, settings.aspectRatio]);

  const isDurationDisabled = !data.model?.startsWith('comfly:') && (data.resolution === '1080p' || data.resolution === '4k');

  return (
    <NodeWrapper title="视频生成引擎" color="yellow" id={id} status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      <div className="space-y-2 mb-3">
        <DarkSelect value={data.model || 'veo3.1-fast'} onChange={(e) => updateNodeData(id, { model: e.target.value })}>
          <optgroup label="GRSAI" className="bg-[#1a1a1a]">
            <option value="veo3.1-fast" className="bg-[#1a1a1a]">Veo 3.1 Fast (GRSAI)</option>
            <option value="veo3.1-pro" className="bg-[#1a1a1a]">Veo 3.1 Pro (GRSAI)</option>
            <option value="sora-2" className="bg-[#1a1a1a]">Sora 2 (GRSAI)</option>
          </optgroup>
          <optgroup label="Comfly" className="bg-[#1a1a1a]">
            <option value="comfly:veo3.1-fast" className="bg-[#1a1a1a]">veo3.1-fast (comfly)</option>
            <option value="comfly:veo3.1-4k" className="bg-[#1a1a1a]">veo3.1-4k (comfly)</option>
            <option value="comfly:veo3.1-pro-4k" className="bg-[#1a1a1a]">veo3.1-pro-4k (comfly)</option>
            <option value="comfly:veo3.1-components-4k" className="bg-[#1a1a1a]">veo3.1-components-4k (comfly)</option>
          </optgroup>
        </DarkSelect>
        <div className="flex gap-1.5">
          <DarkSelect className="flex-1 !p-2 text-[10px]" value={data.aspectRatio || ''} onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}>
            <option value="" className="bg-[#1a1a1a]">比例: 默认</option>
            <option value="16:9" className="bg-[#1a1a1a]">16:9</option>
            <option value="9:16" className="bg-[#1a1a1a]">9:16</option>
          </DarkSelect>
          <DarkSelect className="flex-1 !p-2 text-[10px]" value={data.resolution || '720p'} onChange={handleResolutionChange}>
            <option value="720p" className="bg-[#1a1a1a]">720p</option>
            <option value="1080p" className="bg-[#1a1a1a]">1080p</option>
            <option value="4k" className="bg-[#1a1a1a]">4k</option>
          </DarkSelect>
          <DarkSelect className="flex-1 !p-2 text-[10px]" value={data.durationSeconds || '6'} disabled={isDurationDisabled} onChange={(e) => updateNodeData(id, { durationSeconds: e.target.value })}>
            <option value="4" className="bg-[#1a1a1a]">4s</option>
            <option value="6" className="bg-[#1a1a1a]">6s</option>
            <option value="8" className="bg-[#1a1a1a]">8s</option>
          </DarkSelect>
        </div>
        {data.model === 'comfly:veo3.1-fast' && data.resolution === '1080p' && (
          <div className="px-1 text-[9px] text-blue-400 font-bold opacity-80 animate-pulse">
            ✨ Auto-upsampling to 1080p enabled
          </div>
        )}
      </div>
      <div className="bg-black/60 h-36 rounded-xl flex flex-col items-center justify-center relative border border-white/5 shadow-inner overflow-hidden">
        {data.url ? (
          <div className="flex flex-col items-center gap-3">
            <div className="text-amber-500 text-3xl animate-pulse">🎥</div>
            <a href={data.url} download target="_blank" className="text-[10px] bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded-full text-white font-black transition-all shadow-xl uppercase tracking-widest ring-2 ring-white/10">下载视频</a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
             <span className="text-amber-400 font-black text-xs font-mono">{data.statusMsg || 'IDLE'}</span>
          </div>
        )}
      </div>

      <div className="mt-3">
         <button 
           onClick={() => { setShowDebug(!showDebug); }} 
           className="w-full text-[9px] font-black text-gray-600 hover:text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2 py-1 bg-black/20 rounded border border-white/5 transition-all"
         >
           {showDebug ? '隐藏 Debug Payload' : '显示 Debug Payload'}
         </button>
         {showDebug && (
           <div className="mt-2 p-2 bg-black/80 rounded-lg border border-red-900/30 font-mono text-[8px] text-red-400/80 overflow-x-auto max-h-40 scrollbar-thin">
              <pre>{JSON.stringify(debugPayload, null, 2)}</pre>
           </div>
         )}
      </div>

      <Handle type="target" position={Position.Left} id="text" style={{ top: '35%' }} className="!bg-blue-500" />
      <Handle type="target" position={Position.Left} id="image" style={{ top: '65%' }} className="!bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="video" className="!bg-amber-500" />
    </NodeWrapper>
  );
};

export const OutputResultNode = ({ id, data, selected }: any) => {
  const updateNodeData = useStore(s => s.updateNodeData);
  const setZoomUrl = useStore((s: any) => s.setZoomUrl);
  const nodeColor = data.type === 'image' ? 'green' : 'white';

  return (
    <NodeWrapper title={data.label || "结果输出"} color={nodeColor} id={id} status={data.status} selected={selected} startTime={data.startTime} duration={data.duration} remark={data.remark}>
      {data.type === 'text' && (
        <div className="relative group/text">
          <textarea 
            className="nodrag nowheel nopan w-full bg-black/60 text-[11px] text-gray-400 h-52 rounded-xl outline-none border border-white/5 focus:border-blue-500/50 resize-none font-mono p-3 scrollbar-thin transition-all shadow-inner leading-relaxed"
            value={data.content || ''}
            onChange={(e) => updateNodeData(id, { content: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <button onClick={() => { navigator.clipboard.writeText(data.content || ''); alert("已复制"); }} className="absolute top-3 right-3 p-2 bg-gray-800/80 hover:bg-blue-600 text-white rounded-lg text-[10px] opacity-0 group-hover/text:opacity-100 transition-all border border-white/10">📋</button>
        </div>
      )}
      {data.type === 'image' && (
        <div className="group relative border border-white/10 rounded-xl overflow-hidden shadow-2xl bg-black/20">
          <img key={data.refreshKey} src={data.mediumUrl || data.url} className="w-full rounded-lg object-contain min-h-[100px]" alt="Result" />
          <ImageActions url={data.url || ''} onZoom={setZoomUrl} nodeId={id} />
        </div>
      )}
      {data.type === 'video' && (
        <div className="bg-black/60 p-8 rounded-xl text-center border border-white/10 shadow-inner group relative">
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎬</div>
          <a href={data.url} download target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full text-[10px] font-black transition-all inline-block shadow-2xl tracking-widest ring-2 ring-white/10">下载媒体</a>
        </div>
      )}
      <Handle type="target" position={Position.Left} id="text" style={{ top: '25%' }} className="!bg-blue-500" />
      <Handle type="target" position={Position.Left} id="image" style={{ top: '50%' }} className="!bg-emerald-500" />
      <Handle type="target" position={Position.Left} id="video" style={{ top: '75%' }} className="!bg-amber-500" />
      <Handle type="source" position={Position.Right} id="text" style={{ top: '35%' }} className="!bg-blue-500" />
      <Handle type="source" position={Position.Right} id="image" style={{ top: '65%' }} className="!bg-emerald-500" />
    </NodeWrapper>
  );
};
