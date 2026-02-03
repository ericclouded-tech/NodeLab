
import React, { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Panel,
  ReactFlowProvider,
  Node,
  Edge,
  BackgroundVariant,
  getBezierPath,
  EdgeProps,
  EdgeLabelRenderer,
  useReactFlow,
  addEdge,
  SelectionMode,
  NodeChange,
  EdgeChange
} from 'reactflow';
import { useStore } from './store';
import { 
  InputTextNode, 
  InputImageNode, 
  AIExpertNode, 
  ExpertOptimizerNode,
  ExpertStoryboardNode,
  ExpertActionNode,
  ExpertCharacterNode,
  ExpertEnvironmentNode,
  ImageGenNode, 
  VideoGenNode, 
  OutputResultNode,
  ImageProcessingNode,
  ImageSplitNode,
  PromptMergeNode
} from './components/CustomNodes';
import { SettingsModal } from './components/SettingsModal';
import { 
  geminiTextExpert, 
  grsaiDraw, 
  grsaiVideo, 
  pollGrsaiResult,
  comflyVideo,
  comflyDraw,
  comflyDrawTask,
  pollComflyImageResult,
  pollComflyResult,
  geminiNativeImageGen,
  fetchImageAsBase64,
  uploadToImgBB
} from './services/apiService';
import { EXPERT_INSTRUCTIONS } from './expertsInstructions';

const nodeTypes = {
  inputText: memo(InputTextNode),
  inputImage: memo(InputImageNode),
  aiExpert: memo(AIExpertNode),
  expertOptimizer: memo(ExpertOptimizerNode),
  expertStoryboard: memo(ExpertStoryboardNode),
  expertAction: memo(ExpertActionNode),
  expertCharacter: memo(ExpertCharacterNode),
  expertEnvironment: memo(ExpertEnvironmentNode),
  aiImageGen: memo(ImageGenNode),
  aiVideoGen: memo(VideoGenNode),
  imageProcessing: memo(ImageProcessingNode),
  imageSplit: memo(ImageSplitNode),
  promptMerge: memo(PromptMergeNode),
  outputResult: memo(OutputResultNode),
};

const ConnectionEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const showOrder = data?.order !== undefined && (data?.targetHandle === 'image' || data?.targetHandle === 'sequence');

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={40} 
        className="react-flow__edge-interaction"
        style={{ cursor: 'pointer' }}
      />
      <path
        id={id}
        style={{
          ...style,
          stroke: selected ? '#ef4444' : (style.stroke || '#4b5563'),
          strokeWidth: selected ? 4 : 2,
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {showOrder && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="bg-emerald-950/90 text-emerald-400 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-2xl border border-emerald-500/50 select-none">
              {data.order}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = {
  default: ConnectionEdge,
};

const ViewportSync = () => {
  const { setViewport } = useReactFlow();
  const currentProjectId = useStore(s => s.currentProjectId);
  const storeViewport = useStore(s => s.viewport);
  const lastProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentProjectId !== lastProjectRef.current) {
      setViewport(storeViewport, { duration: 0 });
      lastProjectRef.current = currentProjectId;
    }
  }, [currentProjectId, setViewport, storeViewport]); 

  return null;
};

