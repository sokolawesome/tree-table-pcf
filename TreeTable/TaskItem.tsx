import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TreeNode } from './types';

export interface ITaskItemProps {
    task: TreeNode;
    level: number;
    isSelected: boolean;
    onClick: (taskId: string) => void;
}

export const TaskItem: React.FC<ITaskItemProps> = ({ task, level, isSelected, onClick }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        paddingLeft: `${level * 20 + 5}px`,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
    };

    const handleItemActivation = () => {
        onClick(task.id);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (isDragging) {
            e.stopPropagation();
            return;
        }
        handleItemActivation();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isDragging) {
            e.stopPropagation();
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleItemActivation();
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`tree-node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging-item' : ''}`}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            {task.name}
        </div>
    );
};