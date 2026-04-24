import WhatIfSimulator from './components/WhatIfSimulator'
import ShapWaterfall from "./components/ShapWaterfall";

function App() {
  return (
    <div>
      <header style={{
        backgroundColor: '#4285F4',
        padding: '1rem 1.5rem',
        color: 'white'
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
          Unbiased AI | Solution Challenge 2026
        </h1>
      </header>
      <main>
        <WhatIfSimulator />
        <ShapWaterfall />
      </main>
    </div>
  )
}

export default App