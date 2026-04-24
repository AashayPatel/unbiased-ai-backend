import WhatIfSimulator from './components/WhatIfSimulator'
import ShapWaterfall from "./components/ShapWaterfall";
function App() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <header style={{ backgroundColor: '#4285F4', padding: '1rem', color: 'white' }}>
        <h1>Unbiased AI | Solution Challenge 2026</h1>
      </header>
      <main>
        <WhatIfSimulator />
        <ShapWaterfall />
      </main>
    </div>
  )
}

export default App