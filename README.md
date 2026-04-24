# 🚀 HR Workflow Designer

### Tredence Studio — Full Stack Engineering Intern Case Study

This project is a **visual workflow builder** designed to create, configure, and simulate **HR workflows**.  
It allows users to design workflows using nodes, connect them visually, and test execution through simulation.

---

## ■ 🌐 Live Demo
■ [Click here to run live](https://stackblitz.com/~/github.com/Divya-Vijay02/-hr-workflow-designer?file=src/App.jsx)

---

## ■ 📦 Repository
■ [View Source Code](https://github.com/Divya-Vijay02/-hr-workflow-designer/tree/main)

---

## 🚀 Features

- 🧱 Create workflows using **drag-and-drop nodes**
- 🔗 Connect workflow steps visually using edges
- ⚙️ Configure each node dynamically (Task, Approval, Automation)
- ▶️ Run simulation to validate workflow logic
- 📊 Step-by-step execution visualization
- 💾 Export and import workflow as JSON
- 🎯 Visual feedback for errors and execution

---

## 🧩 Node Types

- 🟢 **Start Node**
  - Entry point of workflow
  - No incoming connections

- 📋 **Task Node**
  - Assign tasks to users
  - Includes due date and metadata

- ✅ **Approval Node**
  - Requires approval from a role/user
  - Supports auto-approval conditions

- ⚙️ **Action Node (Automated)**
  - Executes automated actions
  - Dynamic fields based on API

- 🔴 **End Node**
  - Marks workflow completion
  - Can include summary output

---

## 🔁 Simulation

- ✔️ Validates workflow structure:
  - Missing Start/End nodes
  - Disconnected nodes
  - Cycles (loops)

- 🔄 Executes workflow in correct order
- ✨ Highlights active nodes during execution
- 📍 Displays execution trace step-by-step

---

## 🧠 How It Works

- Uses **graph-based logic** to process workflows
- Implements **topological sorting (Kahn’s Algorithm)** for execution order
- Uses **React state + hooks** for managing workflow and simulation
- Dynamic forms render based on node type and API data

---

## 🛠 Tech Stack

- ⚛️ React 18  
- ⚡ Vite  
- 🔀 React Flow (for node-based UI)  
- 🧠 Custom Hooks (state management)  
- 🧪 Mock API (in-memory simulation)

---

## ▶️ Run Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev
