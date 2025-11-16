(() => {
  const NODE_TYPES = [
    { type: 'Thalamus', label: 'Thalamus', description: 'Central relay station' },
    { type: 'Cortex', label: 'Cortex', description: 'Outer brain layer' },
    { type: 'Critic', label: 'Critic', description: 'Evaluation module' },
    { type: 'MemHub (D1)', label: 'MemHub (D1)', description: 'Memory hub D1' },
    { type: 'Vector DB', label: 'Vector DB', description: 'Vector database' },
    { type: 'Episodic Worker', label: 'Episodic Worker', description: 'Episodic memory worker' },
    { type: 'Semantic Worker', label: 'Semantic Worker', description: 'Semantic processing worker' },
    { type: 'Procedural Worker', label: 'Procedural Worker', description: 'Procedural processing worker' },
    { type: 'Reflective Worker', label: 'Reflective Worker', description: 'Reflection worker' },
    { type: 'Relational Worker', label: 'Relational Worker', description: 'Relational reasoning worker' },
    { type: 'Custom', label: 'Custom', description: '' },
  ];
  let nodes = [];
  let edges = [];
  let selectedNodeId = null;
  let connectingEdge = null;
  // When set, indicates that the user clicked a handle to start a connection
  let pendingConnectionSourceId = null;
  // For marquee and multi-select
  let isMarqueeActive = false;
  let marqueeStart = null;
  // Whether the marquee has actually begun (moved past threshold)
  let marqueeStarted = false;
  const MARQUEE_THRESHOLD = 6; // pixels before we show/resize marquee
  const paletteContainer = document.querySelector('#palette .palette-items');
  const canvas = document.getElementById('canvas');
  const edgesLayer = document.getElementById('edges-layer');
  const inspector = document.getElementById('inspector');
  const exportBtn = document.getElementById('exportBtn');
  const nodeNameInput = document.getElementById('nodeName');
  const nodeDescInput = document.getElementById('nodeDesc');
  const nodeStatusSelect = document.getElementById('nodeStatus');
  const nodeCodeInput = document.getElementById('nodeCode');
  const inspectorTabButtons = document.querySelectorAll('.inspector-tab');
  const openJsonBtn = document.getElementById('openJson');
  const saveJsonBtn = document.getElementById('saveJson');
  const exportPngMenuBtn = document.getElementById('exportPngMenu');
  const undoBtnMenu = document.getElementById('undoBtn');
  const redoBtnMenu = document.getElementById('redoBtn');
  const togglePaletteBtn = document.getElementById('togglePalette');
  const toggleInspectorBtn = document.getElementById('toggleInspector');
  const fileInput = document.getElementById('fileInput');
  const selectionBox = document.getElementById('selectionBox');
  const contextMenu = document.getElementById('contextMenu');
  const edgeModal = document.getElementById('edgeModal');
  const edgeListEl = document.getElementById('edgeList');
  const edgeAddTargetBtn = document.getElementById('edgeAddTargetBtn');
  const edgeAddTargetDropdown = document.getElementById('edgeAddTargetDropdown');
  let edgeAddSelectedId = null;
  const edgeModalClose = document.getElementById('edgeModalClose');
  const edgeModalMinimize = document.getElementById('edgeModalMinimize');
  const modalTray = document.getElementById('modalTray');
    // Minimized modals tracking
    let minimizedModals = [];
  let selectedNodeIds = new Set();
  const STORAGE_KEY = 'fomModelerCurrentProject';
  const storage = (() => {
    try {
      return window.localStorage;
    } catch (err) {
      console.warn('localStorage unavailable; project persistence disabled.', err);
      return null;
    }
  })();

  // Undo/Redo history stacks
  let undoStack = [];
  let redoStack = [];

  // Auto-save uses a single localStorage entry to hold the latest project snapshot.
  let isPerformingUndoRedo = false;
  const uuid = () => 'n-' + Math.random().toString(36).substr(2, 9);

  /**
   * Push the current state of nodes and edges onto the undo stack.
   * Clears the redo stack to maintain history consistency.
   */
  function pushHistory() {
    if (isPerformingUndoRedo) return;
    const snapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    undoStack.push(snapshot);
    // Limit history depth to prevent unbounded growth (optional, here keep last 50 states)
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  }

  /**
   * Restore the previous state from the undo stack and push the current state to the redo stack.
   */
  function undo() {
    if (undoStack.length <= 1) return;
    const current = undoStack.pop();
    redoStack.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    const previous = undoStack[undoStack.length - 1];
    isPerformingUndoRedo = true;
    nodes = JSON.parse(JSON.stringify(previous.nodes));
    edges = JSON.parse(JSON.stringify(previous.edges));
    renderState();
    saveState();
    isPerformingUndoRedo = false;
  }

  /**
   * Restore the next state from the redo stack and push the current state to the undo stack.
   */
  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop();
    undoStack.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    isPerformingUndoRedo = true;
    nodes = JSON.parse(JSON.stringify(next.nodes));
    edges = JSON.parse(JSON.stringify(next.edges));
    renderState();
    saveState();
    isPerformingUndoRedo = false;
  }
  function initPalette() {
    NODE_TYPES.forEach((def) => {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.textContent = def.label;
      item.draggable = true;
      item.dataset.type = def.type;
      item.addEventListener('dragstart', (ev) => {
        // Provide node type on drag for HTML5 drag-and-drop
        ev.dataTransfer.setData('application/fom-node-type', def.type);
      });
      // Also allow click to add the node at a default position for environments where drag-and-drop is not supported
      item.addEventListener('click', () => {
        // Place new node relative to the number of existing nodes
        const x = 250 + (nodes.length * 20) % (canvas.clientWidth - 300);
        const y = 100 + (nodes.length * 60) % (canvas.clientHeight - 200);
        addNode(def.type, x, y);
      });
      paletteContainer.appendChild(item);
    });
  }
  function createNodeElement(node) {
    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.id = node.id; // ensure id present for queries
    // right-click context menu
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      showContextMenuFor(node.id, ev.clientX, ev.clientY);
    });
    // Apply status class for border color
    const statusClass = (node.status || 'Planned').toLowerCase().replace(/\s+/g, '-');
    el.classList.add(statusClass);
    el.dataset.id = node.id;
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    const title = document.createElement('div');
    title.className = 'node-title';
    title.textContent = node.label;
    el.appendChild(title);
    const status = document.createElement('div');
    status.className = 'node-status';
    status.textContent = node.status || 'Planned';
    el.appendChild(status);
    const handle = document.createElement('div');
    handle.className = 'node-handle';
    // Support drag‑start connection on mousedown
    handle.addEventListener('mousedown', (ev) => {
      // Prevent node dragging when clicking the handle
      ev.stopPropagation();
      // Start a drag connection from this node when pressing the handle
      startConnecting(node.id, ev);
    });
    // Also support click‑to‑connect: clicking a handle selects the source,
    // then clicking another node body completes the connection
    handle.addEventListener('click', (ev) => {
      // Mark this node as the source for a new connection. Do not stop propagation so that the canvas click handler can detect the target.
      pendingConnectionSourceId = node.id;
    });
    el.appendChild(handle);
    el.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      if (ev.target === handle) return;
      // If node isn't part of current selection, select it (single)
      if (!selectedNodeIds.has(node.id)) selectNode(node.id);
      startDraggingNode(node.id, ev);
    });
    // On click, select this node. Connections are handled globally on the canvas click handler.
    el.addEventListener('click', (ev) => {
      selectNode(node.id);
    });
    canvas.appendChild(el);
    return el;
  }
  function addNode(type, x, y) {
    const def = NODE_TYPES.find((n) => n.type === type) || { label: type, description: '' };
    const node = {
      id: uuid(),
      type,
      x,
      y,
      label: def.label,
      description: def.description,
      status: 'Planned',
    };
    nodes.push(node);
    // Record history for undo/redo
    pushHistory();
    createNodeElement(node);
    saveState();
  }
  canvas.addEventListener('dragover', (ev) => {
    ev.preventDefault();
  });
  canvas.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const type = ev.dataTransfer.getData('application/fom-node-type');
    if (!type) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    addNode(type, x, y);
  });

  // Global click handler on canvas for completing connections.
  // When a handle is clicked, pendingConnectionSourceId is set.
  // When the next click occurs on a node (not its handle), create an edge.
  // Canvas click/drag handlers: handle marquee selection and click-to-connect
  canvas.addEventListener('mousedown', (ev) => {
    // Start marquee only when clicking the canvas background or the edge overlays
    if (ev.button !== 0) return;
    const target = ev.target;
    const edgeCanvas = document.getElementById('edgeCanvas');
    const clickedOnCanvasBackground = (target === canvas || target === edgesLayer || target === edgeCanvas);
    if (!clickedOnCanvasBackground) return; // don't start marquee when clicking nodes or UI
    isMarqueeActive = true;
    marqueeStart = { x: ev.clientX, y: ev.clientY };
    const rect = canvas.getBoundingClientRect();
    // initialize selection box with a small visible size so it doesn't appear as a single pixel
    selectionBox.style.left = (marqueeStart.x - rect.left) + 'px';
    selectionBox.style.top = (marqueeStart.y - rect.top) + 'px';
    selectionBox.style.width = '2px';
    selectionBox.style.height = '2px';
    selectionBox.style.display = '';
    // change cursor for clarity
    document.body.style.cursor = 'crosshair';
    marqueeStarted = false;
    document.addEventListener('mousemove', onMarqueeMove);
    document.addEventListener('mouseup', onMarqueeUp);
  });
  canvas.addEventListener('click', (ev) => {
    if (!pendingConnectionSourceId) return;
    const targetEl = ev.target.closest('.node');
    if (!targetEl) {
      // Clicked on empty canvas; cancel pending connection
      pendingConnectionSourceId = null;
      return;
    }
    const targetId = targetEl.dataset.id;
    if (!targetId || targetId === pendingConnectionSourceId) {
      // clicked the same node; cancel
      pendingConnectionSourceId = null;
      return;
    }
    // Create edge
    edges.push({ id: uuid(), sourceId: pendingConnectionSourceId, targetId });
    // Record history for undo/redo
    pushHistory();
    pendingConnectionSourceId = null;
    updateEdges();
    saveState();
  });

  // Marquee move / up handlers
  function onMarqueeMove(ev) {
    if (!isMarqueeActive) return;
    const dx = ev.clientX - marqueeStart.x;
    const dy = ev.clientY - marqueeStart.y;
    // Only consider the marquee "started" after the pointer has moved beyond threshold
    if (!marqueeStarted) {
      if (Math.abs(dx) < MARQUEE_THRESHOLD && Math.abs(dy) < MARQUEE_THRESHOLD) return;
      marqueeStarted = true;
    }
    const rect = canvas.getBoundingClientRect();
    const x1 = Math.min(marqueeStart.x, ev.clientX) - rect.left;
    const y1 = Math.min(marqueeStart.y, ev.clientY) - rect.top;
    const w = Math.abs(ev.clientX - marqueeStart.x);
    const h = Math.abs(ev.clientY - marqueeStart.y);
    selectionBox.style.left = x1 + 'px';
    selectionBox.style.top = y1 + 'px';
    selectionBox.style.width = Math.max(4, w) + 'px';
    selectionBox.style.height = Math.max(4, h) + 'px';
  }

  function onMarqueeUp(ev) {
    document.removeEventListener('mousemove', onMarqueeMove);
    document.removeEventListener('mouseup', onMarqueeUp);
    document.body.style.cursor = '';
    if (!isMarqueeActive) return;
    isMarqueeActive = false;
    // If the marquee never passed the threshold, treat as simple click (no selection change)
    if (!marqueeStarted) {
      selectionBox.style.display = 'none';
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x1 = Math.min(marqueeStart.x, ev.clientX) - rect.left;
    const y1 = Math.min(marqueeStart.y, ev.clientY) - rect.top;
    const x2 = Math.max(marqueeStart.x, ev.clientX) - rect.left;
    const y2 = Math.max(marqueeStart.y, ev.clientY) - rect.top;
    // Select nodes that intersect the marquee rectangle
    const newlySelected = new Set();
    nodes.forEach((n) => {
      const el = canvas.querySelector(`.node[data-id="${n.id}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx1 = r.left - rect.left;
      const ny1 = r.top - rect.top;
      const nx2 = nx1 + r.width;
      const ny2 = ny1 + r.height;
      const intersects = !(nx2 < x1 || nx1 > x2 || ny2 < y1 || ny1 > y2);
      if (intersects) newlySelected.add(n.id);
    });
    // Apply selection
    selectedNodeIds = newlySelected;
    canvas.querySelectorAll('.node').forEach((el) => {
      const id = el.dataset.id;
      if (selectedNodeIds.has(id)) el.classList.add('selected'); else el.classList.remove('selected');
    });
    // Update primary selected node and inspector (without overwriting selectedNodeIds)
    const firstId = newlySelected.values().next().value;
    if (firstId) {
      selectedNodeId = firstId;
      const node = nodes.find((n) => n.id === firstId);
      if (node && inspector) {
        inspector.classList.add('active');
        nodeNameInput.value = node.label || '';
        nodeDescInput.value = node.description || '';
        nodeStatusSelect.value = node.status || 'Planned';
        if (nodeCodeInput) {
          nodeCodeInput.value = node.code || '';
        }
      }
    }
    selectionBox.style.display = 'none';
  }
  let dragInfo = null;
  function startDraggingNode(nodeId, startEvent) {
    const isGroup = selectedNodeIds.size > 1 && selectedNodeIds.has(nodeId);
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    if (isGroup) {
      // Prepare group drag info
      const group = Array.from(selectedNodeIds).map((id) => {
        const n = nodes.find((nn) => nn.id === id);
        const el = canvas.querySelector(`.node[data-id="${id}"]`);
        return { node: n, el, origX: n.x, origY: n.y };
      });
      dragInfo = { group, startX, startY };
    } else {
      const node = nodes.find((n) => n.id === nodeId);
      const el = canvas.querySelector(`.node[data-id="${nodeId}"]`);
      const origX = node.x;
      const origY = node.y;
      dragInfo = { node, el, startX, startY, origX, origY };
    }
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }
  function onDragMove(ev) {
    if (!dragInfo) return;
    const dx = ev.clientX - dragInfo.startX;
    const dy = ev.clientY - dragInfo.startY;
    if (dragInfo.group) {
      dragInfo.group.forEach((g) => {
        g.node.x = g.origX + dx;
        g.node.y = g.origY + dy;
        if (g.el) {
          g.el.style.left = g.node.x + 'px';
          g.el.style.top = g.node.y + 'px';
        }
      });
    } else {
      dragInfo.node.x = dragInfo.origX + dx;
      dragInfo.node.y = dragInfo.origY + dy;
      dragInfo.el.style.left = dragInfo.node.x + 'px';
      dragInfo.el.style.top = dragInfo.node.y + 'px';
    }
    updateEdges();
  }
  function onDragEnd(ev) {
    if (dragInfo) {
      // Record history for undo/redo before saving
      pushHistory();
      saveState();
    }
    dragInfo = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }
  function selectNode(nodeId) {
      selectedNodeId = nodeId;
      // Keep `selectedNodeIds` in sync: single selection becomes a new set with this id
      selectedNodeIds = new Set([nodeId]);
      // Update classes for all nodes based on `selectedNodeIds`
      canvas.querySelectorAll('.node').forEach((n) => {
        const id = n.dataset.id;
        if (selectedNodeIds.has(id)) n.classList.add('selected'); else n.classList.remove('selected');
      });
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      inspector.classList.add('active');
      nodeNameInput.value = node.label || '';
      nodeDescInput.value = node.description || '';
      nodeStatusSelect.value = node.status || 'Planned';
      if (nodeCodeInput) {
        nodeCodeInput.value = node.code || '';
      }
      // Show or hide the Code tab based on whether this node is a Worker type
      const codeTabBtn = document.querySelector('.inspector-tab[data-tab="code"]');
      const infoTabBtn = document.querySelector('.inspector-tab[data-tab="info"]');
      const codeSection = document.getElementById('inspectorCode');
      const infoSection = document.getElementById('inspectorInfo');
      const isWorker = /Worker/i.test(node.type);
      if (codeTabBtn) {
        if (isWorker) {
          codeTabBtn.style.display = '';
        } else {
          codeTabBtn.style.display = 'none';
          // If code tab is currently active, switch back to info
          inspectorTabButtons.forEach((btn) => btn.classList.remove('active'));
          if (infoTabBtn) infoTabBtn.classList.add('active');
          if (infoSection) infoSection.style.display = '';
          if (codeSection) codeSection.style.display = 'none';
        }
      }
    }
  }
  nodeNameInput.addEventListener('input', () => {
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    // Record history
    pushHistory();
    node.label = nodeNameInput.value;
    const el = canvas.querySelector(`.node[data-id="${node.id}"] .node-title`);
    if (el) el.textContent = node.label;
    saveState();
  });
  nodeDescInput.addEventListener('input', () => {
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    // Record history
    pushHistory();
    node.description = nodeDescInput.value;
    saveState();
  });
  nodeStatusSelect.addEventListener('change', () => {
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    // Record history
    pushHistory();
    node.status = nodeStatusSelect.value;
    const el = canvas.querySelector(`.node[data-id="${node.id}"] .node-status`);
    if (el) el.textContent = node.status;
    // Update CSS classes for status indicator
    const nodeEl = canvas.querySelector(`.node[data-id="${node.id}"]`);
    if (nodeEl) {
      nodeEl.classList.remove('planned', 'in-progress', 'complete');
      const statusClass = node.status.toLowerCase().replace(/\s+/g, '-');
      nodeEl.classList.add(statusClass);
    }
    saveState();
  });

  // Update code content when user edits code
  if (nodeCodeInput) {
    nodeCodeInput.addEventListener('input', () => {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (!node) return;
      // Record history
      pushHistory();
      node.code = nodeCodeInput.value;
      saveState();
    });
  }
  function startConnecting(sourceId, ev) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('edge-line');
    edgesLayer.appendChild(line);
    connectingEdge = { sourceId, line };
    const sourceNode = nodes.find((n) => n.id === sourceId);
    const startPos = getNodeCenter(sourceNode);
    line.setAttribute('x1', startPos.x);
    line.setAttribute('y1', startPos.y);
    line.setAttribute('x2', startPos.x);
    line.setAttribute('y2', startPos.y);
    document.addEventListener('mousemove', onConnectMove);
    document.addEventListener('mouseup', onConnectEnd);
  }
  function onConnectMove(ev) {
    if (!connectingEdge) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    connectingEdge.line.setAttribute('x2', x);
    connectingEdge.line.setAttribute('y2', y);
  }
  function onConnectEnd(ev) {
    if (!connectingEdge) return;
    document.removeEventListener('mousemove', onConnectMove);
    document.removeEventListener('mouseup', onConnectEnd);
    const rect = canvas.getBoundingClientRect();
    const dropX = ev.clientX - rect.left;
    const dropY = ev.clientY - rect.top;
    const targetNode = nodes.find((n) => {
      const el = canvas.querySelector(`.node[data-id="${n.id}"]`);
      const elRect = el.getBoundingClientRect();
      const cx = elRect.left - rect.left;
      const cy = elRect.top - rect.top;
      return dropX >= cx && dropX <= cx + elRect.width && dropY >= cy && dropY <= cy + elRect.height;
    });
    if (targetNode && targetNode.id !== connectingEdge.sourceId) {
      edges.push({ id: uuid(), sourceId: connectingEdge.sourceId, targetId: targetNode.id });
      // Record history
      pushHistory();
      updateEdges();
      saveState();
    }
    edgesLayer.removeChild(connectingEdge.line);
    connectingEdge = null;
  }
  function getNodeCenter(node) {
    const el = canvas.querySelector(`.node[data-id="${node.id}"]`);
    const rect = el.getBoundingClientRect();
    const parentRect = canvas.getBoundingClientRect();
    return {
      x: rect.left - parentRect.left + rect.width,
      y: rect.top - parentRect.top + rect.height / 2,
    };
  }
  function updateEdges() {
    // Clear existing lines/defs before drawing new ones
    while (edgesLayer.firstChild) {
      edgesLayer.removeChild(edgesLayer.firstChild);
    }
    // Define arrowhead marker once per update
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '5');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M0,0 L6,3 L0,6 z');
    arrowPath.setAttribute('fill', '#333');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    edgesLayer.appendChild(defs);
    // Draw lines for each edge
    const nodeWidth = targetNodeWidth();
    const nodeHeight = 50; // approximate node height used for drawing
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.sourceId);
      const targetNode = nodes.find((n) => n.id === edge.targetId);
      if (!sourceNode || !targetNode) return;
      // Start at the middle right of the source node
      const startX = sourceNode.x + nodeWidth;
      const startY = sourceNode.y + nodeHeight / 2;
      // End at the middle left of the target node
      const endX = targetNode.x;
      const endY = targetNode.y + nodeHeight / 2;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('edge-line');
      // Explicitly set stroke styles for visibility
      line.setAttribute('stroke', '#333');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('x1', startX);
      line.setAttribute('y1', startY);
      line.setAttribute('x2', endX);
      line.setAttribute('y2', endY);
      line.setAttribute('marker-end', 'url(#arrowhead)');
      edgesLayer.appendChild(line);
    });
    // Update edge count display
    const edgeCountEl = document.getElementById('edgeCount');
    if (edgeCountEl) edgeCountEl.textContent = edges.length;
    // Also draw edges on the canvas overlay for cases where SVG lines are not visible
    drawEdgesCanvas();
  }

  // Draw edges on the HTML canvas overlay. This is used as a fallback to ensure visible connections.
  function drawEdgesCanvas() {
    const c = document.getElementById('edgeCanvas');
    if (!c) return;
    // Match canvas size to the canvas container
    c.width = canvas.clientWidth;
    c.height = canvas.clientHeight;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.sourceId);
      const targetNode = nodes.find((n) => n.id === edge.targetId);
      if (!sourceNode || !targetNode) return;
      const nodeWidth = targetNodeWidth();
      const nodeHeight = 50;
      const startX = sourceNode.x + nodeWidth;
      const startY = sourceNode.y + nodeHeight / 2;
      const endX = targetNode.x;
      const endY = targetNode.y + nodeHeight / 2;
      // Draw line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      // Draw arrowhead
      const angle = Math.atan2(endY - startY, endX - startX);
      const arrowLength = 8;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle - Math.PI / 6),
        endY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle + Math.PI / 6),
        endY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = '#333';
      ctx.fill();
    });
  }
  function targetNodeWidth() {
    return 120;
  }
  function saveState() {
    if (!storage) return;
    try {
      const payload = {
        nodes,
        edges,
        savedAt: new Date().toISOString(),
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to save project to localStorage', err);
    }
  }
  function loadState() {
    if (!storage) return;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.nodes)) nodes = data.nodes;
      if (Array.isArray(data.edges)) edges = data.edges;
    } catch (err) {
      console.warn('Failed to load project from localStorage', err);
    }
  }
  function renderState() {
    canvas.innerHTML = '';
    nodes.forEach((node) => {
      createNodeElement(node);
    });
    updateEdges();
  }

  // Context menu helpers
  function showContextMenuFor(nodeId, clientX, clientY) {
    console.log('showContextMenuFor called:', nodeId, clientX, clientY);
    contextMenu.style.display = 'block';
    // position relative to viewport using fixed positioning
    contextMenu.style.left = clientX + 'px';
    contextMenu.style.top = clientY + 'px';
    contextMenu.dataset.nodeId = nodeId;
    console.log('contextMenu shown at', clientX, clientY, 'display:', contextMenu.style.display, 'computed:', window.getComputedStyle(contextMenu).display);
  }
  function hideContextMenu() {
    console.log('hideContextMenu called');
    contextMenu.style.display = 'none';
    delete contextMenu.dataset.nodeId;
  }
  // delete node
  function deleteNode(nodeId) {
    nodes = nodes.filter((n) => n.id !== nodeId);
    edges = edges.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId);
    selectedNodeIds.delete(nodeId);
    if (selectedNodeId === nodeId) selectedNodeId = null;
    renderState();
    pushHistory();
  }
  function duplicateNode(nodeId) {
    const orig = nodes.find((n) => n.id === nodeId);
    if (!orig) return;
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = uuid();
    copy.x = orig.x + 24;
    copy.y = orig.y + 24;
    nodes.push(copy);
    pushHistory();
    renderState();
  }
  function openEdgeModalFor(nodeId) {
    edgeModal.style.display = 'block';
    edgeModal.dataset.nodeId = nodeId;
      edgeModal.dataset.minimized = 'false';
            // Minimize modal logic
            if (edgeModalMinimize) {
              edgeModalMinimize.addEventListener('click', () => {
                minimizeEdgeModal();
              });
            }

            function minimizeEdgeModal() {
              if (edgeModal.style.display !== 'block') return;
              edgeModal.style.display = 'none';
              edgeModal.dataset.minimized = 'true';
              // Add tab to tray
              const nodeId = edgeModal.dataset.nodeId;
              const node = nodes.find(n => n.id === nodeId);
              if (!node) return;
              // Prevent duplicate tabs
              if (minimizedModals.includes(nodeId)) return;
              minimizedModals.push(nodeId);
              const tab = document.createElement('div');
              tab.className = 'modal-tray-tab';
              tab.textContent = node.label || 'Edges';
              tab.dataset.nodeId = nodeId;
              tab.addEventListener('click', () => {
                restoreEdgeModal(nodeId);
              });
              modalTray.appendChild(tab);
            }

            function restoreEdgeModal(nodeId) {
              // Remove tab from tray
              const tab = modalTray.querySelector(`.modal-tray-tab[data-node-id="${nodeId}"]`);
              if (tab) modalTray.removeChild(tab);
              minimizedModals = minimizedModals.filter(id => id !== nodeId);
              openEdgeModalFor(nodeId);
            }

            // When closing modal, also remove from tray if present
            if (edgeModalClose) {
              edgeModalClose.addEventListener('click', () => {
                edgeModal.style.display = 'none';
                edgeModal.dataset.minimized = 'false';
                // Remove tab if present
                const nodeId = edgeModal.dataset.nodeId;
                const tab = modalTray.querySelector(`.modal-tray-tab[data-node-id="${nodeId}"]`);
                if (tab) {
                  modalTray.removeChild(tab);
                  minimizedModals = minimizedModals.filter(id => id !== nodeId);
                }
              });
            }
    // populate list
    edgeListEl.innerHTML = '';
    const related = edges.filter((e) => e.sourceId === nodeId || e.targetId === nodeId);
    related.forEach((e) => {
      const source = nodes.find((n) => n.id === e.sourceId);
      const target = nodes.find((n) => n.id === e.targetId);
      const sourceName = source ? source.label : `(unknown: ${e.sourceId})`;
      const targetName = target ? target.label : `(unknown: ${e.targetId})`;
      const row = document.createElement('div');
      row.className = 'edge-row';
      row.innerHTML = `<div>${sourceName} → ${targetName}</div>`;
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        edges = edges.filter((ee) => ee.id !== e.id);
        pushHistory();
        openEdgeModalFor(nodeId);
        updateEdges();
      });
      row.appendChild(del);
      edgeListEl.appendChild(row);
    });
    // populate add target with custom dropdown
    edgeAddTargetDropdown.innerHTML = '';
    edgeAddTargetBtn.textContent = 'Select node...';
    edgeAddSelectedId = null;
    nodes.forEach((n) => {
      if (n.id === nodeId) return;
      const opt = document.createElement('div');
      opt.style.cssText = 'padding:8px 12px; cursor:pointer; border-bottom:1px solid #eee; background:#fff;';
      opt.textContent = n.label;
      opt.dataset.nodeId = n.id;
      opt.addEventListener('mouseenter', () => {
        opt.style.background = '#f0f0f0';
        const nodeEl = canvas.querySelector(`.node[data-id="${n.id}"]`);
        if (nodeEl) nodeEl.classList.add('edge-target-hover');
      });
      opt.addEventListener('mouseleave', () => {
        opt.style.background = '#fff';
        const nodeEl = canvas.querySelector(`.node[data-id="${n.id}"]`);
        if (nodeEl) nodeEl.classList.remove('edge-target-hover');
      });
      opt.addEventListener('click', () => {
        edgeAddTargetBtn.textContent = n.label;
        edgeAddSelectedId = n.id;
        edgeAddTargetDropdown.style.display = 'none';
        // Clear hover effect on all nodes
        canvas.querySelectorAll('.node.edge-target-hover').forEach((el) => el.classList.remove('edge-target-hover'));
      });
      edgeAddTargetDropdown.appendChild(opt);
    });
  }

  // Toggle custom dropdown
  edgeAddTargetBtn.addEventListener('click', () => {
    edgeAddTargetDropdown.style.display = edgeAddTargetDropdown.style.display === 'none' ? 'block' : 'none';
  });

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (e.target !== edgeAddTargetBtn && e.target !== edgeAddTargetDropdown && !edgeAddTargetDropdown.contains(e.target)) {
      edgeAddTargetDropdown.style.display = 'none';
    }
  });

  /**
   * Save the current project to a JSON file that the user can download.
   */
  function saveProjectJson() {
    const data = { nodes, edges };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fom-modeler.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Load a project from a JSON file selected by the user.
   * @param {File} file
   */
  function openProjectJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.nodes && data.edges) {
          nodes = data.nodes;
          edges = data.edges;
          // Push loaded state to history and render. Persistence is disabled; saving is explicit.
          pushHistory();
          renderState();
        } else {
          alert('Invalid project file. Missing nodes or edges.');
        }
      } catch (err) {
        console.error('Error loading project:', err);
        alert('Failed to load project. See console for details.');
      }
    };
    reader.readAsText(file);
  }
  function exportToImage() {
    const rect = canvas.getBoundingClientRect();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = rect.width;
    exportCanvas.height = rect.height;
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.sourceId);
      const targetNode = nodes.find((n) => n.id === edge.targetId);
      if (!sourceNode || !targetNode) return;
      const start = { x: sourceNode.x + targetNodeWidth(), y: sourceNode.y + 20 };
      const end = { x: targetNode.x, y: targetNode.y + 20 };
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const arrowLength = 8;
      const arrowWidth = 5;
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - arrowLength * Math.cos(angle - Math.PI / 6),
        end.y - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        end.x - arrowLength * Math.cos(angle + Math.PI / 6),
        end.y - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    });
    nodes.forEach((node) => {
      const width = targetNodeWidth();
      const height = 50;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(node.x, node.y, width, height);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(node.label, node.x + 6, node.y + 16);
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText(node.status, node.x + 6, node.y + 32);
    });
    const dataURL = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'fom-modeler.png';
    link.click();
  }
  exportBtn.addEventListener('click', exportToImage);

  // Make edge modal draggable
  let isDraggingModal = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let modalStartX = 0;
  let modalStartY = 0;

  const modalHeader = edgeModal.querySelector('.edge-modal-header');
  const modalMaximizeBtn = document.getElementById('edgeModalMaximize');
  if (modalHeader) {
    modalHeader.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking the close or maximize button
      if (e.target.closest && (e.target.closest('.edge-modal-close') || e.target.closest('.edge-modal-maximize'))) return;
      // Don't drag when maximized
      if (edgeModal.dataset.maximized === 'true') return;
      isDraggingModal = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = edgeModal.getBoundingClientRect();
      modalStartX = rect.left - window.scrollX;
      modalStartY = rect.top - window.scrollY;
      document.addEventListener('mousemove', onModalDragMove);
      document.addEventListener('mouseup', onModalDragEnd);
    });
    // double click header to toggle maximize
    modalHeader.addEventListener('dblclick', () => {
      toggleEdgeModalMaximize();
    });
  }
  if (modalMaximizeBtn) {
    modalMaximizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleEdgeModalMaximize();
    });
  }

  function onModalDragMove(e) {
    if (!isDraggingModal) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const newX = modalStartX + dx;
    const newY = modalStartY + dy;
    edgeModal.style.left = newX + 'px';
    edgeModal.style.top = newY + 'px';
    edgeModal.style.transform = 'none';
  }

  function onModalDragEnd(e) {
    isDraggingModal = false;
    document.removeEventListener('mousemove', onModalDragMove);
    document.removeEventListener('mouseup', onModalDragEnd);
  }

  function toggleEdgeModalMaximize() {
    const maximized = edgeModal.dataset.maximized === 'true';
    if (!maximized) {
      // store current geometry
      const rect = edgeModal.getBoundingClientRect();
      edgeModal.dataset.prevLeft = rect.left - window.scrollX;
      edgeModal.dataset.prevTop = rect.top - window.scrollY;
      edgeModal.dataset.prevWidth = rect.width;
      edgeModal.dataset.prevHeight = rect.height;
      // expand to window edges with small padding
      const pad = 8;
      edgeModal.style.left = pad + 'px';
      edgeModal.style.top = pad + 'px';
      edgeModal.style.width = (window.innerWidth - pad * 2) + 'px';
      edgeModal.style.height = (window.innerHeight - pad * 2) + 'px';
      edgeModal.style.transform = 'none';
      edgeModal.dataset.maximized = 'true';
    } else {
      // restore
      edgeModal.style.left = (edgeModal.dataset.prevLeft || 100) + 'px';
      edgeModal.style.top = (edgeModal.dataset.prevTop || 100) + 'px';
      edgeModal.style.width = (edgeModal.dataset.prevWidth || 500) + 'px';
      edgeModal.style.height = (edgeModal.dataset.prevHeight || 300) + 'px';
      edgeModal.dataset.maximized = 'false';
    }
  }

  // If window resizes while modal is maximized, keep it fitting the window
  window.addEventListener('resize', () => {
    if (edgeModal.dataset.maximized === 'true') {
      const pad = 8;
      edgeModal.style.width = (window.innerWidth - pad * 2) + 'px';
      edgeModal.style.height = (window.innerHeight - pad * 2) + 'px';
    }
  });

  function init() {
    initPalette();
    loadState();
    renderState();
    // Initialize history with the loaded state
    pushHistory();
    // Attach menu event handlers
    if (openJsonBtn) {
      openJsonBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
      });
    }
    if (saveJsonBtn) {
      saveJsonBtn.addEventListener('click', () => {
        saveProjectJson();
      });
    }
    if (exportPngMenuBtn) {
      exportPngMenuBtn.addEventListener('click', () => {
        exportToImage();
      });
    }
    const newProjectBtn = document.getElementById('newProject');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        if (!confirm('Create a new project? This will clear the current canvas.')) return;
        nodes = [];
        edges = [];
        selectedNodeId = null;
        pendingConnectionSourceId = null;
        undoStack = [];
        redoStack = [];
        renderState();
        pushHistory();
        saveState();
      });
    }
    // Global click to hide context menu
    document.addEventListener('click', (ev) => {
      if (!contextMenu) return;
      if (ev.target.closest && ev.target.closest('#contextMenu')) return;
      hideContextMenu();
    });
    // Context menu actions
    contextMenu.addEventListener('click', (ev) => {
      const action = ev.target.getAttribute('data-action');
      const nodeId = contextMenu.dataset.nodeId;
      if (!action || !nodeId) return;
      if (action === 'delete') {
        if (confirm('Delete this node?')) deleteNode(nodeId);
      } else if (action === 'duplicate') {
        duplicateNode(nodeId);
      } else if (action === 'manage-edges') {
        openEdgeModalFor(nodeId);
      }
      hideContextMenu();
    });
    // Edge modal handlers
    edgeAddBtn.addEventListener('click', () => {
      const nodeId = edgeModal.dataset.nodeId;
      const targetId = edgeAddSelectedId;
      if (nodeId && targetId) {
        edges.push({ id: uuid(), sourceId: nodeId, targetId });
        pushHistory();
        updateEdges();
        openEdgeModalFor(nodeId);
      }
    });
    edgeModalClose.addEventListener('click', () => { edgeModal.style.display = 'none'; });
    // Global hide on esc
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideContextMenu(); edgeModal.style.display='none'; } });

    if (undoBtnMenu) {
      undoBtnMenu.addEventListener('click', () => {
        undo();
      });
    }
    if (redoBtnMenu) {
      redoBtnMenu.addEventListener('click', () => {
        redo();
      });
    }
    if (togglePaletteBtn) {
      togglePaletteBtn.addEventListener('click', () => {
        const palette = document.getElementById('palette');
        if (palette) palette.classList.toggle('hidden');
      });
    }
    if (toggleInspectorBtn) {
      toggleInspectorBtn.addEventListener('click', () => {
        const insp = document.getElementById('inspector');
        if (insp) insp.classList.toggle('hidden');
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) openProjectJson(file);
      });
    }
    // Inspector tab switching
    if (inspectorTabButtons && inspectorTabButtons.forEach) {
      inspectorTabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          inspectorTabButtons.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const tab = btn.getAttribute('data-tab');
          const infoSection = document.getElementById('inspectorInfo');
          const codeSection = document.getElementById('inspectorCode');
          if (tab === 'code') {
            if (infoSection) infoSection.style.display = 'none';
            if (codeSection) codeSection.style.display = '';
          } else {
            if (infoSection) infoSection.style.display = '';
            if (codeSection) codeSection.style.display = 'none';
          }
        });
      });
    }
    // Keyboard shortcuts for undo/redo
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        redo();
      }
    });
  }
  window.addEventListener('DOMContentLoaded', init);
})();
