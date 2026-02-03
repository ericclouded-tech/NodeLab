
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { uploadToImgBB } from '../services/apiService';

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputImageUrls: string[];
  onSave: (result: { url: string, mediumUrl: string }) => void;
}

type Mode = 'stitch' | 'crop' | 'resize';
type StitchLayout = 'horizontal' | 'vertical' | 'grid2x2' | 'grid2x3' | 'grid3x3';

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ isOpen, onClose, inputImageUrls, onSave }) => {
  const settings = useStore(s => s.settings);
  const [mode, setMode] = useState<Mode>('stitch');
  const [layout, setLayout] = useState<StitchLayout>('horizontal');
  const [cropRatio, setCropRatio] = useState<string>('free');
  const [resizeWidth, setResizeWidth] = useState<number>(1024);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  
  // 裁剪专用状态
  const [cropBox, setCropBox] = useState<CropBox>({ x: 50, y: 50, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 初始化加载图片
  useEffect(() => {
    if (!isOpen) return;
    const loadImages = async () => {
      const loaded = await Promise.all(inputImageUrls.map(url => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      }));
      setImages(loaded);
      
      // 如果是裁剪模式，初始化裁剪框
      if (loaded.length > 0) {
        const first = loaded[0];
        setCropBox({
          x: first.width * 0.1,
          y: first.height * 0.1,
          width: first.width * 0.8,
          height: first.height * 0.8
        });
      }
    };
    loadImages();
  }, [isOpen, inputImageUrls]);

  // 绘图逻辑
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || images.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (mode === 'stitch') {
      if (layout === 'horizontal') {
        const h = Math.max(...images.map(img => img.height));
        const w = images.reduce((sum, img) => sum + img.width, 0);
        canvas.width = w; canvas.height = h;
        let x = 0;
        images.forEach(img => {
          ctx.drawImage(img, x, 0);
          x += img.width;
        });
      } else if (layout === 'vertical') {
        const w = Math.max(...images.map(img => img.width));
        const h = images.reduce((sum, img) => sum + img.height, 0);
        canvas.width = w; canvas.height = h;
        let y = 0;
        images.forEach(img => {
          ctx.drawImage(img, 0, y);
          y += img.height;
        });
      } else {
        const cols = layout === 'grid3x3' ? 3 : 2;
        const rows = layout === 'grid2x2' ? 2 : (layout === 'grid2x3' ? 3 : 3);
        const cw = Math.max(...images.map(img => img.width));
        const ch = Math.max(...images.map(img => img.height));
        canvas.width = cw * cols; canvas.height = ch * rows;
        images.slice(0, cols * rows).forEach((img, i) => {
          ctx.drawImage(img, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
        });
      }
    } else {
      // 裁剪和缩放模式只处理第一张图
      const img = images[0];
      if (mode === 'resize') {
        const ratio = img.height / img.width;
        canvas.width = resizeWidth;
        canvas.height = resizeWidth * ratio;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else {
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }
    }
  }, [images, mode, layout, resizeWidth]);

  useEffect(() => { draw(); }, [draw]);

  // 裁剪框交互逻辑
  const handleMouseDown = (e: React.MouseEvent, type: any) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragType || images.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 计算缩放比例 (屏幕像素 vs 图片原始像素)
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    
    const dx = (e.clientX - startPos.x) * scale;
    const dy = (e.clientY - startPos.y) * scale;

    setCropBox(prev => {
      let newBox = { ...prev };
      if (dragType === 'move') {
        newBox.x = Math.max(0, Math.min(canvas.width - prev.width, prev.x + dx));
        newBox.y = Math.max(0, Math.min(canvas.height - prev.height, prev.y + dy));
      } else {
        if (dragType.includes('w')) {
          newBox.width = Math.max(50, prev.width - dx);
          newBox.x = prev.x + (prev.width - newBox.width);
        }
        if (dragType.includes('e')) {
          newBox.width = Math.max(50, prev.width + dx);
        }
        if (dragType.includes('n')) {
          newBox.height = Math.max(50, prev.height - dy);
          newBox.y = prev.y + (prev.height - newBox.height);
        }
        if (dragType.includes('s')) {
          newBox.height = Math.max(50, prev.height + dy);
        }

        // 处理比例锁定
        if (cropRatio !== 'free') {
          const [rw, rh] = cropRatio.split(':').map(Number);
          const ratio = rw / rh;
          if (dragType.includes('e') || dragType.includes('w')) {
             newBox.height = newBox.width / ratio;
          } else {
             newBox.width = newBox.height * ratio;
          }
        }
      }
      return newBox;
    });

    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleApply = async () => {
    const canvas = canvasRef.current;
    if (!canvas || images.length === 0) return;
    
    setIsProcessing(true);
    try {
      let finalCanvas = canvas;

      // 如果是裁剪模式，需要创建一个新画布来提取内容
      if (mode === 'crop') {
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropBox.width;
        cropCanvas.height = cropBox.height;
        const cctx = cropCanvas.getContext('2d');
        if (cctx) {
          cctx.drawImage(canvas, cropBox.x, cropBox.y, cropBox.width, cropBox.height, 0, 0, cropBox.width, cropBox.height);
          finalCanvas = cropCanvas;
        }
      }

      const blob = await new Promise<Blob>(res => finalCanvas.toBlob(b => res(b!), 'image/png'));
      const result = await uploadToImgBB(blob, settings.imgbbKey, `proc_${Date.now()}`);
      
      onSave(result); // 这里的 onSave 会在 CustomNodes 内部触发新节点生成
      onClose();
    } catch (err: any) {
      alert("处理失败: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 辅助：获取裁剪框在屏幕上的位置
  const getScreenBox = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    return {
      left: cropBox.x * scale,
      top: cropBox.y * scale,
      width: cropBox.width * scale,
      height: cropBox.height * scale
    };
  };

  if (!isOpen) return null;

  const screenBox = getScreenBox();

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-[#050505] flex flex-col font-sans select-none" onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)}>
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0a0a0a] shadow-xl">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎞️</span>
            <div>
              <h2 className="text-white font-black text-xs tracking-widest uppercase">图像处理编辑器</h2>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">Pixel Master Pro</p>
            </div>
          </div>
          <div className="flex bg-black/60 rounded-xl p-1 border border-white/5">
            <button onClick={() => setMode('stitch')} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${mode === 'stitch' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>拼接</button>
            <button onClick={() => setMode('crop')} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${mode === 'crop' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>裁剪</button>
            <button onClick={() => setMode('resize')} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${mode === 'resize' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>缩放</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="px-5 py-2 text-[10px] font-black text-gray-400 uppercase hover:text-white">取消</button>
          <button onClick={handleApply} disabled={isProcessing || images.length === 0} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase ring-1 ring-emerald-400/30 shadow-lg active:scale-95 transition-all">
            {isProcessing ? '处理上传中...' : '应用并生成新节点'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-white/5 p-8 space-y-8 bg-[#080808] overflow-y-auto">
          {mode === 'stitch' && (
            <div className="space-y-6">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] block">布局选择</label>
              <div className="grid gap-2.5">
                {[
                  { id: 'horizontal', label: '横向拼接', icon: '↔️' },
                  { id: 'vertical', label: '纵向拼接', icon: '↕️' },
                  { id: 'grid2x2', label: '四宫格 (2x2)', icon: '🪟' },
                  { id: 'grid3x3', label: '九宫格 (3x3)', icon: '🪟' },
                ].map(l => (
                  <button key={l.id} onClick={() => setLayout(l.id as any)} className={`text-left px-5 py-4 rounded-2xl text-[11px] font-black border transition-all flex items-center gap-4 ${layout === l.id ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>
                    <span className="text-lg opacity-80">{l.icon}</span> {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {mode === 'crop' && (
            <div className="space-y-6">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] block">裁剪比例</label>
              <div className="grid grid-cols-2 gap-2.5">
                {['free', '1:1', '16:9', '9:16', '4:3', '3:4', '21:9'].map(r => (
                  <button key={r} onClick={() => setCropRatio(r)} className={`px-3 py-3 rounded-xl text-[10px] font-black border transition-all ${cropRatio === r ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'}`}>{r.toUpperCase()}</button>
                ))}
              </div>
              <p className="text-[9px] text-gray-600 font-bold leading-relaxed italic">
                提示：在右侧画布上拖拽虚线框来选择裁剪区域。
              </p>
            </div>
          )}
          
          {mode === 'resize' && (
            <div className="space-y-6">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] block">宽度约束 (PX)</label>
              <input type="number" value={resizeWidth} onChange={(e) => setResizeWidth(parseInt(e.target.value) || 1024)} className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-blue-400 font-black outline-none focus:border-blue-500/50" />
              <div className="grid grid-cols-3 gap-2">
                {[512, 1024, 2048, 4096].map(w => (
                  <button key={w} onClick={() => setResizeWidth(w)} className="px-2 py-2 bg-white/5 rounded-lg text-[9px] text-gray-400 font-black hover:bg-white/10 transition-colors">{w}px</button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex-1 bg-[#050505] relative p-12 flex items-center justify-center overflow-auto" ref={containerRef}>
          {images.length === 0 ? (
            <div className="text-gray-600 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">正在加载素材...</div>
          ) : (
            <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 rounded-sm bg-[#111]">
              <canvas ref={canvasRef} className="max-w-full max-h-[80vh] block" />
              
              {mode === 'crop' && screenBox && (
                <div 
                  className="absolute border-2 border-dashed border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move z-50 group"
                  style={{
                    left: screenBox.left,
                    top: screenBox.top,
                    width: screenBox.width,
                    height: screenBox.height
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 'move')}
                >
                  {/* 四角手柄 */}
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-500 cursor-nw-resize" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 cursor-ne-resize" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-500 cursor-sw-resize" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 cursor-se-resize" onMouseDown={(e) => handleMouseDown(e, 'se')} />
                  
                  {/* 装饰文字 */}
                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-[8px] px-1 font-black rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    CROP: {Math.round(cropBox.width)} × {Math.round(cropBox.height)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
