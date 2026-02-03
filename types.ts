
export type NodeType = 
  | 'inputText' 
  | 'inputImage' 
  | 'outputResult' 
  | 'aiExpert' 
  | 'expertOptimizer'
  | 'expertStoryboard'
  | 'expertAction'
  | 'expertCharacter'
  | 'expertEnvironment'
  | 'aiImageGen' 
  | 'aiVideoGen'
  | 'imageProcessing'
  | 'imageSplit'
  | 'promptMerge';

export interface WorkflowNodeData {
  label: string;
  type: NodeType;
  content?: string;
  url?: string;
  mediumUrl?: string;
  model?: string;
  imageSize?: '1K' | '2K' | '4K';
  resolution?: '720p' | '1080p' | '4k';
  durationSeconds?: '4' | '6' | '8';
  config?: any;
  status?: 'idle' | 'loading' | 'success' | 'error';
  progress?: number;
  expertType?: string;
  aspectRatio?: string;
  statusMsg?: string;
  storyboardConsistency?: boolean;
  readImageRemarks?: boolean;
  refreshKey?: number;
  remark?: string;
  startTime?: number;
  duration?: number;
  // For splitting/merging
  gridType?: '2x2' | '3x3';
  gridSelect?: string;
  gridTrim?: number;
  characterAnchor?: string;
  sequenceContent?: string;
  // AI Expert settings
  outputLang?: 'zh' | 'en';
  // Video Gen settings
  enableUpsample?: boolean;
  // Comfly extra
  comflyAsync?: boolean;
}

export interface AppSettings {
  grsaiKey: string;
  comflyKey: string;
  imgbbKey: string;
  aspectRatio: string;
  snapToGrid: boolean;
  panButton: 'left' | 'middle' | 'right';
}

export interface Project {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  viewport: { x: number; y: number; zoom: number };
}
