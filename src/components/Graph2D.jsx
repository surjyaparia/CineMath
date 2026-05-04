import { useMemo } from 'react'
import {
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(LinearScale, LineElement, PointElement, Tooltip, Legend, Filler)

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'nearest', intersect: false },
  plugins: {
    legend: { display: true, position: 'top' },
    tooltip: {
      callbacks: {
        label(ctx) {
          const { x, y } = ctx.parsed
          return ` (${Number(x).toFixed(3)}, ${Number(y).toFixed(3)})`
        },
      },
    },
  },
  scales: {
    x: {
      type: 'linear',
      title: { display: true, text: 'x' },
      grid: { color: 'rgba(128, 128, 128, 0.15)' },
    },
    y: {
      type: 'linear',
      title: { display: true, text: 'y' },
      grid: { color: 'rgba(128, 128, 128, 0.15)' },
    },
  },
}

export default function Graph2D({ series }) {
  const data = useMemo(() => {
    return {
      datasets: series.map((line, idx) => ({
        label: line.label || `line ${idx + 1}`,
        data: line.points.map((p) => ({ x: p.x, y: p.y })),
        borderColor: line.color ?? 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 6,
        tension: 0.15,
        fill: false,
      })),
    }
  }, [series])

  if (!series.length || !series.some((line) => line.points.length)) {
    return (
      <div className="graph-placeholder">
        <p>Plot an equation to see the graph.</p>
      </div>
    )
  }

  return (
    <div className="graph-wrap">
      <Line data={data} options={defaultOptions} />
    </div>
  )
}
