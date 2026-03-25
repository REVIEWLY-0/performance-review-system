'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { orgChartApi, buildTree, OrgChartNode, OrgTreeNode } from '@/lib/org-chart';
import BackButton from '@/components/BackButton';
import { useToast } from '@/components/ToastProvider';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDescendantIds(nodeId: string, nodes: OrgChartNode[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const n of nodes) {
      if (n.parentId === current) {
        result.add(n.id);
        queue.push(n.id);
      }
    }
  }
  return result;
}

// ─── Node Card ───────────────────────────────────────────────────────────────

function NodeCard({
  node,
  isRoot,
  editMode,
  editingId,
  movingId,
  moveDescendantIds,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onStartAdd,
  onDelete,
  onMove,
  onPlaceUnder,
  onCancelMove,
}: {
  node: OrgTreeNode;
  isRoot: boolean;
  editMode: boolean;
  editingId: string | null;
  movingId: string | null;
  moveDescendantIds: Set<string>;
  onStartEdit: (node: OrgTreeNode) => void;
  onSaveEdit: (id: string, title: string) => void;
  onCancelEdit: () => void;
  onStartAdd: (parentId: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string) => void;
  onPlaceUnder: (parentId: string) => void;
  onCancelMove: () => void;
}) {
  const [draftTitle, setDraftTitle] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingId === node.id;
  const isMoving = movingId === node.id;
  // Valid placement target: something is being moved, it's not this node, not a descendant of moving node
  const isValidTarget = movingId !== null && !isMoving && !moveDescendantIds.has(node.id);

  useEffect(() => {
    if (isEditing) {
      setDraftTitle(node.title);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, node.title]);

  return (
    <div className="relative group/card flex flex-col items-center">
      {/* Card box */}
      <div
        className={[
          'px-4 py-3 rounded-xl border-2 shadow-sm text-center min-w-[130px] max-w-[200px] w-max select-none transition-all',
          isRoot ? 'border-primary/60 bg-surface-container-high' : 'border-outline bg-surface-container-lowest',
          isMoving ? 'ring-2 ring-orange-400 ring-offset-2 border-orange-400 opacity-70' : '',
          isValidTarget ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1 hover:border-indigo-400' : '',
          !isMoving && !isValidTarget && !isEditing ? (isRoot ? '' : 'hover:border-primary') : '',
        ].filter(Boolean).join(' ')}
        onClick={isValidTarget ? () => onPlaceUnder(node.id) : undefined}
      >
        {isEditing ? (
          <div className="flex flex-col gap-1">
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit(node.id, draftTitle);
                if (e.key === 'Escape') onCancelEdit();
              }}
              className="text-sm font-semibold text-center border border-primary/40 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 w-full"
              maxLength={100}
            />
            <div className="flex justify-center gap-1 mt-0.5">
              <button onClick={() => onSaveEdit(node.id, draftTitle)}
                className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                Save
              </button>
              <button onClick={onCancelEdit}
                className="text-xs px-2 py-0.5 bg-surface-container text-on-surface-variant rounded hover:bg-surface-container-high">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <span className={`text-sm font-semibold break-words ${isRoot ? 'text-primary' : 'text-on-surface'}`}>
            {node.title}
          </span>
        )}
      </div>

      {/* Rename / move / delete — hover toolbar */}
      {editMode && !isEditing && !isMoving && movingId === null && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-surface-container-lowest border border-outline-variant rounded-md shadow-sm px-1 py-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-10 whitespace-nowrap">
          <button onClick={() => onStartEdit(node)}
            className="text-on-surface-variant hover:text-primary px-1 py-0.5 text-xs rounded" title="Rename">✎</button>
          <button onClick={() => onMove(node.id)}
            className="text-on-surface-variant hover:text-orange-500 px-1 py-0.5 text-xs rounded" title="Move">⇄</button>
          <button onClick={() => onDelete(node.id)}
            className="text-on-surface-variant hover:text-red-600 px-1 py-0.5 text-xs rounded" title="Delete">×</button>
        </div>
      )}

      {/* Always-visible "+ Add child" button in edit mode */}
      {editMode && !isEditing && !isMoving && movingId === null && (
        <button
          onClick={() => onStartAdd(node.id)}
          className="mt-1.5 text-xs text-on-surface-variant hover:text-primary border border-dashed border-outline hover:border-indigo-400 hover:bg-indigo-50 px-2 py-0.5 rounded-full transition-colors"
        >
          + child
        </button>
      )}

      {/* Moving node: "Cancel move" */}
      {isMoving && (
        <button
          onClick={onCancelMove}
          className="mt-1.5 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-300 rounded-full hover:bg-orange-200"
        >
          ✕ Cancel
        </button>
      )}

      {/* Valid target: "Place here" */}
      {isValidTarget && (
        <button
          onClick={() => onPlaceUnder(node.id)}
          className="mt-1.5 text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow"
        >
          ↳ Place here
        </button>
      )}
    </div>
  );
}

