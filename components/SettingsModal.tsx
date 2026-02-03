
import React, { useState } from 'react';
import { useStore } from '../store';
import { getGrsaiCredits, getComflyCredits } from '../services/apiService';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { settings, setSettings } = useStore();
  const [grsaiCredits, setGrsaiCredits] = useState<number | null>(null);
  const [comflyCredits, setComflyCredits] = useState<any>(null);
  const [isLoadingGrsai, setIsLoadingGrsai] = useState(false);
  const [isLoadingComfly, setIsLoadingComfly] = useState(false);

  const fetchGrsaiCredits = async () => {
    if (!settings.grsaiKey) return;
    setIsLoadingGrsai(true);
    try {
      const result = await getGrsaiCredits(settings.grsaiKey);
      if (result && result.code === 0) {
        setGrsaiCredits(result.data.credits);
      } else {
        alert("获取失败: " + (result?.msg || "未知错误"));
      }
    } catch (err: any) {
      alert("连接错误: " + err.message);
    } finally {
      setIsLoadingGrsai(false);
    }
  };

  const fetchComflyCredits = async () => {
    if (!settings.comflyKey) {
      alert("请填写 Comfly 令牌 API Key");
      return;
    }
    setIsLoadingComfly(true);
    try {
      const result = await getComflyCredits(settings.comflyKey);
      if (result && result.quota !== undefined) {
        setComflyCredits(result.quota);
      } else {
        alert("获取失败: 接口未返回额度数据");
      }
    } catch (err: any) {
      console.error(err);
      alert("Comfly 余额查询失败: " + err.message + "\n请检查网络或 API Key。");
    } finally {
      setIsLoadingComfly(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
          <h2 className="text-lg font-bold">Node LAB 系统设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        
        <div className="p-6 space-y-8 overflow-y-auto max-h-[80vh]">
          <section className="space-y-4">
            <h3 className="text-blue-400 text-sm font-semibold flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
              API 配置 (仅本地存储)
            </h3>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Grsai API Key</label>
                  <div className="flex items-center gap-3">
                    {grsaiCredits !== null && (
                      <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-in fade-in">
                        余额: {grsaiCredits} Credits
                      </span>
                    )}
                    <button 
                      onClick={fetchGrsaiCredits}
                      disabled={isLoadingGrsai || !settings.grsaiKey}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase disabled:opacity-30 flex items-center gap-1"
                    >
                      {isLoadingGrsai ? 'Fetching...' : 'Check Credits'}
                    </button>
                  </div>
                </div>
                <input 
                  type="password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm outline-none focus:border-blue-500 transition-all shadow-inner"
                  value={settings.grsaiKey}
                  onChange={(e) => setSettings({ grsaiKey: e.target.value })}
                  placeholder="Grsai API Key..."
                />
              </div>

              <div className="space-y-2 border-t border-white/5 pt-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Comfly API Token</label>
                  <div className="flex items-center gap-3">
                    {comflyCredits !== null && (
                      <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 animate-in fade-in">
                        额度: {comflyCredits} Quota
                      </span>
                    )}
                    <button 
                      onClick={fetchComflyCredits}
                      disabled={isLoadingComfly || !settings.comflyKey}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase disabled:opacity-30 flex items-center gap-1"
                    >
                      {isLoadingComfly ? 'Fetching...' : 'Check Quota'}
                    </button>
                  </div>
                </div>
                <input 
                  type="password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm outline-none focus:border-emerald-500 transition-all shadow-inner"
                  value={settings.comflyKey}
                  onChange={(e) => setSettings({ comflyKey: e.target.value })}
                  placeholder="Comfly API Token..."
                />
              </div>

              <div className="space-y-2 border-t border-white/5 pt-4">
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block">ImgBB API Key</label>
                <input 
                  type="password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm outline-none focus:border-blue-500 transition-all shadow-inner"
                  value={settings.imgbbKey}
                  onChange={(e) => setSettings({ imgbbKey: e.target.value })}
                  placeholder="ImgBB API Key..."
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-600 italic">注：API Key 仅保存在浏览器 localStorage 中，不会上传到任何服务器。</p>
          </section>

          <section className="space-y-4">
            <h3 className="text-green-400 text-sm font-semibold flex items-center gap-2">
              <span className="w-1 h-4 bg-green-500 rounded-full"></span>
              画布与交互 (Interaction)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-bold uppercase">平移画布按键</label>
                <select 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-white"
                  value={settings.panButton}
                  onChange={(e) => setSettings({ panButton: e.target.value as any })}
                >
                  <option value="left">鼠标左键 (Left Button)</option>
                  <option value="middle">鼠标中键 (Middle Button)</option>
                  <option value="right">鼠标右键 (Right Button)</option>
                </select>
                <p className="text-[10px] text-gray-500 italic mt-1 leading-relaxed">
                  {settings.panButton === 'left' 
                    ? "当前模式：直接拖拽左键平移。按住 Shift + 左键拖拽进行框选。" 
                    : "当前模式：直接拖拽左键进行框选。使用指定的平移按键进行画布移动。"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-bold uppercase">默认生图比例</label>
                <select 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-white"
                  value={settings.aspectRatio}
                  onChange={(e) => setSettings({ aspectRatio: e.target.value })}
                >
                  <option value="1:1">1:1 (正方形)</option>
                  <option value="16:9">16:9 (宽屏)</option>
                  <option value="9:16">9:16 (竖屏)</option>
                  <option value="4:3">4:3 (标准)</option>
                  <option value="3:4">3:4 (人像)</option>
                  <option value="21:9">21:9 (宽银幕)</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
