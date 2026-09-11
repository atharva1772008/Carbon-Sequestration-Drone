import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ── Carbon Sequestration Formula ─────────────────────────────────────────────
// Based on the IPCC/forestry standard allometric approach:
//   1. AGB (kg) = 0.25 × DBH^2.19          (generic allometric, DBH in cm)
//   2. Total Biomass = AGB × 1.25           (adds 25% for below-ground roots)
//   3. Carbon mass = Total Biomass × 0.5    (50% of biomass is carbon)
//   4. CO₂ stored (kg) = Carbon × 3.67     (mol. weight ratio CO₂/C = 44/12)
function calcCO2(dbhCm) {
  if (!dbhCm || dbhCm <= 0) return null
  const agb = 0.25 * Math.pow(dbhCm, 2.19)
  const totalBiomass = agb * 1.25
  const carbon = totalBiomass * 0.5
  const co2 = carbon * 3.67
  return parseFloat(co2.toFixed(2))
}

// ── localStorage helpers for per-row DBH values ──────────────────────────────
const LS_KEY = 'tree_dbh_map'
function loadDbhMap() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} }
  catch { return {} }
}
function saveDbhMap(map) {
  localStorage.setItem(LS_KEY, JSON.stringify(map))
}

// ── Image Modal ──────────────────────────────────────────────────────────────
function ImageModal({ imageUrl, treeId, onClose }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🌳 Tree {treeId}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <img src={imageUrl} alt={`Tree ${treeId}`} className="modal-img" />
        <div className="modal-footer">Click outside or press Esc to close</div>
      </div>
    </div>
  )
}

