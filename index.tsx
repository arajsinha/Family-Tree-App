
import React, { useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, 
  Edit2, 
  Download, 
  Upload, 
  Users, 
  Maximize2, 
  Trash2, 
  Globe, 
  User, 
  Calendar, 
  FileText, 
  X, 
  Venus, 
  Mars,
  Info
} from 'lucide-react';

// --- Data Models ---

type Gender = 'male' | 'female';

interface Person {
  id: string;
  name: string;
  gender: Gender;
  birthYear?: number;
  deathYear?: number;
  notes?: string;
  external?: boolean;
}

interface Marriage {
  id: string;
  spouse1Id: string;
  spouse2Id: string;
  marriageYear?: number;
}

interface ChildLink {
  marriageId: string;
  personId: string;
}

interface FamilyTree {
  persons: Record<string, Person>;
  marriages: Record<string, Marriage>;
  children: ChildLink[];
}

// --- Constants ---

const NODE_WIDTH = 200;
const NODE_HEIGHT = 110;
const HORIZONTAL_SPACING = 300;
const VERTICAL_SPACING = 260;
const MARRIAGE_CIRCLE_RADIUS = 10;
const BUTTON_RADIUS = 14;

// --- Core Logic Functions ---

const updatePerson = (tree: FamilyTree, person: Person): FamilyTree => ({
  ...tree,
  persons: { ...tree.persons, [person.id]: person },
});

const addPerson = (tree: FamilyTree, person: Person): FamilyTree => ({
  ...tree,
  persons: { ...tree.persons, [person.id]: person },
});

const addMarriage = (tree: FamilyTree, marriage: Marriage): FamilyTree => ({
  ...tree,
  marriages: { ...tree.marriages, [marriage.id]: marriage },
});

const addChild = (tree: FamilyTree, marriageId: string, personId: string): FamilyTree => {
  if (tree.children.some(link => link.marriageId === marriageId && link.personId === personId)) {
    return tree;
  }
  return {
    ...tree,
    children: [...tree.children, { marriageId, personId }],
  };
};

const deletePerson = (tree: FamilyTree, personId: string): FamilyTree => {
  const newPersons = { ...tree.persons };
  delete newPersons[personId];

  const newMarriages = { ...tree.marriages };
  Object.keys(newMarriages).forEach(id => {
    if (newMarriages[id].spouse1Id === personId || newMarriages[id].spouse2Id === personId) {
      delete newMarriages[id];
    }
  });

  const newChildren = tree.children.filter(link => {
    const marriageExists = newMarriages[link.marriageId];
    return link.personId !== personId && marriageExists;
  });

  return { persons: newPersons, marriages: newMarriages, children: newChildren };
};

const getChildrenOfMarriage = (tree: FamilyTree, marriageId: string): string[] => {
  return tree.children
    .filter((link) => link.marriageId === marriageId)
    .map((link) => link.personId);
};

const getParentsOfPerson = (tree: FamilyTree, personId: string): string[] => {
  const link = tree.children.find((l) => l.personId === personId);
  if (!link) return [];
  const marriage = tree.marriages[link.marriageId];
  if (!marriage) return [];
  return [marriage.spouse1Id, marriage.spouse2Id].filter(id => id);
};

const computeGenerations = (tree: FamilyTree, startId: string): Record<string, number> => {
  const generations: Record<string, number> = {};
  if (!tree.persons[startId]) return generations;

  const queue: Array<{ id: string; level: number }> = [{ id: startId, level: 0 }];
  generations[startId] = 0;
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    const personMarriages = Object.values(tree.marriages).filter(
      (m) => m.spouse1Id === id || m.spouse2Id === id
    );

    for (const m of personMarriages) {
      const spouseId = m.spouse1Id === id ? m.spouse2Id : m.spouse1Id;
      if (spouseId && !visited.has(spouseId)) {
        visited.add(spouseId);
        generations[spouseId] = level;
        queue.push({ id: spouseId, level });
      }
      const childrenIds = getChildrenOfMarriage(tree, m.id);
      for (const childId of childrenIds) {
        if (!visited.has(childId)) {
          visited.add(childId);
          generations[childId] = level + 1;
          queue.push({ id: childId, level: level + 1 });
        }
      }
    }

    const childLink = tree.children.find((link) => link.personId === id);
    if (childLink) {
      const marriage = tree.marriages[childLink.marriageId];
      if (marriage) {
        [marriage.spouse1Id, marriage.spouse2Id].forEach(pId => {
          if (pId && !visited.has(pId)) {
            visited.add(pId);
            generations[pId] = level - 1;
            queue.push({ id: pId, level: level - 1 });
          }
        });
      }
    }
  }
  return generations;
};

