export interface ProjectTask {
    id: string;
    name: string;
    parentId?: string | null;
    displayOrder: number;
}

export interface TreeNode extends ProjectTask {
    children: TreeNode[];
    level: number;
}

export interface UpdatedOrderInfo {
    id: string;
    newOrder: number;
}