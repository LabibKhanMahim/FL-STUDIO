import React, { useState } from 'react';
import { Folder, FileAudio, FileDown, Database, HardDrive, File as FileIcon, ChevronRight, ChevronDown } from 'lucide-react';

interface BrowserNode {
  name: string;
  type: 'folder' | 'file';
  icon?: React.ReactNode;
  children?: BrowserNode[];
  isOpen?: boolean;
}

const INITIAL_TREE: BrowserNode[] = [
  { name: 'Current project', type: 'folder', isOpen: true, children: [
    { name: 'History', type: 'folder', children: [] },
    { name: 'Patterns', type: 'folder', children: [] },
    { name: 'Effects', type: 'folder', children: [] },
    { name: 'Generators', type: 'folder', children: [] },
  ]},
  { name: 'Recent files', type: 'folder', children: [
    { name: 'vocal_chop_01.wav', type: 'file', icon: <FileAudio className="w-3 h-3 text-fl-green" /> },
    { name: '808_sub_boom.wav', type: 'file', icon: <FileAudio className="w-3 h-3 text-fl-green" /> },
  ]},
  { name: 'Plugin database', type: 'folder', children: [] },
  { name: 'Plugin presets', type: 'folder', children: [] },
  { name: 'Channel presets', type: 'folder', children: [] },
  { name: 'Mixer presets', type: 'folder', children: [] },
  { name: 'Scores', type: 'folder', children: [] },
  { name: 'Copied audio', type: 'folder', children: [] },
  { name: 'Packs', type: 'folder', isOpen: true, children: [
    { name: 'Drums', type: 'folder', children: [] },
    { name: 'Vocals', type: 'folder', children: [] },
    { name: 'Instruments', type: 'folder', children: [] },
    { name: 'Loops', type: 'folder', children: [] },
    { name: 'Legacy', type: 'folder', children: [] },
  ]},
];

interface TreeNodeProps {
  node: BrowserNode;
  level?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(node.isOpen || false);

  return (
    <div className="w-full">
      <div 
        className="flex items-center gap-1.5 py-0.5 hover:bg-[#ffffff10] cursor-pointer pl-2 truncate"
        style={{ paddingLeft: `${ level * 12 + 8 }px` }}
        onClick={() => node.type === 'folder' && setIsOpen(!isOpen)}
      >
        {node.type === 'folder' ? (
          isOpen ? <ChevronDown className="w-3 h-3 text-[#8e8e93]" /> : <ChevronRight className="w-3 h-3 text-[#8e8e93]" />
        ) : (
          <span className="w-3 h-3 block" /> // Spacer
        )}
        
        {node.type === 'folder' && <Folder className="w-3.5 h-3.5 text-[#ffb900]" fill="#ff7b0020" />}
        {node.type === 'file' && (node.icon || <FileIcon className="w-3 h-3 text-[#8e8e93]" />)}
        
        <span className="text-xs text-[#b3b4b8] select-none truncate leading-none pt-0.5">{node.name}</span>
      </div>
      
      {isOpen && node.children && (
        <div className="flex flex-col">
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export function Sidebar() {
  return (
    <div className="w-56 bg-[#161618] border-r border-[#000] flex flex-col h-full overflow-hidden shadow-2xl z-10">
      <div className="h-6 bg-[#2a2b2e] border-b border-[#3f4044] flex items-center px-2 text-[10px] font-bold text-[#8e8e93] shrink-0">
        BROWSER
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {INITIAL_TREE.map((node, i) => (
          <TreeNode key={i} node={node} />
        ))}
      </div>
    </div>
  );
}
