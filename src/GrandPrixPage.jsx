import { useEffect, useState } from "react";
import "./GrandPrix.css";

const API = "http://localhost:4000/api";


function slugify(name = "") {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}


function buildStandings(races) {
  const dMap = new Map();
  const cMap = new Map();
  for (const race of races) {
    const results = Array.isArray(race.results) ? race.results : [];
    for (const r of results) {
      const pts = Number(r.points) || 0;
      const code = r?.driver?.code || r?.driver?.name || "";
      const name = r?.driver?.name || "";
      const team = r?.driver?.team || "";

      if (code || name) {
        const cur = dMap.get(code || name) || { code, name, team, points: 0, wins: 0 };
        cur.points += pts;
        if (r.position === 1) cur.wins += 1;
        if (team) cur.team = team;
        dMap.set(code || name, cur);
      }
      if (team) {
        const curT = cMap.get(team) || { team, points: 0, wins: 0 };
        curT.points += pts;
        if (r.position === 1) curT.wins += 1;
        cMap.set(team, curT);
      }
    }
  }
  const drivers = [...dMap.values()].sort(
    (a, b) => (b.points - a.points) || (b.wins - a.wins) || a.name.localeCompare(b.name)
  );
  const teams = [...cMap.values()].sort(
    (a, b) => (b.points - a.points) || (b.wins - a.wins) || a.team.localeCompare(b.team)
  );
  return { drivers, teams };
}

export default function GrandPrixPage({ season, onBack, onSelectGrandPrix }) {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverStandings, setDriverStandings] = useState([]);
  const [constructorStandings, setConstructorStandings] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`${API}/races?season=${season}`);
        const j = await r.json();
        setRaces(j || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [season]);

  useEffect(() => {
    const { drivers, teams } = buildStandings(races);
    setDriverStandings(drivers);
    setConstructorStandings(teams);
  }, [races]);

  const dMax = Math.max(1, ...driverStandings.map(s => s.points ?? 0));
  const cMax = Math.max(1, ...constructorStandings.map(s => s.points ?? 0));

  return (
    <div className="gp-page">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 className="gp-title">{season} Season</h1>

      
      {loading ? (
        <div className="loading">Loading…</div>
      ) : races.length === 0 ? (
        <div className="empty">No races for this season.</div>
      ) : (
        <div className="gp-grid">
          {races.map(r => {
            const slug = slugify(r.name);
            return (
              <button
                key={r._id}
                className="gp-card"
                onClick={() => onSelectGrandPrix(r)}
                title={`${r.name} (${r.date?.slice?.(0,10)})`}
              >
                <img
                  className="gp-thumb"
                  src={`/circuits/${slug}.jpg`}
                  alt={r.name}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <div className="gp-meta">
                  <div className="gp-name">{r.round}. {r.name}</div>
                  <div className="gp-date">{r.date?.slice?.(0,10)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

     
      <div className="standings">
        <div className="standings-col">
          <h2 className="section-title">Drivers' Championship</h2>
          {driverStandings.length ? (
            <ul className="chart list">
              {driverStandings.map((s, idx) => (
                <li className="bar-row" key={s.code || s.name || idx}>
                  <div className="label">
                    <span className="rank">{idx + 1}</span>
                    <span className="name">
                      <b className="code">{s.code}</b> {s.name}
                    </span>
                  </div>
                  <div className="bar">
                    <div className="fill" style={{ width: `${(100 * (s.points ?? 0)) / dMax}%` }} />
                    <div className="value">{s.points ?? 0}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">Add race results to see standings.</div>
          )}
        </div>

        <div className="standings-col">
          <h2 className="section-title">Constructors' Championship</h2>
          {constructorStandings.length ? (
            <ul className="chart list">
              {constructorStandings.map((s, idx) => (
                <li className="bar-row" key={s.team || idx}>
                  <div className="label">
                    <span className="rank">{idx + 1}</span>
                    <span className="name">{s.team}</span>
                  </div>
                  <div className="bar">
                    <div className="fill team" style={{ width: `${(100 * (s.points ?? 0)) / cMax}%` }} />
                    <div className="value">{s.points ?? 0}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">Add race results to see standings.</div>
          )}
        </div>
      </div>
    </div>
  );
}