// ── Tree Table ───────────────────────────────────────────────────────────────
function TreeTable({ data, loading, error, dbhMap, onDbhChange }) {
  const [modalImage, setModalImage] = useState(null)

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const colSpan = 7

  if (loading) {
    return (
      <table><tbody>
        <tr className="state-row">
          <td colSpan={colSpan}>
            <span className="state-icon">⏳</span>
            <div className="state-text">Loading data…</div>
            <div className="state-sub">Fetching records from the database</div>
          </td>
        </tr>
      </tbody></table>
    )
  }

  if (error) {
    return (
      <table><tbody>
        <tr className="state-row">
          <td colSpan={colSpan}>
            <span className="state-icon">⚠️</span>
            <div className="state-text error-text">Could not connect to backend</div>
            <div className="state-sub">{error}</div>
          </td>
        </tr>
      </tbody></table>
    )
  }

  if (data.length === 0) {
    return (
      <table><tbody>
        <tr className="state-row">
          <td colSpan={colSpan}>
            <span className="state-icon">🌱</span>
            <div className="state-text">No records yet</div>
            <div className="state-sub">Waiting for the Raspberry Pi to send its first reading…</div>
          </td>
        </tr>
      </tbody></table>
    )
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Tree ID</th>
            <th>TOF Distance</th>
            <th>
              DBH
              <span className="th-hint"> (cm)</span>
            </th>
            <th>CO₂ Stored</th>
            <th>Image</th>
            <th>Recorded At</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            const dbh = dbhMap[row._id] ?? ''
            const co2 = calcCO2(parseFloat(dbh))
            return (
              <tr key={row._id}>
                <td className="col-index">{index + 1}</td>
                <td>
                  <span className="tree-id-badge">🌳 {row.treeId}</span>
                </td>
                <td>
                  <span className="tof-value">{row.tofMeasurement}</span>
                  <span className="tof-unit">cm</span>
                </td>
                <td>
                  <div className="dbh-input-wrapper">
                    <input
                      id={`dbh-${row._id}`}
                      type="number"
                      className="dbh-input"
                      placeholder="e.g. 25"
                      min="0"
                      step="0.1"
                      value={dbh}
                      onChange={(e) => onDbhChange(row._id, e.target.value)}
                      aria-label={`Diameter at Breast Height for tree ${row.treeId}`}
                    />
                  </div>
                </td>
                <td>
                  {co2 !== null ? (
                    <div className="co2-cell">
                      <span className="co2-value">{co2.toLocaleString()}</span>
                      <span className="co2-unit"> kg</span>
                    </div>
                  ) : (
                    <span className="co2-empty">—</span>
                  )}
                </td>
                <td>
                  {row.imageUrl ? (
                    <div
                      className="thumb-wrapper"
                      onClick={() => setModalImage(row)}
                      title="Click to enlarge"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setModalImage(row)}
                    >
                      <img src={row.imageUrl} alt={`Tree ${row.treeId}`} loading="lazy" />
                    </div>
                  ) : (
                    <div className="thumb-wrapper" title="No image uploaded">
                      <span className="no-image">🚫</span>
                    </div>
                  )}
                </td>
                <td>
                  <span className="timestamp">{formatDate(row.createdAt)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {modalImage && (
        <ImageModal
          imageUrl={modalImage.imageUrl}
          treeId={modalImage.treeId}
          onClose={() => setModalImage(null)}
        />
      )}
    </>
  )
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [dbhMap, setDbhMap]     = useState(loadDbhMap)

  const fetchData = useCallback(async () => {
    setSpinning(true)
    try {
      const res = await fetch(`${API_URL}/api/tree/data`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const json = await res.json()
      setData(json.data || [])
      setError(null)
      setLastSync(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setTimeout(() => setSpinning(false), 600)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleDbhChange = useCallback((id, value) => {
    setDbhMap((prev) => {
      const next = { ...prev, [id]: value }
      saveDbhMap(next)
      return next
    })
  }, [])

  // Stats
  const uniqueTrees = new Set(data.map((d) => d.treeId)).size
  const avgTof = data.length
    ? (data.reduce((s, d) => s + d.tofMeasurement, 0) / data.length).toFixed(1)
    : '—'
  const withImages = data.filter((d) => d.imageUrl).length

  // Total CO₂ across all rows with a DBH entered
  const totalCO2 = data.reduce((sum, row) => {
    const dbh = parseFloat(dbhMap[row._id] ?? '')
    const co2 = calcCO2(dbh)
    return sum + (co2 ?? 0)
  }, 0)
  const totalCO2Display = totalCO2 > 0 ? totalCO2.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-icon-wrap">🌳</div>
          <div>
            <h1 className="app-title">Tree Monitor</h1>
            <div className="app-subtitle">Real-time Raspberry Pi Sensor Dashboard</div>
          </div>
        </div>
        <div className="status-badge">
          <span className={`status-dot ${error ? 'error' : ''}`} />
          {error ? 'Disconnected' : 'Live — updates every 10s'}
        </div>
      </header>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div className="stat-label">Total Records</div>
          <div className="stat-value">{data.length}</div>
          <div className="stat-sub">readings stored</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🌲</span>
          <div className="stat-label">Unique Trees</div>
          <div className="stat-value">{uniqueTrees}</div>
          <div className="stat-sub">distinct IDs</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📡</span>
          <div className="stat-label">Avg TOF Distance</div>
          <div className="stat-value">{avgTof}</div>
          <div className="stat-sub">centimetres</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📷</span>
          <div className="stat-label">With Images</div>
          <div className="stat-value">{withImages}</div>
          <div className="stat-sub">photos captured</div>
        </div>
        <div className="stat-card stat-card--co2">
          <span className="stat-icon">🌍</span>
          <div className="stat-label">Total CO₂ Stored</div>
          <div className="stat-value co2-stat">{totalCO2Display}</div>
          <div className="stat-sub">kg carbon dioxide</div>
        </div>
      </div>

      {/* Formula Card */}
      <div className="formula-card">
        <div className="formula-card-header">
          <span className="formula-card-icon">🌍</span>
          <div>
            <div className="formula-card-title">Carbon Sequestration Calculator</div>
            <div className="formula-card-sub">IPCC generic allometric method — enter DBH per row to compute stored CO₂</div>
          </div>
        </div>
        <div className="formula-steps">
          <div className="formula-step">
            <div className="formula-step-top">
              <div className="formula-step-num">1</div>
              <div className="formula-step-label">Above-Ground Biomass</div>
            </div>
            <div className="formula-step-eq">AGB = 0.25 × DBH<sup>2.19</sup></div>
            <div className="formula-step-hint">DBH in cm → result in kg</div>
          </div>
          <div className="formula-connector">→</div>
          <div className="formula-step">
            <div className="formula-step-top">
              <div className="formula-step-num">2</div>
              <div className="formula-step-label">Total Biomass</div>
            </div>
            <div className="formula-step-eq">TB = AGB × 1.25</div>
            <div className="formula-step-hint">+25% for root biomass</div>
          </div>
          <div className="formula-connector">→</div>
          <div className="formula-step">
            <div className="formula-step-top">
              <div className="formula-step-num">3</div>
              <div className="formula-step-label">Carbon Mass</div>
            </div>
            <div className="formula-step-eq">C = TB × 0.5</div>
            <div className="formula-step-hint">50% of biomass is carbon</div>
          </div>
          <div className="formula-connector">→</div>
          <div className="formula-step">
            <div className="formula-step-top">
              <div className="formula-step-num">4</div>
              <div className="formula-step-label">CO₂ Equivalent</div>
            </div>
            <div className="formula-step-eq">CO₂ = C × 3.67</div>
            <div className="formula-step-hint">44/12 molecular weight ratio</div>
          </div>
          <div className="formula-connector">→</div>
          <div className="formula-result">
            <span className="formula-result-icon">🌿</span>
            <span className="formula-result-label">kg CO₂<br/>stored</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <div className="table-title">Sensor Readings</div>
            {lastSync && (
              <div className="table-meta">
                Last updated: {lastSync.toLocaleTimeString()}
              </div>
            )}
          </div>
          <button
            className="refresh-btn"
            onClick={fetchData}
            disabled={spinning}
            id="refresh-button"
          >
            <span className={`refresh-icon ${spinning ? 'spinning' : ''}`}>↻</span>
            Refresh
          </button>
        </div>

        <div className="table-wrapper">
          <TreeTable
            data={data}
            loading={loading}
            error={error}
            dbhMap={dbhMap}
            onDbhChange={handleDbhChange}
          />
        </div>
      </div>

      <footer className="app-footer">
        Tree Monitor • Refreshes every 10s • CO₂ estimates use generic allometric equations (IPCC methodology)
      </footer>
    </div>
  )
}