const generateId = () => Math.random().toString(36).substring(2, 11);

// --- Components ---

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all duration-300 animate-in fade-in">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in zoom-in duration-300 ease-out-back">
        <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                <Info size={20} />
             </div>
             <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>
        <div className="p-10 overflow-y-auto max-h-[85vh] custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

const App = () => {
  const initialIdRef = useRef(generateId());
  const [tree, setTree] = useState<FamilyTree>({
    persons: { [initialIdRef.current]: { id: initialIdRef.current, name: 'Root Ancestor', gender: 'male', birthYear: 1950 } },
    marriages: {},
    children: []
  });
  
  const [focusId, setFocusId] = useState<string | null>(initialIdRef.current);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [addingChildToMarriageId, setAddingChildToMarriageId] = useState<string | null>(null);
  const [addingSpouseToPersonId, setAddingSpouseToPersonId] = useState<string | null>(null);
  const [addingParentToPersonId, setAddingParentToPersonId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: -500, y: -250, w: 1000, h: 800 });
  const svgRef = useRef<SVGSVGElement>(null);
  const focusedPerson = focusId ? tree.persons[focusId] : null;

  const layout = useMemo(() => {
    const startId = focusId || Object.keys(tree.persons)[0];
    const gens = computeGenerations(tree, startId);
    const personCoords: Record<string, { x: number; y: number }> = {};
    const marriageCoords: Record<string, { x: number; y: number }> = {};
    const peopleByGen: Record<number, string[]> = {};
    const sortedIds = Object.keys(gens).sort((a, b) => gens[a] - gens[b]);
    const addedToLayout = new Set<string>();

    sortedIds.forEach(id => {
      if (addedToLayout.has(id)) return;
      const gen = gens[id];
      if (!peopleByGen[gen]) peopleByGen[gen] = [];
      peopleByGen[gen].push(id);
      addedToLayout.add(id);
      const marriages = Object.values(tree.marriages).filter(m => m.spouse1Id === id || m.spouse2Id === id);
      marriages.forEach(m => {
        const spouseId = m.spouse1Id === id ? m.spouse2Id : m.spouse1Id;
        if (spouseId && !addedToLayout.has(spouseId) && gens[spouseId] === gen) {
          peopleByGen[gen].push(spouseId);
          addedToLayout.add(spouseId);
        }
      });
    });

    Object.entries(peopleByGen).forEach(([genStr, ids]) => {
      const gen = parseInt(genStr);
      const rowY = gen * VERTICAL_SPACING;
      const rowWidth = (ids.length - 1) * HORIZONTAL_SPACING;
      ids.forEach((id, idx) => {
        const x = (idx * HORIZONTAL_SPACING) - (rowWidth / 2);
        personCoords[id] = { x, y: rowY };
      });
    });

    Object.values(tree.marriages).forEach((m) => {
      const p1 = personCoords[m.spouse1Id];
      const p2 = personCoords[m.spouse2Id];
      if (p1 && p2) {
        marriageCoords[m.id] = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      }
    });

    return { personCoords, marriageCoords, gens };
  }, [tree, focusId]);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tree));
    const node = document.createElement('a');
    node.setAttribute("href", dataStr);
    node.setAttribute("download", "family_tree.json");
    node.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setTree(data);
        setFocusId(Object.keys(data.persons)[0]);
      } catch (err) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const [isPanning, setIsPanning] = useState(false);
  const startPan = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      startPan.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - startPan.current.x;
    const dy = e.clientY - startPan.current.y;
    setViewBox(prev => ({
      ...prev,
      x: prev.x - dx * (prev.w / (svgRef.current?.clientWidth || 1000)),
      y: prev.y - dy * (prev.h / (svgRef.current?.clientHeight || 800))
    }));
    startPan.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(prev => {
      const newW = prev.w * scale;
      const newH = prev.h * scale;
      return { ...prev, x: prev.x + (prev.w - newW) / 2, y: prev.y + (prev.h - newH) / 2, w: newW, h: newH };
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this person and their relationships?")) {
      setTree(prev => deletePerson(prev, id));
      if (focusId === id) setFocusId(null);
      setEditingPerson(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans select-none">
      <header className="flex items-center justify-between px-10 py-5 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <Users size={26} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">The Sinha's</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">The Sinha Family Tree</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 pr-6 border-r border-slate-200">
            {focusedPerson ? (
              <>
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-black text-slate-700">{focusedPerson.name}</div>
                  <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Selected Focus</div>
                </div>
                <button 
                  onClick={() => setEditingPerson(focusedPerson)}
                  className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all shadow-xl shadow-indigo-200 active:scale-95"
                >
                  <Edit2 size={16} /> Edit Profile
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Globe size={18} className="animate-spin-slow" />
                <span className="text-[11px] font-black uppercase tracking-[0.1em]">Global Viewport</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => document.getElementById('import-input')?.click()} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 transition-all"><Upload size={16} /> Import</button>
            <input id="import-input" type="file" className="hidden" onChange={handleImport} />
            <button onClick={handleExport} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 transition-all"><Download size={16} /> Export</button>
            <button onClick={() => setViewBox({ x: -500, y: -250, w: 1000, h: 800 })} className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all"><Maximize2 size={22} /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative cursor-grab active:cursor-grabbing bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]">
        <svg 
          ref={svgRef} 
          className="w-full h-full" 
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} 
          onMouseDown={handleMouseDown} 
          onMouseMove={handleMouseMove} 
          onMouseUp={handleMouseUp} 
          onMouseLeave={handleMouseUp} 
          onWheel={handleWheel}
        >
          <defs>
            <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="6" /><feOffset dx="0" dy="10" result="offsetblur" /><feComponentTransfer><feFuncA type="linear" slope="0.1" /></feComponentTransfer><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <linearGradient id="maleGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#f0f9ff" /></linearGradient>
            <linearGradient id="femaleGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#fdf2f8" /></linearGradient>
          </defs>

          {/* GIANT BACKGROUND RECTANGLE FOR DESELECTION */}
          <rect 
            x="-20000" y="-20000" width="40000" height="40000" 
            fill="transparent" 
            pointerEvents="all" 
            onClick={() => setFocusId(null)}
          />

          {/* Lineage Paths (Dashed Orthogonal) */}
          {tree.children.map((link, idx) => {
            const m = layout.marriageCoords[link.marriageId], p = layout.personCoords[link.personId];
            if (!m || !p) return null;
            const midY = m.y + (p.y - m.y) / 2;
            return (
              <path 
                key={`link-${idx}`} 
                d={`M ${m.x} ${m.y} L ${m.x} ${midY} L ${p.x} ${midY} L ${p.x} ${p.y - NODE_HEIGHT / 2}`} 
                fill="none" 
                stroke="#94a3b8" 
                strokeWidth="2.5" 
                strokeDasharray="8 6"
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })}

          {/* Marriage Connectors (Solid Line) */}
          {(Object.values(tree.marriages) as Marriage[]).map((m) => {
            const p1 = layout.personCoords[m.spouse1Id], p2 = layout.personCoords[m.spouse2Id];
            if (!p1 || !p2) return null;
            return <line key={`m-line-${m.id}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" pointerEvents="none" />;
          })}

          {/* Marriage Interaction Nodes */}
          {(Object.values(tree.marriages) as Marriage[]).map((m) => {
            const coord = layout.marriageCoords[m.id];
            if (!coord) return null;
            return (
              <g key={`m-node-${m.id}`} transform={`translate(${coord.x}, ${coord.y})`}>
                <circle r={MARRIAGE_CIRCLE_RADIUS} fill="white" stroke="#64748b" strokeWidth="2.5" className="transition-all shadow-sm" />
                <g transform="translate(20, -20)" onClick={(e) => { e.stopPropagation(); setAddingChildToMarriageId(m.id); }} className="cursor-pointer group">
                  <circle r="14" fill="#6366f1" className="group-hover:fill-indigo-700 transition-colors shadow-lg" />
                  <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize="18" fontWeight="black" pointerEvents="none">+</text>
                </g>
              </g>
            );
          })}

          {/* Person Nodes */}
          {(Object.values(tree.persons) as Person[]).map((p) => {
            const coord = layout.personCoords[p.id];
            if (!coord) return null;
            const isFocus = p.id === focusId;
            return (
              <g 
                key={`p-node-${p.id}`} 
                transform={`translate(${coord.x}, ${coord.y})`} 
                filter="url(#nodeShadow)"
                className="cursor-pointer group"
                onClick={(e) => { e.stopPropagation(); setFocusId(p.id); }}
              >
                {/* Main Card Body - Removed scale on hover to fix floating buttons jitter */}
                <rect 
                  x={-NODE_WIDTH / 2} 
                  y={-NODE_HEIGHT / 2} 
                  width={NODE_WIDTH} 
                  height={NODE_HEIGHT} 
                  rx="24" 
                  className={`transition-all duration-300 ${isFocus ? 'stroke-indigo-600 stroke-[3px]' : 'stroke-slate-200 stroke-[1px]'} ${p.external ? 'opacity-80' : ''} hover:stroke-indigo-300`} 
                  fill={p.gender === 'male' ? 'url(#maleGrad)' : 'url(#femaleGrad)'} 
                />
                
                {/* Gender Indicator Badge */}
                <g transform={`translate(${-NODE_WIDTH/2 + 30}, 0)`}>
                  <circle r="18" fill={p.gender === 'male' ? '#3b82f6' : '#ec4899'} fillOpacity="0.08" />
                  <text textAnchor="middle" dominantBaseline="central" fontSize="11" fill={p.gender === 'male' ? '#2563eb' : '#db2777'} fontWeight="black" pointerEvents="none">
                    {p.gender === 'male' ? 'M' : 'F'}
                  </text>
                </g>
                
                {/* Name and Dates */}
                <text textAnchor="middle" className="fill-slate-800 font-black text-[15px] tracking-tight" y={-5} x={15}>{p.name}</text>
                {(p.birthYear || p.deathYear) && (
                  <text textAnchor="middle" className="fill-slate-400 text-[11px] font-extrabold uppercase tracking-widest" y={20} x={15}>
                    {p.birthYear || '?'}{p.deathYear ? ` – ${p.deathYear}` : ''}
                  </text>
                )}

                {/* ACTION BUTTONS: Docked at specific coordinates */}
                <g className={`${isFocus ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                  
                  {/* Edit Profile - Top Right Anchor */}
                  <g transform={`translate(${NODE_WIDTH / 2 - 12}, ${-NODE_HEIGHT / 2 + 12})`} 
                     onClick={(e) => { e.stopPropagation(); setEditingPerson(p); }} 
                     className="cursor-pointer">
                    <circle r={14} fill="white" stroke="#e2e8f0" strokeWidth="1.5" className="hover:fill-indigo-50 transition-colors shadow-sm" />
                    <text textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6366f1" fontWeight="black" pointerEvents="none">✎</text>
                  </g>
                  
                  {/* Add Spouse - Bottom Anchor */}
                  <g transform={`translate(0, ${NODE_HEIGHT / 2})`} 
                     onClick={(e) => { e.stopPropagation(); setAddingSpouseToPersonId(p.id); }} 
                     className="cursor-pointer">
                    <circle r={BUTTON_RADIUS} fill="#10b981" className="hover:fill-emerald-700 transition-colors shadow-md" />
                    <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize="18" fontWeight="black" pointerEvents="none">+</text>
                  </g>

                  {/* Add Parents - Top Anchor */}
                  {getParentsOfPerson(tree, p.id).length === 0 && (
                    <g transform={`translate(0, ${-NODE_HEIGHT / 2})`} 
                       onClick={(e) => { e.stopPropagation(); setAddingParentToPersonId(p.id); }} 
                       className="cursor-pointer">
                      <circle r={BUTTON_RADIUS} fill="#3b82f6" className="hover:fill-blue-700 transition-colors shadow-md" />
                      <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize="18" fontWeight="black" pointerEvents="none">+</text>
                    </g>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      </main>

      {/* Edit Person Modal */}
      <Modal isOpen={!!editingPerson} onClose={() => setEditingPerson(null)} title="Update Identity">
        {editingPerson && (
          <form className="space-y-8" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const birthRaw = fd.get('birthYear') as string;
            const deathRaw = fd.get('deathYear') as string;
            const updated: Person = {
              ...editingPerson,
              name: fd.get('name') as string,
              gender: fd.get('gender') as Gender,
              birthYear: birthRaw ? parseInt(birthRaw, 10) : undefined,
              deathYear: deathRaw ? parseInt(deathRaw, 10) : undefined,
              notes: fd.get('notes') as string
            };
            setTree(prev => updatePerson(prev, updated));
            setEditingPerson(null);
          }}>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]"><User size={14} /> Official Name</label>
                <input name="name" defaultValue={editingPerson.name} required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-slate-800" placeholder="e.g. Johnathan Smith" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]"><Mars size={14} /> Gender Assignment</label>
                  <div className="flex gap-3 p-1.5 bg-slate-100 rounded-[20px]">
                    <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl cursor-pointer transition-all ${editingPerson.gender === 'male' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      <input type="radio" name="gender" value="male" defaultChecked={editingPerson.gender === 'male'} className="hidden" />
                      <span className="text-sm font-black">Male</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl cursor-pointer transition-all ${editingPerson.gender === 'female' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      <input type="radio" name="gender" value="female" defaultChecked={editingPerson.gender === 'female'} className="hidden" />
                      <span className="text-sm font-black">Female</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]"><Calendar size={14} /> Lifespan Years</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input name="birthYear" type="number" defaultValue={editingPerson.birthYear} placeholder="Born" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none font-bold transition-all text-center" />
                    <input name="deathYear" type="number" defaultValue={editingPerson.deathYear} placeholder="Died" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none font-bold transition-all text-center" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]"><FileText size={14} /> Biographical Documentation</label>
                <textarea name="notes" defaultValue={editingPerson.notes} className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none min-h-[140px] font-medium text-slate-600 leading-relaxed custom-scrollbar" placeholder="Detail migration, military service, occupations, or oral history..." />
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-8 border-t border-slate-100">
              <div className="flex gap-4">
                <button type="button" onClick={() => setEditingPerson(null)} className="flex-1 py-4 font-bold text-slate-500 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all active:scale-95">Cancel</button>
                <button type="submit" className="flex-[2] py-4 font-black text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 shadow-2xl shadow-indigo-100 hover:-translate-y-0.5 transition-all active:translate-y-0">Save Identity Update</button>
              </div>
              <button 
                type="button" 
                onClick={() => handleDelete(editingPerson.id)}
                className="w-full py-4 text-rose-500 font-bold hover:bg-rose-50 rounded-2xl flex items-center justify-center gap-2 transition-all group"
              >
                <Trash2 size={16} className="group-hover:animate-pulse" /> Irrevocably Delete Profile
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Spouse Modal */}
      <Modal isOpen={!!addingSpouseToPersonId} onClose={() => setAddingSpouseToPersonId(null)} title="New Marriage Entry">
        <form className="space-y-6" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const id = generateId(), mId = generateId();
          let next = addPerson(tree, { id, name: fd.get('name') as string, gender: fd.get('gender') as Gender, external: true });
          next = addMarriage(next, { id: mId, spouse1Id: addingSpouseToPersonId!, spouse2Id: id });
          setTree(next);
          setAddingSpouseToPersonId(null);
        }}>
          <div className="space-y-4">
            <input name="name" required autoFocus className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white font-black text-lg transition-all" placeholder="Partner's Full Name" />
            <div className="flex gap-4">
              <select name="gender" className="flex-1 px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl appearance-none bg-white font-bold outline-none cursor-pointer hover:bg-slate-100 transition-colors">
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>
          <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-emerald-100 hover:bg-emerald-700 transition-all hover:-translate-y-0.5">Commit Marriage Link</button>
        </form>
      </Modal>

      {/* Add Child Modal */}
      <Modal isOpen={!!addingChildToMarriageId} onClose={() => setAddingChildToMarriageId(null)} title="Record Descendant">
        <form className="space-y-6" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const id = generateId();
          let next = addPerson(tree, { id, name: fd.get('name') as string, gender: fd.get('gender') as Gender });
          next = addChild(next, addingChildToMarriageId!, id);
          setTree(next);
          setAddingChildToMarriageId(null);
        }}>
          <div className="space-y-4">
            <input name="name" required autoFocus className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white font-black text-lg transition-all" placeholder="Child's Full Name" />
            <select name="gender" className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl appearance-none bg-white font-bold outline-none cursor-pointer hover:bg-slate-100 transition-colors">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:-translate-y-0.5">Register Birth</button>
        </form>
      </Modal>

      {/* Add Parents Modal */}
      <Modal isOpen={!!addingParentToPersonId} onClose={() => setAddingParentToPersonId(null)} title="Map Previous Generation">
        <form className="space-y-8" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const p1Id = generateId(), p2Id = generateId(), mId = generateId();
          let next = addPerson(tree, { id: p1Id, name: fd.get('p1n') as string, gender: 'male' });
          next = addPerson(next, { id: p2Id, name: fd.get('p2n') as string, gender: 'female' });
          next = addMarriage(next, { id: mId, spouse1Id: p1Id, spouse2Id: p2Id });
          next = addChild(next, mId, addingParentToPersonId!);
          setTree(next);
          setAddingParentToPersonId(null);
        }}>
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Paternal Parent</label>
              <input name="p1n" required className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:bg-white font-black text-lg transition-all" placeholder="Father's Name" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Maternal Parent</label>
              <input name="p2n" required className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-pink-500 focus:bg-white font-black text-lg transition-all" placeholder="Mother's Name" />
            </div>
          </div>
          <button type="submit" className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-0.5">Establish Biological Origins</button>
        </form>
      </Modal>

      <style>{`
        .animate-spin-slow {
          animation: spin 12s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .ease-out-back {
          transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
