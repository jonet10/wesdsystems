import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BlockConfig } from '../BlockTypes';
import { GripVertical, Trash2 } from 'lucide-react';

interface SortableBlockProps {
  block: BlockConfig;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export function SortableBlock({ block, isSelected, onSelect, onDelete, children }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`relative group mb-2 ring-inset select-none cursor-pointer ${
        isSelected ? 'ring-2 ring-primary rounded' : 'hover:ring-1 hover:ring-gray-300 rounded'
      } ${isDragging ? 'opacity-50' : 'opacity-100 bg-white'}`}
    >
      {/* Drag Handle & Delete Button - Visible on hover or when selected */}
      <div 
        className={`absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col gap-1 transition-opacity ${
          isSelected || isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 bg-white border shadow-sm rounded text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          title="Déplacer"
        >
          <GripVertical size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 bg-white border shadow-sm rounded text-red-400 hover:text-red-600 hover:bg-red-50"
          title="Supprimer"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="pointer-events-none">
        {children}
      </div>
    </div>
  );
}
