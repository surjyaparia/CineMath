# CineMath - 3D Math Plotter

A powerful interactive mathematical visualization tool that brings equations to life through 2D graphs, 3D surfaces, and parametric curves. Built with React, Three.js, and advanced mathematical parsing capabilities.

## Features

- **Multiple Visualization Types**:
  - 2D function graphs
  - 3D surface plots
  - Parametric curves
  - Euler/helix visualizations

- **Advanced Math Parser**:
  - Supports complex mathematical expressions
  - Automatic typo detection and correction
  - Real-time equation parsing and compilation

- **Interactive Insights**:
  - Mathematical analysis and insights
  - Function properties detection
  - Visual feedback for different equation types

## Tech Stack

- **Frontend**: React 19.0.0
- **3D Graphics**: Three.js with React Three Fiber
- **Mathematical Computing**: Math.js
- **Charts**: Chart.js with React Chart.js 2
- **Build Tool**: Vite
- **3D Helpers**: React Three Drei

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "3D Math ploter"
```

2. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

The production preview will be available at `http://localhost:4173`

## Usage

1. **Enter Mathematical Expressions**: Type any mathematical equation in the input box
2. **Automatic Detection**: The app automatically detects the equation type (2D, 3D, parametric, or Euler)
3. **Visualize**: View your equation rendered as an interactive graph or surface
4. **Explore Insights**: Get mathematical insights and analysis of your functions

### Supported Functions

- Basic operations: `+`, `-`, `*`, `/`, `^`
- Trigonometric: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
- Logarithmic: `log`, `ln`, `exp`
- Other: `sqrt`, `abs`, `ceil`, `floor`
- Complex numbers and Euler's formula: `e^(i*phi)`

### Example Equations

- **2D Function**: `sin(x) * cos(2*x)`
- **3D Surface**: `sin(x) * cos(y)`
- **Parametric Curve**: `[cos(t), sin(t), t]`
- **Euler's Formula**: `e^(i*phi) = cos(phi) + i*sin(phi)`

## Project Structure

```
src/
├── components/
│   ├── InputBox.jsx      # Equation input component
│   ├── Graph2D.jsx       # 2D graph visualization
│   ├── Graph3D.jsx       # 3D surface visualization
│   └── InsightPanel.jsx  # Mathematical insights display
├── utils/
│   ├── parser.js         # Equation parsing and compilation
│   └── insightEngine.js  # Mathematical analysis engine
├── App.jsx               # Main application component
├── main.jsx              # React entry point
└── style.css             # Application styles
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [React](https://reactjs.org/)
- 3D rendering powered by [Three.js](https://threejs.org/)
- Mathematical computations by [Math.js](https://mathjs.org/)
- Charts by [Chart.js](https://www.chartjs.org/)
