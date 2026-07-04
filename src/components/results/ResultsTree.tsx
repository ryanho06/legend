import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ResultNode } from "../../data/results";

/**
 * Epic-style category navigator for Results Review. Parent nodes expand and
 * collapse; any node can be selected to drive the grid on the right.
 */
export function ResultsTree({
  tree,
  selected,
  onSelect,
}: {
  tree: ResultNode[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="results-tree">
      <div className="results-tree-head">Result Categories</div>
      <ul className="results-tree-list">
        {tree.map((node) => (
          <TreeItem key={node.id} node={node} depth={0} selected={selected} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );
}

function TreeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: ResultNode;
  depth: number;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = !!node.children?.length;

  return (
    <li>
      <div
        className={`results-tree-row${node.id === selected ? " selected" : ""}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(node.id)}
      >
        <button
          className="results-tree-twisty"
          aria-label={hasChildren ? (open ? "Collapse" : "Expand") : undefined}
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) setOpen((value) => !value);
          }}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : null}
        </button>
        <span className="results-tree-label">{node.label}</span>
        {node.abnormal ? <span className="results-tree-badge">{node.abnormal}</span> : null}
      </div>

      {hasChildren && open && (
        <ul className="results-tree-list">
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
