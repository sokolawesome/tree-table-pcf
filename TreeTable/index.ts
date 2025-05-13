import { IInputs, IOutputs } from "./generated/ManifestTypes";

interface ProjectTask {
    id: string;
    name: string;
    parentId?: string | null;
    displayOrder: number;
}

interface TreeNode extends ProjectTask {
    children: TreeNode[];
    level: number;
}

const SELECT_ALL_NODE_ID = "__SELECT_ALL__";
const SVG_CHEVRON_DOWN = `<svg width="45" height="51" viewBox="0 0 15 17" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3.64099 6.2074L7.28202 10.3457L10.923 6.2074" stroke="#1846B9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
const SVG_CHEVRON_RIGHT = `<svg width="45" height="51" viewBox="0 0 15 17" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M5.46155 12.4149L9.10257 8.27658L5.46155 4.13831" stroke="#1846B9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
const SVG_ARROW_UP = `<svg width="30" height="30" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M24 38V10M24 10L10 24M24 10L38 24" stroke="#1846B9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
const SVG_ARROW_DOWN = `<svg width="30" height="30" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M24 10V38M24 38L38 24M24 38L10 24" stroke="#1846B9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
const SVG_CHECKBOX_EMPTY = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" 
style="display: block; margin: auto;"><rect x="0.5" y="0.5" width="15" height="15" rx="1.5" 
stroke="#1846B9" stroke-width="1"/></svg>`;
const SVG_CHECKBOX_CHECKED = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" 
style="display: block; margin: auto;"><rect x="0.5" y="0.5" width="15" height="15" rx="1.5" 
fill="#1846B9" stroke="#1846B9" stroke-width="1"/><path d="M4 8L6.5 10.5L12 5" stroke="white" stroke-width="1.5" 
stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_CHECKBOX_INDETERMINATE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" 
style="display: block; margin: auto;"><rect x="0.5" y="0.5" width="15" height="15" rx="1.5" 
fill="#1846B9" stroke="#1846B9" stroke-width="1"/><line x1="4" y1="8" x2="12" y2="8" 
stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`;

