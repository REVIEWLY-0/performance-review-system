import { fetchWithAuth } from './api';
import { cachedFetch, invalidateCache } from './cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface OrgChartNode {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
}

export interface OrgTreeNode extends OrgChartNode {
  children: OrgTreeNode[];
}

export function buildTree(nodes: OrgChartNode[]): OrgTreeNode[] {
  const map = new Map<string, OrgTreeNode>(
    nodes.map((n) => [n.id, { ...n, children: [] }]),
  );
  const roots: OrgTreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (n: OrgTreeNode) => {
    n.children.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    n.children.forEach(sort);
  };
  roots.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  roots.forEach(sort);
  return roots;
}

export const orgChartApi = {
  getAll: (): Promise<OrgChartNode[]> =>
    cachedFetch('orgchart:all', () => fetchWithAuth(`${API_URL}/org-chart`), 60_000),

  create: async (dto: { title: string; parentId?: string | null; order?: number }): Promise<OrgChartNode> => {
    // Never send parentId: null — class-validator rejects null for @IsString().
    // Omit the key entirely for root nodes.
    const { parentId, ...rest } = dto;
    const payload = parentId ? { ...rest, parentId } : rest;
    const result = await fetchWithAuth(`${API_URL}/org-chart`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    invalidateCache('orgchart:');
    return result;
  },

  update: async (
    id: string,
    dto: { title?: string; parentId?: string | null; order?: number },
  ): Promise<OrgChartNode> => {
    const result = await fetchWithAuth(`${API_URL}/org-chart/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
    invalidateCache('orgchart:');
    return result;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const result = await fetchWithAuth(`${API_URL}/org-chart/${id}`, { method: 'DELETE' });
    invalidateCache('orgchart:');
    return result;
  },
};