// ─── Inline Add Form ─────────────────────────────────────────────────────────

function AddForm({ onSave, onCancel }: { onSave: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 0); }, []);

  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 border-dashed border-primary/40 bg-indigo-50 min-w-[130px] max-w-[200px] w-max">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) onSave(title.trim());
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Position title…"
        maxLength={100}
        className="text-sm text-center border border-primary/40 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary w-full bg-surface-container-lowest"
      />
      <div className="flex gap-1">
        <button onClick={() => title.trim() && onSave(title.trim())} disabled={!title.trim()}
          className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40">
          Add
        </button>
        <button onClick={onCancel}
          className="text-xs px-2 py-0.5 bg-surface-container text-on-surface-variant rounded hover:bg-surface-container-high">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Tree Node (recursive) ───────────────────────────────────────────────────

function TreeNode({
  node, isRoot, editMode, editingId, addingChildOf,
  movingId, moveDescendantIds,
  onStartEdit, onSaveEdit, onCancelEdit, onStartAdd, onDelete,
  onSaveAdd, onCancelAdd, onMove, onPlaceUnder, onCancelMove,
}: {
  node: OrgTreeNode;
  isRoot: boolean;
  editMode: boolean;
  editingId: string | null;
  addingChildOf: string | null;
  movingId: string | null;
  moveDescendantIds: Set<string>;
  onStartEdit: (node: OrgTreeNode) => void;
  onSaveEdit: (id: string, title: string) => void;
  onCancelEdit: () => void;
  onStartAdd: (parentId: string) => void;
  onDelete: (id: string) => void;
  onSaveAdd: (title: string) => void;
  onCancelAdd: () => void;
  onMove: (id: string) => void;
  onPlaceUnder: (parentId: string) => void;
  onCancelMove: () => void;
}) {
  const showAddForm = addingChildOf === node.id;
  const childrenPlusAdd = showAddForm ? [...node.children, null] : node.children;
  const hasChildren = childrenPlusAdd.length > 0;

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        node={node} isRoot={isRoot} editMode={editMode}
        editingId={editingId} movingId={movingId} moveDescendantIds={moveDescendantIds}
        onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit}
        onStartAdd={onStartAdd} onDelete={onDelete}
        onMove={onMove} onPlaceUnder={onPlaceUnder} onCancelMove={onCancelMove}
      />

      {hasChildren && (
        <>
          <div className="w-px h-8 bg-outline-variant" />
          <div className="flex items-start">
            {childrenPlusAdd.map((child, i) => {
              const isFirst = i === 0;
              const isLast = i === childrenPlusAdd.length - 1;
              const isOnly = childrenPlusAdd.length === 1;
              return (
                <div key={child?.id ?? '__add'} className="relative flex flex-col items-center px-6">
                  {isOnly ? (
                    <div className="w-px h-8 bg-outline-variant" />
                  ) : (
                    <>
                      <div className={`absolute top-0 h-px bg-outline-variant ${
                        isFirst ? 'left-1/2 right-0' : isLast ? 'left-0 right-1/2' : 'inset-x-0'
                      }`} />
                      <div className="w-px h-8 bg-outline-variant" />
                    </>
                  )}
                  {child === null ? (
                    <AddForm onSave={onSaveAdd} onCancel={onCancelAdd} />
                  ) : (
                    <TreeNode
                      node={child} isRoot={false} editMode={editMode}
                      editingId={editingId} addingChildOf={addingChildOf}
                      movingId={movingId} moveDescendantIds={moveDescendantIds}
                      onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit}
                      onStartAdd={onStartAdd} onDelete={onDelete}
                      onSaveAdd={onSaveAdd} onCancelAdd={onCancelAdd}
                      onMove={onMove} onPlaceUnder={onPlaceUnder} onCancelMove={onCancelMove}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OrganogramPage() {
  const router = useRouter();
  const toast = useToast();
  const [viewer, setViewer] = useState<User | null>(null);
  const [nodes, setNodes] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingChildOf, setAddingChildOf] = useState<string | 'root' | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const moveDescendantIds = useMemo(
    () => (movingId ? getDescendantIds(movingId, nodes) : new Set<string>()),
    [movingId, nodes],
  );

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser) { router.push('/login'); return; }
    setViewer(currentUser);
    try {
      const data = await orgChartApi.getAll();
      setNodes(data);
    } catch (err) {
      console.error('Failed to load organogram:', err);
    } finally {
      setLoading(false);
    }
  };

  const reload = async () => {
    const data = await orgChartApi.getAll();
    setNodes(data);
  };

  const handleStartEdit = (node: OrgTreeNode) => { setAddingChildOf(null); setEditingId(node.id); };
  const handleSaveEdit = async (id: string, title: string) => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await orgChartApi.update(id, { title: title.trim() });
      setEditingId(null);
      await reload();
    } catch (err: any) { toast.error(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };
  const handleCancelEdit = () => setEditingId(null);

  const handleStartAdd = (parentId: string | 'root') => { setEditingId(null); setAddingChildOf(parentId); };
  const handleSaveAdd = async (title: string) => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await orgChartApi.create({ title: title.trim(), parentId: addingChildOf === 'root' ? null : addingChildOf });
      setAddingChildOf(null);
      await reload();
    } catch (err: any) { toast.error(err.message || 'Failed to add position'); }
    finally { setSaving(false); }
  };
  const handleCancelAdd = () => setAddingChildOf(null);

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await orgChartApi.delete(id);
      setEditingId(null); setAddingChildOf(null);
      await reload();
    } catch (err: any) { toast.error(err.message || 'Failed to delete'); }
    finally { setSaving(false); }
  };

  // ── Move handlers ──────────────────────────────────────────────────────────

  const handleMove = (id: string) => {
    setMovingId(id);
    setEditingId(null);
    setAddingChildOf(null);
  };

  const handleCancelMove = () => setMovingId(null);

  const handlePlaceUnder = async (newParentId: string | null) => {
    if (!movingId) return;
    const moving = nodes.find(n => n.id === movingId);
    if (moving?.parentId === newParentId) { setMovingId(null); return; } // no-op
    setSaving(true);
    try {
      await orgChartApi.update(movingId, { parentId: newParentId });
      setMovingId(null);
      await reload();
    } catch (err: any) { toast.error(err.message || 'Failed to move position'); }
    finally { setSaving(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 animate-pulse">
          <div className="h-4 bg-surface-container-high rounded w-32 mb-4" />
          <div className="h-7 bg-surface-container-high rounded w-48 mb-1" />
        </div>
        <div className="flex justify-center pt-16">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-40 bg-surface-container-high rounded-xl animate-pulse" />
            <div className="w-px h-8 bg-surface-container-high" />
            <div className="flex gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 w-32 bg-surface-container-high rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!viewer) return null;

  const isAdmin = viewer.role === 'ADMIN';
  const backHref = `/${viewer.role.toLowerCase()}`;
  const tree = buildTree(nodes);
  const topLevelItems: (OrgTreeNode | null)[] = addingChildOf === 'root' ? [...tree, null] : tree;
  const isEmpty = nodes.length === 0 && addingChildOf !== 'root';
  const isInMoveMode = movingId !== null;

  const sharedNodeProps = {
    editMode, editingId,
    addingChildOf: addingChildOf as string | null,
    movingId, moveDescendantIds,
    onStartEdit: handleStartEdit, onSaveEdit: handleSaveEdit, onCancelEdit: handleCancelEdit,
    onStartAdd: handleStartAdd, onDelete: handleDelete,
    onSaveAdd: handleSaveAdd, onCancelAdd: handleCancelAdd,
    onMove: handleMove, onPlaceUnder: handlePlaceUnder, onCancelMove: handleCancelMove,
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <BackButton href={backHref} label="Back to Dashboard" />
          <h1 className="text-2xl font-bold text-on-surface">Company Organogram</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Organisational hierarchy</p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 mt-1 flex-shrink-0">
            {editMode && !isInMoveMode && (
              <button
                onClick={() => handleStartAdd('root')}
                disabled={saving || addingChildOf === 'root'}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border border-dashed border-indigo-400 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Add root position
              </button>
            )}
            <button
              onClick={() => { setEditMode((v) => !v); setEditingId(null); setAddingChildOf(null); setMovingId(null); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                editMode ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                         : 'bg-surface-container-lowest text-on-surface-variant border-outline hover:bg-surface-container-low'
              }`}
            >
              {editMode ? '✓ Done editing' : '✎ Edit'}
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="space-y-8">
          <div className="flex flex-col items-center text-center py-6">
            <p className="text-on-surface-variant font-medium mb-1">No organogram has been set up yet.</p>
            {isAdmin ? (
              <p className="text-on-surface-variant text-sm">
                Click <span className="font-semibold text-indigo-600">✎ Edit</span> then{' '}
                <span className="font-semibold text-indigo-600">+ Add root position</span> to build your chart.
              </p>
            ) : (
              <p className="text-on-surface-variant text-sm">Your admin hasn't created an organogram yet.</p>
            )}
          </div>
          <div className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-8">
            <p className="text-center text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-8">
              Example — how it will look
            </p>
            <div className="overflow-x-auto">
              <div className="inline-flex min-w-full justify-center">
                <div className="flex flex-col items-center opacity-60">
                  <div className="px-5 py-3 rounded-xl border-2 border-primary/40 bg-indigo-50 shadow-sm text-sm font-semibold text-indigo-800 whitespace-nowrap">
                    Chief Executive Officer
                  </div>
                  <div className="w-px h-8 bg-outline-variant" />
                  <div className="flex items-start">
                    {[
                      { label: 'Chief Technology Officer', pos: 'first' },
                      { label: 'Chief Financial Officer', pos: 'mid' },
                      { label: 'Chief Operating Officer', pos: 'last' },
                    ].map(({ label, pos }) => (
                      <div key={label} className="relative flex flex-col items-center px-6">
                        <div className={`absolute top-0 h-px bg-outline-variant ${pos === 'first' ? 'left-1/2 right-0' : pos === 'last' ? 'left-0 right-1/2' : 'inset-x-0'}`} />
                        <div className="w-px h-8 bg-outline-variant" />
                        <div className="px-4 py-2.5 rounded-xl border-2 border-outline bg-surface-container-lowest shadow-sm text-sm font-semibold text-on-surface-variant whitespace-nowrap">
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-on-surface-variant mt-8">
              Position titles are custom — use whatever makes sense for your organisation.
            </p>
          </div>
        </div>
      )}

      {/* Tree canvas */}
      {!isEmpty && (
        <>
          {/* Move mode: "Make top-level" strip */}
          {editMode && isInMoveMode && (
            <button
              onClick={() => handlePlaceUnder(null)}
              className="w-full mb-4 py-3 border-2 border-dashed border-orange-300 rounded-xl text-sm text-orange-600 hover:bg-orange-50 hover:border-orange-400 transition-colors"
            >
              ↑ Make top-level (no parent)
            </button>
          )}

          <div className="overflow-x-auto overflow-y-visible pb-12">
            <div className="inline-flex min-w-full justify-center pt-4">
              {topLevelItems.length === 1 && topLevelItems[0] !== null ? (
                <TreeNode node={topLevelItems[0]} isRoot {...sharedNodeProps} />
              ) : (
                <div className="flex items-start gap-8 flex-wrap justify-center">
                  {topLevelItems.map((node) =>
                    node === null ? (
                      <AddForm key="__root_add" onSave={handleSaveAdd} onCancel={handleCancelAdd} />
                    ) : (
                      <TreeNode key={node.id} node={node} isRoot {...sharedNodeProps} />
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Hint */}
      {editMode && !isEmpty && (
        <p className="text-center text-xs text-on-surface-variant mt-2">
          {isInMoveMode
            ? 'Click any box to move the selected position there — or click "↑ Make top-level" above'
            : 'Click "+ child" under any box to add a position below it • Hover a box to rename ✎, move ⇄, or delete ×'}
        </p>
      )}
    </div>
  );
}
