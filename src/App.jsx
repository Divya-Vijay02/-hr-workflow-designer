// ============================================================
// HR WORKFLOW DESIGNER — Tredence Studio Case Study
// Architecture: Custom hooks | Modular nodes | Mock API layer
// Author: Divya | VIT University
// ============================================================

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  Panel,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from "reactflow";
import "reactflow/dist/style.css";

// ─────────────────────────────────────────────
// SECTION 1: CONSTANTS & TYPE DEFINITIONS
// ─────────────────────────────────────────────

/** @typedef {'startNode'|'taskNode'|'approvalNode'|'automatedNode'|'endNode'} NodeType */

const NODE_META = {
  startNode:     { label: "Start",      icon: "\u25C8", color: "#00E5A0", bg: "rgba(0,229,160,0.07)",  desc: "Workflow entry point" },
  taskNode:      { label: "Task",       icon: "\u25FB", color: "#4E9EFF", bg: "rgba(78,158,255,0.07)", desc: "Human task assignment" },
  approvalNode:  { label: "Approval",   icon: "\u25C7", color: "#B57BFF", bg: "rgba(181,123,255,0.07)",desc: "Manager review gate" },
  automatedNode: { label: "Automation", icon: "\u25CE", color: "#FF8A3D", bg: "rgba(255,138,61,0.07)", desc: "System-triggered action" },
  endNode:       { label: "End",        icon: "\u25C9", color: "#FF5C7A", bg: "rgba(255,92,122,0.07)", desc: "Workflow completion" },
};

const PALETTE_ORDER = ["startNode","taskNode","approvalNode","automatedNode","endNode"];

// ─────────────────────────────────────────────
// SECTION 2: MOCK API LAYER
// ─────────────────────────────────────────────

const MockAPI = {
  /** GET /automations */
  getAutomations: () =>
    new Promise((res) =>
      setTimeout(() => res([
        { id: "send_email",     label: "Send Email",           params: [{ key:"to", type:"text" }, { key:"subject", type:"text" }, { key:"body", type:"textarea" }] },
        { id: "generate_doc",   label: "Generate Document",    params: [{ key:"template", type:"select", options:["offer_letter","nda","policy"] }, { key:"recipient", type:"text" }] },
        { id: "notify_slack",   label: "Notify Slack",         params: [{ key:"channel", type:"text" }, { key:"message", type:"textarea" }] },
        { id: "create_ticket",  label: "Create JIRA Ticket",   params: [{ key:"project", type:"text" }, { key:"summary", type:"text" }, { key:"priority", type:"select", options:["Low","Medium","High","Critical"] }] },
        { id: "update_hris",    label: "Update HRIS Record",   params: [{ key:"employee_id", type:"text" }, { key:"field", type:"text" }, { key:"value", type:"text" }] },
        { id: "trigger_payroll",label: "Trigger Payroll Run",  params: [{ key:"cycle", type:"select", options:["monthly","biweekly","weekly"] }, { key:"department", type:"text" }] },
      ]), 250)
    ),

  /** POST /simulate */
  simulate: (workflow) =>
    new Promise((res) =>
      setTimeout(() => {
        const { nodes, edges } = workflow;
        const adj = {};
        const inDegree = {};
        nodes.forEach((n) => { adj[n.id] = []; inDegree[n.id] = 0; });
        edges.forEach((e) => { adj[e.source]?.push(e.target); inDegree[e.target] = (inDegree[e.target] || 0) + 1; });

        const errors = [];
        const startNodes = nodes.filter((n) => n.type === "startNode");
        const endNodes   = nodes.filter((n) => n.type === "endNode");
        if (startNodes.length === 0) errors.push({ type: "error", msg: "Missing Start Node — every workflow needs an entry point." });
        if (startNodes.length > 1)  errors.push({ type: "warn",  msg: `Multiple Start Nodes found (${startNodes.length}). Only one is allowed.` });
        if (endNodes.length === 0)  errors.push({ type: "error", msg: "Missing End Node — workflow has no completion state." });

        // Kahn's algorithm for topological sort + cycle detection
        const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
        const order = [];
        const tempDegree = { ...inDegree };
        while (queue.length) {
          const id = queue.shift();
          order.push(id);
          (adj[id] || []).forEach((nxt) => {
            tempDegree[nxt]--;
            if (tempDegree[nxt] === 0) queue.push(nxt);
          });
        }
        if (order.length !== nodes.length) errors.push({ type: "error", msg: "Cycle detected in workflow graph. Remove circular connections." });

        // Disconnected nodes
        const connected = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
        if (nodes.length > 1) {
          nodes.forEach((n) => {
            if (!connected.has(n.id) && n.type !== "startNode") errors.push({ type: "warn", msg: `Node "${n.data?.title || n.data?.startTitle || n.type}" is disconnected.` });
          });
        }

        // Build execution steps from topological order
        const steps = order.map((id, i) => {
          const node = nodes.find((n) => n.id === id);
          if (!node) return null;
          const d = node.data;
          const meta = NODE_META[node.type];
          const detailMap = {
            startNode:     `Initialising with title: "${d.startTitle || "Untitled"}"`,
            taskNode:      `Assigned to ${d.assignee || "Unassigned"} · Due: ${d.dueDate || "No deadline"}`,
            approvalNode:  `Routing to ${d.approverRole || "Approver"} · Auto-approve after ${d.autoApproveThreshold ?? "N/A"} day(s)`,
            automatedNode: `Executing action: ${d.actionLabel || d.actionId || "None"} · ${Object.entries(d.actionParams || {}).map(([k,v])=>`${k}=${v}`).join(", ") || "No params"}`,
            endNode:       `${d.endMessage || "Workflow complete"} · Summary: ${d.summaryFlag ? "Enabled" : "Disabled"}`,
          };
          return { id, stepNum: i + 1, type: node.type, label: d.title || d.startTitle || d.endMessage || meta.label, detail: detailMap[node.type], color: meta.color, icon: meta.icon };
        }).filter(Boolean);

        res({ success: errors.filter((e) => e.type === "error").length === 0, errors, steps });
      }, 900)
    ),
};

