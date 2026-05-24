import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Network as NetworkIcon } from 'lucide-react';

/**
 * MerkleDagVisualizer
 * --------------------
 * Pure-SVG visualization of a Merkle DAG.
 *
 * Layout strategy (deterministic — no force simulation needed):
 *   - The DAG is a linear chain (each leaf points to the previous one), so we
 *     lay nodes out left-to-right.
 *   - To avoid visual monotony we add a controlled vertical jitter derived from
 *     the first bytes of each node hash (deterministic and stable).
 *   - The Merkle root is rendered as a special "anchor" node at the top, with
 *     edges fanning down to the bottom layer (chain).
 *
 * Interactions:
 *   - Click a node to view its hash + ceremony ID.
 *   - Mouse-wheel or buttons to zoom.
 *   - Drag the canvas to pan.
 */
export default function MerkleDagVisualizer({ graph, height = 480 }) {
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [selected, setSelected] = useState(null);

  const layout = useMemo(() => {
    if (!graph?.nodes?.length) return { nodes: [], links: [], rootNode: null, width: 0 };
    const nodes = graph.nodes;
    // Cap rendered nodes for performance (chain is sequential, sampling preserves shape)
    const maxRender = 80;
    const stride = Math.max(1, Math.ceil(nodes.length / maxRender));
    const rendered = nodes.filter((_, i) => i % stride === 0);
    // Always include first & last
    if (rendered[rendered.length - 1] !== nodes[nodes.length - 1]) {
      rendered.push(nodes[nodes.length - 1]);
    }

    const xStep = 110;
    const yBase = 280;
    const yJitter = 90;
    const width = Math.max(800, rendered.length * xStep + 120);

    const positioned = rendered.map((n, i) => {
      // Deterministic vertical jitter from first 2 hex chars of hash
      const hashByte = parseInt((n.node_hash || '00').slice(0, 2), 16);
      const offset = ((hashByte / 255) - 0.5) * yJitter;
      return {
        ...n,
        x: 60 + i * xStep,
        y: yBase + offset,
        renderedIndex: i,
      };
    });

    const links = [];
    for (let i = 1; i < positioned.length; i++) {
      links.push({
        source: positioned[i - 1],
        target: positioned[i],
        id: `link-${i}`,
      });
    }

    const rootNode = graph.anchor
      ? {
          id: 'root',
          x: width / 2,
          y: 60,
          isRoot: true,
          hash: graph.anchor.root,
          hederaTx: graph.anchor.hedera_transaction_id,
          builtAt: graph.anchor.built_at,
        }
      : null;

    return { nodes: positioned, links, rootNode, width };
  }, [graph]);

  // Wheel zoom
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e) => {
      if (!e.shiftKey) return; // only zoom on shift+wheel to avoid hijacking scroll
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onMouseDown = (e) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };
  const onMouseUp = () => setDragging(false);
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  if (!graph?.nodes?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-md">
        <NetworkIcon className="w-10 h-10 mb-3" />
        <p className="text-sm">No graph nodes to visualize.</p>
      </div>
    );
  }

  return (
    <div className="relative border border-slate-200 rounded-md overflow-hidden bg-navy-900" data-testid="merkle-dag-viz">
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <button onClick={() => setZoom((z) => Math.min(3, z * 1.2))} className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-md backdrop-blur-sm" title="Zoom in" data-testid="dag-zoom-in">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setZoom((z) => Math.max(0.3, z * 0.83))} className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-md backdrop-blur-sm" title="Zoom out" data-testid="dag-zoom-out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button onClick={reset} className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-md backdrop-blur-sm" title="Reset view" data-testid="dag-reset">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 text-[10px] text-white/80 bg-white/5 backdrop-blur-sm p-2 rounded">
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-coral-400" /> Merkle root</div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Chain node</div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Selected</div>
        <div className="text-[9px] text-white/50 mt-1 italic">shift + wheel to zoom · drag to pan</div>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${layout.width} ${height + 100}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      >
        <defs>
          <radialGradient id="rootGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="chainLink" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.3" />
          </linearGradient>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" opacity="0.6" />
          </marker>
        </defs>

        {/* Background grid dots */}
        <pattern id="dotGrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.6" fill="#ffffff" opacity="0.06" />
        </pattern>
        <rect x="0" y="0" width={layout.width} height={height + 100} fill="url(#dotGrid)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Root glow + edges down to a sample of chain nodes */}
          {layout.rootNode && (
            <>
              <circle cx={layout.rootNode.x} cy={layout.rootNode.y} r="60" fill="url(#rootGlow)" />
              {/* Sample 6 evenly-spaced fan-out edges to evoke the merkle tree */}
              {layout.nodes.filter((_, i) => i % Math.max(1, Math.floor(layout.nodes.length / 6)) === 0).map((n) => (
                <line
                  key={`root-edge-${n.id}`}
                  x1={layout.rootNode.x} y1={layout.rootNode.y + 18}
                  x2={n.x} y2={n.y - 18}
                  stroke="#fb923c" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3,3"
                />
              ))}
            </>
          )}

          {/* Chain links */}
          {layout.links.map((l) => (
            <line
              key={l.id}
              x1={l.source.x} y1={l.source.y}
              x2={l.target.x} y2={l.target.y}
              stroke="url(#chainLink)" strokeWidth="2"
              markerEnd="url(#arrow)"
            />
          ))}

          {/* Chain nodes */}
          {layout.nodes.map((n) => {
            const isSelected = selected?.id === n.id;
            const color = isSelected ? '#fbbf24' : '#34d399';
            return (
              <g key={n.id} onClick={(e) => { e.stopPropagation(); setSelected(n); }} style={{ cursor: 'pointer' }}>
                <circle cx={n.x} cy={n.y} r={isSelected ? 11 : 8} fill={color} stroke="#0f172a" strokeWidth="1.5" />
                <text x={n.x} y={n.y - 16} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="ui-monospace, monospace">
                  {n.renderedIndex + 1}
                </text>
              </g>
            );
          })}

          {/* Root node (drawn last so it sits on top) */}
          {layout.rootNode && (
            <g onClick={(e) => { e.stopPropagation(); setSelected(layout.rootNode); }} style={{ cursor: 'pointer' }}>
              <circle cx={layout.rootNode.x} cy={layout.rootNode.y} r="18" fill="#fb923c" stroke="#fff" strokeWidth="2.5" />
              <text x={layout.rootNode.x} y={layout.rootNode.y + 4} textAnchor="middle" fontSize="11" fill="#0f172a" fontFamily="ui-monospace, monospace" fontWeight="700">R</text>
              <text x={layout.rootNode.x} y={layout.rootNode.y - 30} textAnchor="middle" fontSize="11" fill="#fb923c" fontFamily="serif" fontStyle="italic">Merkle root</text>
            </g>
          )}
        </g>
      </svg>

      {/* Detail panel */}
      {selected && (
        <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-md p-3 shadow-lg z-10" data-testid="dag-detail">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-wider uppercase text-coral-600">
                {selected.isRoot ? 'Merkle root anchor' : `Chain node #${selected.renderedIndex + 1}`}
              </p>
              {selected.ceremony_id && (
                <p className="text-xs font-mono text-slate-700 mt-1">Ceremony: {selected.ceremony_id}</p>
              )}
              <p className="text-[10px] font-mono text-slate-500 mt-1 break-all">
                {(selected.isRoot ? selected.hash : selected.node_hash) || '(no hash)'}
              </p>
              {selected.isRoot && selected.hederaTx && (
                <p className="text-[10px] font-mono text-emerald-700 mt-1 break-all">
                  Hedera: {selected.hederaTx}
                </p>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-xs px-2" data-testid="dag-close-detail">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