export class TreeTable implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _notifyOutputChanged: () => void;
    private _context: ComponentFramework.Context<IInputs>;

    private _tasks: ProjectTask[] = [];
    private _selectedTaskIds = new Set<string>();
    private _expandedTaskIds = new Set<string>();
    private _updatedOrderDataForOutput: { id: string, newOrder: number }[] = [];

    private _previousJsonData: string | null | undefined = undefined;
    private _isInternalReorder = false;

    constructor() {
        // constructor
    }

    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        this._context = context;
        this._notifyOutputChanged = notifyOutputChanged;
        this._container = container;

        if (!this._container) {
            return;
        }
        this._container.classList.add("tree-table-container");

        this._previousJsonData = context.parameters.tasksJsonData.raw;
        this.parseAndRender(this._previousJsonData);
    }

    private parseAndRender(jsonString: string | null | undefined, preserveState = false): void {
        const oldSelectedTaskIds = preserveState ? new Set(this._selectedTaskIds) : new Set<string>();
        const oldExpandedTaskIds = preserveState ? new Set(this._expandedTaskIds) : new Set<string>();

        if (!jsonString) {
            this._tasks = [];
        } else {
            try {
                const parsedData = JSON.parse(jsonString) as Partial<ProjectTask>[];
                if (Array.isArray(parsedData)) {
                    this._tasks = parsedData.filter(item =>
                        item && typeof item.id === 'string' &&
                        typeof item.name === 'string' &&
                        typeof item.displayOrder === 'number' &&
                        (item.parentId === null || item.parentId === undefined || typeof item.parentId === 'string')
                    ).map(item => ({
                        id: item.id!,
                        name: item.name!,
                        parentId: (item.parentId ?? null),
                        displayOrder: item.displayOrder!,
                    }));
                } else { this._tasks = []; }
            } catch (e) {
                this._tasks = [];
                if (this._container) this._container.innerHTML = "<div style='color:red;'>Error parsing task data.</div>";
                return;
            }
        }

        if (preserveState) {
            this._selectedTaskIds = oldSelectedTaskIds;
            this._expandedTaskIds = oldExpandedTaskIds;
            this._selectedTaskIds.forEach(id => { if (!this._tasks.find(t => t.id === id)) this._selectedTaskIds.delete(id); });
            this._expandedTaskIds.forEach(id => { if (!this._tasks.find(t => t.id === id)) this._expandedTaskIds.delete(id); });
        } else {
            this._selectedTaskIds.clear();
            this._expandedTaskIds.clear();
        }
        this.renderTree();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        const newJsonData = context.parameters.tasksJsonData.raw;

        if (this._isInternalReorder) {
            if (newJsonData === this._previousJsonData) {
                this._updatedOrderDataForOutput = [];
            }
            this._isInternalReorder = false;
            if (newJsonData !== this._previousJsonData) {
                this._previousJsonData = newJsonData;
                this.parseAndRender(newJsonData, true);
            }
            return;
        }

        if (newJsonData !== this._previousJsonData) {
            this._previousJsonData = newJsonData;
            this.parseAndRender(newJsonData);
        }
    }

    private buildTreeNodes(tasks: ProjectTask[], parentId: string | null = null, level = 0): TreeNode[] {
        return tasks
            .filter(task => (task.parentId ?? null) === parentId)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(task => ({
                ...task,
                level,
                children: this.buildTreeNodes(tasks, task.id, level + 1),
            }));
    }

    private renderTree(): void {
        if (!this._container) return;
        this._container.innerHTML = '';

        if (this._tasks.length > 0) {
            this.renderSelectAllNode(this._container);
        }

        const treeData = this.buildTreeNodes(this._tasks);
        this.renderNodeRecursive(treeData, this._container);
    }

    private renderSelectAllNode(parentElement: HTMLElement): void {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'tree-node-item select-all-node';
        nodeElement.dataset.taskId = SELECT_ALL_NODE_ID;

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'node-content-wrapper';
        contentWrapper.style.paddingLeft = `8px`;

        const selectionIndicator = document.createElement('span');
        selectionIndicator.className = 'selection-indicator';
        const allTasksSelected = this._tasks.length > 0 && this._selectedTaskIds.size === this._tasks.length;
        const someTasksSelected = this._selectedTaskIds.size > 0 && this._selectedTaskIds.size < this._tasks.length;

        if (allTasksSelected) {
            selectionIndicator.innerHTML = SVG_CHECKBOX_CHECKED;
        } else if (someTasksSelected) {
            selectionIndicator.innerHTML = SVG_CHECKBOX_INDETERMINATE;
        } else {
            selectionIndicator.innerHTML = SVG_CHECKBOX_EMPTY;
        }
        contentWrapper.appendChild(selectionIndicator);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'task-name';
        nameSpan.textContent = allTasksSelected ? "Deselect All" : "Select All";
        contentWrapper.appendChild(nameSpan);

        nodeElement.appendChild(contentWrapper);
        nodeElement.onclick = () => this.toggleSelectAll();
        parentElement.appendChild(nodeElement);
    }


    private renderNodeRecursive(nodes: TreeNode[], parentDomElement: HTMLElement): void {
        const siblings = nodes;

        nodes.forEach((node, index) => {
            const nodeElement = document.createElement('div');
            nodeElement.className = 'tree-node-item';
            nodeElement.dataset.taskId = node.id;

            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'node-content-wrapper';
            contentWrapper.style.paddingLeft = `${node.level * 25 + 8}px`;

            if (this._selectedTaskIds.has(node.id)) {
                nodeElement.classList.add('selected');
            }

            const expander = document.createElement('span');
            expander.className = 'expander';
            const hasChildren = node.children && node.children.length > 0;
            if (hasChildren) {
                expander.innerHTML = this._expandedTaskIds.has(node.id) ? SVG_CHEVRON_DOWN : SVG_CHEVRON_RIGHT;
                expander.onclick = (e) => { e.stopPropagation(); this.toggleExpand(node.id); };
            } else {
                expander.className = 'selection-indicator empty-expander';
                expander.innerHTML = ' ';
            }
            contentWrapper.appendChild(expander);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'task-name';
            nameSpan.textContent = node.name;
            contentWrapper.appendChild(nameSpan);

            const moveButtonsContainer = document.createElement('div');
            moveButtonsContainer.className = 'move-buttons-container';

            const moveUpButton = document.createElement('button');
            moveUpButton.className = 'move-button';
            moveUpButton.innerHTML = SVG_ARROW_UP;
            moveUpButton.title = "Move Up";
            moveUpButton.disabled = index === 0;
            moveUpButton.onclick = (e) => { e.stopPropagation(); this.moveTask(node.id, 'up', siblings); };
            moveButtonsContainer.appendChild(moveUpButton);

            const moveDownButton = document.createElement('button');
            moveDownButton.className = 'move-button';
            moveDownButton.innerHTML = SVG_ARROW_DOWN;
            moveDownButton.title = "Move Down";
            moveDownButton.disabled = index === siblings.length - 1;
            moveDownButton.onclick = (e) => { e.stopPropagation(); this.moveTask(node.id, 'down', siblings); };
            moveButtonsContainer.appendChild(moveDownButton);

            contentWrapper.appendChild(moveButtonsContainer);
            nodeElement.appendChild(contentWrapper);

            nodeElement.onclick = () => { this.toggleIndividualSelection(node.id); };
            parentDomElement.appendChild(nodeElement);

            if (hasChildren && this._expandedTaskIds.has(node.id)) {
                this.renderNodeRecursive(node.children, parentDomElement);
            }
        });
    }

    private moveTask(taskId: string, direction: 'up' | 'down', siblings: TreeNode[]): void {
        const taskIndex = siblings.findIndex(s => s.id === taskId);
        if (taskIndex === -1) return;

        const currentTask = siblings[taskIndex];
        let otherTask: TreeNode;

        if (direction === 'up' && taskIndex > 0) {
            otherTask = siblings[taskIndex - 1];
        } else if (direction === 'down' && taskIndex < siblings.length - 1) {
            otherTask = siblings[taskIndex + 1];
        } else {
            return;
        }

        const internalCurrentTask = this._tasks.find(t => t.id === currentTask.id);
        const internalOtherTask = this._tasks.find(t => t.id === otherTask.id);

        if (internalCurrentTask && internalOtherTask) {
            const tempOrder = internalCurrentTask.displayOrder;
            internalCurrentTask.displayOrder = internalOtherTask.displayOrder;
            internalOtherTask.displayOrder = tempOrder;

            this._updatedOrderDataForOutput = [
                { id: internalCurrentTask.id, newOrder: internalCurrentTask.displayOrder },
                { id: internalOtherTask.id, newOrder: internalOtherTask.displayOrder }
            ];

            this._isInternalReorder = true;
            this._notifyOutputChanged();
            this.renderTree();
        }
    }

    private toggleExpand(taskId: string): void {
        if (this._expandedTaskIds.has(taskId)) {
            this._expandedTaskIds.delete(taskId);
        } else {
            this._expandedTaskIds.add(taskId);
        }
        this.renderTree();
    }

    private getAllDescendantIds(taskId: string, tasks: ProjectTask[]): string[] {
        const directChildren = tasks.filter(t => t.parentId === taskId);
        let descendants: string[] = directChildren.map(c => c.id);
        directChildren.forEach(child => {
            descendants = descendants.concat(this.getAllDescendantIds(child.id, tasks));
        });
        return descendants;
    }

    private toggleIndividualSelection(taskId: string): void {
        const taskToToggle = this._tasks.find(t => t.id === taskId);
        if (!taskToToggle) return;

        const descendants = this.getAllDescendantIds(taskId, this._tasks);
        const idsToProcess = [taskId, ...descendants];
        const isCurrentlySelected = this._selectedTaskIds.has(taskId);

        if (isCurrentlySelected) {
            idsToProcess.forEach(id => this._selectedTaskIds.delete(id));
        } else {
            idsToProcess.forEach(id => this._selectedTaskIds.add(id));
        }

        this._notifyOutputChanged();
        this.renderTree();
    }

    private toggleSelectAll(): void {
        if (this._tasks.length === 0) return;
        const shouldSelectAll = this._tasks.some(task => !this._selectedTaskIds.has(task.id)) || this._selectedTaskIds.size === 0;

        this._selectedTaskIds.clear();
        if (shouldSelectAll) {
            this._tasks.forEach(task => this._selectedTaskIds.add(task.id));
        }

        this._notifyOutputChanged();
        this.renderTree();
    }

    public getOutputs(): IOutputs {
        const selectedIdsArray = Array.from(this._selectedTaskIds);
        const outputs: IOutputs = {
            selectedTaskIds: selectedIdsArray.length > 0 ? JSON.stringify(selectedIdsArray) : "",
            updatedOrderData: this._updatedOrderDataForOutput.length > 0 ? JSON.stringify(this._updatedOrderDataForOutput) : ""
        };
        return outputs;
    }

    public destroy(): void {
        // destroy
    }
}