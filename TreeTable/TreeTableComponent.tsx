import * as React from 'react';
import { DndContext, closestCenter, TouchSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ProjectTask, TreeNode, UpdatedOrderInfo } from './types';
import { TaskItem } from './TaskItem';

export interface ITreeTableProps {
  tasks: ProjectTask[];
  onTaskSelect: (taskId: string | null) => void;
  onOrderChange: (updatedOrders: UpdatedOrderInfo[]) => void;
  initialSelectedTaskId?: string | null;
  allocatedWidth: number;
  allocatedHeight: number;
}

const buildTree = (tasks: ProjectTask[], parentId: string | null = null, level = 0): TreeNode[] => {
  return tasks
    .filter(task => (task.parentId ?? null) === parentId)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(task => ({
      ...task,
      level,
      children: buildTree(tasks, task.id, level + 1),
    }));
};

export const TreeTableComponent: React.FC<ITreeTableProps> = (props) => {
  const { tasks: flatTasks, onTaskSelect, onOrderChange, initialSelectedTaskId } = props;
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(initialSelectedTaskId ?? null);
  const [displayTasks, setDisplayTasks] = React.useState<ProjectTask[]>(flatTasks);

  React.useEffect(() => {
    setDisplayTasks(flatTasks);
  }, [flatTasks]);

  React.useEffect(() => {
    setSelectedTaskId(initialSelectedTaskId ?? null);
  }, [initialSelectedTaskId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleTaskClick = (taskId: string) => {
    const newSelectedId = selectedTaskId === taskId ? null : taskId;
    setSelectedTaskId(newSelectedId);
    onTaskSelect(newSelectedId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeTask = displayTasks.find(t => t.id === active.id);
      const overTask = displayTasks.find(t => t.id === over.id);

      if (activeTask && overTask && activeTask.parentId === overTask.parentId) {
        const oldIndex = displayTasks.findIndex(t => t.id === active.id);
        const newIndex = displayTasks.findIndex(t => t.id === over.id);
        const reorderedTasksFlat = arrayMove(displayTasks, oldIndex, newIndex);

        setDisplayTasks(reorderedTasksFlat);

        const parentId = activeTask.parentId;
        const siblings = reorderedTasksFlat.filter(t => (t.parentId ?? null) === (parentId ?? null));

        siblings.sort((a, b) => {
          const idxA = reorderedTasksFlat.findIndex(rt => rt.id === a.id);
          const idxB = reorderedTasksFlat.findIndex(rt => rt.id === b.id);
          return idxA - idxB;
        });

        const updatedOrders: UpdatedOrderInfo[] = [];
        let changed = false;
        siblings.forEach((sibling, index) => {
          const newDisplayOrder = index + 1;
          const originalTaskInDisplay = flatTasks.find(t => t.id === sibling.id);
          if (originalTaskInDisplay && originalTaskInDisplay.displayOrder !== newDisplayOrder) {
            updatedOrders.push({ id: sibling.id, newOrder: newDisplayOrder });
            changed = true;
          } else if (!originalTaskInDisplay) {
            updatedOrders.push({ id: sibling.id, newOrder: newDisplayOrder });
            changed = true;
          }
        });

        if (changed) {
          onOrderChange(updatedOrders);
        }
      }
    }
  };

  const currentRenderTree = React.useMemo(() => buildTree(displayTasks), [displayTasks]);

  const renderNodesByParent = (nodesToRender: TreeNode[], currentParentId: string | null) => {
    const itemsForCurrentParent = nodesToRender
      .filter(n => (n.parentId ?? null) === (currentParentId ?? null))
      .sort((a, b) => {
        const taskA_display = displayTasks.find(t => t.id === a.id)?.displayOrder ?? Infinity;
        const taskB_display = displayTasks.find(t => t.id === b.id)?.displayOrder ?? Infinity;
        return taskA_display - taskB_display;
      });

    if (itemsForCurrentParent.length === 0) return null;
    const itemIds = itemsForCurrentParent.map(item => item.id);

    return (
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {itemsForCurrentParent.map(node => (
          <React.Fragment key={node.id}>
            <TaskItem
              task={node}
              level={node.level}
              isSelected={selectedTaskId === node.id}
              onClick={handleTaskClick}
            />
            {node.children && node.children.length > 0 && (
              <div style={{ marginLeft: '20px' }}>
                {renderNodesByParent(node.children, node.id)}
              </div>
            )}
          </React.Fragment>
        ))}
      </SortableContext>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="tree-table-container" style={{ width: props.allocatedWidth, height: props.allocatedHeight, overflow: 'auto' }}>
        {renderNodesByParent(currentRenderTree, null)}
      </div>
    </DndContext>
  );
};