// ─────────────────────────────────────────────
// SECTION 3: CUSTOM HOOKS
// ─────────────────────────────────────────────

/** useAutomations — fetches and caches automation actions from mock API */
function useAutomations() {
  const [automations, setAutomations] = useState([]);
  useEffect(() => { MockAPI.getAutomations().then(setAutomations); }, []);
  return automations;
}

/** useNodeForm — manages form state for selected node */
function useNodeForm(selectedNode, setNodes) {
  const updateField = useCallback((key, value) => {
    if (!selectedNode) return;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: value } } : n
      )
    );
  }, [selectedNode, setNodes]);

  const updateData = useCallback((newData) => {
    if (!selectedNode) return;
    setNodes((ns) => ns.map((n) => n.id === selectedNode.id ? { ...n, data: newData } : n));
  }, [selectedNode, setNodes]);

  return { updateField, updateData };
}

/** useSimulation — orchestrates mock /simulate call + animated node highlighting */
function useSimulation(nodes, edges, setNodes) {
  const [state, setState] = useState({ open: false, loading: false, result: null, activeStepId: null });
  const timerRef = useRef(null);

  const open  = () => setState((s) => ({ ...s, open: true, result: null }));
  const close = () => { clearTimeout(timerRef.current); setState({ open: false, loading: false, result: null, activeStepId: null }); resetNodeStatus(); };

  const resetNodeStatus = () => setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, _status: null } })));

  const run = async () => {
    setState((s) => ({ ...s, loading: true, result: null, activeStepId: null }));
    resetNodeStatus();
    const result = await MockAPI.simulate({ nodes, edges });
    setState((s) => ({ ...s, loading: false, result }));
    // animate through steps
    result.steps.forEach((step, i) => {
      timerRef.current = setTimeout(() => {
        setState((s) => ({ ...s, activeStepId: step.id }));
        setNodes((ns) => ns.map((n) => n.id === step.id ? { ...n, data: { ...n.data, _status: "active" } } : { ...n, data: { ...n.data, _status: n.data._status === "active" ? "done" : n.data._status } }));
        if (i === result.steps.length - 1) {
          setTimeout(() => {
            setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, _status: "done" } })));
          }, 500);
        }
      }, i * 600);
    });
  };

  return { simState: state, openSandbox: open, closeSandbox: close, runSimulation: run };
}

// ─────────────────────────────────────────────
// SECTION 4: SHARED UI PRIMITIVES
// ─────────────────────────────────────────────

const css = {
  input: {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#F0F0F5", padding: "8px 12px", fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace", outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  label: {
    display: "block", fontSize: 10, color: "#5E6070", textTransform: "uppercase",
    letterSpacing: 1.4, marginBottom: 5, fontFamily: "'Syne', sans-serif", fontWeight: 700,
  },
};

