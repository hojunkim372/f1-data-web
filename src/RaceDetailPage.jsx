// src/RaceDetailPage.jsx
import { useEffect, useState } from "react";
import "./RaceDetail.css";

const API = "http://localhost:4000/api";

export default function RaceDetailPage({ race, onBack }) {
  const [doc, setDoc] = useState(race); 
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    
    async function load() {
      if (!race?._id) return;
      setLoading(true);
      try {
        const r = await fetch(`${API}/races/${race._id}`);
        const j = await r.json();
        setDoc(j);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [race?._id]);

  if (!doc) return null;

  
  const results = Array.isArray(doc.results) ? doc.results : [];
  const podium = results
    .filter(r => r.position != null)
    .sort((a,b) => a.position - b.position)
    .slice(0,3);

  return (
    <div className="race-detail">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <h1 className="title">
        {doc.season} {doc.name}
      </h1>
      <p className="meta">
        {doc.date?.slice?.(0,10)} · {doc.circuit} · {doc.location}
      </p>

      {/* Podium */}
      <section className="podium">
        <h2 className="section-title">Podium</h2>
        <div className="podium-row">
          {podium.map(p => (
            <div key={p.driver.code} className={`podium-card pos-${p.position}`}>
              <div className="pos">#{p.position}</div>
              <div className="name">
                <span className="code">{p.driver.code}</span>{" "}
                {p.driver.name}
              </div>
              <div className="team">{p.driver.team}</div>
              {p.time && <div className="time">{p.time}</div>}
              {!p.time && p.status && <div className="status">{p.status}</div>}
            </div>
          ))}
          {podium.length === 0 && <div className="empty">No podium data</div>}
        </div>
      </section>

   
      <section className="results">
        <h2 className="section-title">Race results</h2>

        {loading && <div className="loading">Loading…</div>}

        {!loading && results.length > 0 && (
          <div className="table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th>Grid</th>
                  <th>Laps</th>
                  <th>Time / Status</th>
                  <th>Pts</th>
                  <th>FL</th>
                </tr>
              </thead>
              <tbody>
                {results
                  .slice()
                  .sort((a,b) => (a.position ?? 9999) - (b.position ?? 9999))
                  .map((r, i) => (
                  <tr key={i}>
                    <td className="pos-cell">{r.position ?? "-"}</td>
                    <td>
                      <div className="driver">
                        <span className="code">{r.driver?.code}</span>{" "}
                        <span className="name">{r.driver?.name}</span>
                      </div>
                    </td>
                    <td className="team-cell">{r.driver?.team}</td>
                    <td>{r.grid ?? "-"}</td>
                    <td>{r.laps ?? "-"}</td>
                    <td>
                      {r.time
                        ? r.time
                        : (r.status || "-")}
                    </td>
                    <td>{r.points ?? 0}</td>
                    <td>
                      {r.fastestLap?.lap
                        ? `L${r.fastestLap.lap} ${r.fastestLap.time ?? ""}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="empty">No results</div>
        )}
      </section>
    </div>
  );
}
