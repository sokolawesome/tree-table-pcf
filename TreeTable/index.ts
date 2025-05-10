import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { TreeTableComponent, ITreeTableProps } from "./TreeTableComponent";
import { ProjectTask, UpdatedOrderInfo } from "./types";

export class TreeTable implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _notifyOutputChanged: () => void;
    private _context: ComponentFramework.Context<IInputs>;
    private _selectedTaskId: string | null = null;
    private _updatedOrderData: UpdatedOrderInfo[] = [];
    private _rawTasks: ProjectTask[] = [];
    private _previousJsonData: string | null | undefined = undefined;


    constructor() {
        // PCF constructor
    }

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;
        context.mode.trackContainerResize(true);

        this._previousJsonData = context.parameters.tasksJsonData.raw;
        this._rawTasks = this.parseTasksFromJson(this._previousJsonData);
        this.renderReactComponent();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        const newJsonData = context.parameters.tasksJsonData.raw;

        if (newJsonData !== this._previousJsonData) {
            this._previousJsonData = newJsonData;
            this._rawTasks = this.parseTasksFromJson(newJsonData);
            this.renderReactComponent();
        }
    }

    private parseTasksFromJson(jsonString: string | null | undefined): ProjectTask[] {
        if (!jsonString) {
            return [];
        }
        try {
            const parsedData = JSON.parse(jsonString) as Partial<ProjectTask>[];
            if (Array.isArray(parsedData)) {
                return parsedData.filter(item =>
                    item &&
                    typeof item.id === 'string' &&
                    typeof item.name === 'string' &&
                    typeof item.displayOrder === 'number' &&
                    (item.parentId === null || item.parentId === undefined || typeof item.parentId === 'string')
                ).map(item => ({
                    id: item.id!,
                    name: item.name!,
                    parentId: item.parentId ?? null,
                    displayOrder: item.displayOrder!,
                }));
            }
            return [];
        } catch (e) {
            console.error("Error parsing tasks JSON data:", e);
            return [];
        }
    }

    private renderReactComponent(): void {
        const props: ITreeTableProps = {
            tasks: this._rawTasks,
            onTaskSelect: this.handleTaskSelect,
            onOrderChange: this.handleOrderChange,
            initialSelectedTaskId: this._selectedTaskId,
            allocatedWidth: this._context.mode.allocatedWidth,
            allocatedHeight: this._context.mode.allocatedHeight,
        };

        ReactDOM.render(
            React.createElement(TreeTableComponent, props),
            this._container
        );
    }

    private handleTaskSelect = (taskId: string | null): void => {
        if (this._selectedTaskId !== taskId) {
            this._selectedTaskId = taskId;
            this._notifyOutputChanged();
        }
    };

    private handleOrderChange = (updatedOrders: UpdatedOrderInfo[]): void => {
        this._updatedOrderData = updatedOrders;
        this._rawTasks = this._rawTasks.map(task => {
            const update = updatedOrders.find(u => u.id === task.id);
            if (update) {
                return { ...task, displayOrder: update.newOrder };
            }
            return task;
        });

        this._notifyOutputChanged();
    };

    public getOutputs(): IOutputs {
        const outputs: IOutputs = {
            selectedTaskId: this._selectedTaskId ?? undefined,
            updatedOrderData: this._updatedOrderData.length > 0 ? JSON.stringify(this._updatedOrderData) : undefined
        };
        this._updatedOrderData = [];
        return outputs;
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }
}