function FormField({ label, children, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ ...css.label }}>{label}{required && <span style={{ color: "#FF5C7A", marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

function StyledInput({ value, onChange, placeholder, type = "text", style = {} }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value || ""} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...css.input, borderColor: focused ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)", ...style }}
    />
  );
}

function StyledTextarea({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...css.input, minHeight: 72, resize: "vertical", borderColor: focused ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)" }}
    />
  );
}

function StyledSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}
      style={{ ...css.input, cursor: "pointer" }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onChange(!value)}>
      <div style={{ width: 44, height: 24, borderRadius: 12, background: value ? "#00E5A0" : "rgba(255,255,255,0.08)", position: "relative", transition: "background 0.2s", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ position: "absolute", top: 3, left: value ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: value ? "#fff" : "#444", transition: "left 0.2s, background 0.2s", boxShadow: "0 1px 4px #0006" }} />
      </div>
      <span style={{ fontSize: 12, color: value ? "#00E5A0" : "#5E6070", fontFamily: "'JetBrains Mono', monospace" }}>{value ? "Enabled" : "Disabled"}</span>
    </div>
  );
}

function KVPairEditor({ pairs = [], onChange }) {
  const add    = () => onChange([...pairs, { key: "", value: "" }]);
  const update = (i, f, v) => { const p = [...pairs]; p[i] = { ...p[i], [f]: v }; onChange(p); };
  const remove = (i) => onChange(pairs.filter((_, idx) => idx !== i));
  return (
    <div>
      {pairs.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <input placeholder="key" value={p.key} onChange={(e) => update(i, "key", e.target.value)}
            style={{ ...css.input, flex: 1, padding: "6px 10px" }} />
          <input placeholder="value" value={p.value} onChange={(e) => update(i, "value", e.target.value)}
            style={{ ...css.input, flex: 1, padding: "6px 10px" }} />
          <button onClick={() => remove(i)} style={{ background: "rgba(255,92,122,0.1)", border: "1px solid rgba(255,92,122,0.3)", color: "#FF5C7A", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{ width: "100%", padding: "6px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", color: "#5E6070", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
        + Add field
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION 5: CUSTOM NODE COMPONENTS
// ─────────────────────────────────────────────

function WorkflowNode({ data, type, selected }) {
  const meta = NODE_META[type] || NODE_META.taskNode;
  const isStart = type === "startNode";
  const isEnd   = type === "endNode";
  const status  = data._status; // null | "active" | "done"

  const glowColor = status === "active" ? meta.color : status === "done" ? "#00E5A0" : meta.color;
  const borderColor = selected ? "#ffffff" : status ? glowColor : `${meta.color}55`;
  const boxShadow = selected
    ? `0 0 0 2px ${meta.color}44, 0 8px 40px rgba(0,0,0,0.6)`
    : status === "active"
    ? `0 0 0 2px ${meta.color}88, 0 0 20px ${meta.color}44, 0 8px 32px rgba(0,0,0,0.5)`
    : `0 4px 24px rgba(0,0,0,0.4)`;

  return (
    <div style={{
      background: status === "active"
        ? `linear-gradient(135deg, ${meta.bg}, rgba(0,0,0,0.6))`
        : "rgba(12,13,18,0.95)",
      border: `1.5px solid ${borderColor}`,
      borderRadius: 14, minWidth: 200, maxWidth: 240,
      padding: "14px 16px", boxShadow,
      transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
      backdropFilter: "blur(12px)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Subtle top gradient line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${meta.color}88, transparent)`, borderRadius: "14px 14px 0 0", opacity: selected || status ? 1 : 0.4 }} />

      {!isStart && <Handle type="target" position={Position.Top} style={{ background: meta.color, border: "2px solid #0C0D12", width: 12, height: 12, top: -6 }} />}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 15, color: meta.color, lineHeight: 1 }}>{meta.icon}</span>
          <span style={{ fontSize: 9, color: meta.color, textTransform: "uppercase", letterSpacing: 2, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{meta.label}</span>
        </div>
        {status === "done" && <span style={{ fontSize: 10, color: "#00E5A0" }}>✓</span>}
        {status === "active" && (
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, display: "inline-block", animation: "pulse 1s infinite" }} />
        )}
      </div>

      {/* Title */}
      <div style={{ fontSize: 13, color: "#F0F0F5", fontWeight: 600, lineHeight: 1.4, fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>
        {data.title || data.startTitle || data.endMessage || <span style={{ color: "#3E3F50" }}>Untitled</span>}
      </div>

      {/* Subtitle badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
        {data.assignee && <Badge color="#4E9EFF">👤 {data.assignee}</Badge>}
        {data.approverRole && <Badge color="#B57BFF">🔐 {data.approverRole}</Badge>}
        {data.actionId && <Badge color="#FF8A3D">⚙ {data.actionLabel || data.actionId}</Badge>}
        {data.dueDate && <Badge color="#4E9EFF">📅 {data.dueDate}</Badge>}
        {data.summaryFlag && <Badge color="#00E5A0">∑ Summary</Badge>}
      </div>

      {!isEnd && <Handle type="source" position={Position.Bottom} style={{ background: meta.color, border: "2px solid #0C0D12", width: 12, height: 12, bottom: -6 }} />}
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{ fontSize: 10, color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 5, padding: "2px 7px", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
      {children}
    </span>
  );
}

// Custom animated edge
function AnimatedEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data }) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: selected ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)", strokeWidth: selected ? 2 : 1.5, strokeDasharray: data?.animated ? "6 3" : "none" }} />
    </>
  );
}

const nodeTypes = {
  startNode:     (p) => <WorkflowNode {...p} type="startNode" />,
  taskNode:      (p) => <WorkflowNode {...p} type="taskNode" />,
  approvalNode:  (p) => <WorkflowNode {...p} type="approvalNode" />,
  automatedNode: (p) => <WorkflowNode {...p} type="automatedNode" />,
  endNode:       (p) => <WorkflowNode {...p} type="endNode" />,
};
const edgeTypes = { animated: AnimatedEdge };

// ─────────────────────────────────────────────
// SECTION 6: NODE CONFIGURATION FORMS
// ─────────────────────────────────────────────

function StartNodeForm({ data, onChange }) {
  return (<>
    <FormField label="Workflow Title" required>
      <StyledInput value={data.startTitle} onChange={(v) => onChange("startTitle", v)} placeholder="e.g. Employee Onboarding" />
    </FormField>
    <FormField label="Metadata Fields">
      <KVPairEditor pairs={data.metadata || []} onChange={(v) => onChange("metadata", v)} />
    </FormField>
  </>);
}

function TaskNodeForm({ data, onChange }) {
  return (<>
    <FormField label="Task Title" required>
      <StyledInput value={data.title} onChange={(v) => onChange("title", v)} placeholder="e.g. Collect Documents" />
    </FormField>
    <FormField label="Description">
      <StyledTextarea value={data.description} onChange={(v) => onChange("description", v)} placeholder="What needs to be done..." />
    </FormField>
    <FormField label="Assignee">
      <StyledInput value={data.assignee} onChange={(v) => onChange("assignee", v)} placeholder="e.g. HR Manager" />
    </FormField>
    <FormField label="Due Date">
      <StyledInput type="date" value={data.dueDate} onChange={(v) => onChange("dueDate", v)} />
    </FormField>
    <FormField label="Custom Fields">
      <KVPairEditor pairs={data.customFields || []} onChange={(v) => onChange("customFields", v)} />
    </FormField>
  </>);
}

function ApprovalNodeForm({ data, onChange }) {
  return (<>
    <FormField label="Step Title">
      <StyledInput value={data.title} onChange={(v) => onChange("title", v)} placeholder="e.g. Manager Approval" />
    </FormField>
    <FormField label="Approver Role">
      <StyledSelect value={data.approverRole} onChange={(v) => onChange("approverRole", v)}
        placeholder="Select role..."
        options={["Manager","HRBP","Director","VP of HR","C-Suite","Legal"]} />
    </FormField>
    <FormField label="Auto-approve Threshold (days)">
      <StyledInput type="number" value={data.autoApproveThreshold} onChange={(v) => onChange("autoApproveThreshold", Number(v))} placeholder="0 = disabled" />
      <div style={{ fontSize: 10, color: "#3E3F50", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
        If no action taken within N days, auto-approve
      </div>
    </FormField>
  </>);
}

function AutomatedNodeForm({ data, onChange, automations }) {
  const selectedAction = automations.find((a) => a.id === data.actionId);
  return (<>
    <FormField label="Step Title">
      <StyledInput value={data.title} onChange={(v) => onChange("title", v)} placeholder="e.g. Send Welcome Email" />
    </FormField>
    <FormField label="Action">
      <StyledSelect value={data.actionId} onChange={(v) => {
        const action = automations.find((a) => a.id === v);
        onChange("actionId", v);
        onChange("actionLabel", action?.label || "");
        onChange("actionParams", {});
      }} placeholder="Choose an action..." options={automations.map((a) => ({ value: a.id, label: a.label }))} />
    </FormField>
    {selectedAction && (
      <FormField label="Action Parameters">
        <div style={{ background: "rgba(255,138,61,0.05)", border: "1px solid rgba(255,138,61,0.15)", borderRadius: 8, padding: 12 }}>
          {selectedAction.params.map((p) => (
            <div key={p.key} style={{ marginBottom: 10 }}>
              <label style={{ ...css.label, color: "#FF8A3D88" }}>{p.key}</label>
              {p.type === "textarea" ? (
                <StyledTextarea value={(data.actionParams || {})[p.key]} onChange={(v) => onChange("actionParams", { ...(data.actionParams || {}), [p.key]: v })} placeholder={p.key} />
              ) : p.type === "select" ? (
                <StyledSelect value={(data.actionParams || {})[p.key]} onChange={(v) => onChange("actionParams", { ...(data.actionParams || {}), [p.key]: v })} options={p.options} placeholder={`Select ${p.key}...`} />
              ) : (
                <StyledInput value={(data.actionParams || {})[p.key]} onChange={(v) => onChange("actionParams", { ...(data.actionParams || {}), [p.key]: v })} placeholder={p.key} />
              )}
            </div>
          ))}
        </div>
      </FormField>
    )}
  </>);
}

function EndNodeForm({ data, onChange }) {
  return (<>
    <FormField label="Completion Message">
      <StyledInput value={data.endMessage} onChange={(v) => onChange("endMessage", v)} placeholder="e.g. Onboarding Complete!" />
    </FormField>
    <FormField label="Generate Summary Report">
      <Toggle value={data.summaryFlag} onChange={(v) => onChange("summaryFlag", v)} />
    </FormField>
  </>);
}

function NodeConfigPanel({ node, automations, updateField }) {
  if (!node) return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#3E3F50", gap: 12 }}>
      <div style={{ fontSize: 32, opacity: 0.4 }}>◈</div>
      <div style={{ fontSize: 12, fontFamily: "'Syne', sans-serif", letterSpacing: 0.5 }}>Select a node to configure</div>
    </div>
  );
  const meta = NODE_META[node.type];
  const FormMap = { startNode: StartNodeForm, taskNode: TaskNodeForm, approvalNode: ApprovalNodeForm, automatedNode: AutomatedNodeForm, endNode: EndNodeForm };
  const Form = FormMap[node.type];
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "#0E0F16", zIndex: 1 }}>
        <span style={{ fontSize: 16, color: meta.color }}>{meta.icon}</span>
        <div>
          <div style={{ fontSize: 11, color: meta.color, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>{meta.label}</div>
          <div style={{ fontSize: 10, color: "#3E3F50", fontFamily: "'JetBrains Mono', monospace" }}>{meta.desc}</div>
        </div>
      </div>
      {Form && <Form data={node.data} onChange={updateField} automations={automations} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION 7: SANDBOX / SIMULATION PANEL
// ─────────────────────────────────────────────

function SimulationPanel({ simState, onClose, onRun }) {
  const { loading, result, activeStepId } = simState;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#0E0F16", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, width: 560, maxHeight: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,229,160,0.1)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F0F0F5", fontFamily: "'Syne', sans-serif", letterSpacing: 0.5 }}>Workflow Simulation</div>
            <div style={{ fontSize: 10, color: "#3E3F50", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>POST /simulate · mock execution trace</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#5E6070", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: 24 }}>
          {/* Run button */}
          <button onClick={onRun} disabled={loading} style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: loading ? "rgba(0,229,160,0.05)" : "linear-gradient(135deg, #00E5A0, #00C880)",
            color: loading ? "#3E3F50" : "#0C0D12", fontWeight: 800, fontSize: 12, cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'Syne', sans-serif", letterSpacing: 2, textTransform: "uppercase", transition: "all 0.2s",
            boxShadow: loading ? "none" : "0 4px 20px rgba(0,229,160,0.3)",
            marginBottom: 20,
          }}>
            {loading ? "▶  Simulating..." : "▶  Run Simulation"}
          </button>

          {/* Validation errors */}
          {result?.errors?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {result.errors.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: e.type === "error" ? "rgba(255,92,122,0.08)" : "rgba(255,138,61,0.08)", border: `1px solid ${e.type === "error" ? "rgba(255,92,122,0.25)" : "rgba(255,138,61,0.25)"}`, borderRadius: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: e.type === "error" ? "#FF5C7A" : "#FF8A3D", flexShrink: 0, marginTop: 1 }}>{e.type === "error" ? "✖" : "⚠"}</span>
                  <span style={{ fontSize: 12, color: e.type === "error" ? "#FF5C7A" : "#FF8A3D", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>{e.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Step-by-step trace */}
          {result?.steps?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#3E3F50", fontFamily: "'Syne', sans-serif", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
                Execution Trace · {result.steps.length} steps
              </div>
              <div style={{ position: "relative" }}>
                {/* vertical line */}
                <div style={{ position: "absolute", left: 18, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)" }} />
                {result.steps.map((step, i) => {
                  const isActive = step.id === activeStepId;
                  return (
                    <div key={step.id} style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "flex-start", opacity: 1, animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both` }}>
                      {/* Step dot */}
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: isActive ? step.color : "rgba(255,255,255,0.04)", border: `1.5px solid ${isActive ? step.color : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.3s", boxShadow: isActive ? `0 0 12px ${step.color}66` : "none" }}>
                        <span style={{ fontSize: 14, color: isActive ? step.color : "#3E3F50" }}>{step.icon}</span>
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, background: isActive ? `${step.color}0A` : "rgba(255,255,255,0.02)", border: `1px solid ${isActive ? `${step.color}30` : "rgba(255,255,255,0.05)"}`, borderRadius: 10, padding: "10px 14px", transition: "all 0.3s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 9, color: "#3E3F50", fontFamily: "'JetBrains Mono', monospace" }}>STEP {step.stepNum}</span>
                          <span style={{ fontSize: 9, color: step.color, background: `${step.color}18`, padding: "1px 7px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>{step.type?.replace("Node","").toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#F0F0F5", fontFamily: "'Syne', sans-serif", fontWeight: 600, marginBottom: 3 }}>{step.label}</div>
                        <div style={{ fontSize: 11, color: "#5E6070", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>{step.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {result && (
                <div style={{ marginTop: 16, padding: "10px 16px", borderRadius: 10, background: result.success ? "rgba(0,229,160,0.07)" : "rgba(255,92,122,0.07)", border: `1px solid ${result.success ? "rgba(0,229,160,0.25)" : "rgba(255,92,122,0.25)"}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{result.success ? "✓" : "✖"}</span>
                  <span style={{ fontSize: 12, color: result.success ? "#00E5A0" : "#FF5C7A", fontFamily: "'JetBrains Mono', monospace" }}>{result.success ? "Workflow is valid and executable" : "Workflow has errors that must be resolved"}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION 8: INITIAL DATA
// ─────────────────────────────────────────────

const INITIAL_NODES = [
  { id: "n1", type: "startNode",     position: { x: 300, y: 40  }, data: { startTitle: "Employee Onboarding", metadata: [{ key: "version", value: "2.0" }] } },
  { id: "n2", type: "taskNode",      position: { x: 300, y: 200 }, data: { title: "Collect Documents", assignee: "HR Admin", description: "Gather all required onboarding docs including PAN, Aadhaar, degree certificates", dueDate: "2025-01-10", customFields: [{ key: "doc_count", value: "7" }] } },
  { id: "n3", type: "approvalNode",  position: { x: 300, y: 360 }, data: { title: "Manager Approval", approverRole: "Manager", autoApproveThreshold: 3 } },
  { id: "n4", type: "automatedNode", position: { x: 300, y: 520 }, data: { title: "Send Welcome Email", actionId: "send_email", actionLabel: "Send Email", actionParams: { to: "new.hire@company.com", subject: "Welcome to Tredence!" } } },
  { id: "n5", type: "endNode",       position: { x: 300, y: 680 }, data: { endMessage: "Onboarding Complete!", summaryFlag: true } },
];

const INITIAL_EDGES = [
  { id: "e1", source: "n1", target: "n2", type: "animated", data: { animated: true }, style: { stroke: "rgba(0,229,160,0.3)", strokeWidth: 1.5 } },
  { id: "e2", source: "n2", target: "n3", type: "animated", data: { animated: true }, style: { stroke: "rgba(78,158,255,0.3)", strokeWidth: 1.5 } },
  { id: "e3", source: "n3", target: "n4", type: "animated", data: { animated: true }, style: { stroke: "rgba(181,123,255,0.3)", strokeWidth: 1.5 } },
  { id: "e4", source: "n4", target: "n5", type: "animated", data: { animated: true }, style: { stroke: "rgba(255,138,61,0.3)", strokeWidth: 1.5 } },
];

// ─────────────────────────────────────────────
// SECTION 9: MAIN APP
// ─────────────────────────────────────────────

let idCounter = 200;

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [workflowName, setWorkflowName] = useState("Employee Onboarding");
  const [editingName, setEditingName] = useState(false);

  const automations    = useAutomations();
  const { updateField, updateData } = useNodeForm(selectedNode, setNodes);
  const { simState, openSandbox, closeSandbox, runSimulation } = useSimulation(nodes, edges, setNodes);

  // Keep selectedNode in sync with nodes state
  useEffect(() => {
    if (selectedNode) {
      const updated = nodes.find((n) => n.id === selectedNode.id);
      if (updated) setSelectedNode(updated);
    }
  }, [nodes]);

  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find((n) => n.id === params.source);
    const color = NODE_META[sourceNode?.type]?.color || "#ffffff";
    setEdges((eds) => addEdge({ ...params, type: "animated", data: { animated: true }, style: { stroke: `${color}44`, strokeWidth: 1.5 } }, eds));
  }, [nodes, setEdges]);

  const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const addNodeToCanvas = (type) => {
    const id = `n${++idCounter}`;
    const defaultData = {
      startNode:     { startTitle: "New Start", metadata: [] },
      taskNode:      { title: "New Task", assignee: "", description: "", dueDate: "", customFields: [] },
      approvalNode:  { title: "New Approval", approverRole: "Manager", autoApproveThreshold: 0 },
      automatedNode: { title: "New Automation", actionId: "", actionLabel: "", actionParams: {} },
      endNode:       { endMessage: "Complete", summaryFlag: false },
    }[type];
    const newNode = { id, type, position: { x: 150 + Math.random() * 350, y: 120 + Math.random() * 320 }, data: defaultData };
    setNodes((ns) => [...ns, newNode]);
    setSelectedNode(newNode);
  };

  const exportWorkflow = () => {
    const blob = new Blob([JSON.stringify({ name: workflowName, nodes, edges }, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${workflowName.replace(/\s/g,"_")}.json` });
    a.click();
  };

  const stats = useMemo(() => ({
    tasks:  nodes.filter((n) => n.type === "taskNode").length,
    approvals: nodes.filter((n) => n.type === "approvalNode").length,
    autos: nodes.filter((n) => n.type === "automatedNode").length,
  }), [nodes]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#080910", overflow: "hidden", fontFamily: "'Syne', sans-serif" }}>
      {/* ── Global Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        input, select, textarea { color-scheme: dark; }
        input::placeholder, textarea::placeholder { color: #3E3F50; }
        .react-flow__edge-path { transition: stroke 0.2s; }
        .react-flow__controls { box-shadow: none !important; background: rgba(14,15,22,0.9) !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 10px !important; }
        .react-flow__controls-button { background: transparent !important; border: none !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; color: #5E6070 !important; }
        .react-flow__controls-button:hover { background: rgba(255,255,255,0.04) !important; color: #fff !important; }
        .react-flow__minimap { border-radius: 10px !important; border: 1px solid rgba(255,255,255,0.08) !important; }
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.5); } }
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div style={{ width: 240, background: "#0C0D14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", zIndex: 10 }}>
        {/* Logo / Brand */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#F0F0F5", letterSpacing: -0.5 }}>HR Flow</div>
          <div style={{ fontSize: 9, color: "#00E5A0", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>Workflow Designer</div>
        </div>

        {/* Stats strip */}
        <div style={{ display: "flex", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: 6 }}>
          {[["Tasks", stats.tasks, "#4E9EFF"], ["Approvals", stats.approvals, "#B57BFF"], ["Autos", stats.autos, "#FF8A3D"]].map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, background: `${c}0A`, border: `1px solid ${c}22`, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{v}</div>
              <div style={{ fontSize: 8, color: "#3E3F50", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Node Palette */}
        <div style={{ padding: "12px 16px 8px" }}>
          <div style={{ fontSize: 9, color: "#3E3F50", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>Add Node</div>
          {PALETTE_ORDER.map((type) => {
            const meta = NODE_META[type];
            return (
              <div key={type} onClick={() => addNodeToCanvas(type)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                border: "1px solid transparent", marginBottom: 4, transition: "all 0.15s", background: "rgba(255,255,255,0.02)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = meta.bg; e.currentTarget.style.borderColor = `${meta.color}44`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "transparent"; }}>
                <span style={{ fontSize: 14, color: meta.color, width: 20, textAlign: "center" }}>{meta.icon}</span>
                <div>
                  <div style={{ fontSize: 12, color: "#C0C0D0", fontWeight: 600 }}>{meta.label}</div>
                  <div style={{ fontSize: 9, color: "#3E3F50", fontFamily: "'JetBrains Mono', monospace" }}>{meta.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Config Panel (bottom half of sidebar) */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", flex: "0 0 auto", maxHeight: "45vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px 6px" }}>
            <div style={{ fontSize: 9, color: "#3E3F50", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>Node Config</div>
          </div>
          <NodeConfigPanel node={selectedNode} automations={automations} updateField={updateField} />
        </div>

        {/* Actions */}
        <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={openSandbox} style={{
            padding: "10px 0", borderRadius: 10, border: "1px solid rgba(0,229,160,0.3)",
            background: "rgba(0,229,160,0.07)", color: "#00E5A0", fontWeight: 700, fontSize: 11,
            cursor: "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: 1.5, textTransform: "uppercase",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,229,160,0.14)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,229,160,0.07)"; }}>
            ▶ Test Workflow
          </button>
          <button onClick={exportWorkflow} style={{
            padding: "8px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
            background: "transparent", color: "#5E6070", fontSize: 10, cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, transition: "color 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#C0C0D0"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#5E6070"}>
            ↓ Export JSON
          </button>
        </div>
      </div>

      {/* ── MAIN CANVAS AREA ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Top toolbar */}
        <div style={{ height: 48, background: "rgba(12,13,20,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 20px", gap: 16, backdropFilter: "blur(8px)", position: "relative", zIndex: 5 }}>
          {editingName ? (
            <input autoFocus value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
              style={{ ...css.input, width: 260, padding: "4px 10px", fontSize: 13, fontWeight: 600, fontFamily: "'Syne', sans-serif" }} />
          ) : (
            <div onClick={() => setEditingName(true)} style={{ fontSize: 13, fontWeight: 700, color: "#F0F0F5", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              onMouseEnter={(e) => e.currentTarget.querySelector("span").style.opacity = "1"}
              onMouseLeave={(e) => e.currentTarget.querySelector("span").style.opacity = "0"}>
              {workflowName}
              <span style={{ fontSize: 10, color: "#3E3F50", transition: "opacity 0.15s", opacity: 0 }}>✎ rename</span>
            </div>
          )}
          <div style={{ height: 20, width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ fontSize: 10, color: "#3E3F50", fontFamily: "'JetBrains Mono', monospace" }}>
            {nodes.length} nodes · {edges.length} edges
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 9, color: "#3E3F50", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
            DEL to remove · drag to connect
          </div>
        </div>

        {/* React Flow Canvas */}
        <div style={{ flex: 1, position: "relative" }}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            deleteKeyCode={["Backspace","Delete"]}
            fitView fitViewOptions={{ padding: 0.2 }}
            style={{ background: "transparent" }}
          >
            {/* Subtle dot grid */}
            <Background color="rgba(255,255,255,0.04)" gap={28} size={1} variant="dots" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => NODE_META[n.type]?.color || "#333"}
              maskColor="rgba(8,9,16,0.85)"
              style={{ background: "rgba(12,13,20,0.9)", bottom: 16, right: 16 }}
            />
          </ReactFlow>

          {/* Empty state hint */}
          {nodes.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ textAlign: "center", color: "#3E3F50" }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>◈</div>
                <div style={{ fontSize: 13, fontFamily: "'Syne', sans-serif" }}>Add nodes from the left panel</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulation Modal */}
      {simState.open && <SimulationPanel simState={simState} onClose={closeSandbox} onRun={runSimulation} />}
    </div>
  );
}