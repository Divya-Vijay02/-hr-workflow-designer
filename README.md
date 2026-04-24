###🚀HR Workflow Designer
###Tredence Studio — Full Stack Engineering Intern Case Study
Author: Divya | VIT University Vellore
Stack: React 18 · React Flow · Vite · Mock API

## ■ Live Demo
■ [Click here to run live](https://stackblitz.com/~/github.com/Divya-Vijay02/-hr-workflow-designer?file=src/App.jsx)
## ■ Repository
■ [View Source Code](https://github.com/Divya-Vijay02/-hr-workflow-designer/tree/main)

##🧠Project Overview
The HR Workflow Designer is an interactive visual tool that allows users to design, configure, and simulate HR workflows using a node-based interface.
It supports
- Workflow creation using drag-and-drop nodes
- Dynamic form configuration for each node
- Simulation with execution tracing
- Graph validation using advanced algorithms

##🛠️ Tech Stack
⚛️ React 18
🔀 React Flow
⚡ Vite
🧪 Mock API 

##▶️ How to Run the Project
1. Create project using Vite
npm create vite@latest hr-workflow-designer -- --template react

2. Navigate into project
cd hr-workflow-designer

3. Install dependencies
npm install reactflow

4. Replace App.jsx with HRWorkflowDesigner.jsx

5. Start development server
npm run dev
Open 👉 http://localhost:5173

##📂 Project Architecture
src/
├── App.jsx                  # Root component (layout + orchestration)

├── constants/
│   └── nodeMeta.js          # Node metadata (colors, icons, labels)

├── api/
│   └── mockAPI.js           # Simulated backend API

├── hooks/
│   ├── useAutomations.js    # Fetch automation actions
│   ├── useNodeForm.js       # Manage node form state
│   └── useSimulation.js     # Simulation logic + execution trace

├── nodes/
│   ├── WorkflowNode.jsx     # Reusable node component
│   └── AnimatedEdge.jsx     # Custom animated edges

├── forms/
│   ├── StartNodeForm.jsx
│   ├── TaskNodeForm.jsx
│   ├── ApprovalNodeForm.jsx
│   ├── AutomatedNodeForm.jsx
│   └── EndNodeForm.jsx

├── panels/
│   ├── NodeConfigPanel.jsx  # Right-side config panel
│   └── SimulationPanel.jsx  # Simulation UI

└── primitives/
    ├── StyledInput.jsx
    ├── StyledSelect.jsx
    ├── StyledTextarea.jsx
    ├── Toggle.jsx
    ├── KVPairEditor.jsx
    └── FormField.jsx