const FlowContainer: React.FC = () => {
  const reactFlowInstance = useReactFlow();
  const { 
    nodes, edges, 
    onNodesChange: storeOnNodesChange, 
    onEdgesChange: storeOnEdgesChange, 
    onConnect: storeOnConnect, 
    addNode, updateNodeData, 
    settings, currentProjectId, projects, saveProject, importProject, loadProject, newProject, deleteProject,
    zoomUrl, setZoomUrl, setViewport: storeSetViewport, setNodes, setEdges, setSettings, deleteNode, deleteEdges, deleteSelected
  } = useStore();
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isUIVisible, setIsUIVisible] = useState(true); 
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isShiftPressed, setIsShiftPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (multiSelectActive) {
        const selectTrue = changes.filter(c => c.type === 'select' && c.selected);
        const selectFalse = changes.filter(c => c.type === 'select' && !c.selected);
        if (selectTrue.length > 0) {
          const filtered = changes.filter(c => c.type !== 'select' || c.selected);
          storeOnNodesChange(filtered);
          return;
        }
        if (selectTrue.length === 0 && selectFalse.length > 1) {
          const filtered = changes.filter(c => c.type !== 'select');
          storeOnNodesChange(filtered);
          return;
        }
      }
      storeOnNodesChange(changes);
    },
    [multiSelectActive, storeOnNodesChange]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (multiSelectActive) {
        const selectTrue = changes.filter(c => c.type === 'select' && c.selected);
        const selectFalse = changes.filter(c => c.type === 'select' && !c.selected);
        if (selectTrue.length > 0) {
          const filtered = changes.filter(c => c.type !== 'select' || c.selected);
          storeOnEdgesChange(filtered);
          return;
        }
        if (selectTrue.length === 0 && selectFalse.length > 1) {
          const filtered = changes.filter(c => c.type !== 'select');
          storeOnEdgesChange(filtered);
          return;
        }
      }
      storeOnEdgesChange(changes);
    },
    [multiSelectActive, storeOnEdgesChange]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (multiSelectActive && node.selected) {
      setNodes(
        useStore.getState().nodes.map((n) => {
          if (n.id === node.id) return { ...n, selected: false };
          return n;
        })
      );
    }
  }, [multiSelectActive, setNodes]);

  const onPaneClick = useCallback(() => {
    if (!multiSelectActive) {
      setNodes(nodes.map(n => ({ ...n, selected: false })));
      setEdges(edges.map(e => ({ ...e, selected: false })));
    }
  }, [multiSelectActive, nodes, edges, setNodes, setEdges]);

  const panOnDragConfig = useMemo(() => {
    if (settings.panButton === 'left') {
      return isShiftPressed ? false : [0];
    }
    if (settings.panButton === 'middle') return [1];
    if (settings.panButton === 'right') return [2];
    return [0];
  }, [settings.panButton, isShiftPressed]);

  const selectionOnDragConfig = useMemo(() => {
    if (settings.panButton === 'left') {
      return isShiftPressed;
    }
    return true; 
  }, [settings.panButton, isShiftPressed]);

  const executeNode = useCallback(async (nodeId: string) => {
    const node = useStore.getState().nodes.find(n => n.id === nodeId);
    if (!node || ['inputText', 'inputImage', 'outputResult', 'imageProcessing'].includes(node.type as string)) return;

    const getIncomingData = (targetNodeId: string) => {
      const state = useStore.getState();
      const incomingEdges = state.edges.filter(e => e.target === targetNodeId);
      const data = { texts: [] as string[], images: [] as string[], imageRemarks: [] as string[] };
      
      incomingEdges.filter(e => !e.targetHandle || e.targetHandle === 'text' || e.targetHandle === 'anchor' || e.targetHandle === 'sequence').forEach(edge => {
        const sourceNode = state.nodes.find(n => n.id === edge.source);
        if (sourceNode?.data?.content) {
          data.texts.push(sourceNode.data.content);
        }
      });
      
      incomingEdges.filter(e => e.targetHandle === 'image').sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0)).forEach(edge => {
        const sourceNode = state.nodes.find(n => n.id === edge.source);
        if (sourceNode?.data?.url) {
          data.images.push(sourceNode.data.url);
          if (sourceNode.data.remark) {
            data.imageRemarks.push(sourceNode.data.remark);
          }
        }
      });
      return data;
    };

    const inputs = getIncomingData(nodeId);
    let fullPrompt = inputs.texts.join('\n\n');
    const targetAspectRatio = node.data.aspectRatio || settings.aspectRatio;
    
    if (node.data.readImageRemarks && inputs.imageRemarks.length > 0) {
      const remarksSection = inputs.imageRemarks.map((rem, idx) => `[图片${idx + 1}参考信息]: ${rem}`).join('\n');
      fullPrompt = `以下是输入图像的背景补充信息，请在分析时结合使用：\n${remarksSection}\n\n用户主要要求：\n${fullPrompt || "无具体文字要求，请根据图像进行创作分析。"}`;
    }

    const runStartTime = Date.now();
    updateNodeData(nodeId, { 
      status: 'loading', 
      progress: 0, 
      statusMsg: 'Running...', 
      startTime: runStartTime, 
      duration: undefined 
    });

    const finalizeNode = (nodeId: string, status: 'success' | 'error', additionalData: any = {}) => {
      const runDuration = (Date.now() - runStartTime) / 1000;
      updateNodeData(nodeId, { 
        status, 
        duration: parseFloat(runDuration.toFixed(1)), 
        ...additionalData 
      });
    };

    try {
      if (node.type === 'promptMerge') {
        const incomingEdges = useStore.getState().edges.filter(e => e.target === nodeId);
        
        const anchorEdge = incomingEdges.find(e => e.targetHandle === 'anchor');
        let anchor = node.data.characterAnchor || "未指定角色锚点";
        if (anchorEdge) {
           const sourceNode = useStore.getState().nodes.find(n => n.id === anchorEdge.source);
           anchor = sourceNode?.data?.content || sourceNode?.data?.label || anchor;
        }

        const sequenceEdges = incomingEdges
          .filter(e => e.targetHandle === 'sequence')
          .sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0));
        
        let shots = (node.data.sequenceContent || "").split('\n').filter(l => l.trim().length > 0);
        
        if (sequenceEdges.length > 0) {
          shots = sequenceEdges.map(e => {
             const sourceNode = useStore.getState().nodes.find(n => n.id === e.source);
             return sourceNode?.data?.content || sourceNode?.data?.label || "";
          }).filter(Boolean);
        }

        if (shots.length === 0) throw new Error("缺少序列内容分镜描述");

        const gridType = node.data.gridType || '3x3';
        const targetLen = gridType === '3x3' ? 9 : 4;
        
        const finalShots = [...shots];
        while (finalShots.length < targetLen) {
           finalShots.push(finalShots[finalShots.length - 1]); 
        }
        const activeShots = finalShots.slice(0, targetLen);

        const mergedPrompt = `TASK: Generate a multi-shot sequence in a ${gridType} grid format.
    
    VISUAL STYLE: Exact imitation of the artistic medium, textures, and rendering style of the provided reference images. DO NOT add any extra artistic filters.
    
    ### STYLE CLONE: Inherit the artistic medium and visual aesthetic of the references.
    - VISUAL CONSISTENCY: Ensure the same character appearance and environmental aesthetic across all panels.
    
    CHARACTER ANCHORS:
    ${anchor}
    
    SEQUENCE CONTENT:
${activeShots.map((content, i) => `【Shot ${i + 1}】: ${content}`).join('\n')}
    
    TECHNICAL REQUIREMENTS:
    1. Clean ${gridType} grid with thin dividing lines.
    2. NO TEXT, LABELS, OR CAPTIONS in the frames.
    3. NO DUPLICATE CHARACTERS: Each character appears exactly once per frame.
    4. MEDIUM FIDELITY: Maintain the specific artistic quality and structural foundation of the first reference image.`;

        finalizeNode(nodeId, 'success', { statusMsg: 'Merged' });
        const resultId = crypto.randomUUID();
        addNode({
           id: resultId,
           type: 'outputResult',
           position: { x: node.position.x + 400, y: node.position.y },
           data: { type: 'text', label: '合并提示词', content: mergedPrompt, status: 'idle' }
        });
        storeOnConnect({ source: nodeId, target: resultId, sourceHandle: 'text', targetHandle: 'text' } as any);
        return;
      }

      if (node.type === 'imageSplit') {
        if (inputs.images.length === 0) throw new Error("缺少输入图像");
        updateNodeData(nodeId, { statusMsg: 'Processing Split...' });
        
        const sourceUrl = inputs.images[0];
        const gridType = node.data.gridType || '2x2';
        const selectStr = node.data.gridSelect || '0';
        const trim = node.data.gridTrim ?? 10;
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = sourceUrl;
        });

        const cols = gridType === '3x3' ? 3 : 2;
        const rows = cols;
        const cellW = img.width / cols;
        const cellH = img.height / rows;
        const totalCells = cols * rows;

        let indicesToExtract: number[] = [];
        if (selectStr.trim() === '0') {
          indicesToExtract = Array.from({ length: totalCells }, (_, i) => i + 1);
        } else {
          indicesToExtract = selectStr.split(/[,\s]+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n >= 1 && n <= totalCells);
        }

        if (indicesToExtract.length === 0) throw new Error("无有效的选择索引");

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");

        const newOutputNodes: Node[] = [];
        const newOutputEdges: Edge[] = [];

        for (let i = 0; i < indicesToExtract.length; i++) {
          const idx = indicesToExtract[i] - 1; 
          const r = Math.floor(idx / cols);
          const c = idx % cols;

          const sx = c * cellW + trim;
          const sy = r * cellH + trim;
          const sw = cellW - trim * 2;
          const sh = cellH - trim * 2;

          if (sw <= 0 || sh <= 0) throw new Error("裁剪边距太大，超出格子尺寸");

          canvas.width = sw;
          canvas.height = sh;
          ctx.clearRect(0, 0, sw, sh);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

          const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
          const { url, mediumUrl } = await uploadToImgBB(blob, settings.imgbbKey, `split_${idx + 1}`);
          
          const resultId = crypto.randomUUID();
          const newNode: Node = {
            id: resultId,
            type: 'outputResult',
            position: { x: node.position.x + 400, y: node.position.y + i * 220 - (indicesToExtract.length - 1) * 110 },
            data: { type: 'image', label: `格 ${idx + 1}`, url, mediumUrl, status: 'idle' }
          };
          
          newOutputNodes.push(newNode);
          newOutputEdges.push({
            id: `e-${nodeId}-${resultId}`,
            source: nodeId,
            target: resultId,
            sourceHandle: 'image',
            targetHandle: 'image',
            data: { targetHandle: 'image' }
          });

          updateNodeData(nodeId, { progress: Math.floor(((i + 1) / indicesToExtract.length) * 100) });
        }

        const currentNodes = useStore.getState().nodes;
        const currentEdges = useStore.getState().edges;
        setNodes([...currentNodes, ...newOutputNodes]);
        setEdges([...currentEdges, ...newOutputEdges]);

        finalizeNode(nodeId, 'success', { statusMsg: 'Split Done' });
        return;
      }

      const isExpert = node.type!.startsWith('expert') || node.type === 'aiExpert';
      const isGeminiNative = node.type === 'aiImageGen' && node.data.model === 'gemini-native';
      let geminiImages: any[] = [];
      if ((isExpert || isGeminiNative) && inputs.images.length > 0) {
        updateNodeData(nodeId, { statusMsg: 'Processing Media...' });
        geminiImages = await Promise.all(inputs.images.map(url => fetchImageAsBase64(url)));
      }

      if (isExpert) {
        const expertType = node.type === 'aiExpert' ? node.data.expertType : node.type!.replace('expert', '').toLowerCase();
        let systemInstruction = (EXPERT_INSTRUCTIONS as any)[expertType] || EXPERT_INSTRUCTIONS.default;
        
        if (expertType === 'storyboard' && node.data.storyboardConsistency) {
          systemInstruction += "\n\nCRITICAL INSTRUCTION: User has requested SPACE CONSISTENCY. You MUST ensure that all output frames share the EXACT SAME environment, lighting, and atmosphere description. Only the camera angle and character movement should change.";
        }

        const lang = node.data.outputLang || 'zh';
        systemInstruction += `\n\nLANGUAGE REQUIREMENT: You MUST output all analysis text and keyword content in ${lang === 'en' ? 'English' : 'Chinese'}.`;

        const result = await geminiTextExpert(fullPrompt || "Start creation", systemInstruction, geminiImages);
        finalizeNode(nodeId, 'success', { content: result.displaySummary, statusMsg: 'Success' });
        
        const newResultNodes: Node[] = [];
        const newResultEdges: Edge[] = [];

        result.outputs?.slice(0, 16).forEach((out: any, index: number) => {
          const resultId = crypto.randomUUID();
          newResultNodes.push({ 
            id: resultId, 
            type: 'outputResult', 
            position: { x: node.position.x + 400, y: node.position.y + (index - (result.outputs.length - 1) / 2) * 220 }, 
            data: { type: 'text', label: out.title, content: out.prompt, status: 'idle' } 
          });
          newResultEdges.push({ 
            id: `e-${nodeId}-${resultId}`, 
            source: nodeId, 
            target: resultId, 
            sourceHandle: 'text', 
            targetHandle: 'text',
            data: { targetHandle: 'text' }
          });
        });

        const currentNodes = useStore.getState().nodes;
        const currentEdges = useStore.getState().edges;
        setNodes([...currentNodes, ...newResultNodes]);
        setEdges([...currentEdges, ...newResultEdges]);
      }

      if (node.type === 'aiImageGen') {
        const isComflyDraw = node.data.model?.startsWith('comfly:');
        if (isGeminiNative) {
          const base64Image = await geminiNativeImageGen(fullPrompt || "A masterpiece", targetAspectRatio, node.data.imageSize, geminiImages);
          const { url, mediumUrl } = await uploadToImgBB(base64Image, settings.imgbbKey);
          finalizeNode(nodeId, 'success', { url, mediumUrl, progress: 100, statusMsg: 'Success' });
          
          const resultId = crypto.randomUUID();
          addNode({ id: resultId, type: 'outputResult', position: { x: node.position.x + 400, y: node.position.y }, data: { type: 'image', url, mediumUrl, status: 'idle' } });
          storeOnConnect({ id: `e-${nodeId}-${resultId}`, source: nodeId, target: resultId, sourceHandle: 'image', targetHandle: 'image' } as any);
        } else if (isComflyDraw) {
          const actualModel = node.data.model.split(':')[1];
          const size = node.data.imageSize || '1K';
          const isAsync = node.data.comflyAsync ?? true;

          if (isAsync) {
            updateNodeData(nodeId, { statusMsg: 'Queueing Task...' });
            const taskId = await comflyDrawTask({ 
              model: actualModel, 
              prompt: fullPrompt || "Masterpiece", 
              aspectRatio: targetAspectRatio, 
              imageSize: size, 
              urls: inputs.images, 
              apiKey: settings.comflyKey 
            });

            const poll = async () => {
              const resObj = await pollComflyImageResult(taskId, settings.comflyKey);
              
              // 按照提供的示例 JSON 结构解析数据
              // 示例结构: { "code": "success", "data": { "status": "SUCCESS", "progress": "100%", "data": { "data": [{ "url": "..." }] } } }
              const taskInfo = resObj.data || resObj; 
              const rawStatus = (taskInfo.status || taskInfo.state || '').toString().toUpperCase();
              
              const isDone = ['SUCCESS', 'FINISHED', 'SUCCEEDED', 'COMPLETED', 'DONE'].includes(rawStatus);
              const isFailed = ['FAILED', 'ERROR', 'FAILURE'].includes(rawStatus);
              
              // 根据示例路径提取 URL: data.data.data[0].url
              let remoteUrl = taskInfo.data?.data?.[0]?.url || taskInfo.url || taskInfo.result;
              
              if (isFailed) {
                finalizeNode(nodeId, 'error', { statusMsg: taskInfo.fail_reason || 'Generation Failed' });
                return;
              }
              
              if (isDone || remoteUrl) {
                if (!remoteUrl) {
                   finalizeNode(nodeId, 'error', { statusMsg: 'No URL found in success result' });
                   return;
                }
                updateNodeData(nodeId, { statusMsg: 'Uploading Result...' });
                const imgRes = await fetch(remoteUrl);
                const { url: finalUrl, mediumUrl } = await uploadToImgBB(await imgRes.blob(), settings.imgbbKey);
                finalizeNode(nodeId, 'success', { url: finalUrl, mediumUrl, progress: 100, statusMsg: 'Done' });
                
                const resultId = crypto.randomUUID();
                addNode({ id: resultId, type: 'outputResult', position: { x: node.position.x + 400, y: node.position.y }, data: { type: 'image', url: finalUrl, mediumUrl, status: 'idle' } });
                storeOnConnect({ id: `e-${nodeId}-${resultId}`, source: nodeId, target: resultId, sourceHandle: 'image', targetHandle: 'image' } as any);
              } else {
                const progStr = taskInfo.progress || '0%';
                const progNum = parseInt(progStr.replace('%',''), 10) || 0;
                updateNodeData(nodeId, { progress: progNum, statusMsg: progStr || 'Processing...' });
                setTimeout(poll, 3000);
              }
            };
            poll();
          } else {
            // 同步模式
            const url = await comflyDraw({ 
              model: actualModel, 
              prompt: fullPrompt || "Masterpiece", 
              aspectRatio: targetAspectRatio, 
              imageSize: size, 
              urls: inputs.images, 
              apiKey: settings.comflyKey 
            });
            const imgRes = await fetch(url);
            const { url: finalUrl, mediumUrl } = await uploadToImgBB(await imgRes.blob(), settings.imgbbKey);
            finalizeNode(nodeId, 'success', { url: finalUrl, mediumUrl, progress: 100, statusMsg: 'Done' });
            
            const resultId = crypto.randomUUID();
            addNode({ id: resultId, type: 'outputResult', position: { x: node.position.x + 400, y: node.position.y }, data: { type: 'image', url: finalUrl, mediumUrl, status: 'idle' } });
            storeOnConnect({ id: `e-${nodeId}-${resultId}`, source: nodeId, target: resultId, sourceHandle: 'image', targetHandle: 'image' } as any);
          }
        } else {
          // GRSAI Draw
          const taskId = await grsaiDraw({ model: node.data.model!, prompt: fullPrompt || "Masterpiece", aspectRatio: targetAspectRatio, imageSize: node.data.imageSize, urls: inputs.images, apiKey: settings.grsaiKey });
          const poll = async () => {
            const result = await pollGrsaiResult(taskId, settings.grsaiKey);
            if (result.status === 'failed') {
               finalizeNode(nodeId, 'error', { statusMsg: 'Violated/Failed' });
               return;
            }
            if (result.status === 'succeeded') {
              const imgRes = await fetch(result.results?.[0]?.url);
              const { url, mediumUrl } = await uploadToImgBB(await imgRes.blob(), settings.imgbbKey);
              finalizeNode(nodeId, 'success', { url, mediumUrl, progress: 100, statusMsg: 'Done' });
              
              const resultId = crypto.randomUUID();
              addNode({ id: resultId, type: 'outputResult', position: { x: node.position.x + 400, y: node.position.y }, data: { type: 'image', url, mediumUrl, status: 'idle' } });
              storeOnConnect({ id: `e-${nodeId}-${resultId}`, source: nodeId, target: resultId, sourceHandle: 'image', targetHandle: 'image' } as any);
            } else {
              updateNodeData(nodeId, { progress: result.progress, statusMsg: `${result.progress}%` });
              setTimeout(poll, 3000);
            }
          };
          poll();
        }
      }

      if (node.type === 'aiVideoGen') {
        const isComfly = node.data.model?.startsWith('comfly:');
        const actualModel = isComfly ? node.data.model.split(':')[1] : (node.data.model || 'veo3.1-fast');

        let modeMsg = "Generating...";
        if (inputs.images.length === 1) modeMsg = "First Frame Mode...";
        else if (inputs.images.length === 2) modeMsg = "I2V Start-End Mode...";
        else if (inputs.images.length >= 3) modeMsg = "Reference Image Mode...";

        updateNodeData(nodeId, { statusMsg: modeMsg });

        if (isComfly) {
          const taskId = await comflyVideo({
            model: actualModel,
            prompt: fullPrompt || "Cinematic masterpiece",
            urls: inputs.images,
            aspectRatio: targetAspectRatio,
            apiKey: settings.comflyKey,
            enable_upsample: (node.data.resolution === '1080p' && actualModel === 'veo3.1-fast') ? true : undefined
          });

          const poll = async () => {
            const result = await pollComflyResult(taskId, settings.comflyKey);
            const rawStatus = (result.status || result.state || '').toString().toUpperCase();
            const isDone = ['SUCCESS', 'FINISHED', 'SUCCEEDED', 'COMPLETED', 'DONE'].includes(rawStatus);

            if (rawStatus === 'FAILURE' || rawStatus === 'FAILED') {
              finalizeNode(nodeId, 'error', { statusMsg: result.fail_reason || 'Generation Failed' });
              return;
            }
            if (isDone || (result.data && (result.data.output || result.data.url))) {
              const url = result.data?.output || result.data?.url || (Array.isArray(result.data?.outputs) ? result.data.outputs[0] : result.data?.outputs);
              finalizeNode(nodeId, 'success', { url, progress: 100, statusMsg: 'Success' });
              
              const resultId = crypto.randomUUID();
              addNode({ id: resultId, type: 'outputResult', position: { x: node.position.x + 400, y: node.position.y }, data: { type: 'video', url, status: 'idle' } });
              storeOnConnect({ id: `e-${nodeId}-${resultId}`, source: nodeId, target: resultId, sourceHandle: 'video', targetHandle: 'video' } as any);
            } else {
              const progStr = result.progress || '0%';
              const progNum = parseInt(progStr.replace('%',''), 10) || 0;
              updateNodeData(nodeId, { progress: progNum, statusMsg: progStr || 'In Progress' });
              setTimeout(poll, 4000);
            }
          };
          poll();
        } else {
          const taskId = await grsaiVideo({ 
            model: actualModel, 
            prompt: fullPrompt || "Cinematic masterpiece", 
            urls: inputs.images || [], 
            aspectRatio: targetAspectRatio, 
            resolution: node.data.resolution,
            durationSeconds: node.data.durationSeconds,
            apiKey: settings.grsaiKey 
          });

          const poll = async () => {
            const result = await pollGrsaiResult(taskId, settings.grsaiKey);
            if (result.status === 'failed') {
              finalizeNode(nodeId, 'error', { statusMsg: 'Generation Failed' });
              return;
            }
            if (result.status === 'succeeded') {
              const url = result.url || result.results?.[0]?.url;
              finalizeNode(nodeId, 'success', { url, progress: 100, statusMsg: 'Success' });
              
              const resultId = crypto.randomUUID();
              addNode({ id: resultId, type: 'outputResult', position: { x: node.position.x + 400, y: node.position.y }, data: { type: 'video', url, status: 'idle' } });
              storeOnConnect({ id: `e-${nodeId}-${resultId}`, source: nodeId, target: resultId, sourceHandle: 'video', targetHandle: 'video' } as any);
            } else {
              updateNodeData(nodeId, { progress: result.progress, statusMsg: `${result.progress}%` });
              setTimeout(poll, 3000);
            }
          };
          poll();
        }
      }
    } catch (err: any) {
      finalizeNode(nodeId, 'error', { statusMsg: err.message });
    }
  }, [nodes, edges, settings, updateNodeData, addNode, storeOnConnect, setNodes, setEdges]);

  useEffect(() => {
    window.executeNodeById = executeNode;
    return () => { delete window.executeNodeById; };
  }, [executeNode]);

  const exportProjectToFile = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name}.nodelab`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const projectData = JSON.parse(event.target?.result as string);
        importProject(projectData);
        setIsProjectListOpen(false);
        alert("✅ 工程导入成功！");
      } catch (err) {
        alert("❌ 导入失败: 文件格式错误");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  }, [importProject]);

  const handleNewProject = useCallback(() => {
    if (confirm("清空画布并新建工程？当前未保存的修改将丢失。")) {
      newProject();
      reactFlowInstance.setNodes([]);
      reactFlowInstance.setEdges([]);
      reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 });
    }
  }, [newProject, reactFlowInstance]);

  const autoArrangeSelected = useCallback(() => {
    const { nodes } = useStore.getState();
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 1) {
      alert("请先框选或点击选择需要排列的节点");
      return;
    }

    const sortedNodes = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const startX = sortedNodes[0].position.x;
    const startY = sortedNodes[0].position.y;
    
    const gridSizeX = 400;
    const snapSize = 20;

    const newNodes = nodes.map(node => {
      if (node.selected) {
        const index = sortedNodes.findIndex(n => n.id === node.id);
        let targetX = startX + index * gridSizeX;
        let targetY = startY;
        targetX = Math.round(targetX / snapSize) * snapSize;
        targetY = Math.round(targetY / snapSize) * snapSize;
        return { ...node, position: { x: targetX, y: targetY } };
      }
      return node;
    });

    setNodes(newNodes);
  }, [setNodes]);

  const addNewNode = useCallback((type: string, initialPos?: { x: number, y: number }) => {
    const { nodes } = useStore.getState();
    const selectedNodes = nodes.filter(n => n.selected);
    const newNodeId = crypto.randomUUID();
    let position = initialPos || { x: 0, y: 0 };
    
    if (!initialPos) {
      if (selectedNodes.length > 0) {
        const maxX = Math.max(...selectedNodes.map(n => n.position.x));
        const avgY = selectedNodes.reduce((acc, n) => acc + n.position.y, 0) / selectedNodes.length;
        position = { x: maxX + 400, y: avgY };
      } else {
        const { x, y, zoom } = reactFlowInstance.getViewport();
        position = {
          x: (window.innerWidth / 2 - x) / zoom,
          y: (window.innerHeight / 2 - y) / zoom,
        };
      }
    }

    if (settings.snapToGrid) {
      position.x = Math.round(position.x / 20) * 20;
      position.y = Math.round(position.y / 20) * 20;
    }

    const isVideoGen = type === 'aiVideoGen';
    const newNode: Node = {
      id: newNodeId,
      type,
      position,
      data: { 
        label: `${type}`, 
        type, 
        status: 'idle',
        model: type === 'aiImageGen' ? 'gemini-native' : (isVideoGen ? 'comfly:veo3.1-fast' : undefined),
        imageSize: '1K',
        resolution: isVideoGen ? '720p' : '720p',
        durationSeconds: isVideoGen ? '8' : '6',
        aspectRatio: '',
        remark: '',
        readImageRemarks: true,
        gridType: '3x3',
        gridSelect: '0',
        gridTrim: 10,
        characterAnchor: '',
        sequenceContent: '',
        outputLang: 'zh',
        enableUpsample: false,
        comflyAsync: true // Default to async for Comfly
      },
    };
    addNode(newNode);
    if (selectedNodes.length > 0) {
      const textNodes = selectedNodes.filter(n => n.type === 'inputText' || n.type?.startsWith('expert') || (n.type === 'outputResult' && n.data.type === 'text') || n.type === 'promptMerge');
      const imageNodes = selectedNodes.filter(n => n.type === 'inputImage' || (n.type === 'outputResult' && n.data.type === 'image') || n.type === 'aiImageGen' || n.type === 'imageProcessing' || n.type === 'imageSplit').sort((a, b) => a.position.y - b.position.y);
      
      textNodes.forEach(source => {
        const targetHandle = newNode.type === 'promptMerge' ? 'sequence' : 'text';
        storeOnConnect({ id: `e-${source.id}-${newNodeId}-text`, source: source.id, target: newNodeId, sourceHandle: 'text', targetHandle, data: { targetHandle } } as any);
      });
      
      imageNodes.forEach((source, index) => storeOnConnect({ id: `e-${source.id}-${newNodeId}-image`, source: source.id, target: newNodeId, sourceHandle: 'image', targetHandle: 'image', data: { order: index + 1, targetHandle: 'image' } } as any));
    }
  }, [addNode, storeOnConnect, reactFlowInstance, settings.snapToGrid, settings.imgbbKey, updateNodeData]);

  const onConnect = useCallback((params: any) => {
    const { nodes, edges } = useStore.getState();
    const selectedNodes = nodes.filter(n => n.selected);
    const isSourceSelected = selectedNodes.some(n => n.id === params.source);

    if (isSourceSelected && selectedNodes.length > 1) {
      const sortedSelectedNodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
      let baseOrder = edges.filter(e => e.target === params.target && e.targetHandle === params.targetHandle).length;
      
      sortedSelectedNodes.forEach((node) => {
        if (node.id === params.target) return;
        const connection = { ...params, source: node.id };
        const needsOrder = (params.targetHandle === 'image' || params.targetHandle === 'sequence');
        const order = needsOrder ? ++baseOrder : undefined;
        storeOnConnect({ ...connection, data: { order, targetHandle: params.targetHandle } } as any);
      });
    } else {
      const targetEdges = edges.filter(e => e.target === params.target && e.targetHandle === params.targetHandle);
      const order = (params.targetHandle === 'image' || params.targetHandle === 'sequence') ? targetEdges.length + 1 : undefined;
      storeOnConnect({ ...params, data: { order, targetHandle: params.targetHandle } } as any);
    }
  }, [storeOnConnect]);

  const handleSaveAndExport = useCallback(() => {
    if (!saveName.trim()) return;
    const viewport = reactFlowInstance.getViewport();
    storeSetViewport(viewport);
    const id = saveProject(saveName.trim());
    exportProjectToFile(id);
    setIsSaveModalOpen(false);
  }, [saveName, reactFlowInstance, storeSetViewport, saveProject]);

  const handleSaveLocal = useCallback(() => {
    if (!saveName.trim()) return;
    const viewport = reactFlowInstance.getViewport();
    storeSetViewport(viewport);
    saveProject(saveName.trim());
    setIsSaveModalOpen(false);
  }, [saveName, reactFlowInstance, storeSetViewport, saveProject]);

  const currentProjectName = useMemo(() => projects.find(p => p.id === currentProjectId)?.name || "New LAB", [currentProjectId, projects]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        (Array.from(files) as File[]).forEach(async (file) => {
          if (file.type.startsWith('image/')) {
            const newNodeId = crypto.randomUUID();
            addNode({ id: newNodeId, type: 'inputImage', position, data: { status: 'loading', statusMsg: 'Uploading...' } });
            try {
              const { url, mediumUrl } = await uploadToImgBB(file, settings.imgbbKey);
              updateNodeData(newNodeId, { url, mediumUrl, status: 'success', statusMsg: 'Done' });
            } catch (err: any) {
              updateNodeData(newNodeId, { status: 'error', statusMsg: err.message });
            }
          }
        });
      }
    },
    [reactFlowInstance, addNode, settings.imgbbKey, updateNodeData]
  );

  return (
    <div className="w-full h-full bg-[#0b0b0b] relative">
      <ViewportSync />
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange} 
        onConnect={onConnect} 
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes} 
        edgeTypes={edgeTypes} 
        snapToGrid={settings.snapToGrid}
        snapGrid={[20, 20]}
        fitView 
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.01} 
        maxZoom={10}   
        style={{ width: '100%', height: '100%' }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        panOnDrag={panOnDragConfig}
        selectionOnDrag={selectionOnDragConfig}
        selectionMode={SelectionMode.Partial}
      >
        <Background color="#333" gap={24} variant={BackgroundVariant.Dots} />
        <Controls className="!bg-gray-800 border-gray-700 hidden md:flex" />
        <MiniMap 
          className="hidden md:block"
          nodeStrokeColor={(n) => {
            if (n.type === 'inputText') return '#3b82f6';
            if (n.type === 'inputImage') return '#10b981';
            if (n.type?.startsWith('expert')) return '#9333ea';
            if (n.type === 'aiExpert') return '#9333ea';
            if (n.type === 'aiImageGen') return '#10b981';
            if (n.type === 'aiVideoGen') return '#d97706';
            if (n.type === 'imageProcessing' || n.type === 'imageSplit' || n.type === 'promptMerge') return '#6366f1';
            return '#374151';
        }} nodeColor={() => '#1f2937'} maskColor="rgba(0, 0, 0, 0.7)" />
        
        <button 
          onClick={() => setIsUIVisible(!isUIVisible)}
          className="fixed bottom-4 left-4 z-[2000] w-10 h-10 bg-gray-900 border border-white/20 rounded-xl flex items-center justify-center shadow-2xl text-xl md:hidden transition-transform active:scale-90"
        >
          {isUIVisible ? '🧊' : '🗺️'}
        </button>

        {isUIVisible && (
          <>
            <Panel position="top-left" className="m-4 transition-all duration-300">
              <div className="bg-gray-900/95 backdrop-blur-xl p-2 md:p-3 rounded-2xl border border-white/10 flex flex-col gap-1.5 md:gap-2 shadow-2xl min-w-[140px] md:min-w-[170px] max-h-[70vh] overflow-y-auto scrollbar-thin">
                <div className="px-2 md:px-3 py-1 text-[8px] md:text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]">Input Source</div>
                <button onClick={() => addNewNode('inputText')} className="px-3 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs bg-gray-800/40 hover:bg-blue-600 rounded-xl transition-all text-left flex items-center gap-2 group">📝 文字输入</button>
                <button onClick={() => addNewNode('inputImage')} className="px-3 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs bg-gray-800/40 hover:bg-emerald-600 rounded-xl transition-all text-left flex items-center gap-2 group">🖼️ 图像素材</button>
                
                <div className="px-2 md:px-3 py-1 text-[8px] md:text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mt-2 md:mt-3">Workflow Tools</div>
                <button onClick={() => addNewNode('imageProcessing')} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-indigo-600 rounded-xl transition-all text-left flex items-center gap-2 group">✂️ 图片处理</button>
                <button onClick={() => addNewNode('imageSplit')} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-indigo-600 rounded-xl transition-all text-left flex items-center gap-2 group">🪟 宫格拆分</button>
                <button onClick={() => addNewNode('promptMerge')} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-indigo-600 rounded-xl transition-all text-left flex items-center gap-2 group">🧬 提示词合并</button>

                <div className="px-2 md:px-3 py-1 text-[8px] md:text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mt-2 md:mt-3">Creative Experts</div>
                <button onClick={() => addNewNode(`expertOptimizer`)} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-violet-600 rounded-xl transition-all text-left flex items-center gap-2 group">✨ 提示词优化</button>
                <button onClick={() => addNewNode(`expertStoryboard`)} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-violet-600 rounded-xl transition-all text-left flex items-center gap-2 group">✨ 分镜导演</button>
                <button onClick={() => addNewNode(`expertAction`)} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-violet-600 rounded-xl transition-all text-left flex items-center gap-2 group">✨ 动作导演</button>
                <button onClick={() => addNewNode(`expertCharacter`)} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-violet-600 rounded-xl transition-all text-left flex items-center gap-2 group">✨ 角色设计</button>
                <button onClick={() => addNewNode(`expertEnvironment`)} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-violet-600 rounded-xl transition-all text-left flex items-center gap-2 group">✨ 环境设计</button>
                
                <div className="px-2 md:px-3 py-1 text-[8px] md:text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mt-2 md:mt-3">Render Engines</div>
                <button onClick={() => addNewNode('aiImageGen')} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-emerald-600 rounded-xl transition-all text-left flex items-center gap-2 group">🎨 图片生成</button>
                <button onClick={() => addNewNode('aiVideoGen')} className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs bg-gray-800/40 hover:bg-amber-600 rounded-xl transition-all text-left flex items-center gap-2 group">🎥 视频生成</button>
              </div>
            </Panel>

            <Panel position="top-center" className="mt-4 transition-all duration-300">
              <div className="bg-gray-900/95 border border-white/10 rounded-2xl flex items-center p-1.5 md:p-2 shadow-2xl backdrop-blur-md ring-1 ring-black">
                <div className="px-3 md:px-4 py-0.5 md:py-1 flex flex-col border-r border-gray-700 mr-1.5 md:mr-2 min-w-[60px] md:min-w-[120px]">
                  <span className="text-[7px] md:text-[8px] text-gray-500 font-bold uppercase tracking-widest hidden md:block">Workspace</span>
                  <span className="text-[10px] md:text-xs font-bold text-blue-400 truncate max-w-[80px] md:max-w-[140px]">{currentProjectName}</span>
                </div>
                <div className="flex gap-1 md:gap-2 px-1">
                  <button onClick={handleNewProject} className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors text-white text-base md:text-lg" title="新建工程">📄</button>
                  <button onClick={() => { const current = projects.find(p => p.id === currentProjectId); setSaveName(current?.name || `Lab_${Date.now().toString().slice(-4)}`); setIsSaveModalOpen(true); }} className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors text-white text-base md:text-lg" title="保存工程">💾</button>
                  <button onClick={() => setIsProjectListOpen(true)} className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors text-white text-base md:text-lg" title="工程列表">📂</button>
                </div>
              </div>
            </Panel>

            <Panel position="top-right" className="m-4 flex items-center gap-2 transition-all duration-300">
              <div className="flex bg-gray-900 border border-white/10 rounded-xl p-1 shadow-xl ring-1 ring-black">
                <button 
                  onClick={() => setSettings({ snapToGrid: !settings.snapToGrid })} 
                  className={`p-1.5 md:p-2 rounded-lg transition-all flex items-center gap-1.5 md:gap-2 ${settings.snapToGrid ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-white'}`}
                  title={settings.snapToGrid ? "网格对齐: 已开启" : "网格对齐: 已关闭"}
                >
                  <span className="text-base md:text-lg">🕸️</span>
                </button>
                <button 
                  onClick={autoArrangeSelected} 
                  className="p-1.5 md:p-2 text-gray-500 hover:text-white rounded-lg transition-all hidden md:flex"
                  title="自动排列所选节点"
                >
                  <span className="text-base md:text-lg">🧹</span>
                </button>
              </div>
              <button onClick={() => setIsSettingsOpen(true)} className="bg-gray-900 border border-white/10 px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-bold hover:bg-gray-800 flex items-center gap-1.5 md:gap-2 shadow-xl ring-1 ring-black transition-all text-white">
                <span className="md:inline hidden">⚙️ 系统设置</span>
                <span className="md:hidden text-base">⚙️</span>
              </button>
            </Panel>

            <Panel position="bottom-center" className="mb-6 md:mb-8 transition-all duration-300 flex items-center gap-3">
              <div className="flex items-center bg-gray-900/95 border border-white/10 rounded-xl p-1.5 shadow-2xl backdrop-blur-md">
                <button 
                  onClick={() => setMultiSelectActive(!multiSelectActive)}
                  className={`p-2 rounded-lg transition-all flex items-center justify-center ${multiSelectActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'}`}
                  title="多选模式"
                >
                  <span className="text-lg">🎯</span>
                </button>
              </div>

              <button 
                onClick={() => {
                  const { nodes } = useStore.getState();
                  nodes.filter(n => n.selected).forEach(n => executeNode(n.id));
                }} 
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-8 md:px-16 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm transition-all shadow-2xl flex items-center gap-2 md:gap-3 tracking-widest uppercase ring-1 ring-blue-400/30"
              >
                🚀 Run
              </button>
            </Panel>
          </>
        )}
      </ReactFlow>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {isProjectListOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 w-full md:max-w-lg max-w-[90vw] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
              <h2 className="text-base md:text-lg font-bold text-white">工程列表</h2>
              <button onClick={() => setIsProjectListOpen(false)} className="text-gray-400 hover:text-white p-1">✕</button>
            </div>
            <div className="p-4 md:p-6 space-y-3 md:space-y-4 max-h-[50vh] md:max-h-[60vh] overflow-y-auto scrollbar-thin">
              {projects.length === 0 ? (
                <div className="text-center py-6 text-gray-500 italic text-sm">暂无保存的工程</div>
              ) : (
                projects.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-800/40 p-2.5 md:p-3 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all group">
                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                      <span className="text-xs md:text-sm font-bold text-gray-200 truncate">{p.name}</span>
                      <span className="text-[9px] md:text-[10px] text-gray-500 font-mono uppercase truncate">{p.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => loadProject(p.id)} className="px-2 py-1 md:px-3 md:py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] md:text-xs font-bold hover:bg-blue-600 hover:text-white transition-all">加载</button>
                      <button onClick={() => exportProjectToFile(p.id)} className="px-2 py-1 md:px-3 md:py-1.5 bg-gray-700 text-gray-300 rounded-lg text-[10px] md:text-xs font-bold hover:bg-gray-600 transition-all">导出</button>
                      <button onClick={() => { if(confirm('确认删除?')) deleteProject(p.id); }} className="px-2 py-1 md:px-3 md:py-1.5 bg-red-900/20 text-red-500 rounded-lg text-[10px] md:text-xs font-bold hover:bg-red-600 hover:text-white transition-all">删除</button>
                    </div>
                  </div>
                ))
              )}
              <div className="pt-3 border-t border-white/5">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 md:py-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                >
                  📥 导入 .nodelab 文件
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".nodelab" onChange={handleImportFile} />
              </div>
            </div>
          </div>
        </div>
      )}

      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 w-full md:max-w-sm max-w-[85vw] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-3 md:px-6 md:py-4 border-b border-gray-700 bg-gray-800/50">
              <h2 className="text-base md:text-lg font-bold text-white">保存当前工程</h2>
            </div>
            <div className="p-5 md:p-6 space-y-3 md:space-y-4">
              <input 
                type="text"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2.5 md:p-3 text-sm text-white outline-none focus:border-blue-500"
                placeholder="工程名称..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2.5 pt-1">
                <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-[10px] md:text-xs font-black uppercase">取消</button>
                <button onClick={handleSaveLocal} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] md:text-xs font-black uppercase">仅本地保存</button>
              </div>
              <button onClick={handleSaveAndExport} className="w-full py-2.5 md:py-3 bg-emerald-600 text-white rounded-xl text-[10px] md:text-xs font-black uppercase shadow-lg shadow-emerald-900/20">保存并下载文件</button>
            </div>
          </div>
        </div>
      )}

      {zoomUrl && (
        <div className="fixed inset-0 z-[4000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-in fade-in zoom-in duration-200" onClick={() => setZoomUrl(null)}>
          <div className="relative max-w-full max-h-full">
            <img src={zoomUrl} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain border border-white/10" alt="Zoom" />
            <button className="absolute -top-12 right-0 text-white text-2xl hover:text-red-400 transition-colors">✕</button>
            <div className="absolute -bottom-12 left-0 right-0 text-center">
              <a href={zoomUrl} download target="_blank" className="text-xs text-blue-400 font-bold uppercase tracking-widest hover:text-white transition-colors">点击下载原始图像</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  return (
    <ReactFlowProvider>
      <FlowContainer />
    </ReactFlowProvider>
  );
};

export default App;
