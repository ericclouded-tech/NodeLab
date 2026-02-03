
import { create } from 'zustand';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  Node, 
  NodeChange, 
  addEdge, 
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect, 
  applyNodeChanges, 
  applyEdgeChanges,
  Viewport
} from 'reactflow';
import { AppSettings, Project } from './types';

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  settings: AppSettings;
  projects: Project[];
  currentProjectId: string | null;
  zoomUrl: string | null;
  viewport: Viewport;
  
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setViewport: (viewport: Viewport) => void;
  
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  addNode: (node: Node) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdges: (edges: Edge[]) => void;
  deleteSelected: () => void;
  
  setSettings: (settings: Partial<AppSettings>) => void;
  saveProject: (name: string) => string;
  importProject: (projectData: Project) => void;
  loadProject: (id: string) => void;
  newProject: () => void;
  deleteProject: (id: string) => void;
  setZoomUrl: (url: string | null) => void;
}

const STORAGE_KEY_SETTINGS = 'node_lab_settings';
const STORAGE_KEY_PROJECTS = 'node_lab_projects';

const defaultSettings: AppSettings = {
  grsaiKey: '',
  comflyKey: '',
  imgbbKey: '',
  aspectRatio: '16:9',
  snapToGrid: true,
  panButton: 'middle'
};

const getInitialSettings = (): AppSettings => {
  const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
  const settings = saved ? JSON.parse(saved) : defaultSettings;
  return { ...defaultSettings, ...settings };
};

const getInitialProjects = (): Project[] => {
  const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
  try {
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

export const useStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  settings: getInitialSettings(),
  projects: getInitialProjects(),
  currentProjectId: null,
  zoomUrl: null,
  viewport: { x: 0, y: 0, zoom: 1 },

  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  
  onConnect: (connection: Connection) => {
    set((state) => ({ edges: addEdge(connection, state.edges) }));
  },

  setViewport: (viewport) => set({ viewport }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  
  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) => 
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },

  addNode: (node) => set({ nodes: [...get().nodes, node] }),

  duplicateNode: (nodeId) => {
    const nodeToCopy = get().nodes.find(n => n.id === nodeId);
    if (!nodeToCopy) return;

    const newNodeId = crypto.randomUUID();
    const newNode: Node = {
      ...JSON.parse(JSON.stringify(nodeToCopy)),
      id: newNodeId,
      position: { x: nodeToCopy.position.x + 40, y: nodeToCopy.position.y + 40 },
      selected: false,
      data: {
        ...nodeToCopy.data,
        status: 'idle',
        progress: 0,
        statusMsg: undefined,
      }
    };
    set({ nodes: [...get().nodes, newNode] });
  },
  
  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  },

  deleteEdges: (edgesToDelete) => {
    const edgeIdsToDelete = edgesToDelete.map(e => e.id);
    set({
      edges: get().edges.filter(e => !edgeIdsToDelete.includes(e.id))
    });
  },

  deleteSelected: () => {
    const { nodes, edges } = get();
    const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    const selectedEdgeIds = new Set(edges.filter(e => e.selected).map(e => e.id));
    
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

    set({
      nodes: nodes.filter(n => !selectedNodeIds.has(n.id)),
      edges: edges.filter(e => 
        !selectedEdgeIds.has(e.id) && 
        !selectedNodeIds.has(e.source) && 
        !selectedNodeIds.has(e.target)
      )
    });
  },

  setSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings } as AppSettings;
    set({ settings: updated });
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
  },

  saveProject: (name) => {
    const { nodes, edges, currentProjectId, projects, viewport } = get();
    const id = currentProjectId || crypto.randomUUID();
    
    const cleanedNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        status: node.data.status === 'loading' ? 'idle' : node.data.status,
        progress: 0,
        statusMsg: undefined
      }
    }));

    const newProject: Project = { id, name, nodes: cleanedNodes, edges, viewport };
    const updatedProjects = projects.filter(p => p.id !== id).concat(newProject);
    
    set({ projects: updatedProjects, currentProjectId: id });
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updatedProjects));
    return id;
  },

  importProject: (projectData) => {
    const { projects } = get();
    const projectWithViewport = {
       ...projectData,
       viewport: projectData.viewport || { x: 0, y: 0, zoom: 1 }
    };
    const updatedProjects = projects.filter(p => p.id !== projectWithViewport.id).concat(projectWithViewport);
    set({ 
      projects: updatedProjects, 
      currentProjectId: projectWithViewport.id, 
      nodes: projectWithViewport.nodes, 
      edges: projectWithViewport.edges,
      viewport: projectWithViewport.viewport
    });
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updatedProjects));
  },

  loadProject: (id) => {
    const project = get().projects.find(p => p.id === id);
    if (project) {
      set({
        nodes: project.nodes || [],
        edges: project.edges || [],
        viewport: project.viewport || { x: 0, y: 0, zoom: 1 },
        currentProjectId: id,
      });
    }
  },

  newProject: () => {
    set({ 
      nodes: [], 
      edges: [], 
      currentProjectId: null,
      viewport: { x: 0, y: 0, zoom: 1 }
    });
  },

  deleteProject: (id) => {
    const updated = get().projects.filter(p => p.id !== id);
    set({ 
      projects: updated, 
      currentProjectId: get().currentProjectId === id ? null : get().currentProjectId 
    });
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updated));
  },

  setZoomUrl: (url) => set({ zoomUrl: url })
}));
