import { useState } from "react";
import Home from "./Home";
import GrandPrixPage from "./GrandPrixPage";
import RaceDetailPage from "./RaceDetailPage";
import "./App.css";

export default function App() {
  const [page, setPage] = useState("home"); // 'home' | 'gp' | 'race'
  const [season, setSeason] = useState(null);
  const [selectedRace, setSelectedRace] = useState(null);

  if (page === "home") {
    return <Home onSelect={(y) => { setSeason(y); setPage("gp"); }} />;
  }
  if (page === "gp") {
    return (
      <GrandPrixPage
        season={season}
        onBack={() => setPage("home")}
        onSelectGrandPrix={(race) => { setSelectedRace(race); setPage("race"); }}
      />
    );
  }
  return (
    <RaceDetailPage
      race={selectedRace}
      onBack={() => setPage("gp")}
    />
  );
}

